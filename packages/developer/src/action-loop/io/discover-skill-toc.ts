import { constants, type BigIntStats, type Dirent } from "node:fs";
import {
	open,
	readdir,
	realpath,
	stat,
	type FileHandle,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import {
	MAX_TOC_BYTES,
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
	type ParsedToc,
	type TocParseError,
} from "../routing/parse-toc.ts";

export const MAX_TOC_DISCOVERY_JSON_FILES = 32;
export const MAX_TOC_DISCOVERY_BYTES = 256 * 1024;

const DEFAULT_TOC_DESCRIPTOR_NAME = "toc.json";
const TOC_SCHEMA_FAMILY_PREFIX =
	"https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v";
const TOC_SCHEMA_FAMILY_SUFFIX = ".schema.json";

export interface DiscoveredTocDescriptor {
	readonly name: string;
	readonly locator: string;
	readonly byteLength: number;
	readonly toc: ParsedToc;
}

export type TocDiscoveryErrorCode =
	| "invalid-root"
	| "root-unreadable"
	| "too-many-json-files"
	| "descriptor-too-large"
	| "discovery-too-large"
	| "descriptor-not-regular"
	| "descriptor-unreadable"
	| "descriptor-changed"
	| "unsupported-version"
	| "ambiguous-descriptor"
	| "invalid-descriptor";

export interface TocDiscoveryError {
	readonly code: TocDiscoveryErrorCode;
	readonly path: string;
	readonly message: string;
	readonly descriptorNames?: readonly string[];
	readonly schemaUri?: string;
	readonly parseError?: TocParseError;
}

export type TocDiscoveryResult =
	| { readonly status: "unstructured" }
	| {
			readonly status: "structured";
			readonly descriptor: DiscoveredTocDescriptor;
	  }
	| { readonly status: "failed"; readonly error: TocDiscoveryError };

interface SkillRoot {
	readonly physical: string;
}

interface AcquiredJsonFile {
	readonly name: string;
	readonly locator: string;
	readonly byteLength: number;
	readonly bytes: Uint8Array;
	readonly schemaUri?: string;
}

type RootResult =
	| { readonly ok: true; readonly value: SkillRoot }
	| { readonly ok: false; readonly error: TocDiscoveryError };

type AcquisitionResult =
	| { readonly ok: true; readonly value: AcquiredJsonFile }
	| { readonly ok: false; readonly error: TocDiscoveryError };

function failure(
	code: TocDiscoveryErrorCode,
	path: string,
	message: string,
	details: Pick<
		TocDiscoveryError,
		"descriptorNames" | "schemaUri" | "parseError"
	> = {},
): TocDiscoveryResult {
	return Object.freeze({
		status: "failed",
		error: Object.freeze({ code, path, message, ...details }),
	});
}

function nodeErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined;
	}
	return typeof error.code === "string" ? error.code : undefined;
}

function sameFileState(before: BigIntStats, after: BigIntStats): boolean {
	return (
		before.dev === after.dev &&
		before.ino === after.ino &&
		before.size === after.size &&
		before.mtimeNs === after.mtimeNs &&
		before.ctimeNs === after.ctimeNs
	);
}

async function closeQuietly(handle: FileHandle | undefined): Promise<void> {
	if (handle === undefined) return;
	try {
		await handle.close();
	} catch {
		// Discovery remains bounded even when descriptor cleanup fails.
	}
}

async function resolveSkillRoot(skillRootPath: string): Promise<RootResult> {
	if (!isAbsolute(skillRootPath)) {
		return {
			ok: false,
			error: {
				code: "invalid-root",
				path: "skillRootPath",
				message: "Skill root must be an absolute path",
			},
		};
	}
	try {
		const physical = await realpath(resolve(skillRootPath));
		const rootStat = await stat(physical);
		if (!rootStat.isDirectory()) {
			return {
				ok: false,
				error: {
					code: "invalid-root",
					path: "skillRootPath",
					message: "Skill root must resolve to a directory",
				},
			};
		}
		return { ok: true, value: Object.freeze({ physical }) };
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "invalid-root",
				path: "skillRootPath",
				message: `Skill root cannot be resolved (${nodeErrorCode(error) ?? "unknown"})`,
			},
		};
	}
}

function schemaUriFrom(bytes: Uint8Array): string | undefined {
	let source: string;
	try {
		source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch {
		return undefined;
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	const schema = (value as Record<string, unknown>).$schema;
	return typeof schema === "string" ? schema : undefined;
}

function isKnownTocSchemaFamily(schemaUri: string): boolean {
	return (
		schemaUri.startsWith(TOC_SCHEMA_FAMILY_PREFIX) &&
		schemaUri.endsWith(TOC_SCHEMA_FAMILY_SUFFIX)
	);
}

async function acquireJsonFile(
	root: SkillRoot,
	name: string,
	remainingBytes: number,
): Promise<AcquisitionResult> {
	const locator = join(root.physical, name);
	let handle: FileHandle | undefined;
	try {
		handle = await open(locator, constants.O_RDONLY | constants.O_NOFOLLOW);
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) {
			return {
				ok: false,
				error: {
					code: "descriptor-not-regular",
					path: name,
					message: "Direct-child JSON descriptor candidate must be regular",
				},
			};
		}
		if (before.size > BigInt(MAX_TOC_BYTES)) {
			return {
				ok: false,
				error: {
					code: "descriptor-too-large",
					path: name,
					message: `JSON descriptor candidate exceeds ${MAX_TOC_BYTES} bytes`,
				},
			};
		}
		if (before.size > BigInt(remainingBytes)) {
			return {
				ok: false,
				error: {
					code: "discovery-too-large",
					path: name,
					message: `Direct-child JSON discovery exceeds ${MAX_TOC_DISCOVERY_BYTES} bytes`,
				},
			};
		}
		const bytes = await handle.readFile();
		const after = await handle.stat({ bigint: true });
		if (
			!sameFileState(before, after) ||
			BigInt(bytes.byteLength) !== before.size
		) {
			return {
				ok: false,
				error: {
					code: "descriptor-changed",
					path: name,
					message: "JSON descriptor candidate changed during discovery",
				},
			};
		}
		return {
			ok: true,
			value: {
				name,
				locator,
				byteLength: bytes.byteLength,
				bytes,
				schemaUri: schemaUriFrom(bytes),
			},
		};
	} catch (error) {
		const code = nodeErrorCode(error);
		return {
			ok: false,
			error: {
				code:
					code === "ELOOP" ? "descriptor-not-regular" : "descriptor-unreadable",
				path: name,
				message: `JSON descriptor candidate cannot be read (${code ?? "unknown"})`,
			},
		};
	} finally {
		await closeQuietly(handle);
	}
}

function sortNames(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function chooseDescriptor(
	files: readonly AcquiredJsonFile[],
): TocDiscoveryResult {
	const unsupported = files.filter(
		(file) =>
			file.schemaUri !== undefined &&
			file.schemaUri !== SKILL_TOC_SCHEMA_URI &&
			isKnownTocSchemaFamily(file.schemaUri),
	);
	if (unsupported.length > 0) {
		const first = unsupported[0];
		if (first === undefined)
			throw new Error("Unsupported descriptor invariant");
		return failure(
			"unsupported-version",
			first.name,
			`Unsupported Skill TOC schema ${first.schemaUri}`,
			{
				descriptorNames: Object.freeze(unsupported.map(({ name }) => name)),
				schemaUri: first.schemaUri,
			},
		);
	}

	const candidates = files.filter(
		(file) =>
			file.name === DEFAULT_TOC_DESCRIPTOR_NAME ||
			file.schemaUri === SKILL_TOC_SCHEMA_URI,
	);
	if (candidates.length === 0) {
		return Object.freeze({ status: "unstructured" });
	}
	if (candidates.length > 1) {
		return failure(
			"ambiguous-descriptor",
			"skillRootPath",
			"Skill root contains multiple canonical TOC descriptors",
			{
				descriptorNames: Object.freeze(candidates.map(({ name }) => name)),
			},
		);
	}

	const candidate = candidates[0];
	if (candidate === undefined)
		throw new Error("Descriptor selection invariant");
	const parsed = parseTocBytes(candidate.bytes);
	if (!parsed.ok) {
		return failure(
			"invalid-descriptor",
			candidate.name,
			`Recognized TOC descriptor is invalid: ${parsed.error.message}`,
			{ parseError: Object.freeze({ ...parsed.error }) },
		);
	}
	return Object.freeze({
		status: "structured",
		descriptor: Object.freeze({
			name: candidate.name,
			locator: candidate.locator,
			byteLength: candidate.byteLength,
			toc: parsed.value,
		}),
	});
}

/**
 * Discovers the default toc.json or one schema-identified alternate descriptor
 * inside a Pi-selected Skill root. It never descends, follows direct-child links,
 * or fetches schemas over a network.
 */
export async function discoverTocDescriptor(
	skillRootPath: string,
): Promise<TocDiscoveryResult> {
	const root = await resolveSkillRoot(skillRootPath);
	if (!root.ok) {
		return Object.freeze({
			status: "failed",
			error: Object.freeze(root.error),
		});
	}

	let entries: Dirent[];
	try {
		entries = await readdir(root.value.physical, { withFileTypes: true });
	} catch (error) {
		return failure(
			"root-unreadable",
			"skillRootPath",
			`Skill root cannot be listed (${nodeErrorCode(error) ?? "unknown"})`,
		);
	}
	const names = entries
		.flatMap((entry) =>
			entry.isFile() && entry.name.endsWith(".json") ? [entry.name] : [],
		)
		.sort(sortNames);
	if (names.length > MAX_TOC_DISCOVERY_JSON_FILES) {
		return failure(
			"too-many-json-files",
			"skillRootPath",
			`Skill root has more than ${MAX_TOC_DISCOVERY_JSON_FILES} direct-child JSON files`,
		);
	}

	const files: AcquiredJsonFile[] = [];
	let totalBytes = 0;
	for (const name of names) {
		const acquired = await acquireJsonFile(
			root.value,
			name,
			MAX_TOC_DISCOVERY_BYTES - totalBytes,
		);
		if (!acquired.ok) {
			return Object.freeze({
				status: "failed",
				error: Object.freeze(acquired.error),
			});
		}
		totalBytes += acquired.value.byteLength;
		files.push(acquired.value);
	}
	return chooseDescriptor(files);
}
