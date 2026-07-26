import assert from "node:assert/strict";
import {
	cp,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initialObserverState } from "../src/lifecycle.ts";
import {
	decodeNotebookId,
	decodeNotebookManifest,
	initializeNotebook,
	OBSERVER_MANIFEST_DIRECTORY,
	OBSERVER_MANIFEST_FILENAME,
	OBSERVER_NOTEBOOK_SCHEMA,
	OBSERVER_RECORDS_DIRECTORY,
	openNotebook,
} from "../src/notebook.ts";
import {
	createNotebookService,
	type NotebookService,
} from "../src/notebook-service.ts";
import {
	decodeNotebookSelection,
	fileNotebookSelectionStore,
	OBSERVER_SELECTION_SCHEMA,
	type NotebookSelectionStore,
} from "../src/notebook-selection-store.ts";

const baselineRecords = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);

interface ResultLike<Value> {
	readonly ok: boolean;
	readonly value?: Value;
	readonly issue?: { readonly code: string; readonly message: string };
}

function requireValue<Value>(result: ResultLike<Value>): Value {
	if (!result.ok || result.value === undefined) {
		assert.fail(`Expected success: ${JSON.stringify(result.issue)}`);
	}
	return result.value;
}

async function withSandbox(
	run: (sandbox: string) => Promise<void>,
): Promise<void> {
	const sandbox = await mkdtemp(join(tmpdir(), "observer-setup-"));
	try {
		await run(sandbox);
	} finally {
		await rm(sandbox, { force: true, recursive: true });
	}
}

function selectionPath(sandbox: string): string {
	return join(sandbox, "state", "selected-notebook.json");
}

function serviceAt(sandbox: string): NotebookService {
	return createNotebookService({
		selectionStore: fileNotebookSelectionStore(selectionPath(sandbox)),
	});
}

function manifestPath(root: string): string {
	return join(
		root,
		OBSERVER_MANIFEST_DIRECTORY,
		OBSERVER_MANIFEST_FILENAME,
	);
}

function recordsPath(root: string): string {
	return join(root, OBSERVER_RECORDS_DIRECTORY);
}

async function copyBaselineRecords(root: string): Promise<void> {
	for (const name of await readdir(baselineRecords)) {
		await cp(join(baselineRecords, name), join(recordsPath(root), name));
	}
}

async function writeRawLayout(
	root: string,
	manifest: string | null,
): Promise<void> {
	await mkdir(join(root, OBSERVER_MANIFEST_DIRECTORY), { recursive: true });
	await mkdir(recordsPath(root), { recursive: true });
	if (manifest !== null) {
		await writeFile(manifestPath(root), manifest, "utf8");
	}
}

const validNotebookId = "notebook-00000000-0000-4000-8000-000000000001";
const otherNotebookId = "notebook-00000000-0000-4000-8000-000000000002";

function manifestSource(input?: {
	readonly schema?: string;
	readonly notebookId?: string;
	readonly language?: string;
	readonly extra?: boolean;
}): string {
	const value: Record<string, unknown> = {
		observer_notebook: input?.schema ?? OBSERVER_NOTEBOOK_SCHEMA,
		notebook_id: input?.notebookId ?? validNotebookId,
		default_language: input?.language ?? "ko",
	};
	if (input?.extra) value.extra = true;
	return `${JSON.stringify(value, null, 2)}\n`;
}

describe("Observer notebook manifest and selection decoding", () => {
	test("decodes strict v1 notebook and selection documents", () => {
		const manifest = decodeNotebookManifest({
			observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
			notebook_id: validNotebookId,
			default_language: "ko",
		});
		assert.equal(manifest.ok, true);
		assert.notEqual(decodeNotebookId(validNotebookId), null);

		const selection = decodeNotebookSelection({
			observer_selection: OBSERVER_SELECTION_SCHEMA,
			notebook_id: validNotebookId,
			root: "/tmp/observer-notebook",
		});
		assert.equal(selection.ok, true);
	});

	const invalidManifests: readonly (readonly [string, unknown, string])[] = [
		["non-object", null, "notebook.manifest-invalid"],
		[
			"missing schema",
			{ notebook_id: validNotebookId, default_language: "ko" },
			"notebook.manifest-invalid",
		],
		[
			"unsupported schema",
			{
				observer_notebook: "observer-notebook/v2",
				notebook_id: validNotebookId,
				default_language: "ko",
			},
			"notebook.manifest-unsupported",
		],
		[
			"invalid ID",
			{
				observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
				notebook_id: "notebook-invalid",
				default_language: "ko",
			},
			"notebook.manifest-invalid",
		],
		[
			"unsupported language",
			{
				observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
				notebook_id: validNotebookId,
				default_language: "ja",
			},
			"notebook.manifest-invalid",
		],
		[
			"unknown field",
			{
				observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
				notebook_id: validNotebookId,
				default_language: "ko",
				extra: true,
			},
			"notebook.manifest-invalid",
		],
	];

	for (const [name, value, code] of invalidManifests) {
		test(`rejects manifest ${name}`, () => {
			const result = decodeNotebookManifest(value);
			if (result.ok) assert.fail(`Expected ${name} rejection`);
			assert.equal(result.issue.code, code);
		});
	}

	test("rejects malformed selection values without defaults", () => {
		for (const value of [
			null,
			{},
			{
				observer_selection: "observer-selection/v2",
				notebook_id: validNotebookId,
				root: "/tmp/notebook",
			},
			{
				observer_selection: OBSERVER_SELECTION_SCHEMA,
				notebook_id: validNotebookId,
				root: "relative/notebook",
			},
		]) {
			assert.equal(decodeNotebookSelection(value).ok, false);
		}
	});
});

describe("Observer notebook setup and recovery", () => {
	test("initializes an explicit new notebook and recovers it", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const service = serviceAt(sandbox);
			const setup = requireValue(
				await service.setup({
					root,
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			assert.equal(setup.notebook.root, await realpath(root));
			assert.equal(setup.notebook.manifest.default_language, "ko");
			assert.notEqual(
				decodeNotebookId(setup.notebook.manifest.notebook_id),
				null,
			);
			assert.deepEqual((await readdir(recordsPath(root))).sort(), []);

			const freshService = serviceAt(sandbox);
			const recovered = requireValue(
				await freshService.recover(initialObserverState()),
			);
			assert.equal(
				recovered.notebook.manifest.notebook_id,
				setup.notebook.manifest.notebook_id,
			);
			assert.equal(recovered.selection.root, await realpath(root));
			assert.equal(
				recovered.state.selectedNotebookId,
				setup.notebook.manifest.notebook_id,
			);
		});
	});

	test("adopts an existing folder without rewriting unrelated bytes", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "existing");
			await mkdir(root);
			const unrelatedPath = join(root, "user-note.md");
			const unrelated = "# Existing user note\n\nDo not rewrite me.\n";
			await writeFile(unrelatedPath, unrelated, "utf8");
			const service = serviceAt(sandbox);
			const setup = await service.setup({
				root,
				defaultLanguage: "en",
				state: initialObserverState(),
			});
			assert.equal(setup.ok, true);
			assert.equal(await readFile(unrelatedPath, "utf8"), unrelated);
			assert.equal((await openNotebook(root)).ok, true);
		});
	});

	test("keeps idempotent setup bytes and rejects language conflict", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const service = serviceAt(sandbox);
			const first = requireValue(
				await service.setup({
					root,
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			const before = await readFile(manifestPath(root));
			const second = await service.setup({
				root,
				defaultLanguage: "ko",
				state: first.state,
			});
			assert.equal(second.ok, true);
			assert.deepEqual(await readFile(manifestPath(root)), before);
			const conflict = await service.setup({
				root,
				defaultLanguage: "en",
				state: first.state,
			});
			assert.equal(conflict.ok, false);
			if (conflict.ok) assert.fail("Expected language conflict");
			assert.equal(conflict.issue.code, "notebook.language-conflict");
			assert.deepEqual(await readFile(manifestPath(root)), before);
		});
	});

	test("repairs malformed selection only through explicit setup", async () => {
		await withSandbox(async (sandbox) => {
			const path = selectionPath(sandbox);
			await mkdir(join(sandbox, "state"));
			await writeFile(path, "{not-json", "utf8");
			const service = serviceAt(sandbox);
			const setup = await service.setup({
				root: join(sandbox, "notebook"),
				defaultLanguage: "ko",
				state: initialObserverState(),
			});
			assert.equal(setup.ok, true);
			const persisted = decodeNotebookSelection(
				JSON.parse(await readFile(path, "utf8")),
			);
			assert.equal(persisted.ok, true);
		});
	});

	test("does not claim selection when its final publication fails", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const failingStore: NotebookSelectionStore = {
				location: join(sandbox, "state", "selected.json"),
				async load() {
					return { found: false };
				},
				async save(): Promise<void> {
					throw new Error("selection write failed");
				},
			};
			const service = createNotebookService({ selectionStore: failingStore });
			const setup = await service.setup({
				root,
				defaultLanguage: "ko",
				state: initialObserverState(),
			});
			assert.equal(setup.ok, false);
			if (setup.ok) assert.fail("Expected selection failure");
			assert.equal(setup.issue.code, "selection.store");
			assert.equal((await openNotebook(root)).ok, true);
		});
	});
});

describe("Observer notebook opening and health", () => {
	test("rejects relative, missing, and non-directory roots", async () => {
		await withSandbox(async (sandbox) => {
			const relative = await openNotebook("relative/notebook");
			assert.equal(relative.ok, false);
			if (relative.ok) assert.fail("Expected relative path rejection");
			assert.equal(relative.issue.code, "notebook.path-absolute-required");

			const missing = await openNotebook(join(sandbox, "missing"));
			assert.equal(missing.ok, false);
			if (missing.ok) assert.fail("Expected missing path rejection");
			assert.equal(missing.issue.code, "notebook.path-missing");

			const file = join(sandbox, "file");
			await writeFile(file, "not a directory", "utf8");
			const nonDirectory = await initializeNotebook(file, "ko");
			assert.equal(nonDirectory.ok, false);
			if (nonDirectory.ok) assert.fail("Expected non-directory rejection");
			assert.equal(nonDirectory.issue.code, "notebook.path-not-directory");
		});
	});

	test("distinguishes missing, corrupt, unsupported, and strict manifests", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			await writeRawLayout(root, null);
			const missing = await openNotebook(root);
			assert.equal(missing.ok, false);
			if (missing.ok) assert.fail("Expected missing manifest");
			assert.equal(missing.issue.code, "notebook.manifest-missing");

			await writeFile(manifestPath(root), "{not-json", "utf8");
			const corrupt = await openNotebook(root);
			assert.equal(corrupt.ok, false);
			if (corrupt.ok) assert.fail("Expected corrupt manifest");
			assert.equal(corrupt.issue.code, "notebook.manifest-invalid");

			await writeFile(
				manifestPath(root),
				manifestSource({ schema: "observer-notebook/v2" }),
				"utf8",
			);
			const unsupported = await openNotebook(root);
			assert.equal(unsupported.ok, false);
			if (unsupported.ok) assert.fail("Expected unsupported manifest");
			assert.equal(unsupported.issue.code, "notebook.manifest-unsupported");

			await writeFile(
				manifestPath(root),
				manifestSource({ extra: true }),
				"utf8",
			);
			const strict = await openNotebook(root);
			assert.equal(strict.ok, false);
			if (strict.ok) assert.fail("Expected strict manifest rejection");
			assert.equal(strict.issue.code, "notebook.manifest-invalid");
		});
	});

	test("opens the six-record baseline through Slice 1 validation", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const notebook = requireValue(await initializeNotebook(root, "ko"));
			await copyBaselineRecords(root);
			const opened = requireValue(await openNotebook(notebook.root));
			assert.equal(opened.recordCount, 6);
		});
	});

	test("reports invalid records through status without mutation", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const service = serviceAt(sandbox);
			await service.setup({
				root,
				defaultLanguage: "ko",
				state: initialObserverState(),
			});
			const invalidPath = join(recordsPath(root), "invalid.md");
			await writeFile(invalidPath, "# Missing frontmatter\n", "utf8");
			const manifestBefore = await readFile(manifestPath(root));
			const selectionBefore = await readFile(selectionPath(sandbox));
			const recordBefore = await readFile(invalidPath);
			const status = await service.status();
			assert.equal(status.status, "unhealthy");
			if (status.status !== "unhealthy") assert.fail("Expected unhealthy");
			assert.equal(status.issue.code, "notebook.records-invalid");
			assert.equal(status.issue.diagnostics?.length, 1);
			assert.deepEqual(await readFile(manifestPath(root)), manifestBefore);
			assert.deepEqual(await readFile(selectionPath(sandbox)), selectionBefore);
			assert.deepEqual(await readFile(invalidPath), recordBefore);
		});
	});
});

describe("Observer notebook selection and language", () => {
	test("allows an exact live refresh and rejects another notebook", async () => {
		await withSandbox(async (sandbox) => {
			const rootA = join(sandbox, "notebook-a");
			const rootB = join(sandbox, "notebook-b");
			const service = serviceAt(sandbox);
			const setup = requireValue(
				await service.setup({
					root: rootA,
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			const live = requireValue(
				await service.openEpisode({ state: setup.state, episodeId: "episode-1" }),
			);
			const refreshed = requireValue(
				await service.select({ root: rootA, state: live.state }),
			);
			assert.deepEqual(refreshed.state, live.state);

			assert.equal((await initializeNotebook(rootB, "en")).ok, true);
			const selectionBefore = await readFile(selectionPath(sandbox));
			const switched = await service.select({ root: rootB, state: live.state });
			assert.equal(switched.ok, false);
			if (switched.ok) assert.fail("Expected live switch rejection");
			assert.equal(switched.issue.code, "selection.live-switch");
			assert.deepEqual(await readFile(selectionPath(sandbox)), selectionBefore);
		});
	});

	test("rejects a copied notebook at another path during live work", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const copyRoot = join(sandbox, "notebook-copy");
			const service = serviceAt(sandbox);
			const setup = requireValue(
				await service.setup({
					root,
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			const live = requireValue(
				await service.openEpisode({ state: setup.state, episodeId: "episode-1" }),
			);
			await cp(root, copyRoot, { recursive: true });
			const switched = await service.select({
				root: copyRoot,
				state: live.state,
			});
			assert.equal(switched.ok, false);
			if (switched.ok) assert.fail("Expected copied-target rejection");
			assert.equal(switched.issue.code, "selection.live-switch");
		});
	});

	test("reports stale path and manifest identity during recovery", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const moved = join(sandbox, "moved");
			const service = serviceAt(sandbox);
			await service.setup({
				root,
				defaultLanguage: "ko",
				state: initialObserverState(),
			});
			await rename(root, moved);
			const stalePath = await service.recover(initialObserverState());
			assert.equal(stalePath.ok, false);
			if (stalePath.ok) assert.fail("Expected stale path");
			assert.equal(stalePath.issue.code, "selection.stale");

			await rename(moved, root);
			const opened = requireValue(await openNotebook(root));
			await writeFile(
				manifestPath(root),
				manifestSource({
					notebookId:
						opened.manifest.notebook_id === validNotebookId
							? otherNotebookId
							: validNotebookId,
				}),
				"utf8",
			);
			const staleId = await service.recover(initialObserverState());
			assert.equal(staleId.ok, false);
			if (staleId.ok) assert.fail("Expected stale identity");
			assert.equal(staleId.issue.code, "selection.stale");
		});
	});

	test("rejects an invalid episode identity before lifecycle mutation", async () => {
		await withSandbox(async (sandbox) => {
			const service = serviceAt(sandbox);
			const setup = requireValue(
				await service.setup({
					root: join(sandbox, "notebook"),
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			const opened = await service.openEpisode({
				state: setup.state,
				episodeId: " ",
			});
			assert.equal(opened.ok, false);
			if (opened.ok) assert.fail("Expected invalid episode ID");
			assert.equal(opened.issue.code, "lifecycle.rejected");
			assert.equal(setup.state.episode.status, "empty");
		});
	});

	test("updates only the future-episode default language", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const service = serviceAt(sandbox);
			const setup = requireValue(
				await service.setup({
					root,
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			await copyBaselineRecords(root);
			const sourcePath = join(recordsPath(root), "source-external.md");
			const sourceBefore = await readFile(sourcePath);
			const live = requireValue(
				await service.openEpisode({ state: setup.state, episodeId: "episode-ko" }),
			);
			const updated = requireValue(
				await service.updateDefaultLanguage({
					state: live.state,
					language: "en",
				}),
			);
			assert.equal(updated.notebook.manifest.default_language, "en");
			assert.equal(updated.state.episode.status, "open");
			if (updated.state.episode.status !== "open") {
				assert.fail("Expected live episode");
			}
			assert.equal(updated.state.episode.core.lang, "ko");
			assert.deepEqual(await readFile(sourcePath), sourceBefore);

			const next = requireValue(
				await service.openEpisode({
					state: initialObserverState(),
					episodeId: "episode-en",
				}),
			);
			assert.equal(next.state.episode.status, "open");
			if (next.state.episode.status !== "open") {
				assert.fail("Expected next episode");
			}
			assert.equal(next.state.episode.core.lang, "en");
		});
	});

	test("reports malformed persisted selection explicitly", async () => {
		await withSandbox(async (sandbox) => {
			const path = selectionPath(sandbox);
			await mkdir(join(sandbox, "state"));
			const service = serviceAt(sandbox);
			for (const source of ["{not-json", "null"]) {
				await writeFile(path, source, "utf8");
				const recovered = await service.recover(initialObserverState());
				assert.equal(recovered.ok, false);
				if (recovered.ok) assert.fail("Expected malformed selection");
				assert.equal(recovered.issue.code, "selection.invalid");
			}
			const status = await service.status();
			assert.equal(status.status, "unhealthy");
		});
	});

	test("rejects live setup before creating another root", async () => {
		await withSandbox(async (sandbox) => {
			const root = join(sandbox, "notebook");
			const other = join(sandbox, "other");
			const service = serviceAt(sandbox);
			const setup = requireValue(
				await service.setup({
					root,
					defaultLanguage: "ko",
					state: initialObserverState(),
				}),
			);
			const live = requireValue(
				await service.openEpisode({ state: setup.state, episodeId: "episode-1" }),
			);
			const rejected = await service.setup({
				root: other,
				defaultLanguage: "en",
				state: live.state,
			});
			assert.equal(rejected.ok, false);
			if (rejected.ok) assert.fail("Expected live setup rejection");
			assert.equal(rejected.issue.code, "selection.live-switch");
			await assert.rejects(readFile(manifestPath(other)));
		});
	});
});
