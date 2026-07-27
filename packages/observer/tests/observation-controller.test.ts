import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
	completeMemoPreparation,
	completeWrapPreparation,
	observationToolText,
} from "../extensions/observer.ts";
import { initialObserverState, OBSERVER_PROTOCOL } from "../src/lifecycle.ts";
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
} from "../src/observer-controller.ts";
import {
	OBSERVER_APPLIED_MEMO_ENTRY,
	OBSERVER_PREPARED_MEMO_ENTRY,
} from "../src/memo-session.ts";
import { OBSERVER_OBSERVATION_ENTRY } from "../src/observation-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_WRAP_ENTRY,
	reconstructObserverPiState,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";
import {
	OBSERVER_WRAP_REQUEST_ENTRY,
	reconstructWrapRequestSession,
	type WrapPreparationGuide,
} from "../src/wrap-trigger.ts";

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
title: Wrapped observation source
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
# Wrapped observation source

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
	failNextInstructionAppend = false;
	dropNextInstructionAppend = false;
	failNextWrapRequestAppend = false;
	dropNextWrapRequestAppend = false;
	confirmation = true;

	branchEntries(): readonly PiBranchEntryLike[] {
		return this.entries;
	}

	appendEntry(customType: string, data: unknown): void {
		if (
			this.failNextWrapRequestAppend &&
			customType === OBSERVER_WRAP_REQUEST_ENTRY
		) {
			this.failNextWrapRequestAppend = false;
			throw new Error("Injected Wrap request append failure");
		}
		if (
			this.dropNextWrapRequestAppend &&
			customType === OBSERVER_WRAP_REQUEST_ENTRY
		) {
			this.dropNextWrapRequestAppend = false;
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

	confirm(): Promise<boolean> {
		return Promise.resolve(this.confirmation);
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

function deterministicIds(): ObservationControllerIds {
	let candidate = 0;
	let read = 0;
	let hydration = 0;
	let observation = 0;
	let source = 100;
	let inquiry = 0;
	let memoRequest = 0;
	let wrapRequest = 0;
	let wrapProposal = 0;
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
		wrapRequestId(): `wrap-request-${string}` {
			wrapRequest += 1;
			return `wrap-request-00000000-0000-4000-8000-${suffix(wrapRequest)}`;
		},
		wrapProposalId(): `proposal-${string}` {
			wrapProposal += 1;
			return `proposal-00000000-0000-4000-8000-${suffix(wrapProposal)}`;
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

	test("completes read-only Memo then approves and settles a required-record Wrap", async () => {
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
				const failed = controller.requestMemo(port);
				assert.equal(failed.ok, false);
				assert.equal(port.entries.length, beforeFailed);

				const requested = controller.requestMemo(port);
				if (!requested.ok || requested.status !== "requested") {
					assert.fail(requested.ok ? "Expected request" : requested.message);
				}
				const afterRequest = port.entries.length;
				const resumed = controller.requestMemo(port);
				assert.equal(resumed.ok, true);
				if (resumed.ok) assert.equal(resumed.status, "resumed");
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
				const beforeWrapRequest = port.entries.length;
				port.failNextWrapRequestAppend = true;
				assert.equal((await controller.requestWrap(port)).ok, false);
				assert.equal(port.entries.length, beforeWrapRequest);
				port.dropNextWrapRequestAppend = true;
				assert.equal((await controller.requestWrap(port)).ok, false);
				assert.equal(port.entries.length, beforeWrapRequest);
				const wrapRequested = await controller.requestWrap(port);
				if (!wrapRequested.ok || !wrapRequested.request)
					assert.fail(
						wrapRequested.ok ? "Expected Wrap request" : wrapRequested.message,
					);
				assert.equal(wrapRequested.status, "requested");
				const afterWrapRequest = port.entries.length;
				const wrapResumed = await controller.requestWrap(port);
				assert.equal(wrapResumed.ok, true);
				if (wrapResumed.ok) assert.equal(wrapResumed.status, "resumed");
				assert.equal(port.entries.length, afterWrapRequest);
				const malformedWrapScope = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-scope",
						request_id: wrapRequested.request.requestId,
						extra: true,
					},
					port,
				);
				assert.equal(malformedWrapScope.ok, false);
				assert.equal(port.entries.length, afterWrapRequest);
				const wrapScoped = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-scope",
						request_id: wrapRequested.request.requestId,
					},
					port,
				);
				if (!wrapScoped.ok || wrapScoped.action !== "wrap-scope")
					assert.fail(
						wrapScoped.ok ? "Expected Wrap scope" : wrapScoped.message,
					);
				assert.equal(
					wrapScoped.guide.locked_target.proposal_id,
					wrapRequested.request.proposalId,
				);
				assert.equal(wrapScoped.guide.inventory.length, 6);
				assert.equal(wrapScoped.guide.observed_sources.length, 1);
				const wrapPayload = toolPayload(wrapScoped);
				assert.equal(wrapPayload.request_id, wrapRequested.request.requestId);
				assert.deepEqual(wrapPayload.wrap_preparation, wrapScoped.guide);
				assert.equal(
					reconstructWrapRequestSession(port.entries).pendingRequest?.requestId,
					wrapRequested.request.requestId,
				);
				assert.equal(
					port.entries.some(
						(entry) =>
							entry.type === "custom" &&
							entry.customType === OBSERVER_PREPARED_WRAP_ENTRY,
					),
					false,
				);
				assert.equal(await readFile(notebookPath, "utf8"), beforeNotebook);
				const sourceId = sourceRead.read.source.sourceId;
				function recordsFor(guide: WrapPreparationGuide): readonly unknown[] {
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
					wrapScoped.guide.required_records.map((record) => record.record_id),
					[
						DURABLE_INQUIRY,
						registeredHypothesis.inquiryId,
						DURABLE_MEMO,
						sourceId,
					].toSorted(),
				);
				const beforeMalformedWrap = port.entries.length;
				const missingCoverage = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-prepare",
						request_id: wrapRequested.request.requestId,
						summary: "Incomplete proposal",
						records: [],
					},
					port,
				);
				assert.equal(missingCoverage.ok, false);
				const lockedOverride = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-prepare",
						request_id: wrapRequested.request.requestId,
						summary: "Locked override",
						records: recordsFor(wrapScoped.guide),
						proposal_id: "proposal-00000000-0000-4000-8000-000000000999",
					},
					port,
				);
				assert.equal(lockedOverride.ok, false);
				assert.equal(port.entries.length, beforeMalformedWrap);
				const preparedWrap = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-prepare",
						request_id: wrapRequested.request.requestId,
						summary: "Persist one source and the reconciled inquiry state.",
						records: recordsFor(wrapScoped.guide),
					},
					port,
				);
				if (!preparedWrap.ok || preparedWrap.action !== "wrap-prepare")
					assert.fail(
						preparedWrap.ok
							? "Expected Wrap preparation"
							: preparedWrap.message,
					);
				assert.equal(port.entries.length, beforeMalformedWrap);
				const failedWrapInstall = await completeWrapPreparation(
					preparedWrap.handoff,
					{
						install() {
							return Promise.resolve(false);
						},
						apply() {
							assert.fail("Wrap apply must not run after failed install");
						},
						status() {
							return "recovery-required";
						},
					},
				);
				assert.equal(failedWrapInstall.ok, false);
				assert.equal(port.entries.length, beforeMalformedWrap);
				function completionStatus(
					proposalId: string,
				): "completed" | "cancelled" | "recovery-required" {
					const snapshot = reconstructObserverPiState(port.entries);
					if (snapshot.issues.length > 0) return "recovery-required";
					if (
						snapshot.state.episode.status === "settled" &&
						snapshot.state.episode.committedWrap.proposalId === proposalId
					)
						return "completed";
					return snapshot.state.episode.status === "open" &&
						snapshot.prepared === null
						? "cancelled"
						: "recovery-required";
				}
				port.confirmation = false;
				const cancelled = await completeWrapPreparation(preparedWrap.handoff, {
					install(value) {
						return lifecycleController.installPrepared(value, port);
					},
					apply() {
						return lifecycleController.command("wrap", port);
					},
					status: completionStatus,
				});
				assert.equal(cancelled.ok, true);
				if (cancelled.ok) assert.equal(cancelled.status, "cancelled");
				assert.equal(
					reconstructObserverPiState(port.entries).state.episode.status,
					"open",
				);
				await assert.rejects(
					readFile(join(sandbox, "notebook", "records", `${sourceId}.md`)),
				);

				port.confirmation = true;
				const retryRequest = await controller.requestWrap(port);
				if (!retryRequest.ok || !retryRequest.request)
					assert.fail(
						retryRequest.ok
							? "Expected retry Wrap request"
							: retryRequest.message,
					);
				const retryScope = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-scope",
						request_id: retryRequest.request.requestId,
					},
					port,
				);
				if (!retryScope.ok || retryScope.action !== "wrap-scope")
					assert.fail(
						retryScope.ok ? "Expected retry Wrap scope" : retryScope.message,
					);
				const retryPrepared = await controller.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "wrap-prepare",
						request_id: retryRequest.request.requestId,
						summary: "Approved durable reconciliation.",
						records: recordsFor(retryScope.guide),
					},
					port,
				);
				if (!retryPrepared.ok || retryPrepared.action !== "wrap-prepare")
					assert.fail(
						retryPrepared.ok
							? "Expected retry Wrap preparation"
							: retryPrepared.message,
					);
				const completed = await completeWrapPreparation(retryPrepared.handoff, {
					install(value) {
						return lifecycleController.installPrepared(value, port);
					},
					apply() {
						return lifecycleController.command("wrap", port);
					},
					status: completionStatus,
				});
				assert.equal(completed.ok, true);
				if (completed.ok) assert.equal(completed.status, "completed");
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
