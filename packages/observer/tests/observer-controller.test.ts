import assert from "node:assert/strict";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import {
	createObserverController,
	type ObserverCommandPort,
	type ObserverControllerIds,
} from "../src/observer-controller.ts";
import {
	completeObserveArgs,
	parseObserveCommand,
} from "../src/observer-command.ts";
import { decodeNotebookId, openNotebook } from "../src/notebook.ts";
import { createNotebookService } from "../src/notebook-service.ts";
import {
	fileNotebookSelectionStore,
	type NotebookSelectionStore,
} from "../src/notebook-selection-store.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_WRAP_PROTOCOL,
	OBSERVER_WRAP_ATTEMPT_ENTRY,
	OBSERVER_WRAP_ATTEMPT_PROTOCOL,
	preparedWrapDigest,
	reconstructObserverPiState,
	type PiBranchEntryLike,
	type PreparedWrapHandoff,
} from "../src/pi-session.ts";
import { inspectWrapAcknowledgment } from "../src/wrap-acknowledgment.ts";
import { OBSERVER_WRAP_SCHEMA } from "../src/wrap-profile.ts";
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

	branchEntries(): readonly PiBranchEntryLike[] {
		return this.entries;
	}

	sessionFile(): string | undefined {
		return this.persistedSession || undefined;
	}

	appendEntry(customType: string, data: unknown): void {
		if (
			this.failCommitAppend &&
			customType === OBSERVER_LIFECYCLE_ENTRY &&
			isObject(data) &&
			data.kind === "wrap-committed"
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

	notify(
		message: string,
		type: "info" | "warning" | "error" = "info",
	): void {
		this.notifications.push({ message, type });
	}

	setStatus(text: string | undefined): void {
		this.statuses.push(text);
	}
}

function deterministicIds(): ObserverControllerIds {
	let episodes = 0;
	let attempts = 0;
	let receipts = 0;
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
}): PreparedWrapHandoff {
	return {
		protocol: OBSERVER_PREPARED_WRAP_PROTOCOL,
		summary: "승인할 Observer wrap 계획",
		prepared: {
			observer_wrap: OBSERVER_WRAP_SCHEMA,
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
}): Promise<PreparedWrapHandoff> {
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

describe("Observer command parsing", () => {
	test("parses exact actions and preserves a spaced absolute path", () => {
		assert.deepEqual(parseObserveCommand(""), {
			ok: true,
			command: { kind: "status" },
		});
		assert.deepEqual(parseObserveCommand("setup ko /tmp/My Notes"), {
			ok: true,
			command: { kind: "setup", lang: "ko", root: "/tmp/My Notes" },
		});
		assert.equal(parseObserveCommand("on extra").ok, false);
		assert.equal(parseObserveCommand("setup /tmp/missing-language").ok, false);
		assert.deepEqual(
			completeObserveArgs("st")?.map((item) => item.value),
			["status"],
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
				opened.state.episode.status !== "reviewing-wrap"
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
			assert.match(port.statuses.at(-1) ?? "", /Observer · 켜짐 · 열림 · 정상/u);
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
			assert.match(text, /임시 세션/u);
			assert.match(text, /아직 집계되지 않음 \(Slice 6\+\)/u);
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
			await controller.command("wrap", port);
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
			await controller.command("wrap", port);
			const snapshot = reconstructObserverPiState(port.entries);
			assert.equal(
				snapshot.state.mode,
				"off",
				JSON.stringify(port.notifications),
			);
			assert.equal(snapshot.state.episode.status, "settled");
			const attemptIndex = port.entries.findIndex(
				(entry) => entry.customType === OBSERVER_WRAP_ATTEMPT_ENTRY,
			);
			const commitIndex = port.entries.findIndex(
				(entry) =>
					entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
					isObject(entry.data) &&
					entry.data.kind === "wrap-committed",
			);
			assert.ok(attemptIndex >= 0);
			assert.ok(commitIndex > attemptIndex);
			assert.equal(
				await readFile(join(root, "records", `${CREATED_SOURCE}.md`), "utf8"),
				markdown,
			);
		});
	});

	test("recovers a post-save pre-ack gap without republishing", async () => {
		await withSandbox(async (sandbox) => {
			const store = selectionStore(sandbox);
			const ids = deterministicIds();
			const controller = createObserverController({ selectionStore: store, ids });
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
			await assert.rejects(controller.command("wrap", port));
			const beforeRecovery = reconstructObserverPiState(port.entries);
			assert.equal(beforeRecovery.state.episode.status, "reviewing-wrap");
			assert.ok(beforeRecovery.attempt);
			const saved = await readFile(
				join(root, "records", `${CREATED_SOURCE}.md`),
				"utf8",
			);
			assert.equal(saved, markdown);

			const restarted = createObserverController({ selectionStore: store, ids });
			await restarted.bind(port);
			const recovered = reconstructObserverPiState(port.entries);
			assert.equal(recovered.state.episode.status, "settled");
			assert.equal(recovered.state.mode, "off");
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_WRAP_ATTEMPT_ENTRY,
				).length,
				1,
			);
		});
	});
});

describe("Observer wrap acknowledgment inspection", () => {
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
			const before = await inspectWrapAcknowledgment({
				notebook: setup.notebook,
				prepared: proposal.prepared,
				dependencies,
			});
			assert.equal(before.status, "before");

			const target = join(root, "records", `${CREATED_SOURCE}.md`);
			await writeFile(target, markdown, "utf8");
			const reopenedFinal = requireNotebook(await openNotebook(root));
			const final = await inspectWrapAcknowledgment({
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
			const mixed = await inspectWrapAcknowledgment({
				notebook: reopenedMixed,
				prepared: proposal.prepared,
				dependencies,
			});
			assert.equal(mixed.status, "mixed");

			await mkdir(wrapTransactionActivePath(root), { recursive: true });
			const active = await inspectWrapAcknowledgment({
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
			protocol: OBSERVER_WRAP_ATTEMPT_PROTOCOL,
			kind: "approved",
			attemptId: "attempt-exact",
			proposalId: value.prepared.proposal_id,
			preparedDigest: preparedWrapDigest(value),
		};
		assert.equal(attempt.preparedDigest, preparedWrapDigest(value));
	});
});
