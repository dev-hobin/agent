import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import {
	OBSERVER_PROTOCOL,
	type ActivationChangedEvent,
	type EpisodeOpenedEvent,
	type MemoReconciledEvent,
} from "../src/lifecycle.ts";
import { decodePreparedMemoPass, type InquiryId } from "../src/memo-profile.ts";
import {
	hydrateMemoScope,
	initialMemoWorkingState,
	reconcileMemoPass,
} from "../src/memo-reconciliation.ts";
import {
	encodeAppliedMemoPass,
	memoAcknowledgmentEvent,
	OBSERVER_APPLIED_MEMO_ENTRY,
	OBSERVER_PREPARED_MEMO_ENTRY,
	type PendingMemoAcknowledgment,
} from "../src/memo-session.ts";
import { decodeObserverMarkdown } from "../src/markdown-profile.ts";
import {
	decodeObservationEvent,
	encodeObservationEvent,
	observationMemoRequestDigest,
	prepareObservationEvent,
	OBSERVER_OBSERVATION_ENTRY,
	type CandidateCapturedEvent,
	type ObservationEvent,
} from "../src/observation-profile.ts";
import {
	observationCandidateDigest,
	reconstructObservationSession,
} from "../src/observation-session.ts";
import type { NotebookInventoryEntry } from "../src/notebook.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	reconstructObserverPiState,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";
import {
	encodeMaterialReviewEvent,
	OBSERVER_MATERIAL_REVIEW_ENTRY,
	OBSERVER_MATERIAL_REVIEW_PROTOCOL,
	type MaterialReviewRequestedEvent,
} from "../src/material-review-trigger.ts";
import {
	buildStandingIndex,
	hydrateStandingContext,
} from "../src/standing-index.ts";
import { observationContextBasisFixture } from "./fixtures/context-basis.ts";

const EPISODE_ID = "episode-observation-1";
const CANDIDATE_USER = "candidate-00000000-0000-4000-8000-000000000301";
const CANDIDATE_TOOL = "candidate-00000000-0000-4000-8000-000000000302";
const READ_ID = "source-read-00000000-0000-4000-8000-000000000303";
const HYDRATION_ID = "hydration-00000000-0000-4000-8000-000000000304";
const OBSERVATION_MAJOR = "observation-00000000-0000-4000-8000-000000000305";
const OBSERVATION_USER = "observation-00000000-0000-4000-8000-000000000306";
const REQUEST_ID = "memo-request-00000000-0000-4000-8000-000000000307";
const MATERIAL_REVIEW_REQUEST_ID =
	"material-review-00000000-0000-4000-8000-000000000312";
const SOURCE_ID = "source-00000000-0000-4000-8000-000000000308";
const DURABLE_INQUIRY: InquiryId =
	"inquiry-00000000-0000-4000-8000-000000000003";
const USER_INQUIRY: InquiryId = "inquiry-00000000-0000-4000-8000-000000000309";
const REVISION_ID =
	"memo-working-revision-00000000-0000-4000-8000-000000000310";
const RECEIPT_ID = "memo-receipt-00000000-0000-4000-8000-000000000311";
const INDEX_DIGEST = sha256Text("standing-index");
const CONTEXT_DIGEST = sha256Text("standing-context");
const SEMANTIC_CONTEXT_BASIS = await observationContextBasisFixture({
	sourceReading: {
		readingId: READ_ID,
		episodeId: EPISODE_ID,
		sourceId: SOURCE_ID,
		faithfulSummary:
			"The source reports that capture can interrupt reading under specific timing conditions.",
		claims: [
			{
				text: "Capture timing changes interruption cost.",
				locator: "result section",
			},
		],
	},
	inquiryContext: {
		inquiryContextId: HYDRATION_ID,
		readingId: READ_ID,
		inquiryIds: [DURABLE_INQUIRY],
		contextDigest: CONTEXT_DIGEST,
	},
	relatedInquiryIds: [DURABLE_INQUIRY],
});
const FOREIGN_BRANCH_CONTEXT_BASIS = await observationContextBasisFixture({
	sourceReading: {
		readingId: READ_ID,
		episodeId: EPISODE_ID,
		sourceId: SOURCE_ID,
		faithfulSummary: "A parallel branch changed the source-reading basis.",
		claims: [
			{
				text: "Capture timing changes interruption cost.",
				locator: "result section",
			},
		],
	},
	inquiryContext: {
		inquiryContextId: HYDRATION_ID,
		readingId: READ_ID,
		inquiryIds: [DURABLE_INQUIRY],
		contextDigest: CONTEXT_DIGEST,
	},
	relatedInquiryIds: [DURABLE_INQUIRY],
});
const FIXTURES = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);

function custom(customType: string, data: unknown): PiBranchEntryLike {
	return { type: "custom", customType, data };
}

type LifecycleTestEvent =
	| ActivationChangedEvent
	| EpisodeOpenedEvent
	| MemoReconciledEvent;

function lifecycle(event: LifecycleTestEvent): PiBranchEntryLike {
	return custom(OBSERVER_LIFECYCLE_ENTRY, event);
}

function opened(): EpisodeOpenedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId: EPISODE_ID,
		notebookId: "notebook-main",
		lang: "en",
	};
}

function enabled(): ActivationChangedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "activation-changed",
		enabled: true,
	};
}

function requireWorkingEvent(value: unknown): ObservationEvent {
	const result = prepareObservationEvent(value);
	if (!result.ok) assert.fail(JSON.stringify(result.issue));
	return result.value;
}

function observationEntry(event: ObservationEvent): PiBranchEntryLike {
	return custom(OBSERVER_OBSERVATION_ENTRY, encodeObservationEvent(event));
}

function candidate(input: {
	readonly candidateId: string;
	readonly origin: unknown;
	readonly text: string;
	readonly materialReviewRequestId?: string;
}): CandidateCapturedEvent {
	const event = requireWorkingEvent({
		observer_observation: "observer-observation/v1",
		kind: "candidate-captured",
		episode_id: EPISODE_ID,
		candidate_id: input.candidateId,
		origin: input.origin,
		text: input.text,
		content_hash: sha256Text(input.text),
		captured_at: "2026-08-01T10:00:00.000Z",
		...(input.materialReviewRequestId
			? { one_shot_request_id: input.materialReviewRequestId }
			: {}),
	});
	if (event.kind !== "candidate-captured")
		assert.fail("Expected candidate event");
	return event;
}

function workingTrace(): {
	readonly entries: readonly PiBranchEntryLike[];
	readonly userCandidate: CandidateCapturedEvent;
	readonly toolCandidate: CandidateCapturedEvent;
	readonly events: readonly ObservationEvent[];
} {
	const userCandidate = candidate({
		candidateId: CANDIDATE_USER,
		origin: { kind: "user-input", input_source: "interactive" },
		text: "내 가설은 기록 시점이 재진입 비용을 바꾼다는 것이다.",
	});
	const toolCandidate = candidate({
		candidateId: CANDIDATE_TOOL,
		origin: {
			kind: "tool-result",
			tool_call_id: "tool-call-reading-1",
			tool_name: "read",
		},
		text: "The source reports a counterexample to interruption-free capture.",
	});
	const sourceRead = requireWorkingEvent({
		observer_observation: "observer-observation/v1",
		kind: "source-read-recorded",
		episode_id: EPISODE_ID,
		read_id: READ_ID,
		candidate_ids: [CANDIDATE_TOOL],
		source: {
			kind: "external-material",
			source_id: SOURCE_ID,
			title: "Interruption study",
			lang: "en",
			uri: "https://example.com/interruption",
			revision: null,
			content_hash: null,
			retrieval_context: "Tool result tool-call-reading-1",
		},
		faithful_summary:
			"The source reports that capture can interrupt reading under specific timing conditions.",
		claims: [
			{
				text: "Capture timing changes interruption cost.",
				locator: "result section",
			},
		],
		candidate_digest: observationCandidateDigest([toolCandidate]),
		index_digest: INDEX_DIGEST,
		index_inquiry_ids: [DURABLE_INQUIRY],
	});
	const hydration = requireWorkingEvent({
		observer_observation: "observer-observation/v1",
		kind: "inquiry-hydrated",
		episode_id: EPISODE_ID,
		hydration_id: HYDRATION_ID,
		read_id: READ_ID,
		index_digest: INDEX_DIGEST,
		inquiry_ids: [DURABLE_INQUIRY],
		context_digest: CONTEXT_DIGEST,
	});
	const semantic = requireWorkingEvent({
		observer_observation: "observer-observation/v1",
		kind: "semantic-observation-recorded",
		episode_id: EPISODE_ID,
		observation_id: OBSERVATION_MAJOR,
		read_id: READ_ID,
		hydration_id: HYDRATION_ID,
		related_inquiry_ids: [DURABLE_INQUIRY],
		stance: "challenges",
		movement: "core-counterexample",
		rationale:
			"The boundary condition contradicts the unconditional hypothesis.",
		observer_hypothesis: null,
		context_basis: SEMANTIC_CONTEXT_BASIS,
	});
	const userHypothesis = requireWorkingEvent({
		observer_observation: "observer-observation/v1",
		kind: "user-hypothesis-recorded",
		episode_id: EPISODE_ID,
		observation_id: OBSERVATION_USER,
		candidate_id: CANDIDATE_USER,
		inquiry_id: USER_INQUIRY,
		original: "기록 시점이 재진입 비용을 바꾼다.",
		context: "사용자가 명시적으로 추적을 요청했다.",
	});
	if (
		semantic.kind !== "semantic-observation-recorded" ||
		userHypothesis.kind !== "user-hypothesis-recorded"
	) {
		assert.fail("Expected semantic and user-hypothesis events");
	}
	const request = requireWorkingEvent({
		observer_observation: "observer-observation/v1",
		kind: "memo-requested",
		episode_id: EPISODE_ID,
		request_id: REQUEST_ID,
		base_memo_revision_id: null,
		observation_ids: [OBSERVATION_MAJOR, OBSERVATION_USER],
		request_digest: observationMemoRequestDigest({
			episodeId: EPISODE_ID,
			baseMemoRevisionId: null,
			observations: [semantic, userHypothesis],
		}),
	});
	const events = [
		userCandidate,
		toolCandidate,
		sourceRead,
		hydration,
		semantic,
		userHypothesis,
		request,
	];
	return {
		entries: [
			lifecycle(opened()),
			lifecycle(enabled()),
			...events.map(observationEntry),
		],
		userCandidate,
		toolCandidate,
		events,
	};
}

async function fixtureEntry(name: string): Promise<NotebookInventoryEntry> {
	const path = join(FIXTURES, name);
	const content = await readFile(path, "utf8");
	const decoded = decodeObserverMarkdown({ path, content });
	if (!decoded.ok) assert.fail(JSON.stringify(decoded.diagnostics));
	return {
		path,
		relativePath: name,
		content,
		sha256: sha256Text(content),
		document: decoded.value,
	};
}

async function baselineInventory(): Promise<readonly NotebookInventoryEntry[]> {
	return Promise.all([
		fixtureEntry("source-external.md"),
		fixtureEntry("inquiry.md"),
		fixtureEntry("memo-incubating.md"),
	]);
}

function memoCommitEntries(
	prefix: readonly PiBranchEntryLike[],
): readonly PiBranchEntryLike[] {
	const observation = reconstructObservationSession(prefix);
	const lifecycleState = reconstructObserverPiState(prefix).state;
	const state = initialMemoWorkingState();
	const scope = hydrateMemoScope({
		lifecycle: lifecycleState,
		working: state,
		inventory: [],
		relatedInquiryIds: [],
		workingSourceBases: observation.workingSourceBases,
	});
	if (!scope.ok) assert.fail(JSON.stringify(scope.issue));
	const decoded = decodePreparedMemoPass({
		observer_memo_pass: "observer.prepared-memo-pass/v1",
		pass_id: "memo-pass-00000000-0000-4000-8000-000000000312",
		episode_id: EPISODE_ID,
		base_revision_id: null,
		basis_digest: scope.value.basisDigest,
		related_inquiry_ids: [],
		instruction_id: REQUEST_ID,
		evidence: [],
		hypothesis_outcomes: [
			{
				kind: "create",
				hypothesis: {
					inquiry_id: USER_INQUIRY,
					episode_id: EPISODE_ID,
					origin: "user",
					original: "기록 시점이 재진입 비용을 바꾼다.",
					current: "기록 시점이 재진입 비용을 바꾼다.",
					revision_reason: null,
					evidence_ids: [],
				},
			},
		],
		memo_outcomes: [],
	});
	if (!decoded.ok) assert.fail(JSON.stringify(decoded.issue));
	const reconciled = reconcileMemoPass({
		state,
		scope: scope.value,
		pass: decoded.value,
		ids: {
			revisionId() {
				return REVISION_ID;
			},
			receiptId(): `memo-receipt-${string}` {
				return RECEIPT_ID;
			},
		},
	});
	if (!reconciled.ok) assert.fail(JSON.stringify(reconciled.issue));
	const pending: PendingMemoAcknowledgment = {
		passId: decoded.value.passId,
		instructionId: decoded.value.instructionId,
		revisionId: REVISION_ID,
		receipt: reconciled.value.receipt,
	};
	return [
		custom(
			OBSERVER_PREPARED_MEMO_ENTRY,
			decoded.value && {
				observer_memo_pass: "observer.prepared-memo-pass/v1",
				pass_id: decoded.value.passId,
				episode_id: decoded.value.episodeId,
				base_revision_id: decoded.value.baseRevisionId,
				basis_digest: decoded.value.basisDigest,
				related_inquiry_ids: decoded.value.relatedInquiryIds,
				instruction_id: decoded.value.instructionId,
				evidence: [],
				hypothesis_outcomes: [
					{
						kind: "create",
						hypothesis: {
							inquiry_id: USER_INQUIRY,
							episode_id: EPISODE_ID,
							origin: "user",
							original: "기록 시점이 재진입 비용을 바꾼다.",
							current: "기록 시점이 재진입 비용을 바꾼다.",
							revision_reason: null,
							evidence_ids: [],
						},
					},
				],
				memo_outcomes: [],
			},
		),
		custom(
			OBSERVER_APPLIED_MEMO_ENTRY,
			encodeAppliedMemoPass({
				pass: decoded.value,
				scope: scope.value,
				receipt: reconciled.value.receipt,
			}),
		),
		lifecycle(memoAcknowledgmentEvent(pending)),
	];
}

describe("Observation Profile v1", () => {
	test("round-trips every staged event and rejects digest/shape tampering", () => {
		const trace = workingTrace();
		for (const event of trace.events) {
			const encoded = encodeObservationEvent(event);
			const decoded = prepareObservationEvent(encoded);
			assert.equal(
				decoded.ok,
				false,
				"persisted event must not enter the draft parser",
			);
		}
		const encoded = encodeObservationEvent(trace.userCandidate);
		if (
			typeof encoded !== "object" ||
			encoded === null ||
			Array.isArray(encoded)
		) {
			assert.fail("Expected encoded object");
		}
		const extra = { ...encoded, unexpected: true };
		assert.equal(prepareObservationEvent(extra).ok, false);
		const tampered = { ...encoded, event_digest: "0".repeat(64) };
		const rejected = decodeObservationEvent(tampered);
		assert.equal(rejected.ok, false);
		if (rejected.ok) assert.fail("Expected digest rejection");
		assert.equal(rejected.issue.code, "observation-profile.digest");
		const sourceRead = trace.events.find(
			(event) => event.kind === "source-read-recorded",
		);
		if (!sourceRead) assert.fail("Expected SourceRead event");
		const encodedRead = encodeObservationEvent(sourceRead);
		if (
			typeof encodedRead !== "object" ||
			encodedRead === null ||
			Array.isArray(encodedRead)
		)
			assert.fail("Expected encoded SourceRead object");
		assert.equal(
			decodeObservationEvent({
				...encodedRead,
				one_shot_request_id: "material-review-invalid",
			}).ok,
			false,
		);
	});

	test("orders a durable Review & Save continuation after its exact Memo request", () => {
		const trace = workingTrace();
		const request = trace.events.find(
			(event) => event.kind === "memo-requested",
		);
		if (!request || request.kind !== "memo-requested")
			assert.fail("Expected Memo request");
		const continuation = prepareObservationEvent({
			observer_observation: "observer-observation/v1",
			kind: "review-save-continuation-requested",
			episode_id: request.episodeId,
			memo_request_id: request.requestId,
			base_save_request_count: 0,
		});
		if (
			!continuation.ok ||
			continuation.value.kind !== "review-save-continuation-requested"
		)
			assert.fail("Expected Review & Save continuation");
		const accepted = reconstructObservationSession([
			...trace.entries,
			observationEntry(continuation.value),
		]);
		assert.equal(accepted.issues.length, 0);
		assert.equal(
			accepted.reviewSaveContinuations[0]?.memoRequestId,
			request.requestId,
		);
		const requestEntry = trace.entries.at(-1);
		if (!requestEntry) assert.fail("Expected Memo request entry");
		const reordered = reconstructObservationSession([
			...trace.entries.slice(0, -1),
			observationEntry(continuation.value),
			requestEntry,
		]);
		assert.equal(reordered.issues[0]?.code, "observation-session.order");
	});

	test("rejects self-tool candidates, old basis-less history, and inconsistent branches", () => {
		const legacy = prepareObservationEvent({
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: EPISODE_ID,
			observation_id: OBSERVATION_MAJOR,
			read_id: READ_ID,
			hydration_id: HYDRATION_ID,
			related_inquiry_ids: [DURABLE_INQUIRY],
			stance: "supports",
			movement: "minor-refinement",
			rationale: "Old adapter history has no persisted context basis.",
			observer_hypothesis: null,
		});
		assert.equal(legacy.ok, false);
		if (!legacy.ok)
			assert.equal(legacy.issue.code, "observation-profile.shape");

		const self = prepareObservationEvent({
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: EPISODE_ID,
			candidate_id: CANDIDATE_TOOL,
			origin: {
				kind: "tool-result",
				tool_call_id: "observer-call",
				tool_name: "observer_sidecar",
			},
			text: "self output",
			content_hash: sha256Text("self output"),
			captured_at: "2026-08-01T10:00:00.000Z",
		});
		assert.equal(self.ok, false);
		const inconsistent = prepareObservationEvent({
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: EPISODE_ID,
			observation_id: OBSERVATION_MAJOR,
			read_id: READ_ID,
			hydration_id: null,
			related_inquiry_ids: [DURABLE_INQUIRY],
			stance: "supports",
			movement: "minor-refinement",
			rationale: "This incorrectly omits hydration.",
			observer_hypothesis: null,
			context_basis: SEMANTIC_CONTEXT_BASIS,
		});
		assert.equal(inconsistent.ok, false);
	});
});

describe("Observation current-branch session", () => {
	test("authorizes only request-linked candidates after an exact pending material review prefix", () => {
		const request: MaterialReviewRequestedEvent = {
			protocol: OBSERVER_MATERIAL_REVIEW_PROTOCOL,
			kind: "material-review-requested",
			requestId: MATERIAL_REVIEW_REQUEST_ID,
			episodeId: EPISODE_ID,
			userMessageDigest: sha256Text("inline material"),
			material: "inline-user-message",
		};
		const linked = candidate({
			candidateId: CANDIDATE_USER,
			origin: { kind: "user-input", input_source: "interactive" },
			text: "inline material",
			materialReviewRequestId: MATERIAL_REVIEW_REQUEST_ID,
		});
		const encoded = encodeObservationEvent(linked);
		const decoded = decodeObservationEvent(encoded);
		if (!decoded.ok) assert.fail(decoded.issue.message);
		assert.equal(
			decoded.value.kind === "candidate-captured"
				? decoded.value.materialReviewRequestId
				: null,
			MATERIAL_REVIEW_REQUEST_ID,
		);
		const requestEntry = custom(
			OBSERVER_MATERIAL_REVIEW_ENTRY,
			encodeMaterialReviewEvent(request),
		);
		const candidateEntry = observationEntry(linked);
		const authorized = reconstructObservationSession([
			lifecycle(opened()),
			requestEntry,
			candidateEntry,
		]);
		assert.equal(authorized.lifecycle.mode, "off");
		assert.equal(authorized.issues.length, 0);
		assert.equal(authorized.candidates.length, 1);

		const reordered = reconstructObservationSession([
			lifecycle(opened()),
			candidateEntry,
			requestEntry,
		]);
		assert.equal(reordered.candidates.length, 0);
		assert.equal(reordered.issues[0]?.code, "observation-session.scope");
		const activatedWithoutRequest = reconstructObservationSession([
			lifecycle(opened()),
			lifecycle(enabled()),
			candidateEntry,
		]);
		assert.equal(activatedWithoutRequest.candidates.length, 0);
		assert.equal(
			activatedWithoutRequest.issues[0]?.code,
			"observation-session.scope",
		);
		const unlinked = reconstructObservationSession([
			lifecycle(opened()),
			observationEntry(
				candidate({
					candidateId: CANDIDATE_TOOL,
					origin: { kind: "user-input", input_source: "interactive" },
					text: "unlinked material",
				}),
			),
		]);
		assert.equal(unlinked.candidates.length, 0);
		assert.equal(unlinked.issues[0]?.code, "observation-session.scope");
	});

	test("replays candidate-read-hydrate-observe-user-H-request and consumes only after Memo ack", () => {
		const trace = workingTrace();
		const pending = reconstructObservationSession(trace.entries);
		assert.equal(pending.issues.length, 0);
		assert.deepEqual(pending.unconsumedObservationIds, [
			OBSERVATION_MAJOR,
			OBSERVATION_USER,
		]);
		assert.equal(pending.pendingHypotheses[0]?.origin, "user");
		assert.equal(
			pending.pendingHypotheses[0]?.original,
			"기록 시점이 재진입 비용을 바꾼다.",
		);
		assert.equal(pending.workingSourceBases[0]?.sourceId, SOURCE_ID);

		const committed = reconstructObservationSession([
			...trace.entries,
			...memoCommitEntries(trace.entries),
		]);
		assert.equal(committed.issues.length, 0);
		assert.deepEqual(committed.unconsumedObservationIds, []);
		assert.deepEqual(committed.consumedObservationIds, [
			OBSERVATION_MAJOR,
			OBSERVATION_USER,
		]);
		assert.deepEqual(committed.pendingHypotheses, []);
	});

	test("rejects a valid context basis copied from another branch", () => {
		const trace = workingTrace();
		const foreignSemantic = requireWorkingEvent({
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: EPISODE_ID,
			observation_id: OBSERVATION_MAJOR,
			read_id: READ_ID,
			hydration_id: HYDRATION_ID,
			related_inquiry_ids: [DURABLE_INQUIRY],
			stance: "challenges",
			movement: "core-counterexample",
			rationale:
				"The boundary condition contradicts the unconditional hypothesis.",
			observer_hypothesis: null,
			context_basis: FOREIGN_BRANCH_CONTEXT_BASIS,
		});
		const branch = trace.entries.map((entry) =>
			entry.customType === OBSERVER_OBSERVATION_ENTRY &&
			typeof entry.data === "object" &&
			entry.data !== null &&
			Reflect.get(entry.data, "kind") === "semantic-observation-recorded"
				? observationEntry(foreignSemantic)
				: entry,
		);
		const replay = reconstructObservationSession(branch);
		assert.equal(
			replay.issues.some((issue) => issue.code === "observation-session.order"),
			true,
		);
		assert.equal(replay.observations.length, 0);
	});

	test("stutters exact duplicates and fails closed for conflicts/reordering/forks", () => {
		const trace = workingTrace();
		const duplicate = reconstructObservationSession([
			...trace.entries,
			observationEntry(trace.userCandidate),
		]);
		assert.equal(duplicate.issues.length, 0);
		assert.equal(duplicate.candidates.length, 2);

		const conflictingCandidate = candidate({
			candidateId: CANDIDATE_USER,
			origin: { kind: "user-input", input_source: "interactive" },
			text: "같은 ID의 다른 내용",
		});
		const conflict = reconstructObservationSession([
			lifecycle(opened()),
			lifecycle(enabled()),
			observationEntry(trace.userCandidate),
			observationEntry(conflictingCandidate),
		]);
		assert.equal(conflict.issues[0]?.code, "observation-session.conflict");

		const hydration = trace.events.find(
			(event) => event.kind === "inquiry-hydrated",
		);
		if (!hydration) assert.fail("Expected hydration event");
		const reordered = reconstructObservationSession([
			lifecycle(opened()),
			lifecycle(enabled()),
			observationEntry(hydration),
		]);
		assert.equal(reordered.issues[0]?.code, "observation-session.order");

		const branchA = reconstructObservationSession(trace.entries);
		const branchB = reconstructObservationSession(trace.entries.slice(0, 4));
		assert.equal(branchA.observations.length, 1);
		assert.equal(branchB.observations.length, 0);
	});
});

describe("standing Inquiry index", () => {
	test("combines durable and pending inquiries deterministically and hydrates only selected context", async () => {
		const inventory = await baselineInventory();
		const trace = workingTrace();
		const observation = reconstructObservationSession(trace.entries);
		const memo = initialMemoWorkingState();
		const index = buildStandingIndex({ inventory, memo, observation });
		const reversed = buildStandingIndex({
			inventory: inventory.toReversed(),
			memo,
			observation,
		});
		assert.equal(index.digest, reversed.digest);
		assert.deepEqual(
			index.inquiries.map((inquiry) => [inquiry.inquiryId, inquiry.source]),
			[
				[DURABLE_INQUIRY, "durable"],
				[USER_INQUIRY, "pending"],
			],
		);

		const durable = hydrateStandingContext({
			index,
			requestedInquiryIds: [DURABLE_INQUIRY],
			inventory,
			memo,
			observation,
			episodeLanguage: "en",
		});
		if (!durable.ok) assert.fail(JSON.stringify(durable.issue));
		assert.equal(durable.value.inquiries.length, 1);
		assert.equal(durable.value.memos.length, 1);
		assert.equal(
			durable.value.memos[0]?.memoId,
			"memo-00000000-0000-4000-8000-000000000004",
		);

		const pending = hydrateStandingContext({
			index,
			requestedInquiryIds: [USER_INQUIRY],
			inventory,
			memo,
			observation,
			episodeLanguage: "en",
		});
		if (!pending.ok) assert.fail(JSON.stringify(pending.issue));
		assert.equal(pending.value.inquiries[0]?.source, "pending");
		assert.equal(pending.value.memos.length, 0);
	});
});
