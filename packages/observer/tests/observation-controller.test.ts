import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
	completeMemoPreparation,
	completeSavePreparation,
	observationToolText,
} from "../extensions/observer.ts";
import {
	routeMaterialReviewTool,
	type ObserverTurnState,
} from "../extensions/material-review-runtime.ts";
import { sha256Text } from "../src/content-hash.ts";
import { initialObserverState, OBSERVER_PROTOCOL } from "../src/lifecycle.ts";
import {
	executeMaterialReviewFinish,
	executeMaterialReviewStart,
	materialReviewCommandText,
	materialReviewContext,
} from "../src/material-review-command.ts";
import { OBSERVER_MEMO_INSTRUCTION_ENTRY } from "../src/memo-instruction.ts";
import {
	createNotebookService,
	type NotebookService,
} from "../src/notebook-service.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";
import {
	createObservationController,
	type ObservationCommandPort,
	type ObservationControllerIds,
} from "../src/observation-controller.ts";
import {
	createObserverController,
	type ObserverController,
	type ObserverControllerIds,
	type MaterialReviewEpisodeCapability,
} from "../src/observer-controller.ts";
import {
	OBSERVER_APPLIED_MEMO_ENTRY,
	OBSERVER_PREPARED_MEMO_ENTRY,
} from "../src/memo-session.ts";
import {
	MAX_OBSERVATION_TEXT_LENGTH,
	OBSERVER_OBSERVATION_ENTRY,
} from "../src/observation-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_SAVE_ENTRY,
	reconstructObserverPiState,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";
import {
	OBSERVER_MATERIAL_REVIEW_ENTRY,
	refineMaterialReviewIntent,
	type MaterialReviewIntent,
} from "../src/material-review-trigger.ts";
import {
	OBSERVER_SAVE_REQUEST_ENTRY,
	reconstructSaveRequestSession,
	type SavePreparationGuide,
} from "../src/save-trigger.ts";

const BASELINE = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);
const DURABLE_INQUIRY = "inquiry-00000000-0000-4000-8000-000000000003";
const DURABLE_MEMO = "memo-00000000-0000-4000-8000-000000000004";

function wrappedSourceMarkdown(sourceId: string): string {
	return `---
observer_schema: observer-record/v1
observer_type: source
observer_status: available
id: ${sourceId}
title: Saveped observation source
lang: en
created: "2026-08-01T10:05:00Z"
modified: "2026-08-01T10:05:00Z"
tags: []
aliases: []
sources: []
lineage: []
relations: []
source_kind: external-material
external:
  uri: https://example.test/material
---
# Saveped observation source

Immediate notes can preserve retrieval cues.
`;
}

function toolPayload(
	result: Parameters<typeof observationToolText>[0],
): ReturnType<typeof JSON.parse> {
	try {
		return JSON.parse(observationToolText(result));
	} catch (error) {
		assert.fail(
			`Observer tool payload must be JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function wrappedInquiryMarkdown(inquiryId: string, sourceId: string): string {
	return `---
observer_schema: observer-record/v1
observer_type: inquiry
observer_status: open
id: ${inquiryId}
title: Timing and re-entry inquiry
lang: en
created: "2026-08-01T10:05:00Z"
modified: "2026-08-01T10:05:00Z"
tags: []
aliases: []
sources:
  - record: ${sourceId}
    role: context
lineage: []
relations: []
inquiry:
  origin: user
  original: 재진입 비용은 기록 시점에 따라 달라진다.
  current: 재진입 비용은 기록 시점에 따라 달라진다.
---
# Timing and re-entry inquiry

The explicit user hypothesis remains open for later inquiry.
`;
}

class FakePort implements ObservationCommandPort {
	readonly entries: PiBranchEntryLike[] = [];
	readonly notifications: Array<{
		readonly message: string;
		readonly type: "info" | "warning" | "error";
	}> = [];
	failNextObservationAppend = false;
	dropNextObservationAppend = false;
	failNextMaterialReviewAppend = false;
	dropNextMaterialReviewAppend = false;
	failNextInstructionAppend = false;
	dropNextInstructionAppend = false;
	failNextSaveRequestAppend = false;
	dropNextSaveRequestAppend = false;
	confirmation = true;

	branchEntries(): readonly PiBranchEntryLike[] {
		return this.entries;
	}

	appendEntry(customType: string, data: unknown): void {
		if (
			this.failNextMaterialReviewAppend &&
			customType === OBSERVER_MATERIAL_REVIEW_ENTRY
		) {
			this.failNextMaterialReviewAppend = false;
			throw new Error("Injected material review request append failure");
		}
		if (
			this.dropNextMaterialReviewAppend &&
			customType === OBSERVER_MATERIAL_REVIEW_ENTRY
		) {
			this.dropNextMaterialReviewAppend = false;
			return;
		}
		if (
			this.failNextSaveRequestAppend &&
			customType === OBSERVER_SAVE_REQUEST_ENTRY
		) {
			this.failNextSaveRequestAppend = false;
			throw new Error("Injected Review & Save request append failure");
		}
		if (
			this.dropNextSaveRequestAppend &&
			customType === OBSERVER_SAVE_REQUEST_ENTRY
		) {
			this.dropNextSaveRequestAppend = false;
			return;
		}
		if (
			this.failNextInstructionAppend &&
			customType === OBSERVER_MEMO_INSTRUCTION_ENTRY
		) {
			this.failNextInstructionAppend = false;
			throw new Error("Injected Memo instruction append failure");
		}
		if (
			this.dropNextInstructionAppend &&
			customType === OBSERVER_MEMO_INSTRUCTION_ENTRY
		) {
			this.dropNextInstructionAppend = false;
			return;
		}
		if (
			this.failNextObservationAppend &&
			customType === OBSERVER_OBSERVATION_ENTRY
		) {
			this.failNextObservationAppend = false;
			throw new Error("Injected observation append failure");
		}
		if (
			this.dropNextObservationAppend &&
			customType === OBSERVER_OBSERVATION_ENTRY
		) {
			this.dropNextObservationAppend = false;
			return;
		}
		this.entries.push({ type: "custom", customType, data });
	}

	notify(message: string, type: "info" | "warning" | "error" = "info"): void {
		this.notifications.push({ message, type });
	}

	sessionFile(): string {
		return "/tmp/observer-sidecar-session.jsonl";
	}

	input(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	select(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	reviewSaveProposal(): Promise<"approve" | "reject"> {
		return Promise.resolve(this.confirmation ? "approve" : "reject");
	}

	setStatus(): void {}
}

function lifecycleIds(): ObserverControllerIds {
	let revision = 0;
	let receipt = 0;
	return {
		episodeId() {
			return "episode-unused";
		},
		attemptId() {
			return "attempt-unused";
		},
		receiptId(): `receipt-${string}` {
			return "receipt-00000000-0000-4000-8000-000000000001";
		},
		memoRevisionId() {
			revision += 1;
			return `memo-working-revision-00000000-0000-4000-8000-${String(revision).padStart(12, "0")}`;
		},
		memoReceiptId(): `memo-receipt-${string}` {
			receipt += 1;
			return `memo-receipt-00000000-0000-4000-8000-${String(receipt).padStart(12, "0")}`;
		},
	};
}

function materialReviewIntent(input: {
	readonly text: string;
	readonly material: "inline-user-message" | "retrieved-tool-results";
	readonly requestId: `material-review-${string}`;
}): MaterialReviewIntent {
	const refined = refineMaterialReviewIntent({
		value: {
			observer_action: "observer-sidecar/v1",
			action: "material-review-start",
			user_message_digest: sha256Text(input.text),
			material: { kind: input.material },
		},
		latestUser: { text: input.text, inputSource: "interactive" },
		requestId: input.requestId,
	});
	if (!refined.ok) assert.fail(refined.issue.message);
	return refined.value;
}

async function materialReviewEpisode(input: {
	readonly controller: ObserverController;
	readonly port: FakePort;
	readonly intent: MaterialReviewIntent;
}): Promise<MaterialReviewEpisodeCapability> {
	const ensured = await input.controller.ensureMaterialReviewEpisode(
		input.intent,
		input.port,
	);
	if (!ensured.ok) assert.fail(ensured.message);
	return ensured.value;
}

function deterministicIds(): ObservationControllerIds {
	let candidate = 0;
	let read = 0;
	let hydration = 0;
	let observation = 0;
	let source = 100;
	let inquiry = 0;
	let memoRequest = 0;
	let saveRequest = 0;
	let saveProposal = 0;
	function suffix(value: number): string {
		return String(value).padStart(12, "0");
	}
	return {
		candidateId(): `candidate-${string}` {
			candidate += 1;
			return `candidate-00000000-0000-4000-8000-${suffix(candidate)}`;
		},
		sourceReadId(): `source-read-${string}` {
			read += 1;
			return `source-read-00000000-0000-4000-8000-${suffix(read)}`;
		},
		hydrationId(): `hydration-${string}` {
			hydration += 1;
			return `hydration-00000000-0000-4000-8000-${suffix(hydration)}`;
		},
		observationId(): `observation-${string}` {
			observation += 1;
			return `observation-00000000-0000-4000-8000-${suffix(observation)}`;
		},
		sourceId(): `source-${string}` {
			source += 1;
			return `source-00000000-0000-4000-8000-${suffix(source)}`;
		},
		inquiryId(): `inquiry-${string}` {
			inquiry += 1;
			return `inquiry-00000000-0000-4000-8000-${suffix(inquiry)}`;
		},
		memoRequestId(): `memo-request-${string}` {
			memoRequest += 1;
			return `memo-request-00000000-0000-4000-8000-${suffix(memoRequest)}`;
		},
		saveRequestId(): `save-request-${string}` {
			saveRequest += 1;
			return `save-request-00000000-0000-4000-8000-${suffix(saveRequest)}`;
		},
		saveProposalId(): `proposal-${string}` {
			saveProposal += 1;
			return `proposal-00000000-0000-4000-8000-${suffix(saveProposal)}`;
		},
	};
}

async function withSandbox(
	run: (input: {
		readonly sandbox: string;
		readonly service: NotebookService;
		readonly port: FakePort;
		readonly controller: ReturnType<typeof createObservationController>;
		readonly lifecycleController: ObserverController;
	}) => Promise<void>,
): Promise<void> {
	const sandbox = await mkdtemp(join(tmpdir(), "observer-sidecar-"));
	try {
		const root = join(sandbox, "notebook");
		await mkdir(root, { recursive: true });
		await cp(BASELINE, join(root, "records"), { recursive: true });
		const selectionStore = fileNotebookSelectionStore(
			join(sandbox, "state", "selection.json"),
		);
		const service = createNotebookService({ selectionStore });
		const setup = await service.setup({
			root,
			defaultLanguage: "en",
			state: initialObserverState(),
		});
		if (!setup.ok) assert.fail(setup.issue.message);
		const port = new FakePort();
		port.entries.push(
			{
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "notebook-selected",
					notebookId: setup.value.notebook.manifest.notebook_id,
				},
			},
			{
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "episode-opened",
					episodeId: "episode-sidecar-1",
					notebookId: setup.value.notebook.manifest.notebook_id,
					lang: "en",
				},
			},
			{
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "activation-changed",
					enabled: true,
				},
			},
		);
		const controller = createObservationController({
			selectionStore,
			ids: deterministicIds(),
		});
		const lifecycleController = createObserverController({
			selectionStore,
			ids: lifecycleIds(),
		});
		await run({ sandbox, service, port, controller, lifecycleController });
	} finally {
		await rm(sandbox, { force: true, recursive: true });
	}
}

function externalSourceAction(candidateId: string): Record<string, unknown> {
	return {
		observer_action: "observer-sidecar/v1",
		action: "source-read",
		candidate_ids: [candidateId],
		source: {
			kind: "external-material",
			title: "Interruption study",
			lang: "en",
			uri: "https://example.com/interruption",
			revision: null,
			content_hash: null,
			retrieval_context: "read tool result",
		},
		faithful_summary:
			"The source reports that capture timing changes interruption cost.",
		claims: [
			{
				text: "Capture timing changes interruption cost.",
				locator: "result",
			},
		],
	};
}

describe("Observation staged controller", () => {
	test("orchestrates inline material review without changing active Mode", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			const text = "이 문장을 Observer 관점으로 바로 관찰해 줘.";
			const value = {
				observer_action: "observer-sidecar/v1",
				action: "material-review-start",
				user_message_digest: sha256Text(text),
				material: { kind: "inline-user-message" },
			};
			let generated = 0;
			const ids = {
				requestId(): `material-review-${string}` {
					generated += 1;
					return `material-review-00000000-0000-4000-8000-${String(400 + generated).padStart(12, "0")}`;
				},
			};
			assert.equal(reconstructObserverPiState(port.entries).state.mode, "on");
			const beforeDigestRejection = port.entries.length;
			assert.equal(
				(
					await executeMaterialReviewStart({
						value: { ...value, user_message_digest: "0".repeat(64) },
						latestUser: { text, inputSource: "interactive" },
						capturedAt: "2026-08-01T09:58:00.000Z",
						port,
						lifecycle: lifecycleController,
						observation: controller,
						ids,
					})
				).ok,
				false,
			);
			assert.equal(port.entries.length, beforeDigestRejection);
			const activationCount = port.entries.filter(
				(entry) =>
					entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
					typeof entry.data === "object" &&
					entry.data !== null &&
					Reflect.get(entry.data, "kind") === "activation-changed" &&
					Reflect.get(entry.data, "enabled") === true,
			).length;
			const started = await executeMaterialReviewStart({
				value,
				latestUser: { text, inputSource: "interactive" },
				capturedAt: "2026-08-01T09:59:00.000Z",
				port,
				lifecycle: lifecycleController,
				observation: controller,
				ids,
			});
			if (!started.ok || started.action !== "material-review-start")
				assert.fail(
					started.ok ? "Expected material review start" : started.message,
				);
			assert.equal(started.status, "inline-captured");
			assert.ok(started.candidateId);
			assert.equal(reconstructObserverPiState(port.entries).state.mode, "on");
			assert.deepEqual(JSON.parse(materialReviewCommandText(started)), {
				ok: true,
				action: "material-review-start",
				status: "inline-captured",
				request_id: started.requestId,
				candidate_id: started.candidateId,
				next_action: "source-read",
			});
			const afterStarted = port.entries.length;
			const resumed = await executeMaterialReviewStart({
				value,
				latestUser: { text, inputSource: "interactive" },
				capturedAt: "2026-08-01T10:00:00.000Z",
				port,
				lifecycle: lifecycleController,
				observation: controller,
				ids,
			});
			if (!resumed.ok || resumed.action !== "material-review-start")
				assert.fail(resumed.ok ? "Expected resumed start" : resumed.message);
			assert.equal(resumed.status, "inline-resumed");
			assert.equal(resumed.requestId, started.requestId);
			assert.equal(port.entries.length, afterStarted);
			assert.equal(
				port.entries.filter(
					(entry) =>
						entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
						typeof entry.data === "object" &&
						entry.data !== null &&
						Reflect.get(entry.data, "kind") === "activation-changed" &&
						Reflect.get(entry.data, "enabled") === true,
				).length,
				activationCount,
			);
		});
	});

	test("orchestrates retrieved start and exposes only pending guidance", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			await lifecycleController.command("off", port);
			const text = "이 파일을 읽고 관찰해 줘: /tmp/input.md";
			const affordance = materialReviewContext({
				latestUser: { text, inputSource: "rpc" },
				entries: port.entries,
			});
			assert.match(affordance ?? "", new RegExp(sha256Text(text), "u"));
			assert.doesNotMatch(affordance ?? "", new RegExp(text, "u"));
			const started = await executeMaterialReviewStart({
				value: {
					observer_action: "observer-sidecar/v1",
					action: "material-review-start",
					user_message_digest: sha256Text(text),
					material: { kind: "retrieved-tool-results" },
				},
				latestUser: { text, inputSource: "rpc" },
				capturedAt: "2026-08-01T10:00:00.000Z",
				port,
				lifecycle: lifecycleController,
				observation: controller,
				ids: {
					requestId() {
						return "material-review-00000000-0000-4000-8000-000000000409";
					},
				},
			});
			if (!started.ok || started.action !== "material-review-start")
				assert.fail(started.ok ? "Expected retrieved start" : started.message);
			assert.equal(started.status, "pending-retrieval");
			assert.equal(started.candidateId, null);
			const guidance = materialReviewContext({
				latestUser: { text, inputSource: "rpc" },
				entries: port.entries,
			});
			assert.match(guidance ?? "", new RegExp(started.requestId, "u"));
			assert.match(guidance ?? "", /retrieved-tool-results/u);
			assert.match(guidance ?? "", /related_inquiry_ids.*first call hydrate/u);
			assert.match(
				guidance ?? "",
				/hydration_id=null and related_inquiry_ids=\[\]/u,
			);
			assert.match(guidance ?? "", /exactly one semantic Observation/u);
			assert.doesNotMatch(guidance ?? "", new RegExp(text, "u"));
		});
	});

	test("routes material review actions through the Pi runtime adapter as results or errors", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			await lifecycleController.command("off", port);
			const text = "이 경계를 바로 관찰해 줘.";
			const turnState: ObserverTurnState = {
				toolUsed: true,
				latestUser: { text, inputSource: "interactive" },
				scriptedMaterialRequest: null,
				blockedRequestId: null,
			};
			const routed = await routeMaterialReviewTool({
				value: {
					observer_action: "observer-sidecar/v1",
					action: "material-review-start",
					user_message_digest: sha256Text(text),
					material: { kind: "inline-user-message" },
				},
				capturedAt: "2026-08-01T10:00:00.000Z",
				port,
				lifecycle: lifecycleController,
				observation: controller,
				ids: {
					requestId() {
						return "material-review-00000000-0000-4000-8000-000000000410";
					},
				},
				turnState,
			});
			if (!routed || routed.result.action !== "material-review-start")
				assert.fail("Expected routed material review start");
			assert.match(routed.text, /"next_action":"source-read"/u);
			assert.equal(
				await routeMaterialReviewTool({
					value: { action: "not-material-review" },
					capturedAt: "2026-08-01T10:00:01.000Z",
					port,
					lifecycle: lifecycleController,
					observation: controller,
					ids: {
						requestId() {
							return "material-review-00000000-0000-4000-8000-000000000411";
						},
					},
					turnState,
				}),
				null,
			);
			await assert.rejects(
				routeMaterialReviewTool({
					value: {
						observer_action: "observer-sidecar/v1",
						action: "material-review-finish",
						request_id: routed.result.requestId,
					},
					capturedAt: "2026-08-01T10:00:02.000Z",
					port,
					lifecycle: lifecycleController,
					observation: controller,
					ids: {
						requestId() {
							return "material-review-00000000-0000-4000-8000-000000000412";
						},
					},
					turnState,
				}),
				/SourceReads must contain/u,
			);
		});
	});

	test("appends material review request before one exact OFF inline candidate and resumes both", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			await lifecycleController.command("off", port);
			const text = "이 문장을 Observer 관점으로 바로 관찰해 줘.";
			const firstIntent = materialReviewIntent({
				text,
				material: "inline-user-message",
				requestId: "material-review-00000000-0000-4000-8000-000000000301",
			});
			const firstEpisode = await materialReviewEpisode({
				controller: lifecycleController,
				port,
				intent: firstIntent,
			});
			const beforeMismatch = port.entries.length;
			const mismatched = controller.startMaterialReview(
				{
					intent: firstIntent,
					episode: {
						...firstEpisode,
						userMessageDigest: sha256Text("different intent"),
					},
					capturedAt: "2026-08-01T09:59:00.000Z",
				},
				port,
			);
			assert.equal(mismatched.ok, false);
			assert.equal(port.entries.length, beforeMismatch);
			const started = controller.startMaterialReview(
				{
					intent: firstIntent,
					episode: firstEpisode,
					capturedAt: "2026-08-01T10:00:00.000Z",
				},
				port,
			);
			if (!started.ok) assert.fail(started.message);
			assert.equal(started.status, "inline-captured");
			assert.equal(started.candidate.text, text);
			assert.equal(
				started.candidate.materialReviewRequestId,
				started.request.requestId,
			);
			assert.deepEqual(started.candidate.origin, {
				kind: "user-input",
				inputSource: "interactive",
			});
			const requestIndex = port.entries.findIndex(
				(entry) => entry.customType === OBSERVER_MATERIAL_REVIEW_ENTRY,
			);
			const candidateIndex = port.entries.findIndex(
				(entry) => entry.customType === OBSERVER_OBSERVATION_ENTRY,
			);
			assert.ok(requestIndex >= 0);
			assert.ok(candidateIndex > requestIndex);
			const replayed = reconstructObservationSession(port.entries);
			assert.equal(replayed.issues.length, 0);
			assert.equal(replayed.lifecycle.mode, "off");
			assert.equal(replayed.candidates.length, 1);
			const beforeUnrelatedTool = port.entries.length;
			const unrelatedTool = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-inline-unrelated",
						tool_name: "read",
					},
					text: "This result is unrelated to inline material.",
					capturedAt: "2026-08-01T10:00:30.000Z",
				},
				port,
			);
			assert.equal(unrelatedTool.ok, true);
			if (unrelatedTool.ok) assert.equal(unrelatedTool.status, "ignored");
			assert.equal(port.entries.length, beforeUnrelatedTool);

			const retryIntent = materialReviewIntent({
				text,
				material: "inline-user-message",
				requestId: "material-review-00000000-0000-4000-8000-000000000302",
			});
			const retryEpisode = await materialReviewEpisode({
				controller: lifecycleController,
				port,
				intent: retryIntent,
			});
			const count = port.entries.length;
			const resumed = controller.startMaterialReview(
				{
					intent: retryIntent,
					episode: retryEpisode,
					capturedAt: "2026-08-01T10:01:00.000Z",
				},
				port,
			);
			if (!resumed.ok) assert.fail(resumed.message);
			assert.equal(resumed.status, "inline-resumed");
			assert.equal(resumed.request.requestId, started.request.requestId);
			assert.equal(port.entries.length, count);
		});
	});

	test("keeps retrieved material review pending without creating user-source material", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			await lifecycleController.command("off", port);
			const intent = materialReviewIntent({
				text: "이 파일을 읽고 Observer 관점으로 관찰해 줘: /tmp/input.md",
				material: "retrieved-tool-results",
				requestId: "material-review-00000000-0000-4000-8000-000000000303",
			});
			const episode = await materialReviewEpisode({
				controller: lifecycleController,
				port,
				intent,
			});
			const started = controller.startMaterialReview(
				{
					intent,
					episode,
					capturedAt: "2026-08-01T10:02:00.000Z",
				},
				port,
			);
			if (!started.ok) assert.fail(started.message);
			assert.equal(started.status, "pending-retrieval");
			const unrelatedUser = controller.capture(
				{
					origin: { kind: "user-input", input_source: "interactive" },
					text: "후속 사용자 입력은 retrieval 결과가 아니다.",
					capturedAt: "2026-08-01T10:02:30.000Z",
				},
				port,
			);
			assert.equal(unrelatedUser.ok, true);
			if (unrelatedUser.ok) assert.equal(unrelatedUser.status, "ignored");
			port.failNextObservationAppend = true;
			const failed = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-retrieved-1",
						tool_name: "read",
					},
					text: "Exact retrieved source material.",
					capturedAt: "2026-08-01T10:03:00.000Z",
				},
				port,
			);
			assert.equal(failed.ok, false);
			port.dropNextObservationAppend = true;
			const dropped = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-retrieved-1",
						tool_name: "read",
					},
					text: "Exact retrieved source material.",
					capturedAt: "2026-08-01T10:03:00.000Z",
				},
				port,
			);
			assert.equal(dropped.ok, false);
			const captured = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-retrieved-1",
						tool_name: "read",
					},
					text: "Exact retrieved source material.",
					capturedAt: "2026-08-01T10:03:00.000Z",
				},
				port,
			);
			if (!captured.ok) assert.fail(captured.message);
			assert.equal(captured.status, "captured");
			if (!captured.candidate) assert.fail("Expected retrieved candidate");
			assert.equal(
				captured.candidate.materialReviewRequestId,
				started.request.requestId,
			);
			assert.deepEqual(captured.candidate.origin, {
				kind: "tool-result",
				toolCallId: "tool-call-retrieved-1",
				toolName: "read",
			});
			const replayed = reconstructObservationSession(port.entries);
			assert.equal(replayed.issues.length, 0);
			assert.equal(replayed.lifecycle.mode, "off");
			assert.equal(replayed.candidates.length, 1);
			const finishValue = {
				observer_action: "observer-sidecar/v1",
				action: "material-review-finish",
				request_id: started.request.requestId,
			};
			const beforeIncomplete = port.entries.length;
			assert.equal(
				executeMaterialReviewFinish({
					value: finishValue,
					port,
					observation: controller,
				}).ok,
				false,
			);
			assert.equal(port.entries.length, beforeIncomplete);
			const read = await controller.execute(
				externalSourceAction(captured.candidate.candidateId),
				port,
			);
			if (!read.ok || read.action !== "source-read")
				assert.fail(read.ok ? "Expected material review read" : read.message);
			assert.equal(
				read.read.materialReviewRequestId,
				started.request.requestId,
			);
			const hydrated = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!hydrated.ok || hydrated.action !== "hydrate")
				assert.fail(
					hydrated.ok ? "Expected material review hydration" : hydrated.message,
				);
			const recorded = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "record",
					read_id: read.read.readId,
					hydration_id: hydrated.hydration.hydrationId,
					related_inquiry_ids: [DURABLE_INQUIRY],
					stance: "challenges",
					movement: "core-counterexample",
					rationale:
						"Retrieved evidence changes the active material review inquiry.",
					observer_hypothesis: null,
				},
				port,
			);
			if (!recorded.ok || recorded.action !== "record")
				assert.fail(
					recorded.ok ? "Expected material review record" : recorded.message,
				);
			const completedChain = reconstructObservationSession(port.entries);
			assert.equal(completedChain.issues.length, 0);
			assert.equal(completedChain.lifecycle.mode, "off");
			assert.equal(completedChain.sourceReads.length, 1);
			assert.equal(completedChain.hydrations.length, 1);
			assert.equal(completedChain.observations.length, 1);
			port.failNextMaterialReviewAppend = true;
			assert.equal(
				executeMaterialReviewFinish({
					value: finishValue,
					port,
					observation: controller,
				}).ok,
				false,
			);
			port.dropNextMaterialReviewAppend = true;
			assert.equal(
				executeMaterialReviewFinish({
					value: finishValue,
					port,
					observation: controller,
				}).ok,
				false,
			);
			const finished = executeMaterialReviewFinish({
				value: finishValue,
				port,
				observation: controller,
			});
			if (!finished.ok) assert.fail(finished.message);
			assert.equal(finished.status, "completed");
			assert.deepEqual(finished.observationIds, [
				recorded.observation.observationId,
			]);
			assert.deepEqual(JSON.parse(materialReviewCommandText(finished)), {
				ok: true,
				action: "material-review-finish",
				status: "completed",
				request_id: started.request.requestId,
				observation_ids: [recorded.observation.observationId],
				completion_digest: finished.completionDigest,
				lifecycle: { mode: "unchanged", episode: "open" },
			});
			const resumed = executeMaterialReviewFinish({
				value: finishValue,
				port,
				observation: controller,
			});
			if (!resumed.ok) assert.fail(resumed.message);
			assert.equal(resumed.status, "resumed");
			assert.equal(resumed.completionDigest, finished.completionDigest);
			assert.deepEqual(resumed.observationIds, finished.observationIds);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_MATERIAL_REVIEW_ENTRY,
				).length,
				2,
			);
			const afterFinish = reconstructObservationSession(port.entries);
			assert.equal(afterFinish.lifecycle.mode, "off");
			assert.equal(afterFinish.lifecycle.episode.status, "open");
		});
	});

	test("rejects mixed Sidecar and material review candidate ancestry", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			const sidecar = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-sidecar-before-material-review",
						tool_name: "read",
					},
					text: "Earlier Sidecar material.",
					capturedAt: "2026-08-01T10:08:00.000Z",
				},
				port,
			);
			if (!sidecar.ok || !sidecar.candidate)
				assert.fail("Expected Sidecar candidate");
			await lifecycleController.command("off", port);
			const intent = materialReviewIntent({
				text: "새 자료를 조회해 관찰해 줘.",
				material: "retrieved-tool-results",
				requestId: "material-review-00000000-0000-4000-8000-000000000309",
			});
			const episode = await materialReviewEpisode({
				controller: lifecycleController,
				port,
				intent,
			});
			const started = controller.startMaterialReview(
				{ intent, episode, capturedAt: "2026-08-01T10:09:00.000Z" },
				port,
			);
			if (!started.ok) assert.fail(started.message);
			const linked = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-material-review-mixed",
						tool_name: "read",
					},
					text: "Current material review material.",
					capturedAt: "2026-08-01T10:10:00.000Z",
				},
				port,
			);
			if (!linked.ok || !linked.candidate)
				assert.fail("Expected linked candidate");
			const beforeRead = port.entries.length;
			const mixed = await controller.execute(
				{
					...externalSourceAction(sidecar.candidate.candidateId),
					candidate_ids: [
						sidecar.candidate.candidateId,
						linked.candidate.candidateId,
					],
				},
				port,
			);
			assert.equal(mixed.ok, false);
			assert.equal(port.entries.length, beforeRead);
		});
	});

	test("does not treat an unlinked Sidecar read as material review ancestry after off", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			const captured = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-sidecar-read",
						tool_name: "read",
					},
					text: "Sidecar-only read material.",
					capturedAt: "2026-08-01T10:11:00.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate)
				assert.fail("Expected candidate");
			const read = await controller.execute(
				externalSourceAction(captured.candidate.candidateId),
				port,
			);
			if (!read.ok || read.action !== "source-read")
				assert.fail("Expected read");
			assert.equal(read.read.materialReviewRequestId, undefined);
			await lifecycleController.command("off", port);
			const before = port.entries.length;
			const hydrate = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			assert.equal(hydrate.ok, false);
			const record = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "record",
					read_id: read.read.readId,
					hydration_id: null,
					related_inquiry_ids: [],
					stance: "neutral",
					movement: "minor-refinement",
					rationale: "This must remain Sidecar-only after Mode turns off.",
					observer_hypothesis: null,
				},
				port,
			);
			assert.equal(record.ok, false);
			assert.equal(port.entries.length, before);
		});
	});

	test("recovers request and candidate append throw/drop gaps without duplicates", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			await lifecycleController.command("off", port);
			const text = "재시도 경계를 관찰해 줘.";
			async function attempt(request: number) {
				const intent = materialReviewIntent({
					text,
					material: "inline-user-message",
					requestId: `material-review-00000000-0000-4000-8000-${String(request).padStart(12, "0")}`,
				});
				return {
					intent,
					episode: await materialReviewEpisode({
						controller: lifecycleController,
						port,
						intent,
					}),
				};
			}
			port.failNextMaterialReviewAppend = true;
			const first = await attempt(304);
			assert.equal(
				controller.startMaterialReview(
					{ ...first, capturedAt: "2026-08-01T10:03:00.000Z" },
					port,
				).ok,
				false,
			);
			port.dropNextMaterialReviewAppend = true;
			const second = await attempt(305);
			assert.equal(
				controller.startMaterialReview(
					{ ...second, capturedAt: "2026-08-01T10:04:00.000Z" },
					port,
				).ok,
				false,
			);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_MATERIAL_REVIEW_ENTRY,
				).length,
				0,
			);

			port.failNextObservationAppend = true;
			const third = await attempt(306);
			assert.equal(
				controller.startMaterialReview(
					{ ...third, capturedAt: "2026-08-01T10:05:00.000Z" },
					port,
				).ok,
				false,
			);
			port.dropNextObservationAppend = true;
			const fourth = await attempt(307);
			assert.equal(
				controller.startMaterialReview(
					{ ...fourth, capturedAt: "2026-08-01T10:06:00.000Z" },
					port,
				).ok,
				false,
			);
			const fifth = await attempt(308);
			const recovered = controller.startMaterialReview(
				{ ...fifth, capturedAt: "2026-08-01T10:07:00.000Z" },
				port,
			);
			assert.equal(recovered.ok, true);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_MATERIAL_REVIEW_ENTRY,
				).length,
				1,
			);
			assert.equal(
				port.entries.filter(
					(entry) => entry.customType === OBSERVER_OBSERVATION_ENTRY,
				).length,
				1,
			);
		});
	});

	test("captures active candidates, returns index after source-read, and hydrates only standing IDs", async () => {
		await withSandbox(async ({ controller, port }) => {
			const captured = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-1",
						tool_name: "read",
					},
					text: "Source result text",
					capturedAt: "2026-08-01T10:00:00.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate) {
				assert.fail(captured.ok ? "Expected candidate" : captured.message);
			}
			assert.equal(captured.candidate.materialReviewRequestId, undefined);
			const beforeReadEntries = port.entries.length;
			const read = await controller.execute(
				externalSourceAction(captured.candidate.candidateId),
				port,
			);
			if (!read.ok || read.action !== "source-read") {
				assert.fail(read.ok ? "Expected source-read" : read.message);
			}
			assert.equal(port.entries.length, beforeReadEntries + 1);
			assert.equal(read.index.inquiries[0]?.inquiryId, DURABLE_INQUIRY);
			const readPayload = toolPayload(read);
			assert.equal(readPayload.read_id, read.read.readId);
			assert.equal(readPayload.standing_index.inquiries.length, 1);
			assert.equal("source" in readPayload, false);
			const unknown = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: ["inquiry-00000000-0000-4000-8000-000000000099"],
				},
				port,
			);
			const beforeUnknown = port.entries.length;
			assert.equal(unknown.ok, false);
			assert.equal(port.entries.length, beforeUnknown);
			const hydrated = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!hydrated.ok || hydrated.action !== "hydrate") {
				assert.fail(hydrated.ok ? "Expected hydrate" : hydrated.message);
			}
			assert.equal(hydrated.context.inquiries.length, 1);
			assert.equal(hydrated.context.memos.length, 1);
			const hydrationPayload = toolPayload(hydrated);
			assert.equal(
				hydrationPayload.hydration_id,
				hydrated.hydration.hydrationId,
			);
			assert.equal(hydrationPayload.standing_context.inquiries.length, 1);
			const beforeDuplicateHydration = port.entries.length;
			const duplicateHydration = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			assert.equal(duplicateHydration.ok, true);
			assert.equal(port.entries.length, beforeDuplicateHydration);
			const duplicateRead = await controller.execute(
				externalSourceAction(captured.candidate.candidateId),
				port,
			);
			assert.equal(duplicateRead.ok, false);
			assert.equal(port.entries.length, beforeDuplicateHydration);
		});
	});

	test("captures oversized tool results as complete bounded segments without profile errors", async () => {
		await withSandbox(async ({ controller, port }) => {
			const original = `BEGIN-${"x".repeat(50_000)}-END`;
			const captured = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-oversized",
						tool_name: "read",
					},
					text: original,
					capturedAt: "2026-08-01T10:00:30.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate)
				assert.fail(captured.ok ? "Expected candidate" : captured.message);
			const segments = reconstructObservationSession(
				port.entries,
			).candidates.filter(
				(candidate) =>
					candidate.origin.kind === "tool-result" &&
					candidate.origin.toolCallId === "tool-oversized",
			);
			assert.equal(segments.length, 3);
			assert.equal(
				segments
					.map((segment) =>
						segment.text.replace(
							/^\[Observer candidate segment \d+\/\d+; contiguous text from one captured message\]\n/u,
							"",
						),
					)
					.join(""),
				original,
			);
			assert.ok(
				segments.every(
					(segment) =>
						segment.text.length <= MAX_OBSERVATION_TEXT_LENGTH &&
						segment.contentHash === sha256Text(segment.text),
				),
			);
			const read = await controller.execute(
				{
					...externalSourceAction(segments[0]?.candidateId ?? ""),
					candidate_ids: segments.map((segment) => segment.candidateId),
				},
				port,
			);
			assert.equal(read.ok, true);
		});
	});

	test("keeps minor observations silent and alerts only after a major append", async () => {
		await withSandbox(async ({ controller, port }) => {
			const first = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-minor",
						tool_name: "read",
					},
					text: "Minor source result",
					capturedAt: "2026-08-01T10:01:00.000Z",
				},
				port,
			);
			if (!first.ok || !first.candidate)
				assert.fail("Expected first candidate");
			const firstRead = await controller.execute(
				externalSourceAction(first.candidate.candidateId),
				port,
			);
			if (!firstRead.ok || firstRead.action !== "source-read") {
				assert.fail(firstRead.ok ? "Expected read" : firstRead.message);
			}
			const firstHydration = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: firstRead.read.readId,
					index_digest: firstRead.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!firstHydration.ok || firstHydration.action !== "hydrate") {
				assert.fail("Expected first hydration");
			}
			const minor = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "record",
					read_id: firstRead.read.readId,
					hydration_id: firstHydration.hydration.hydrationId,
					related_inquiry_ids: [DURABLE_INQUIRY],
					stance: "supports",
					movement: "repeated-support",
					rationale: "This only repeats existing support.",
					observer_hypothesis: null,
				},
				port,
			);
			assert.equal(minor.ok, true);
			assert.equal(port.notifications.length, 0);

			const second = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-major",
						tool_name: "read",
					},
					text: "Major source result",
					capturedAt: "2026-08-01T10:02:00.000Z",
				},
				port,
			);
			if (!second.ok || !second.candidate)
				assert.fail("Expected second candidate");
			const secondRead = await controller.execute(
				externalSourceAction(second.candidate.candidateId),
				port,
			);
			if (!secondRead.ok || secondRead.action !== "source-read") {
				assert.fail("Expected second read");
			}
			const secondHydration = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: secondRead.read.readId,
					index_digest: secondRead.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!secondHydration.ok || secondHydration.action !== "hydrate") {
				assert.fail("Expected second hydration");
			}
			const majorAction = {
				observer_action: "observer-sidecar/v1",
				action: "record",
				read_id: secondRead.read.readId,
				hydration_id: secondHydration.hydration.hydrationId,
				related_inquiry_ids: [DURABLE_INQUIRY],
				stance: "challenges",
				movement: "core-counterexample",
				rationale: "This counterexample changes the central condition.",
				observer_hypothesis: null,
			};
			port.failNextObservationAppend = true;
			const failed = await controller.execute(majorAction, port);
			assert.equal(failed.ok, false);
			assert.equal(port.notifications.length, 0);
			port.dropNextObservationAppend = true;
			const unconfirmed = await controller.execute(majorAction, port);
			assert.equal(unconfirmed.ok, false);
			assert.equal(port.notifications.length, 0);
			const major = await controller.execute(majorAction, port);
			assert.equal(major.ok, true);
			assert.equal(port.notifications.length, 1);
			assert.equal(port.notifications[0]?.type, "warning");
			assert.match(port.notifications[0]?.message ?? "", /Observer 중요 변화/u);
		});
	});

	test("completes read-only Memo then approves and settles a required-record Review & Save", async () => {
		await withSandbox(
			async ({ sandbox, controller, lifecycleController, port }) => {
				const sourceCandidate = controller.capture(
					{
						origin: {
							kind: "tool-result",
							tool_call_id: "tool-memo-source",
							tool_name: "read",
						},
						text: "Immediate notes can preserve retrieval cues.",
						capturedAt: "2026-08-01T10:02:00.000Z",
					},
					port,
				);
				if (!sourceCandidate.ok || !sourceCandidate.candidate)
					assert.fail("Expected source candidate");
				const sourceRead = await controller.execute(
					externalSourceAction(sourceCandidate.candidate.candidateId),
					port,
				);
				if (!sourceRead.ok || sourceRead.action !== "source-read")
					assert.fail(
						sourceRead.ok ? "Expected source read" : sourceRead.message,
					);
				const sourceHydration = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "hydrate",
						read_id: sourceRead.read.readId,
						index_digest: sourceRead.index.digest,
						inquiry_ids: [DURABLE_INQUIRY],
					},
					port,
				);
				if (!sourceHydration.ok || sourceHydration.action !== "hydrate")
					assert.fail("Expected source hydration");
				const sourceObservation = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "record",
						read_id: sourceRead.read.readId,
						hydration_id: sourceHydration.hydration.hydrationId,
						related_inquiry_ids: [DURABLE_INQUIRY],
						stance: "challenges",
						movement: "minor-refinement",
						rationale: "Immediate notes refine the cost boundary.",
						observer_hypothesis: null,
					},
					port,
				);
				if (!sourceObservation.ok || sourceObservation.action !== "record")
					assert.fail("Expected source observation");

				const captured = controller.capture(
					{
						origin: { kind: "user-input", input_source: "interactive" },
						text: "재진입 비용은 기록 시점에 따라 달라진다.",
						capturedAt: "2026-08-01T10:03:00.000Z",
					},
					port,
				);
				if (!captured.ok || !captured.candidate)
					assert.fail("Expected candidate");
				const registered = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "user-hypothesis",
						candidate_id: captured.candidate.candidateId,
						existing_inquiry_id: null,
						original: "재진입 비용은 기록 시점에 따라 달라진다.",
						context: "사용자가 명시적으로 추적을 요청했다.",
					},
					port,
				);
				if (!registered.ok || registered.action !== "user-hypothesis") {
					assert.fail(
						registered.ok ? "Expected user hypothesis" : registered.message,
					);
				}
				const registeredHypothesis = registered.hypothesis;
				const contextReview = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "hypothesis-context-review",
						hypothesis_observation_id: registeredHypothesis.observationId,
						assessment: "supports",
						supporting_clues: [
							"The current conversation explicitly connects re-entry cost to recording time.",
						],
						challenging_clues: [],
						missing_information: [
							"No cross-session comparison is available yet.",
						],
						source_ids: [],
						interpretation_boundary:
							"Initial review is limited to the visible Pi context.",
					},
					port,
				);
				if (
					!contextReview.ok ||
					contextReview.action !== "hypothesis-context-review"
				)
					assert.fail(
						contextReview.ok
							? "Expected hypothesis context review"
							: contextReview.message,
					);
				port.entries.push({
					type: "custom",
					customType: OBSERVER_LIFECYCLE_ENTRY,
					data: {
						protocol: OBSERVER_PROTOCOL,
						kind: "activation-changed",
						enabled: false,
					},
				});
				const notebookPath = join(sandbox, "notebook", "records", "inquiry.md");
				const beforeNotebook = await readFile(notebookPath, "utf8");
				const beforeFailed = port.entries.length;
				port.failNextObservationAppend = true;
				const failed = await controller.requestReviewSave(port);
				assert.equal(failed.ok, false);
				assert.equal(port.entries.length, beforeFailed);

				const ordinaryMemo = controller.requestMemo(port);
				if (!ordinaryMemo.ok || ordinaryMemo.status !== "requested")
					assert.fail(
						ordinaryMemo.ok
							? "Expected ordinary Memo request"
							: ordinaryMemo.message,
					);
				if (!ordinaryMemo.request)
					assert.fail("Expected ordinary Memo request identity");
				assert.equal(
					await controller.continueReviewSaveAfterMemo(
						ordinaryMemo.request.requestId,
						port,
					),
					null,
				);
				const beforeFailedContinuation = port.entries.length;
				port.failNextObservationAppend = true;
				const failedContinuation = await controller.requestReviewSave(port);
				assert.equal(failedContinuation.ok, false);
				assert.equal(port.entries.length, beforeFailedContinuation);

				const finalization = await controller.requestReviewSave(port);
				if (!finalization.ok || finalization.status !== "memo-resumed") {
					assert.fail(
						finalization.ok
							? "Expected existing Memo to continue into Review & Save"
							: finalization.message,
					);
				}
				assert.equal(
					reconstructObservationSession(port.entries).reviewSaveContinuations[0]
						?.memoRequestId,
					ordinaryMemo.request.requestId,
				);
				const requested = { request: ordinaryMemo.request };
				const afterRequest = port.entries.length;
				const resumed = await controller.requestReviewSave(port);
				assert.equal(resumed.ok, true);
				if (resumed.ok) assert.equal(resumed.status, "memo-resumed");
				assert.equal(port.entries.length, afterRequest);

				const malformed = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-scope",
						request_id: requested.request.requestId,
						extra: true,
					},
					port,
				);
				assert.equal(malformed.ok, false);
				assert.equal(port.entries.length, afterRequest);

				const unknown = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-scope",
						request_id: "memo-request-00000000-0000-4000-8000-000000000999",
					},
					port,
				);
				assert.equal(unknown.ok, false);
				assert.equal(port.entries.length, afterRequest);

				const scoped = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-scope",
						request_id: requested.request.requestId,
					},
					port,
				);
				if (!scoped.ok || scoped.action !== "memo-scope") {
					assert.fail(scoped.ok ? "Expected Memo scope" : scoped.message);
				}
				assert.deepEqual(
					scoped.context.observations.map((item) => item.observationId),
					[
						sourceObservation.observation.observationId,
						registeredHypothesis.observationId,
					].toSorted(),
				);
				assert.deepEqual(scoped.context.memoScope.relatedInquiryIds, [
					DURABLE_INQUIRY,
				]);
				const payload = toolPayload(scoped);
				assert.equal(payload.request_id, requested.request.requestId);
				assert.equal(payload.request_digest, requested.request.requestDigest);
				assert.equal(payload.observations.length, 2);
				assert.deepEqual(payload.memo_preparation, scoped.guide);
				assert.equal(
					scoped.guide.instruction_seed.pass.instruction_id,
					requested.request.requestId,
				);
				assert.equal(
					scoped.guide.instruction_seed.pass.pass_id,
					requested.request.requestId.replace("memo-request-", "memo-pass-"),
				);
				const instruction = {
					observer_memo_instruction: "observer.memo-instruction/v1",
					request_id: requested.request.requestId,
					request_digest: requested.request.requestDigest,
					pass: {
						observer_memo_pass: "observer.prepared-memo-pass/v1",
						pass_id: "memo-pass-00000000-0000-4000-8000-000000000601",
						episode_id: requested.request.episodeId,
						base_revision_id: requested.request.baseMemoRevisionId,
						basis_digest: scoped.context.memoScope.basisDigest,
						related_inquiry_ids: scoped.context.memoScope.relatedInquiryIds,
						instruction_id: requested.request.requestId,
						evidence: [
							{
								evidence_id: "evidence-00000000-0000-4000-8000-000000000601",
								kind: "source-claim",
								source_id: sourceRead.read.source.sourceId,
								summary: "Immediate notes can preserve retrieval cues.",
							},
						],
						hypothesis_outcomes: [
							{ kind: "keep", inquiry_id: DURABLE_INQUIRY },
							{
								kind: "create",
								hypothesis: {
									inquiry_id: registeredHypothesis.inquiryId,
									episode_id: requested.request.episodeId,
									origin: "user",
									original: registeredHypothesis.original,
									current: registeredHypothesis.original,
									revision_reason: null,
									evidence_ids: [],
								},
							},
						],
						memo_outcomes: [{ kind: "keep-incubating", memo_id: DURABLE_MEMO }],
					},
					dispositions: [
						{
							observation_id: sourceObservation.observation.observationId,
							decision: "integrated",
							hypothesis_inquiry_ids: [DURABLE_INQUIRY],
							memo_ids: [DURABLE_MEMO],
							evidence_ids: ["evidence-00000000-0000-4000-8000-000000000601"],
							rationale:
								"The source evidence refines the durable inquiry boundary.",
						},
						{
							observation_id: registeredHypothesis.observationId,
							decision: "integrated",
							hypothesis_inquiry_ids: [registeredHypothesis.inquiryId],
							memo_ids: [],
							evidence_ids: [],
							rationale:
								"The explicit user hypothesis is registered unchanged.",
						},
					],
				};
				const submission = {
					evidence: instruction.pass.evidence,
					hypothesis_outcomes: instruction.pass.hypothesis_outcomes,
					memo_outcomes: instruction.pass.memo_outcomes,
					dispositions: instruction.dispositions,
				};
				const beforeMalformed = port.entries.length;
				const noOpHypothesisRevision = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission: {
							...submission,
							hypothesis_outcomes: [
								{
									kind: "revise",
									inquiry_id: DURABLE_INQUIRY,
									current: "Frequent durable writing may disrupt learning.",
									revision_reason:
										"A reason without changed current text must fail before append.",
									evidence_ids: [
										"evidence-00000000-0000-4000-8000-000000000601",
									],
								},
								...instruction.pass.hypothesis_outcomes.slice(1),
							],
						},
					},
					port,
				);
				assert.equal(noOpHypothesisRevision.ok, false);
				if (!noOpHypothesisRevision.ok)
					assert.match(
						noOpHypothesisRevision.message,
						/Hypothesis revision must change current text/u,
					);
				assert.equal(port.entries.length, beforeMalformed);
				assert.equal(
					port.entries.some(
						(entry) =>
							entry.type === "custom" &&
							entry.customType === OBSERVER_MEMO_INSTRUCTION_ENTRY,
					),
					false,
				);
				const legacyRevise = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission: {
							...submission,
							memo_outcomes: [
								{
									kind: "revise",
									memo_id: DURABLE_MEMO,
									revision: {
										revision_id:
											"memo-revision-00000000-0000-4000-8000-000000000602",
										title: "Legacy revise",
										content: "Legacy raw shape must be rejected.",
										evidence_ids: [],
										reason: "Legacy fixture",
									},
									disposition: "incubating",
								},
							],
						},
					},
					port,
				);
				assert.equal(legacyRevise.ok, false);
				const additionalReviseField = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission: {
							...submission,
							memo_outcomes: [
								{
									kind: "revise-incubating",
									memo_id: DURABLE_MEMO,
									revision: {},
									disposition: "incubating",
								},
							],
						},
					},
					port,
				);
				assert.equal(additionalReviseField.ok, false);
				assert.equal(port.entries.length, beforeMalformed);
				const malformedPreparation = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission: { ...submission, dispositions: [] },
					},
					port,
				);
				assert.equal(malformedPreparation.ok, false);
				assert.equal(port.entries.length, beforeMalformed);
				const attemptedLockedOverride = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission,
						instruction,
					},
					port,
				);
				assert.equal(attemptedLockedOverride.ok, false);
				assert.equal(port.entries.length, beforeMalformed);
				port.failNextInstructionAppend = true;
				const failedInstructionAppend = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission,
					},
					port,
				);
				assert.equal(failedInstructionAppend.ok, false);
				assert.equal(port.entries.length, beforeMalformed);
				port.dropNextInstructionAppend = true;
				const droppedInstructionAppend = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission,
					},
					port,
				);
				assert.equal(droppedInstructionAppend.ok, false);
				assert.equal(port.entries.length, beforeMalformed);

				const prepared = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission,
					},
					port,
				);
				if (!prepared.ok || prepared.action !== "memo-prepare") {
					assert.fail(
						prepared.ok ? "Expected Memo preparation" : prepared.message,
					);
				}
				const instructionCount = port.entries.filter(
					(entry) =>
						entry.type === "custom" &&
						entry.customType === OBSERVER_MEMO_INSTRUCTION_ENTRY,
				).length;
				const failedInstall = await completeMemoPreparation(
					prepared.instruction,
					{
						install() {
							return Promise.resolve(false);
						},
						apply() {
							assert.fail("Apply must not run after failed install");
						},
						completed() {
							return false;
						},
					},
				);
				assert.equal(failedInstall.ok, false);
				const resumedPreparation = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "memo-prepare",
						request_id: requested.request.requestId,
						submission,
					},
					port,
				);
				if (
					!resumedPreparation.ok ||
					resumedPreparation.action !== "memo-prepare"
				) {
					assert.fail("Expected resumed Memo preparation");
				}
				assert.equal(resumedPreparation.status, "resumed");
				assert.equal(
					port.entries.filter(
						(entry) =>
							entry.type === "custom" &&
							entry.customType === OBSERVER_MEMO_INSTRUCTION_ENTRY,
					).length,
					instructionCount,
				);
				const completion = await completeMemoPreparation(
					resumedPreparation.instruction,
					{
						install(value) {
							return lifecycleController.installPreparedMemo(value, port);
						},
						apply() {
							return lifecycleController.command("memo", port);
						},
						completed(requestId) {
							const snapshot = reconstructObservationSession(port.entries);
							const memoRequest = snapshot.memoRequests.find(
								(item) => item.requestId === requestId,
							);
							return (
								memoRequest !== undefined &&
								memoRequest.observationIds.every((id) =>
									snapshot.consumedObservationIds.includes(id),
								)
							);
						},
					},
				);
				assert.deepEqual(completion, {
					ok: true,
					status: "completed",
					message: "Memo request를 적용하고 acknowledgment까지 확인했습니다.",
				});
				const customTypes = port.entries.flatMap((entry) =>
					entry.type === "custom" ? [entry.customType] : [],
				);
				const instructionIndex = customTypes.indexOf(
					OBSERVER_MEMO_INSTRUCTION_ENTRY,
				);
				const preparedIndex = customTypes.indexOf(OBSERVER_PREPARED_MEMO_ENTRY);
				const appliedIndex = customTypes.indexOf(OBSERVER_APPLIED_MEMO_ENTRY);
				const acknowledgmentIndex = port.entries.findIndex(
					(entry) =>
						entry.type === "custom" &&
						entry.customType === OBSERVER_LIFECYCLE_ENTRY &&
						typeof entry.data === "object" &&
						entry.data !== null &&
						Reflect.get(entry.data, "kind") === "memo-reconciled",
				);
				assert.equal(instructionIndex < preparedIndex, true);
				assert.equal(preparedIndex < appliedIndex, true);
				assert.equal(appliedIndex < acknowledgmentIndex, true);
				assert.equal(
					customTypes.filter((type) => type === OBSERVER_MEMO_INSTRUCTION_ENTRY)
						.length,
					1,
				);
				assert.equal(
					customTypes.filter((type) => type === OBSERVER_PREPARED_MEMO_ENTRY)
						.length,
					1,
				);
				assert.equal(
					customTypes.filter((type) => type === OBSERVER_APPLIED_MEMO_ENTRY)
						.length,
					1,
				);
				assert.equal(
					reconstructObservationSession(port.entries).pendingMemoRequest,
					null,
				);
				assert.equal(
					reconstructObserverPiState(port.entries).state.mode,
					"off",
				);
				const beforeSaveRequest = port.entries.length;
				port.failNextSaveRequestAppend = true;
				assert.equal(
					(
						await controller.continueReviewSaveAfterMemo(
							requested.request.requestId,
							port,
						)
					)?.ok,
					false,
				);
				assert.equal(port.entries.length, beforeSaveRequest);
				port.dropNextSaveRequestAppend = true;
				assert.equal(
					(
						await controller.continueReviewSaveAfterMemo(
							requested.request.requestId,
							port,
						)
					)?.ok,
					false,
				);
				assert.equal(port.entries.length, beforeSaveRequest);
				const saveRequested = await controller.continueReviewSaveAfterMemo(
					requested.request.requestId,
					port,
				);
				if (saveRequested === null)
					assert.fail("Expected Review & Save continuation");
				if (!saveRequested.ok) assert.fail(saveRequested.message);
				if (saveRequested.status !== "requested")
					assert.fail("Expected Review & Save request");
				const afterSaveRequest = port.entries.length;
				assert.equal(
					await controller.continueReviewSaveAfterMemo(
						requested.request.requestId,
						port,
					),
					null,
				);
				const saveResumed = await controller.requestReviewSave(port);
				assert.equal(saveResumed.ok, true);
				if (saveResumed.ok) assert.equal(saveResumed.status, "resumed");
				assert.equal(port.entries.length, afterSaveRequest);
				const malformedSaveScope = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-scope",
						request_id: saveRequested.request.requestId,
						extra: true,
					},
					port,
				);
				assert.equal(malformedSaveScope.ok, false);
				assert.equal(port.entries.length, afterSaveRequest);
				const saveScoped = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-scope",
						request_id: saveRequested.request.requestId,
					},
					port,
				);
				if (!saveScoped.ok || saveScoped.action !== "save-scope")
					assert.fail(
						saveScoped.ok ? "Expected Review & Save scope" : saveScoped.message,
					);
				assert.equal(
					saveScoped.guide.locked_target.proposal_id,
					saveRequested.request.proposalId,
				);
				assert.equal(saveScoped.guide.inventory.length, 6);
				assert.equal(saveScoped.guide.observed_sources.length, 1);
				const savePayload = toolPayload(saveScoped);
				assert.equal(savePayload.request_id, saveRequested.request.requestId);
				assert.deepEqual(savePayload.next_action, {
					action: "save-prepare",
					request_id: saveRequested.request.requestId,
					submit_only: ["request_id", "summary", "records"],
					do_not_repeat: "save-scope",
				});
				assert.deepEqual(savePayload.save_preparation, saveScoped.guide);
				assert.equal(
					reconstructSaveRequestSession(port.entries).pendingRequest?.requestId,
					saveRequested.request.requestId,
				);
				assert.equal(
					port.entries.some(
						(entry) =>
							entry.type === "custom" &&
							entry.customType === OBSERVER_PREPARED_SAVE_ENTRY,
					),
					false,
				);
				assert.equal(await readFile(notebookPath, "utf8"), beforeNotebook);
				const sourceId = sourceRead.read.source.sourceId;
				function recordsFor(guide: SavePreparationGuide): readonly unknown[] {
					return guide.required_records.map((required) => {
						if (required.operation === "update") {
							const inventoryRecord = guide.inventory.find(
								(record) => record.record_id === required.record_id,
							);
							if (!inventoryRecord || !required.expected_sha256)
								assert.fail("Required update must have locked inventory");
							return {
								operation: "update",
								record_id: required.record_id,
								expected_sha256: required.expected_sha256,
								markdown: inventoryRecord.markdown,
							};
						}
						return {
							operation: "create",
							record_id: required.record_id,
							markdown:
								required.record_id === sourceId
									? wrappedSourceMarkdown(sourceId)
									: wrappedInquiryMarkdown(required.record_id, sourceId),
						};
					});
				}
				assert.deepEqual(
					saveScoped.guide.required_records.map((record) => record.record_id),
					[
						DURABLE_INQUIRY,
						registeredHypothesis.inquiryId,
						DURABLE_MEMO,
						sourceId,
					].toSorted(),
				);
				const beforeMalformedSave = port.entries.length;
				const missingCoverage = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-prepare",
						request_id: saveRequested.request.requestId,
						summary: "Incomplete proposal",
						records: [],
					},
					port,
				);
				assert.equal(missingCoverage.ok, false);
				const lockedOverride = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-prepare",
						request_id: saveRequested.request.requestId,
						summary: "Locked override",
						records: recordsFor(saveScoped.guide),
						proposal_id: "proposal-00000000-0000-4000-8000-000000000999",
					},
					port,
				);
				assert.equal(lockedOverride.ok, false);
				assert.equal(port.entries.length, beforeMalformedSave);
				const preparedSave = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-prepare",
						request_id: saveRequested.request.requestId,
						summary: "Persist one source and the reconciled inquiry state.",
						records: recordsFor(saveScoped.guide),
					},
					port,
				);
				if (!preparedSave.ok || preparedSave.action !== "save-prepare")
					assert.fail(
						preparedSave.ok
							? "Expected Review & Save preparation"
							: preparedSave.message,
					);
				assert.equal(port.entries.length, beforeMalformedSave);
				const failedSaveInstall = await completeSavePreparation(
					preparedSave.handoff,
					{
						install() {
							return Promise.resolve(false);
						},
					},
				);
				assert.equal(failedSaveInstall.ok, false);
				assert.equal(port.entries.length, beforeMalformedSave);

				port.confirmation = false;
				const reviewed = await completeSavePreparation(preparedSave.handoff, {
					install(value) {
						return lifecycleController.installPrepared(value, port);
					},
				});
				assert.equal(reviewed.ok, true);
				if (reviewed.ok) assert.equal(reviewed.status, "prepared");
				assert.equal(
					reconstructObserverPiState(port.entries).state.episode.status,
					"reviewing-save",
				);
				await lifecycleController.command("save", port);
				assert.equal(
					reconstructObserverPiState(port.entries).state.episode.status,
					"open",
				);
				await assert.rejects(
					readFile(join(sandbox, "notebook", "records", `${sourceId}.md`)),
				);

				port.confirmation = true;
				const retryRequest = await controller.requestSave(port);
				if (!retryRequest.ok || !retryRequest.request)
					assert.fail(
						retryRequest.ok
							? "Expected retry Review & Save request"
							: retryRequest.message,
					);
				const retryScope = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-scope",
						request_id: retryRequest.request.requestId,
					},
					port,
				);
				if (!retryScope.ok || retryScope.action !== "save-scope")
					assert.fail(
						retryScope.ok
							? "Expected retry Review & Save scope"
							: retryScope.message,
					);
				const retryPrepared = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "save-prepare",
						request_id: retryRequest.request.requestId,
						summary: "Approved durable reconciliation.",
						records: recordsFor(retryScope.guide),
					},
					port,
				);
				if (!retryPrepared.ok || retryPrepared.action !== "save-prepare")
					assert.fail(
						retryPrepared.ok
							? "Expected retry Review & Save preparation"
							: retryPrepared.message,
					);
				const completed = await completeSavePreparation(retryPrepared.handoff, {
					install(value) {
						return lifecycleController.installPrepared(value, port);
					},
				});
				assert.equal(completed.ok, true);
				if (completed.ok) assert.equal(completed.status, "prepared");
				assert.equal(
					reconstructObserverPiState(port.entries).state.episode.status,
					"reviewing-save",
				);
				await lifecycleController.command("save", port);
				const settled = reconstructObserverPiState(port.entries);
				assert.equal(settled.state.mode, "off");
				assert.equal(settled.state.episode.status, "settled");
				assert.match(
					await readFile(
						join(sandbox, "notebook", "records", `${sourceId}.md`),
						"utf8",
					),
					/Immediate notes can preserve retrieval cues\./u,
				);
			},
		);
	});

	test("tracks an explicit hypothesis while Mode stays off and resumes exact retries", async () => {
		await withSandbox(async ({ controller, lifecycleController, port }) => {
			await lifecycleController.command("off", port);
			const episode =
				await lifecycleController.ensureUserHypothesisEpisode(port);
			if (!episode.ok) assert.fail(episode.message);
			assert.equal(episode.value.mode, "off");
			const original = "가설 추적은 지속 관찰과 독립적이어야 한다.";
			const context =
				"사용자는 지속 관찰을 켜지 않고도 떠오른 가설을 보존하고 싶다.";
			const tracked = await controller.trackUserHypothesis(
				{
					episode: episode.value,
					original,
					context,
					capturedAt: "2026-08-01T10:02:00.000Z",
					inputSource: "interactive",
				},
				port,
			);
			if (!tracked.ok) assert.fail(tracked.message);
			assert.equal(tracked.status, "recorded");
			assert.equal(tracked.reviewPending, true);
			assert.equal(tracked.hypothesis.original, original);
			assert.equal(reconstructObserverPiState(port.entries).state.mode, "off");
			const session = reconstructObservationSession(port.entries);
			assert.equal(session.pendingHypotheses[0]?.origin, "user");
			assert.equal(session.pendingHypotheses[0]?.sourceReadId, null);
			assert.equal(session.pendingHypothesisReviews.length, 1);
			const blockedMemo = controller.requestMemo(port);
			assert.equal(blockedMemo.ok, false);
			if (!blockedMemo.ok) assert.match(blockedMemo.message, /context review/u);
			const reviewed = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hypothesis-context-review",
					hypothesis_observation_id: tracked.hypothesis.observationId,
					assessment: "insufficient-context",
					supporting_clues: [],
					challenging_clues: [],
					missing_information: [
						"The visible context has no comparison across multiple sessions yet.",
					],
					source_ids: [],
					interpretation_boundary:
						"The first review covers only the visible Pi context and current Episode working state.",
				},
				port,
			);
			if (!reviewed.ok || reviewed.action !== "hypothesis-context-review")
				assert.fail(reviewed.ok ? "Expected context review" : reviewed.message);
			const reviewedSession = reconstructObservationSession(port.entries);
			assert.equal(reviewedSession.pendingHypothesisReviews.length, 0);
			assert.match(
				reviewedSession.pendingHypotheses[0]?.context ?? "",
				/Context review: insufficient-context/u,
			);
			const beforeInvalidRead = port.entries.length;
			const invalidRead = await controller.execute(
				externalSourceAction(tracked.candidate.candidateId),
				port,
			);
			assert.equal(invalidRead.ok, false);
			if (!invalidRead.ok)
				assert.match(invalidRead.message, /not Source evidence/u);
			assert.equal(port.entries.length, beforeInvalidRead);

			const beforeRetry = port.entries.length;
			const retried = await controller.trackUserHypothesis(
				{
					episode: episode.value,
					original,
					context,
					capturedAt: "2026-08-01T10:02:30.000Z",
					inputSource: "interactive",
				},
				port,
			);
			if (!retried.ok) assert.fail(retried.message);
			assert.equal(retried.status, "resumed");
			assert.equal(retried.reviewPending, false);
			assert.equal(retried.hypothesis.inquiryId, tracked.hypothesis.inquiryId);
			assert.equal(port.entries.length, beforeRetry);
		});
	});

	test("registers an explicit user hypothesis after append and ignores capture when off", async () => {
		await withSandbox(async ({ controller, port }) => {
			const captured = controller.capture(
				{
					origin: { kind: "user-input", input_source: "interactive" },
					text: "내 가설은 관찰 순서가 해석 편향을 바꾼다는 것이다.",
					capturedAt: "2026-08-01T10:03:00.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate)
				assert.fail("Expected user candidate");
			const result = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "user-hypothesis",
					candidate_id: captured.candidate.candidateId,
					existing_inquiry_id: null,
					original: "관찰 순서가 해석 편향을 바꾼다.",
					context: "사용자가 직접 추적을 요청했다.",
				},
				port,
			);
			assert.equal(result.ok, true);
			assert.equal(port.notifications.length, 1);
			const beforeDuplicate = port.entries.length;
			const duplicate = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "user-hypothesis",
					candidate_id: captured.candidate.candidateId,
					existing_inquiry_id: null,
					original: "관찰 순서가 해석 편향을 바꾼다.",
					context: "사용자가 직접 추적을 요청했다.",
				},
				port,
			);
			assert.equal(duplicate.ok, true);
			assert.equal(port.entries.length, beforeDuplicate);
			assert.equal(port.notifications.length, 1);
			const session = reconstructObservationSession(port.entries);
			assert.equal(session.pendingHypotheses[0]?.origin, "user");
			assert.equal(session.pendingHypotheses[0]?.sourceReadId, null);

			port.entries.push({
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "activation-changed",
					enabled: false,
				},
			});
			const before = port.entries.length;
			const ignored = controller.capture(
				{
					origin: { kind: "user-input", input_source: "interactive" },
					text: "off candidate",
					capturedAt: "2026-08-01T10:04:00.000Z",
				},
				port,
			);
			assert.equal(ignored.ok, true);
			if (ignored.ok) assert.equal(ignored.status, "ignored");
			assert.equal(port.entries.length, before);
		});
	});
});
