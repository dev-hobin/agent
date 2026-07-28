import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import {
	refineMaterialReviewIntent,
	type MaterialReviewIntent,
} from "../src/material-review-trigger.ts";
import {
	createObserverController,
	type ObserverCommandPort,
	type ObserverControllerIds,
} from "../src/observer-controller.ts";
import {
	completeObserveArgs,
	parseObserveCommand,
} from "../src/observer-command.ts";
import {
	decodeNotebookId,
	openNotebook,
	readNotebookInventory,
} from "../src/notebook.ts";
import { createNotebookService } from "../src/notebook-service.ts";
import {
	fileNotebookSelectionStore,
	type NotebookSelectionStore,
} from "../src/notebook-selection-store.ts";
import { hydrateMemoScope } from "../src/memo-reconciliation.ts";
import {
	OBSERVER_APPLIED_MEMO_ENTRY,
	OBSERVER_PREPARED_MEMO_ENTRY,
	reconstructMemoSession,
} from "../src/memo-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_SAVE_PROTOCOL,
	OBSERVER_SAVE_ATTEMPT_ENTRY,
	OBSERVER_SAVE_ATTEMPT_PROTOCOL,
	preparedSaveDigest,
	reconstructObserverPiState,
	type PiBranchEntryLike,
	type PreparedSaveHandoff,
} from "../src/pi-session.ts";
import { inspectSaveAcknowledgment } from "../src/save-acknowledgment.ts";
import { OBSERVER_SAVE_SCHEMA } from "../src/save-profile.ts";
import { wrapTransactionActivePath } from "../src/wrap-transaction.ts";

const externalSourceFixture = join(
	import.meta.dirname,
	"fixtures",
	"records",
	"valid",
	"external-source.md",
);
const ORIGINAL_SOURCE = "source-00000000-0000-4000-8000-000000000001";
const CREATED_SOURCE = "source-00000000-0000-4000-8000-000000000021";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

class FakePort implements ObserverCommandPort {
	cwd = process.cwd();
	readonly entries: PiBranchEntryLike[] = [];
	readonly notifications: Array<{
		readonly message: string;
		readonly type: "info" | "warning" | "error";
	}> = [];
	readonly statuses: Array<string | undefined> = [];
	readonly inputs: Array<string | undefined> = [];
	readonly selections: Array<string | undefined> = [];
	readonly confirmations: boolean[] = [];
	persistedSession = "/tmp/observer-session.jsonl";
	failCommitAppend = false;
	failMemoAppliedAppend = false;
	failMemoAcknowledgmentAppend = false;
	failMaterialReviewOpenAppend = false;
	dropMaterialReviewOpenAppend = false;

	branchEntries(): readonly PiBranchEntryLike[] {
		return this.entries;
	}

	sessionFile(): string | undefined {
		return this.persistedSession || undefined;
	}

	appendEntry(customType: string, data: unknown): void {
		if (
			customType === OBSERVER_LIFECYCLE_ENTRY &&
			isObject(data) &&
			data.kind === "episode-opened" &&
			this.failMaterialReviewOpenAppend
		) {
			this.failMaterialReviewOpenAppend = false;
			throw new Error("Injected material review Episode append failure");
		}
		if (
			customType === OBSERVER_LIFECYCLE_ENTRY &&
			isObject(data) &&
			data.kind === "episode-opened" &&
			this.dropMaterialReviewOpenAppend
		) {
			this.dropMaterialReviewOpenAppend = false;
			return;
		}
		if (
			this.failMemoAppliedAppend &&
			customType === OBSERVER_APPLIED_MEMO_ENTRY
		) {
			this.failMemoAppliedAppend = false;
			throw new Error("Injected Memo applied append failure");
		}
		if (
			this.failMemoAcknowledgmentAppend &&
			customType === OBSERVER_LIFECYCLE_ENTRY &&
			isObject(data) &&
			data.kind === "memo-reconciled"
		) {
			this.failMemoAcknowledgmentAppend = false;
			throw new Error("Injected Memo acknowledgment append failure");
		}
		if (
			this.failCommitAppend &&
			customType === OBSERVER_LIFECYCLE_ENTRY &&
			isObject(data) &&
			data.kind === "save-committed"
		) {
			this.failCommitAppend = false;
			throw new Error("Injected session append failure");
		}
		this.entries.push({ type: "custom", customType, data });
	}

	async input(): Promise<string | undefined> {
		return this.inputs.shift();
	}

	async select(): Promise<string | undefined> {
		return this.selections.shift();
	}

	async confirm(): Promise<boolean> {
		return this.confirmations.shift() ?? false;
	}

	notify(message: string, type: "info" | "warning" | "error" = "info"): void {
		this.notifications.push({ message, type });
	}

	setStatus(text: string | undefined): void {
		this.statuses.push(text);
	}
}

function materialReviewIntent(
	text = "이 자료를 Observer 관점으로 봐줘.",
): MaterialReviewIntent {
	const refined = refineMaterialReviewIntent({
		value: {
			observer_action: "observer-sidecar/v1",
			action: "material-review-start",
			user_message_digest: sha256Text(text),
			material: { kind: "retrieved-tool-results" },
		},
		latestUser: { text, inputSource: "interactive" },
		requestId: "material-review-00000000-0000-4000-8000-000000000901",
	});
	if (!refined.ok) assert.fail(refined.issue.message);
	return refined.value;
}

function deterministicIds(): ObserverControllerIds {
	let episodes = 0;
	let attempts = 0;
	let receipts = 0;
	let memoRevisions = 0;
	let memoReceipts = 0;
	return {
		episodeId() {
			episodes += 1;
			return `episode-${episodes}`;
		},
		attemptId() {
			attempts += 1;
			return `attempt-${attempts}`;
		},
		receiptId(): `receipt-${string}` {
			receipts += 1;
			return `receipt-recovered-${receipts}`;
		},
		memoRevisionId() {
			memoRevisions += 1;
			return `memo-working-revision-00000000-0000-4000-8000-${String(memoRevisions).padStart(12, "0")}`;
		},
		memoReceiptId(): `memo-receipt-${string}` {
			memoReceipts += 1;
			return `memo-receipt-00000000-0000-4000-8000-${String(memoReceipts).padStart(12, "0")}`;
		},
	};
}

async function withSandbox(
	run: (sandbox: string) => Promise<void>,
): Promise<void> {
	const sandbox = await mkdtemp(join(tmpdir(), "observer-controller-"));
	try {
		await run(sandbox);
	} finally {
		await rm(sandbox, { recursive: true, force: true });
	}
}

function selectionStore(sandbox: string): NotebookSelectionStore {
	return fileNotebookSelectionStore(join(sandbox, "state", "selection.json"));
}

function requireNotebook<Value>(result: {
	readonly ok: boolean;
	readonly value?: Value;
	readonly issue?: { readonly message: string };
}): Value {
	if (!result.ok || result.value === undefined) {
		assert.fail(result.issue?.message ?? "Expected notebook success");
	}
	return result.value;
}

async function createdSource(): Promise<string> {
	return (await readFile(externalSourceFixture, "utf8")).replace(
		ORIGINAL_SOURCE,
		CREATED_SOURCE,
	);
}

function handoff(input: {
	readonly notebookId: `notebook-${string}`;
	readonly root: string;
	readonly markdown?: string;
}): PreparedSaveHandoff {
	return {
		protocol: OBSERVER_PREPARED_SAVE_PROTOCOL,
		summary: "승인할 Observer save 계획",
		prepared: {
			observer_save: OBSERVER_SAVE_SCHEMA,
			proposal_id: "proposal-controller-1",
			notebook_id: input.notebookId,
			root: input.root,
			episode_language: "en",
			records: input.markdown
				? [
						{
							operation: "create",
							record_id: CREATED_SOURCE,
							markdown: input.markdown,
						},
					]
				: [],
		},
	};
}

async function setupAndTurnOn(input: {
	readonly controller: ReturnType<typeof createObserverController>;
	readonly port: FakePort;
	readonly root: string;
}): Promise<PreparedSaveHandoff> {
	await input.controller.command(`setup en ${input.root}`, input.port);
	await input.controller.command("on", input.port);
	const snapshot = reconstructObserverPiState(input.port.entries);
	assert.equal(snapshot.state.mode, "on");
	assert.equal(snapshot.state.episode.status, "open");
	const notebookId = decodeNotebookId(snapshot.state.selectedNotebookId);
	if (!notebookId) assert.fail("Expected selected notebook");
	const notebook = requireNotebook(await openNotebook(input.root));
	return handoff({ notebookId, root: notebook.root });
}

async function emptyPreparedMemoPass(input: {
	readonly port: FakePort;
	readonly root: string;
	readonly passId: string;
}): Promise<Record<string, unknown>> {
	const snapshot = reconstructObserverPiState(input.port.entries);
	const memo = reconstructMemoSession(input.port.entries);
	if (snapshot.state.episode.status !== "open") {
		assert.fail("Expected open episode for Memo pass");
	}
	const notebook = requireNotebook(await openNotebook(input.root));
	const inventory = requireNotebook(await readNotebookInventory(notebook));
	const scope = hydrateMemoScope({
		lifecycle: snapshot.state,
		working: memo.state,
		inventory,
		relatedInquiryIds: [],
		workingSourceBases: [],
	});
	if (!scope.ok) assert.fail(JSON.stringify(scope.issue));
	return {
		observer_memo_pass: "observer.prepared-memo-pass/v1",
		pass_id: input.passId,
		episode_id: snapshot.state.episode.core.episodeId,
		base_revision_id: memo.state.revisionId,
		basis_digest: scope.value.basisDigest,
		related_inquiry_ids: [],
		instruction_id: null,
		evidence: [],
		hypothesis_outcomes: [],
		memo_outcomes: [],
	};
}

describe("Observer command parsing", () => {
	test("parses exact actions and preserves absolute or relative paths", () => {
		assert.deepEqual(parseObserveCommand(""), {
			ok: true,
			command: { kind: "status" },
		});
		assert.deepEqual(parseObserveCommand("setup ko /tmp/My Notes"), {
			ok: true,
			command: { kind: "setup", lang: "ko", root: "/tmp/My Notes" },
		});
		assert.deepEqual(parseObserveCommand("setup en ./Observer Notes"), {
			ok: true,
			command: { kind: "setup", lang: "en", root: "./Observer Notes" },
		});
		assert.deepEqual(parseObserveCommand("memo"), {
			ok: true,
			command: { kind: "memo" },
		});
		assert.deepEqual(parseObserveCommand("save"), {
			ok: true,
			command: { kind: "save" },
		});
		assert.equal(parseObserveCommand("wrap").ok, false);
		assert.equal(parseObserveCommand("on extra").ok, false);
		assert.equal(parseObserveCommand("setup /tmp/missing-language").ok, false);
		assert.deepEqual(
			completeObserveArgs("st")?.map((item) => item.value),
			["status"],
		);
		assert.deepEqual(
			completeObserveArgs("add")?.map((item) => item.value),
			["add-hypothesis"],
		);
		assert.deepEqual(
			completeObserveArgs("mat")?.map((item) => item.value),
			["material"],
		);
	});
});

describe("Observer command controller", () => {
	test("sets up, opens, turns off, and resumes the same episode", async () => {
		await withSandbox(async (sandbox) => {
			const store = selectionStore(sandbox);
			const controller = createObserverController({
				selectionStore: store,
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "notebook with spaces");
			await setupAndTurnOn({ controller, port, root });
			const opened = reconstructObserverPiState(port.entries);
			if (
				opened.state.episode.status !== "open" &&
				opened.state.episode.status !== "reviewing-save"
			) {
				assert.fail("Expected live episode");
			}
			const episodeId = opened.state.episode.core.episodeId;
			await controller.command("off", port);
			const stopped = reconstructObserverPiState(port.entries);
			assert.equal(stopped.state.mode, "off");
			assert.equal(stopped.state.episode.status, "open");

			const restarted = createObserverController({
				selectionStore: store,
				ids: deterministicIds(),
			});
			await restarted.bind(port);
			await restarted.command("on", port);
			const resumed = reconstructObserverPiState(port.entries);
			assert.equal(resumed.state.mode, "on");
			assert.equal(resumed.state.episode.status, "open");
			if (resumed.state.episode.status !== "open") return;
			assert.equal(resumed.state.episode.core.episodeId, episodeId);
			assert.match(
				port.statuses.at(-1) ?? "",
				/Observer · On · Open · Healthy/u,
			);
		});
	});

	test("opens and reuses a material review Episode without changing Mode", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "material-review notebook");
			await controller.command(`setup en ${root}`, port);
			const before = reconstructObserverPiState(port.entries);
			assert.equal(before.state.mode, "off");
			assert.equal(before.state.episode.status, "empty");

			const opened = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent(),
				port,
			);
			if (!opened.ok) assert.fail(opened.message);
			assert.equal(opened.status, "opened");
			assert.equal(opened.value.requestId, materialReviewIntent().requestId);
			const snapshot = reconstructObserverPiState(port.entries);
			assert.equal(snapshot.state.mode, "off");
			assert.equal(snapshot.state.episode.status, "open");
			assert.equal(
				port.entries.some(
					(entry) =>
						entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
						isObject(entry.data) &&
						entry.data.kind === "activation-changed" &&
						entry.data.enabled === true,
				),
				false,
			);

			const count = port.entries.length;
			const resumed = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent(),
				port,
			);
			if (!resumed.ok) assert.fail(resumed.message);
			assert.equal(resumed.status, "resumed");
			assert.equal(resumed.value.episodeId, opened.value.episodeId);
			assert.equal(port.entries.length, count);

			await controller.command("on", port);
			const beforeActiveResume = port.entries.length;
			const active = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent(),
				port,
			);
			if (!active.ok) assert.fail(active.message);
			assert.equal(active.status, "resumed");
			assert.equal(active.value.episodeId, opened.value.episodeId);
			assert.equal(reconstructObserverPiState(port.entries).state.mode, "on");
			assert.equal(port.entries.length, beforeActiveResume);
		});
	});

	test("opens and reuses a hypothesis Episode without changing Observer Mode", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			await controller.command(
				`setup ko ${join(sandbox, "hypothesis notebook")}`,
				port,
			);

			const opened = await controller.ensureUserHypothesisEpisode(port);
			if (!opened.ok) assert.fail(opened.message);
			assert.equal(opened.status, "opened");
			assert.equal(opened.value.mode, "off");
			assert.equal(opened.value.lang, "ko");
			const offSnapshot = reconstructObserverPiState(port.entries);
			assert.equal(offSnapshot.state.mode, "off");
			assert.equal(offSnapshot.state.episode.status, "open");

			const beforeResume = port.entries.length;
			const resumed = await controller.ensureUserHypothesisEpisode(port);
			if (!resumed.ok) assert.fail(resumed.message);
			assert.equal(resumed.status, "resumed");
			assert.equal(resumed.value.episodeId, opened.value.episodeId);
			assert.equal(port.entries.length, beforeResume);

			await controller.command("on", port);
			const active = await controller.ensureUserHypothesisEpisode(port);
			if (!active.ok) assert.fail(active.message);
			assert.equal(active.status, "resumed");
			assert.equal(active.value.mode, "on");
			assert.equal(active.value.episodeId, opened.value.episodeId);
		});
	});

	test("returns no material review capability across Episode append throw/drop gaps", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			await controller.command(
				`setup en ${join(sandbox, "material-review recovery notebook")}`,
				port,
			);
			port.failMaterialReviewOpenAppend = true;
			const thrown = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent(),
				port,
			);
			assert.equal(thrown.ok, false);
			assert.equal(
				reconstructObserverPiState(port.entries).state.episode.status,
				"empty",
			);
			port.dropMaterialReviewOpenAppend = true;
			const dropped = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent(),
				port,
			);
			assert.equal(dropped.ok, false);
			assert.equal(
				reconstructObserverPiState(port.entries).state.episode.status,
				"empty",
			);
			const recovered = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent(),
				port,
			);
			assert.equal(recovered.ok, true);
			if (recovered.ok) assert.equal(recovered.status, "opened");
		});
	});

	test("resolves relative Notebook paths from Pi's working directory", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			port.cwd = sandbox;
			await controller.command("setup en ./relative notebook", port);
			const opened = requireNotebook(
				await openNotebook(join(sandbox, "relative notebook")),
			);
			assert.equal(opened.manifest.default_language, "en");
		});
	});

	test("supports interactive setup without applying hidden defaults", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "prompt notebook");
			port.inputs.push(root);
			port.selections.push("ko");
			await controller.command("setup", port);
			const opened = requireNotebook(await openNotebook(root));
			assert.equal(opened.manifest.default_language, "ko");
		});
	});

	test("changes only the next-episode language while a live episode stays fixed", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "language settings notebook");
			await controller.command(`setup ko ${root}`, port);
			await controller.command("on", port);

			assert.equal(await controller.updateDefaultLanguage("en", port), true);
			const opened = requireNotebook(await openNotebook(root));
			assert.equal(opened.manifest.default_language, "en");
			const view = await controller.inspect(port);
			assert.equal(view.control.mode, "on");
			assert.equal(view.control.episode, "open");
			assert.equal(view.control.notebookDefaultLanguage, "en");
			assert.equal(view.episodeLanguage, "ko");
			assert.match(
				port.notifications.at(-1)?.message ?? "",
				/current Episode output remains ko/u,
			);
		});
	});

	test("reports honest status and does not mutate history", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			port.persistedSession = "";
			const before = port.entries.length;
			await controller.command("status", port);
			assert.equal(port.entries.length, before);
			const text = port.notifications.at(-1)?.message ?? "";
			assert.match(text, /Ephemeral session/u);
			assert.match(text, /Pending Memos: Not counted yet/u);
		});
	});

	test("applies a prepared Memo pass before lifecycle acknowledgment without Markdown writes", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "memo notebook");
			await setupAndTurnOn({ controller, port, root });
			const beforeNotebook = requireNotebook(await openNotebook(root));
			const beforeInventory = requireNotebook(
				await readNotebookInventory(beforeNotebook),
			);
			const prepared = await emptyPreparedMemoPass({
				port,
				root,
				passId: "memo-pass-00000000-0000-4000-8000-000000000201",
			});
			assert.equal(await controller.installPreparedMemo(prepared, port), true);
			await controller.command("memo", port);

			const preparedIndex = port.entries.findIndex(
				(entry) => entry.customType === OBSERVER_PREPARED_MEMO_ENTRY,
			);
			const appliedIndex = port.entries.findIndex(
				(entry) => entry.customType === OBSERVER_APPLIED_MEMO_ENTRY,
			);
			const acknowledgmentIndex = port.entries.findIndex(
				(entry) =>
					entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
					isObject(entry.data) &&
					entry.data.kind === "memo-reconciled",
			);
			assert.ok(preparedIndex >= 0);
			assert.ok(appliedIndex > preparedIndex);
			assert.ok(acknowledgmentIndex > appliedIndex);

			const memo = reconstructMemoSession(port.entries);
			assert.equal(memo.issues.length, 0);
			assert.equal(memo.state.passes, 1);
			assert.equal(memo.pendingAcknowledgment, null);
			assert.equal(memo.lifecycle.mode, "on");
			assert.equal(memo.lifecycle.episode.status, "open");
			const afterNotebook = requireNotebook(await openNotebook(root));
			const afterInventory = requireNotebook(
				await readNotebookInventory(afterNotebook),
			);
			assert.deepEqual(afterInventory, beforeInventory);

			await controller.command("status", port);
			const status = port.notifications.at(-1)?.message ?? "";
			assert.match(status, /Pending Memos: 0/u);
			assert.match(status, /Open Inquiries: 0/u);
			assert.match(status, /Zettel candidates: 0/u);
			const entryCount = port.entries.length;
			await controller.command("memo", port);
			assert.equal(port.entries.length, entryCount);
			assert.match(
				port.notifications.at(-1)?.message ?? "",
				/There is no new prepared reconciliation/u,
			);
		});
	});

	test("recovers a prepared-pass apply append gap without duplicate application", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "memo apply recovery notebook");
			await setupAndTurnOn({ controller, port, root });
			const prepared = await emptyPreparedMemoPass({
				port,
				root,
				passId: "memo-pass-00000000-0000-4000-8000-000000000203",
			});
			assert.equal(await controller.installPreparedMemo(prepared, port), true);
			port.failMemoAppliedAppend = true;
			await controller.command("memo", port);
			const interrupted = reconstructMemoSession(port.entries);
			assert.equal(interrupted.state.passes, 0);
			assert.notEqual(interrupted.prepared, null);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_APPLIED_MEMO_ENTRY,
				).length,
				0,
			);

			await controller.command("memo", port);
			const recovered = reconstructMemoSession(port.entries);
			assert.equal(recovered.issues.length, 0);
			assert.equal(recovered.state.passes, 1);
			assert.equal(recovered.prepared, null);
			assert.equal(recovered.pendingAcknowledgment, null);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_APPLIED_MEMO_ENTRY,
				).length,
				1,
			);
		});
	});

	test("recovers a Memo applied-entry acknowledgment gap without reapplying", async () => {
		await withSandbox(async (sandbox) => {
			const store = selectionStore(sandbox);
			const controller = createObserverController({
				selectionStore: store,
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "memo recovery notebook");
			await setupAndTurnOn({ controller, port, root });
			const prepared = await emptyPreparedMemoPass({
				port,
				root,
				passId: "memo-pass-00000000-0000-4000-8000-000000000202",
			});
			assert.equal(await controller.installPreparedMemo(prepared, port), true);
			port.failMemoAcknowledgmentAppend = true;
			await controller.command("memo", port);
			const pending = reconstructMemoSession(port.entries);
			assert.equal(pending.state.passes, 1);
			assert.notEqual(pending.pendingAcknowledgment, null);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_APPLIED_MEMO_ENTRY,
				).length,
				1,
			);

			const restarted = createObserverController({
				selectionStore: store,
				ids: deterministicIds(),
			});
			await restarted.bind(port);
			const recovered = reconstructMemoSession(port.entries);
			assert.equal(recovered.issues.length, 0);
			assert.equal(recovered.pendingAcknowledgment, null);
			assert.equal(recovered.state.passes, 1);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_APPLIED_MEMO_ENTRY,
				).length,
				1,
			);
		});
	});

	test("blocks mutation when owned branch history is malformed", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			port.entries.push({
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: { bad: true },
			});
			await controller.command(`setup en ${join(sandbox, "blocked")}`, port);
			assert.equal(port.entries.length, 1);
			assert.equal(port.notifications.at(-1)?.type, "error");
			const blockedNotebook = await openNotebook(join(sandbox, "blocked"));
			assert.equal(blockedNotebook.ok, false);
		});
	});

	test("installs and declines a prepared proposal without record writes", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "notebook");
			const proposal = await setupAndTurnOn({ controller, port, root });
			assert.equal(await controller.installPrepared(proposal, port), true);
			port.confirmations.push(false);
			await controller.command("save", port);
			const snapshot = reconstructObserverPiState(port.entries);
			assert.equal(snapshot.state.mode, "on");
			assert.equal(snapshot.state.episode.status, "open");
			const notebook = requireNotebook(await openNotebook(root));
			assert.equal(notebook.recordCount, 0);
		});
	});

	test("records approval before local save and commit acknowledgment after readback", async () => {
		await withSandbox(async (sandbox) => {
			const controller = createObserverController({
				selectionStore: selectionStore(sandbox),
				ids: deterministicIds(),
			});
			const port = new FakePort();
			const root = join(sandbox, "notebook");
			const markdown = await createdSource();
			const initial = await setupAndTurnOn({ controller, port, root });
			const proposal = handoff({
				notebookId: initial.prepared.notebook_id,
				root: initial.prepared.root,
				markdown,
			});
			await controller.installPrepared(proposal, port);
			port.confirmations.push(true);
			await controller.command("save", port);
			const snapshot = reconstructObserverPiState(port.entries);
			assert.equal(
				snapshot.state.mode,
				"off",
				JSON.stringify(port.notifications),
			);
			assert.equal(snapshot.state.episode.status, "settled");
			const attemptIndex = port.entries.findIndex(
				(entry) => entry.customType === OBSERVER_SAVE_ATTEMPT_ENTRY,
			);
			const commitIndex = port.entries.findIndex(
				(entry) =>
					entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
					isObject(entry.data) &&
					entry.data.kind === "save-committed",
			);
			assert.ok(attemptIndex >= 0);
			assert.ok(commitIndex > attemptIndex);
			assert.equal(
				await readFile(join(root, "records", `${CREATED_SOURCE}.md`), "utf8"),
				markdown,
			);
			const reopened = await controller.ensureMaterialReviewEpisode(
				materialReviewIntent("저장된 자료를 다시 Observer 관점으로 봐줘."),
				port,
			);
			if (!reopened.ok) assert.fail(reopened.message);
			assert.equal(reopened.status, "opened");
			const materialReviewState = reconstructObserverPiState(port.entries);
			assert.equal(materialReviewState.state.mode, "off");
			assert.equal(materialReviewState.state.episode.status, "open");
		});
	});

	test("recovers a post-save pre-ack gap without republishing", async () => {
		await withSandbox(async (sandbox) => {
			const store = selectionStore(sandbox);
			const ids = deterministicIds();
			const controller = createObserverController({
				selectionStore: store,
				ids,
			});
			const port = new FakePort();
			const root = join(sandbox, "notebook");
			const markdown = await createdSource();
			const initial = await setupAndTurnOn({ controller, port, root });
			const proposal = handoff({
				notebookId: initial.prepared.notebook_id,
				root: initial.prepared.root,
				markdown,
			});
			await controller.installPrepared(proposal, port);
			port.confirmations.push(true);
			port.failCommitAppend = true;
			await assert.rejects(controller.command("save", port));
			const beforeRecovery = reconstructObserverPiState(port.entries);
			assert.equal(beforeRecovery.state.episode.status, "reviewing-save");
			assert.ok(beforeRecovery.attempt);
			const saved = await readFile(
				join(root, "records", `${CREATED_SOURCE}.md`),
				"utf8",
			);
			assert.equal(saved, markdown);

			const restarted = createObserverController({
				selectionStore: store,
				ids,
			});
			await restarted.bind(port);
			const recovered = reconstructObserverPiState(port.entries);
			assert.equal(recovered.state.episode.status, "settled");
			assert.equal(recovered.state.mode, "off");
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_SAVE_ATTEMPT_ENTRY,
				).length,
				1,
			);
		});
	});
});

describe("Observer save acknowledgment inspection", () => {
	test("distinguishes before, exact final, mixed, and active states", async () => {
		await withSandbox(async (sandbox) => {
			const store = selectionStore(sandbox);
			const notebooks = createNotebookService({ selectionStore: store });
			const root = join(sandbox, "notebook");
			const setup = requireNotebook(
				await notebooks.setup({
					root,
					defaultLanguage: "en",
					state: reconstructObserverPiState([]).state,
				}),
			);
			const markdown = await createdSource();
			const proposal = handoff({
				notebookId: setup.notebook.manifest.notebook_id,
				root: setup.notebook.root,
				markdown,
			});
			let receipts = 0;
			const dependencies = {
				receiptId(): `receipt-${string}` {
					receipts += 1;
					return `receipt-inspection-${receipts}`;
				},
			};
			const before = await inspectSaveAcknowledgment({
				notebook: setup.notebook,
				prepared: proposal.prepared,
				dependencies,
			});
			assert.equal(before.status, "before");

			const target = join(root, "records", `${CREATED_SOURCE}.md`);
			await writeFile(target, markdown, "utf8");
			const reopenedFinal = requireNotebook(await openNotebook(root));
			const final = await inspectSaveAcknowledgment({
				notebook: reopenedFinal,
				prepared: proposal.prepared,
				dependencies,
			});
			assert.equal(final.status, "final");
			if (final.status === "final") {
				assert.equal(final.receipt.records[0]?.sha256, sha256Text(markdown));
			}

			const changed = markdown.replace(
				"A source record identifies the edition used during observation.",
				"A manual edit changed this source after approval.",
			);
			await writeFile(target, changed, "utf8");
			const reopenedMixed = requireNotebook(await openNotebook(root));
			const mixed = await inspectSaveAcknowledgment({
				notebook: reopenedMixed,
				prepared: proposal.prepared,
				dependencies,
			});
			assert.equal(mixed.status, "mixed");

			await mkdir(wrapTransactionActivePath(root), { recursive: true });
			const active = await inspectSaveAcknowledgment({
				notebook: reopenedMixed,
				prepared: proposal.prepared,
				dependencies,
			});
			assert.equal(active.status, "active");
		});
	});

	test("bind-time attempt identity is exact", async () => {
		const value = handoff({
			notebookId: "notebook-00000000-0000-4000-8000-000000000001",
			root: "/tmp/notebook",
		});
		const attempt = {
			protocol: OBSERVER_SAVE_ATTEMPT_PROTOCOL,
			kind: "approved",
			attemptId: "attempt-exact",
			proposalId: value.prepared.proposal_id,
			preparedDigest: preparedSaveDigest(value),
		};
		assert.equal(attempt.preparedDigest, preparedSaveDigest(value));
	});
});
