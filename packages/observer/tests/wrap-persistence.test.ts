import assert from "node:assert/strict";
import {
	access,
	cp,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import {
	applyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	OBSERVER_PROTOCOL,
	type ObserverEvent,
	type ObserverState,
} from "../src/lifecycle.ts";
import {
	openNotebook,
	readNotebookInventory,
	type NotebookId,
} from "../src/notebook.ts";
import {
	createNotebookService,
	type NotebookService,
	type NotebookSession,
} from "../src/notebook-service.ts";
import {
	fileNotebookSelectionStore,
	type NotebookSelectionStore,
} from "../src/notebook-selection-store.ts";
import {
	decodePreparedWrap,
	decodeWrapApproval,
	OBSERVER_WRAP_APPROVAL_SCHEMA,
	OBSERVER_WRAP_SCHEMA,
	type PreparedRecord,
} from "../src/wrap-profile.ts";
import {
	createWrapService,
	type WrapService,
	type WrapServiceResult,
} from "../src/wrap-service.ts";
import type { WrapFaultInjector, WrapFaultPoint } from "../src/wrap-transaction.ts";

const baselineRoot = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);
const externalSourceFixture = join(
	import.meta.dirname,
	"fixtures",
	"records",
	"valid",
	"external-source.md",
);

const SOURCE_ONE = "source-00000000-0000-4000-8000-000000000001";
const SOURCE_NEW = "source-00000000-0000-4000-8000-000000000010";
const MEMO_ONE = "memo-00000000-0000-4000-8000-000000000004";
const ZETTEL_NEW = "zettel-00000000-0000-4000-8000-000000000007";
const ZETTEL_INVALID = "zettel-00000000-0000-4000-8000-000000000008";

interface ReviewContext {
	readonly root: string;
	readonly selectionStore: NotebookSelectionStore;
	readonly notebooks: NotebookService;
	readonly wraps: WrapService;
	readonly session: NotebookSession;
	readonly state: ObserverState;
	readonly notebookId: NotebookId;
}

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

function requireEvent(value: unknown): ObserverEvent {
	const decoded = normalizeObserverEvent(value);
	if (!decoded.ok) assert.fail(JSON.stringify(decoded.issue));
	return decoded.event;
}

function applied(state: ObserverState, event: ObserverEvent): ObserverState {
	const result = applyObserverEvent(state, event);
	if (!result.applied) assert.fail(result.reason);
	return result.state;
}

async function withSandbox(
	run: (sandbox: string) => Promise<void>,
): Promise<void> {
	const sandbox = await mkdtemp(join(tmpdir(), "observer-wrap-"));
	try {
		await run(sandbox);
	} finally {
		await rm(sandbox, { recursive: true, force: true });
	}
}

async function copyBaseline(root: string): Promise<void> {
	for (const name of await readdir(baselineRoot)) {
		await cp(join(baselineRoot, name), join(root, "records", name));
	}
}

async function prepareReview(
	sandbox: string,
	withBaseline: boolean,
	faultInjector?: WrapFaultInjector,
): Promise<ReviewContext> {
	const root = join(sandbox, "notebook");
	const selectionStore = fileNotebookSelectionStore(
		join(sandbox, "state", "selected.json"),
	);
	const notebooks = createNotebookService({ selectionStore });
	const setup = requireValue(
		await notebooks.setup({
			root,
			defaultLanguage: "en",
			state: initialObserverState(),
		}),
	);
	if (withBaseline) await copyBaseline(root);
	const episode = requireValue(
		await notebooks.openEpisode({
			state: setup.state,
			episodeId: "episode-wrap-1",
		}),
	);
	const state = applied(
		episode.state,
		requireEvent({
			protocol: OBSERVER_PROTOCOL,
			kind: "wrap-proposed",
			proposalId: "proposal-wrap-1",
			summary: "Prepared wrap",
		}),
	);
	return {
		root: episode.notebook.root,
		selectionStore,
		notebooks,
		wraps: createWrapService({ selectionStore, faultInjector }),
		session: episode,
		state,
		notebookId: episode.notebook.manifest.notebook_id,
	};
}

function preparedWrap(
	context: ReviewContext,
	records: readonly PreparedRecord[],
	input?: {
		readonly proposalId?: string;
		readonly notebookId?: NotebookId;
		readonly root?: string;
		readonly language?: "ko" | "en";
	},
): unknown {
	return {
		observer_wrap: OBSERVER_WRAP_SCHEMA,
		proposal_id: input?.proposalId ?? "proposal-wrap-1",
		notebook_id: input?.notebookId ?? context.notebookId,
		root: input?.root ?? context.root,
		episode_language: input?.language ?? "en",
		records,
	};
}

function approval(
	approved = true,
	proposalId = "proposal-wrap-1",
): unknown {
	return {
		observer_approval: OBSERVER_WRAP_APPROVAL_SCHEMA,
		proposal_id: proposalId,
		approved,
	};
}

async function externalSource(id = SOURCE_NEW): Promise<string> {
	const source = await readFile(externalSourceFixture, "utf8");
	return source.replace(SOURCE_ONE, id);
}

async function memoEntry(root: string) {
	const opened = requireValue(await openNotebook(root));
	const inventory = requireValue(await readNotebookInventory(opened));
	const memo = inventory.find((entry) => entry.document.record.id === MEMO_ONE);
	if (!memo) assert.fail("Expected incubating Memo");
	return memo;
}

async function promotedMemo(root: string): Promise<{
	readonly content: string;
	readonly sha256: string;
	readonly path: string;
}> {
	const memo = await memoEntry(root);
	return {
		content: memo.content.replace(
			"observer_status: incubating",
			"observer_status: promoted",
		),
		sha256: memo.sha256,
		path: memo.path,
	};
}

async function revisedMemo(root: string): Promise<{
	readonly content: string;
	readonly sha256: string;
	readonly path: string;
}> {
	const memo = await memoEntry(root);
	return {
		content: `${memo.content.trimEnd()}\n\nAdditional evidence remains under review.\n`,
		sha256: memo.sha256,
		path: memo.path,
	};
}

function promotedZettel(): string {
	return `---
observer_schema: observer-record/v1
observer_type: zettel
observer_status: mature
id: ${ZETTEL_NEW}
title: Promoted observation
lang: en
created: "2026-07-27T11:00:00Z"
modified: "2026-07-27T11:00:00Z"
tags: []
aliases: []
sources:
  - record: ${SOURCE_ONE}
    role: supports
lineage:
  - type: promoted_from
    target: ${MEMO_ONE}
relations: []
---
# Promoted observation

This thought is mature enough for durable re-entry.
`;
}

function invalidZettel(): string {
	return `---
observer_schema: observer-record/v1
observer_type: zettel
observer_status: mature
id: ${ZETTEL_INVALID}
title: Dangling source
lang: en
created: "2026-07-27T11:01:00Z"
modified: "2026-07-27T11:01:00Z"
tags: []
aliases: []
sources:
  - record: source-00000000-0000-4000-8000-999999999999
    role: supports
lineage: []
relations: []
---
# Dangling source

This graph is invalid despite valid local Markdown.
`;
}

function createRecord(id: string, markdown: string): PreparedRecord {
	return { operation: "create", record_id: id, markdown };
}

function updateRecord(
	id: string,
	expectedSha256: string,
	markdown: string,
): PreparedRecord {
	return {
		operation: "update",
		record_id: id,
		expected_sha256: expectedSha256,
		markdown,
	};
}

async function inventoryContents(root: string): Promise<ReadonlyMap<string, string>> {
	const notebook = requireValue(await openNotebook(root));
	const inventory = requireValue(await readNotebookInventory(notebook));
	return new Map(inventory.map((entry) => [entry.relativePath, entry.content]));
}

function activeTransactionPath(root: string): string {
	return join(root, ".observer", "transactions", "active");
}

async function assertNoActiveTransaction(root: string): Promise<void> {
	await assert.rejects(access(activeTransactionPath(root)));
}

function throwingFault(
	selected: WrapFaultPoint,
	action?: (recordId: string | undefined) => Promise<void>,
): WrapFaultInjector {
	return {
		async hit(point, recordId): Promise<void> {
			if (point !== selected) return;
			if (action) await action(recordId);
			throw new Error(`Injected fault at ${point}`);
		},
	};
}

function requireWrapSuccess(result: WrapServiceResult) {
	if (!result.ok) assert.fail(JSON.stringify(result.issue));
	return result.value;
}

describe("Observer wrap profile", () => {
	test("decodes empty prepared wrap and explicit approval", () => {
		const prepared = decodePreparedWrap({
			observer_wrap: OBSERVER_WRAP_SCHEMA,
			proposal_id: "proposal-1",
			notebook_id: "notebook-00000000-0000-4000-8000-000000000001",
			root: "/tmp/notebook",
			episode_language: "ko",
			records: [],
		});
		assert.equal(prepared.ok, true);
		const accepted = decodeWrapApproval(approval());
		assert.equal(accepted.ok, true);
		if (!accepted.ok) assert.fail("Expected approval");
		assert.equal(accepted.value.approved, true);
		const declined = decodeWrapApproval(approval(false));
		assert.equal(declined.ok, true);
	});

	test("rejects malformed prepared and approval values", () => {
		const valid = {
			observer_wrap: OBSERVER_WRAP_SCHEMA,
			proposal_id: "proposal-1",
			notebook_id: "notebook-00000000-0000-4000-8000-000000000001",
			root: "/tmp/notebook",
			episode_language: "ko",
			records: [],
		};
		for (const value of [
			null,
			{ ...valid, observer_wrap: "observer-wrap/v2" },
			{ ...valid, root: "relative/notebook" },
			{ ...valid, episode_language: "ja" },
			{ ...valid, records: null },
			{ ...valid, extra: true },
			{
				...valid,
				records: [
					{
						operation: "update",
						record_id: MEMO_ONE,
						expected_sha256: "invalid",
						markdown: "text",
					},
				],
			},
		]) {
			assert.equal(decodePreparedWrap(value).ok, false);
		}
		for (const value of [
			null,
			{ observer_approval: "observer-wrap-approval/v2" },
			{
				observer_approval: OBSERVER_WRAP_APPROVAL_SCHEMA,
				proposal_id: "proposal-wrap-1",
				approved: "yes",
			},
			{
				observer_approval: OBSERVER_WRAP_APPROVAL_SCHEMA,
				proposal_id: "proposal-wrap-1",
				approved: true,
				extra: true,
			},
		]) {
			assert.equal(decodeWrapApproval(value).ok, false);
		}
	});
});

describe("Observer wrap durable persistence", () => {
	test("creates exact Markdown, verifies receipt, settles, and reopens", async () => {
		await withSandbox(async (sandbox) => {
			const context = await prepareReview(sandbox, false);
			const markdown = await externalSource();
			const result = requireWrapSuccess(
				await context.wraps.commit({
					state: context.state,
					prepared: preparedWrap(context, [
						createRecord(SOURCE_NEW, markdown),
					]),
					approval: approval(),
				}),
			);
			assert.equal(result.state.mode, "off");
			assert.equal(result.state.episode.status, "settled");
			assert.deepEqual(
				result.receipt.records.map((record) => record.record_id),
				[SOURCE_NEW],
			);
			const savedPath = join(context.root, "records", `${SOURCE_NEW}.md`);
			assert.equal(await readFile(savedPath, "utf8"), markdown);
			assert.equal(result.receipt.records[0]?.sha256, sha256Text(markdown));
			const fresh = createNotebookService({
				selectionStore: fileNotebookSelectionStore(
					join(sandbox, "state", "selected.json"),
				),
			});
			const reopened = requireValue(
				await fresh.recover(initialObserverState()),
			);
			assert.equal(reopened.notebook.recordCount, 1);
			await assertNoActiveTransaction(context.root);
		});
	});

	test("updates an existing path and creates a paired Zettel", async () => {
		await withSandbox(async (sandbox) => {
			const context = await prepareReview(sandbox, true);
			const memo = await promotedMemo(context.root);
			const zettel = promotedZettel();
			const result = requireWrapSuccess(
				await context.wraps.commit({
					state: context.state,
					prepared: preparedWrap(context, [
						createRecord(ZETTEL_NEW, zettel),
						updateRecord(MEMO_ONE, memo.sha256, memo.content),
					]),
					approval: approval(),
				}),
			);
			assert.deepEqual(
				result.receipt.records.map((record) => record.record_id),
				[MEMO_ONE, ZETTEL_NEW],
			);
			assert.equal(
				result.receipt.records.find((record) => record.record_id === MEMO_ONE)
					?.path,
				"records/memo-incubating.md",
			);
			assert.equal(await readFile(memo.path, "utf8"), memo.content);
			const fresh = requireValue(await openNotebook(context.root));
			assert.equal(fresh.recordCount, 7);
		});
	});

	test("allows an approved empty batch after fresh graph validation", async () => {
		await withSandbox(async (sandbox) => {
			const context = await prepareReview(sandbox, true);
			const before = await inventoryContents(context.root);
			const result = requireWrapSuccess(
				await context.wraps.commit({
					state: context.state,
					prepared: preparedWrap(context, []),
					approval: approval(),
				}),
			);
			assert.deepEqual(result.receipt.records, []);
			assert.deepEqual(await inventoryContents(context.root), before);
			assert.equal(result.state.episode.status, "settled");
		});
	});

	test("rejects approval and target mismatches before staging", async () => {
		await withSandbox(async (sandbox) => {
			const context = await prepareReview(sandbox, true);
			const before = await inventoryContents(context.root);
			const cases = [
				{
					prepared: preparedWrap(context, []),
					approval: approval(false),
					code: "wrap.declined",
				},
				{
					prepared: preparedWrap(context, []),
					approval: approval(true, "proposal-stale"),
					code: "wrap.lifecycle",
				},
				{
					prepared: preparedWrap(context, [], {
						proposalId: "proposal-stale",
					}),
					approval: approval(true, "proposal-stale"),
					code: "wrap.lifecycle",
				},
				{
					prepared: preparedWrap(context, [], {
						notebookId:
							"notebook-00000000-0000-4000-8000-999999999999",
					}),
					approval: approval(),
					code: "wrap.target-mismatch",
				},
				{
					prepared: preparedWrap(context, [], { root: join(sandbox, "other") }),
					approval: approval(),
					code: "wrap.target-mismatch",
				},
				{
					prepared: preparedWrap(context, [], { language: "ko" }),
					approval: approval(),
					code: "wrap.target-mismatch",
				},
			];
			for (const item of cases) {
				const result = await context.wraps.commit({
					state: context.state,
					prepared: item.prepared,
					approval: item.approval,
				});
				assert.equal(result.ok, false);
				if (result.ok) assert.fail("Expected wrap rejection");
				assert.equal(result.issue.code, item.code);
				assert.deepEqual(await inventoryContents(context.root), before);
				await assertNoActiveTransaction(context.root);
			}
		});
	});

	test("rejects batch relation and graph errors without mutation", async () => {
		await withSandbox(async (sandbox) => {
			const context = await prepareReview(sandbox, true);
			const before = await inventoryContents(context.root);
			const memo = await promotedMemo(context.root);
			const newSource = await externalSource();
			const cases: readonly (readonly [readonly PreparedRecord[], string])[] = [
				[
					[
						createRecord(SOURCE_NEW, newSource),
						createRecord(SOURCE_NEW, newSource),
					],
					"wrap-preflight.duplicate-id",
				],
				[
					[createRecord(SOURCE_ONE, await externalSource(SOURCE_ONE))],
					"wrap-preflight.create-collision",
				],
				[
					[updateRecord(SOURCE_NEW, "0".repeat(64), newSource)],
					"wrap-preflight.update-missing",
				],
				[
					[createRecord(SOURCE_NEW, "# invalid\n")],
					"wrap-preflight.record-invalid",
				],
				[
					[createRecord(ZETTEL_INVALID, invalidZettel())],
					"wrap-preflight.final-invalid",
				],
				[
					[updateRecord(MEMO_ONE, "0".repeat(64), memo.content)],
					"wrap-preflight.update-stale",
				],
			];
			for (const [records, code] of cases) {
				const result = await context.wraps.commit({
					state: context.state,
					prepared: preparedWrap(context, records),
					approval: approval(),
				});
				assert.equal(result.ok, false);
				if (result.ok) assert.fail("Expected preflight rejection");
				assert.equal(result.issue.code, code);
				assert.deepEqual(await inventoryContents(context.root), before);
				await assertNoActiveTransaction(context.root);
			}
		});
	});

	test("rolls back injected stage, publish, and readback failures", async () => {
		for (const point of [
			"after-stage",
			"before-drift-check",
			"before-publish",
			"after-publish",
			"before-readback",
		] satisfies readonly WrapFaultPoint[]) {
			await withSandbox(async (sandbox) => {
				const context = await prepareReview(
					sandbox,
					true,
					throwingFault(point),
				);
				const before = await inventoryContents(context.root);
				const memo = await promotedMemo(context.root);
				const result = await context.wraps.commit({
					state: context.state,
					prepared: preparedWrap(context, [
						updateRecord(MEMO_ONE, memo.sha256, memo.content),
						createRecord(ZETTEL_NEW, promotedZettel()),
					]),
					approval: approval(),
				});
				assert.equal(result.ok, false);
				if (result.ok) assert.fail("Expected injected failure");
				assert.equal(result.issue.recoveryRequired, false);
				assert.deepEqual(await inventoryContents(context.root), before);
				assert.equal(context.state.episode.status, "reviewing-wrap");
				await assertNoActiveTransaction(context.root);
			});
		}
	});

	test("detects non-target drift before first publication", async () => {
		await withSandbox(async (sandbox) => {
			const sourcePath = join(contextRoot(sandbox), "records", "source-external.md");
			const fault = throwingFault("before-drift-check", async () => {
				const current = await readFile(sourcePath, "utf8");
				await writeFile(sourcePath, `${current}\n`, "utf8");
			});
			const context = await prepareReview(sandbox, true, fault);
			const memo = await revisedMemo(context.root);
			const memoBefore = await readFile(memo.path, "utf8");
			const result = await context.wraps.commit({
				state: context.state,
				prepared: preparedWrap(context, [
					updateRecord(MEMO_ONE, memo.sha256, memo.content),
				]),
				approval: approval(),
			});
			assert.equal(result.ok, false);
			if (result.ok) assert.fail("Expected drift rejection");
			assert.equal(result.issue.code, "wrap-transaction.drift");
			assert.equal(await readFile(memo.path, "utf8"), memoBefore);
			await assertNoActiveTransaction(context.root);
		});
	});

	test("reports recovery when rollback would overwrite unknown bytes", async () => {
		await withSandbox(async (sandbox) => {
			let targetPath = "";
			const fault = throwingFault("after-publish", async (recordId) => {
				if (recordId === MEMO_ONE) {
					await writeFile(targetPath, "external concurrent edit", "utf8");
				}
			});
			const context = await prepareReview(sandbox, true, fault);
			const memo = await revisedMemo(context.root);
			targetPath = memo.path;
			const result = await context.wraps.commit({
				state: context.state,
				prepared: preparedWrap(context, [
					updateRecord(MEMO_ONE, memo.sha256, memo.content),
				]),
				approval: approval(),
			});
			assert.equal(result.ok, false);
			if (result.ok) assert.fail("Expected recovery-required failure");
			assert.equal(result.issue.code, "wrap-transaction.rollback");
			assert.equal(result.issue.recoveryRequired, true);
			assert.equal(await readFile(targetPath, "utf8"), "external concurrent edit");
			await access(activeTransactionPath(context.root));
		});
	});

	test("rejects active transaction overlap and duplicate settled commit", async () => {
		await withSandbox(async (sandbox) => {
			const context = await prepareReview(sandbox, false);
			const markdown = await externalSource();
			await mkdir(activeTransactionPath(context.root), { recursive: true });
			const blocked = await context.wraps.commit({
				state: context.state,
				prepared: preparedWrap(context, [
					createRecord(SOURCE_NEW, markdown),
				]),
				approval: approval(),
			});
			assert.equal(blocked.ok, false);
			if (blocked.ok) assert.fail("Expected active transaction rejection");
			assert.equal(blocked.issue.code, "wrap-transaction.active");
			assert.equal(blocked.issue.recoveryRequired, true);
			await rm(activeTransactionPath(context.root), {
				recursive: true,
				force: true,
			});
			const prepared = preparedWrap(context, [
				createRecord(SOURCE_NEW, markdown),
			]);
			const success = requireWrapSuccess(
				await context.wraps.commit({
					state: context.state,
					prepared,
					approval: approval(),
				}),
			);
			const beforeDuplicate = await inventoryContents(context.root);
			const duplicate = await context.wraps.commit({
				state: success.state,
				prepared,
				approval: approval(),
			});
			assert.equal(duplicate.ok, false);
			if (duplicate.ok) assert.fail("Expected duplicate commit rejection");
			assert.equal(duplicate.issue.code, "wrap.lifecycle");
			assert.deepEqual(await inventoryContents(context.root), beforeDuplicate);
		});
	});
});

function contextRoot(sandbox: string): string {
	return join(sandbox, "notebook");
}
