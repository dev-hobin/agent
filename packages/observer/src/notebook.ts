import { randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	readFile,
	readdir,
	realpath,
	stat,
} from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { atomicCreateTextFile, atomicReplaceTextFile } from "./atomic-file.ts";
import type {
	MarkdownInput,
	ObserverDiagnostic,
} from "./markdown-profile.ts";
import type { EpisodeLanguage } from "./lifecycle.ts";
import { validateObserverNotebook } from "./notebook-validation.ts";

export const OBSERVER_NOTEBOOK_SCHEMA: "observer-notebook/v1" =
	"observer-notebook/v1";
export const OBSERVER_MANIFEST_DIRECTORY = ".observer";
export const OBSERVER_MANIFEST_FILENAME = "notebook.json";
export const OBSERVER_RECORDS_DIRECTORY = "records";

const NOTEBOOK_ID_PATTERN =
	/^notebook-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type NotebookId = `notebook-${string}`;

export interface NotebookManifest {
	readonly observer_notebook: typeof OBSERVER_NOTEBOOK_SCHEMA;
	readonly notebook_id: NotebookId;
	readonly default_language: EpisodeLanguage;
}

export interface NotebookHandle {
	readonly root: string;
	readonly recordsDir: string;
	readonly manifestPath: string;
	readonly manifest: NotebookManifest;
	readonly recordCount: number;
}

export type NotebookIssueCode =
	| "notebook.io"
	| "notebook.language-conflict"
	| "notebook.language-invalid"
	| "notebook.layout-invalid"
	| "notebook.manifest-invalid"
	| "notebook.manifest-missing"
	| "notebook.manifest-unsupported"
	| "notebook.path-absolute-required"
	| "notebook.path-missing"
	| "notebook.path-not-directory"
	| "notebook.records-invalid";

export interface NotebookIssue {
	readonly code: NotebookIssueCode;
	readonly message: string;
	readonly path: string;
	readonly diagnostics?: readonly ObserverDiagnostic[];
}

export type NotebookResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: NotebookIssue };

interface NotebookFailure {
	readonly failure: "observer-notebook";
	readonly issue: NotebookIssue;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
	value: Readonly<Record<string, unknown>>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => expected.includes(key))
	);
}

export function decodeNotebookId(value: unknown): NotebookId | null {
	if (typeof value !== "string" || !NOTEBOOK_ID_PATTERN.test(value)) {
		return null;
	}
	return `notebook-${value.slice("notebook-".length)}`;
}

function issue(
	code: NotebookIssueCode,
	path: string,
	message: string,
	diagnostics?: readonly ObserverDiagnostic[],
): NotebookIssue {
	return diagnostics
		? { code, path, message, diagnostics }
		: { code, path, message };
}

function throwNotebookIssue(value: NotebookIssue): never {
	const failure: NotebookFailure = {
		failure: "observer-notebook",
		issue: value,
	};
	throw failure;
}

function isNotebookFailure(value: unknown): value is NotebookFailure {
	return (
		isObject(value) &&
		value.failure === "observer-notebook" &&
		isObject(value.issue) &&
		typeof value.issue.code === "string" &&
		typeof value.issue.message === "string" &&
		typeof value.issue.path === "string"
	);
}

function fail(
	code: NotebookIssueCode,
	path: string,
	message: string,
	options?: ErrorOptions,
): never {
	const cause = options?.cause;
	const detail = cause instanceof Error ? ` ${cause.message}` : "";
	return throwNotebookIssue(issue(code, path, `${message}${detail}`));
}

function errorCode(value: unknown): string | undefined {
	if (!isObject(value) || typeof value.code !== "string") return undefined;
	return value.code;
}

function isMissingError(value: unknown): boolean {
	return errorCode(value) === "ENOENT";
}

function isEpisodeLanguage(value: unknown): value is EpisodeLanguage {
	return value === "ko" || value === "en";
}

function requireAbsolute(path: string): void {
	if (!isAbsolute(path)) {
		fail(
			"notebook.path-absolute-required",
			path,
			"Observer notebook path must be absolute.",
		);
	}
}

export function decodeNotebookManifest(
	value: unknown,
	path = "<notebook-manifest>",
): NotebookResult<NotebookManifest> {
	if (!isObject(value)) {
		return {
			ok: false,
			issue: issue(
				"notebook.manifest-invalid",
				path,
				"Observer notebook manifest must be an object.",
			),
		};
	}
	if (value.observer_notebook !== OBSERVER_NOTEBOOK_SCHEMA) {
		const code =
			typeof value.observer_notebook === "string"
				? "notebook.manifest-unsupported"
				: "notebook.manifest-invalid";
		return {
			ok: false,
			issue: issue(
				code,
				path,
				"Observer notebook manifest has an unsupported schema.",
			),
		};
	}
	const id = decodeNotebookId(value.notebook_id);
	if (
		!hasExactKeys(value, [
			"observer_notebook",
			"notebook_id",
			"default_language",
		]) ||
		!id ||
		(value.default_language !== "ko" && value.default_language !== "en")
	) {
		return {
			ok: false,
			issue: issue(
				"notebook.manifest-invalid",
				path,
				"Observer notebook manifest has an invalid v1 shape.",
			),
		};
	}
	return {
		ok: true,
		value: {
			observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
			notebook_id: id,
			default_language: value.default_language,
		},
	};
}

function serializeManifest(manifest: NotebookManifest): string {
	return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseManifest(source: string, path: string): NotebookManifest {
	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch (error) {
		fail(
			"notebook.manifest-invalid",
			path,
			"Observer notebook manifest is not valid JSON.",
			{ cause: error },
		);
	}
	const decoded = decodeNotebookManifest(value, path);
	if (!decoded.ok) throwNotebookIssue(decoded.issue);
	return decoded.value;
}

async function canonicalDirectory(root: string): Promise<string> {
	requireAbsolute(root);
	let metadata;
	try {
		metadata = await stat(root);
	} catch (error) {
		if (isMissingError(error)) {
			fail("notebook.path-missing", root, "Observer notebook path is missing.");
		}
		fail("notebook.io", root, "Failed to inspect Observer notebook path.", {
			cause: error,
		});
	}
	if (!metadata.isDirectory()) {
		fail(
			"notebook.path-not-directory",
			root,
			"Observer notebook path must be a directory.",
		);
	}
	try {
		return await realpath(root);
	} catch (error) {
		fail("notebook.io", root, "Failed to resolve Observer notebook path.", {
			cause: error,
		});
	}
}

async function requireOwnedDirectory(path: string): Promise<void> {
	let metadata;
	try {
		metadata = await lstat(path);
	} catch (error) {
		if (isMissingError(error)) {
			fail(
				"notebook.layout-invalid",
				path,
				"Observer notebook directory is missing.",
			);
		}
		fail("notebook.io", path, "Failed to inspect notebook directory.", {
			cause: error,
		});
	}
	if (!metadata.isDirectory()) {
		fail(
			"notebook.layout-invalid",
			path,
			"Observer notebook entry must be a real directory.",
		);
	}
}

async function requireManifestFile(path: string): Promise<void> {
	let metadata;
	try {
		metadata = await lstat(path);
	} catch (error) {
		if (isMissingError(error)) {
			fail(
				"notebook.manifest-missing",
				path,
				"Observer notebook manifest is missing.",
			);
		}
		fail("notebook.io", path, "Failed to inspect notebook manifest.", {
			cause: error,
		});
	}
	if (!metadata.isFile()) {
		fail(
			"notebook.manifest-invalid",
			path,
			"Observer notebook manifest must be a regular file.",
		);
	}
}

async function readRecordInputs(recordsDir: string): Promise<MarkdownInput[]> {
	let entries;
	try {
		entries = await readdir(recordsDir, { withFileTypes: true });
	} catch (error) {
		fail("notebook.io", recordsDir, "Failed to list Observer records.", {
			cause: error,
		});
	}
	const sorted = [...entries].sort((left, right) =>
		left.name.localeCompare(right.name),
	);
	const inputs: MarkdownInput[] = [];
	for (const entry of sorted) {
		const path = join(recordsDir, entry.name);
		if (!entry.isFile() || !entry.name.endsWith(".md")) {
			fail(
				"notebook.layout-invalid",
				path,
				"Observer records must be direct regular Markdown files.",
			);
		}
		try {
			inputs.push({ path, content: await readFile(path, "utf8") });
		} catch (error) {
			fail("notebook.io", path, "Failed to read Observer record.", {
				cause: error,
			});
		}
	}
	return inputs;
}

async function validatedRecordCount(recordsDir: string): Promise<number> {
	const validation = validateObserverNotebook(await readRecordInputs(recordsDir));
	if (!validation.ok) {
		throwNotebookIssue(
			issue(
				"notebook.records-invalid",
				recordsDir,
				"Observer notebook records failed validation.",
				validation.diagnostics,
			),
		);
	}
	return validation.records.length;
}

async function openNotebookOrThrow(root: string): Promise<NotebookHandle> {
	const canonicalRoot = await canonicalDirectory(root);
	const observerDir = join(canonicalRoot, OBSERVER_MANIFEST_DIRECTORY);
	const recordsDir = join(canonicalRoot, OBSERVER_RECORDS_DIRECTORY);
	const manifestPath = join(observerDir, OBSERVER_MANIFEST_FILENAME);
	await requireOwnedDirectory(observerDir);
	await requireOwnedDirectory(recordsDir);
	await requireManifestFile(manifestPath);
	let source: string;
	try {
		source = await readFile(manifestPath, "utf8");
	} catch (error) {
		fail("notebook.io", manifestPath, "Failed to read notebook manifest.", {
			cause: error,
		});
	}
	const manifest = parseManifest(source, manifestPath);
	const recordCount = await validatedRecordCount(recordsDir);
	return {
		root: canonicalRoot,
		recordsDir,
		manifestPath,
		manifest,
		recordCount,
	};
}

function operationFailure<Value>(
	error: unknown,
	path: string,
	message: string,
): NotebookResult<Value> {
	if (isNotebookFailure(error)) {
		return { ok: false, issue: error.issue };
	}
	return {
		ok: false,
		issue: issue("notebook.io", path, message),
	};
}

export async function openNotebook(
	root: string,
): Promise<NotebookResult<NotebookHandle>> {
	try {
		return { ok: true, value: await openNotebookOrThrow(root) };
	} catch (error) {
		return operationFailure(error, root, "Failed to open Observer notebook.");
	}
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (isMissingError(error)) return false;
		fail("notebook.io", path, "Failed to inspect notebook path.", {
			cause: error,
		});
	}
}

async function initializeNotebookOrThrow(
	root: string,
	defaultLanguage: EpisodeLanguage,
): Promise<NotebookHandle> {
	requireAbsolute(root);
	if (!isEpisodeLanguage(defaultLanguage)) {
		fail(
			"notebook.language-invalid",
			root,
			"Observer notebook language must be ko or en.",
		);
	}
	if (await pathExists(root)) {
		await canonicalDirectory(root);
	} else {
		try {
			await mkdir(root, { recursive: true });
		} catch (error) {
			fail("notebook.io", root, "Failed to create Observer notebook path.", {
				cause: error,
			});
		}
	}
	const canonicalRoot = await canonicalDirectory(root);
	const observerDir = join(canonicalRoot, OBSERVER_MANIFEST_DIRECTORY);
	const recordsDir = join(canonicalRoot, OBSERVER_RECORDS_DIRECTORY);
	try {
		await mkdir(observerDir, { recursive: true });
	} catch (error) {
		fail("notebook.io", observerDir, "Failed to create manifest directory.", {
			cause: error,
		});
	}
	await requireOwnedDirectory(observerDir);
	const manifestPath = join(observerDir, OBSERVER_MANIFEST_FILENAME);
	if (await pathExists(manifestPath)) {
		await requireManifestFile(manifestPath);
		const source = await readFile(manifestPath, "utf8");
		const manifest = parseManifest(source, manifestPath);
		if (manifest.default_language !== defaultLanguage) {
			fail(
				"notebook.language-conflict",
				manifestPath,
				"Existing notebook language differs from setup request.",
			);
		}
		return openNotebookOrThrow(canonicalRoot);
	}
	try {
		await mkdir(recordsDir, { recursive: true });
	} catch (error) {
		fail("notebook.io", recordsDir, "Failed to create records directory.", {
			cause: error,
		});
	}
	await requireOwnedDirectory(recordsDir);
	await validatedRecordCount(recordsDir);
	const manifest: NotebookManifest = {
		observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
		notebook_id: `notebook-${randomUUID()}`,
		default_language: defaultLanguage,
	};
	try {
		await atomicCreateTextFile(manifestPath, serializeManifest(manifest));
	} catch (error) {
		fail("notebook.io", manifestPath, "Failed to create notebook manifest.", {
			cause: error,
		});
	}
	return openNotebookOrThrow(canonicalRoot);
}

export async function initializeNotebook(
	root: string,
	defaultLanguage: EpisodeLanguage,
): Promise<NotebookResult<NotebookHandle>> {
	try {
		return {
			ok: true,
			value: await initializeNotebookOrThrow(root, defaultLanguage),
		};
	} catch (error) {
		return operationFailure(error, root, "Failed to initialize Observer notebook.");
	}
}

export async function replaceNotebookDefaultLanguage(
	notebook: NotebookHandle,
	language: EpisodeLanguage,
): Promise<NotebookResult<NotebookHandle>> {
	if (!isEpisodeLanguage(language)) {
		return {
			ok: false,
			issue: issue(
				"notebook.language-invalid",
				notebook.manifestPath,
				"Observer notebook language must be ko or en.",
			),
		};
	}
	const manifest: NotebookManifest = {
		...notebook.manifest,
		default_language: language,
	};
	try {
		await atomicReplaceTextFile(
			notebook.manifestPath,
			serializeManifest(manifest),
		);
		return { ok: true, value: await openNotebookOrThrow(notebook.root) };
	} catch (error) {
		return operationFailure(
			error,
			notebook.manifestPath,
			"Failed to update notebook language.",
		);
	}
}
