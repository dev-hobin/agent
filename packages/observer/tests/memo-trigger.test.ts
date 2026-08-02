import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import { OBSERVER_PROTOCOL } from "../src/lifecycle.ts";
import {
	decodePreparedObservationMemoInstruction,
	decodeStoredObservationMemoInstruction,
	encodeObservationMemoInstruction,
	OBSERVER_MEMO_INSTRUCTION_ENTRY,
	reconstructMemoInstructionSession,
} from "../src/memo-instruction.ts";
import { reconstructMemoSession } from "../src/memo-session.ts";
import { decodePreparedMemoPass } from "../src/memo-profile.ts";
import {
	buildObservationMemoPreparationGuide,
	hydrateObservationMemoContext,
	planObservationMemoRequest,
	type ObservationMemoContext,
} from "../src/memo-trigger.ts";
import {
	encodeObservationEvent,
	observationMemoRequestDigest,
	prepareObservationEvent,
	OBSERVER_OBSERVATION_ENTRY,
	type CandidateCapturedEvent,
	type MemoRequestId,
	type ObservationEvent,
	type SemanticObservationRecordedEvent,
	type UserHypothesisRecordedEvent,
} from "../src/observation-profile.ts";
import {
	observationCandidateDigest,
	reconstructObservationSession,
} from "../src/observation-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";
import {
	memoContextBasisDataFixture,
	observationContextBasisFixture,
} from "./fixtures/context-basis.ts";

const EPISODE_ID = "episode-memo-trigger-1";
const REQUEST_ID: MemoRequestId =
	"memo-request-00000000-0000-4000-8000-000000000501";
const USER_CANDIDATE = "candidate-00000000-0000-4000-8000-000000000502";
const TOOL_CANDIDATE = "candidate-00000000-0000-4000-8000-000000000503";
const READ_ID = "source-read-00000000-0000-4000-8000-000000000504";
const SOURCE_ID = "source-00000000-0000-4000-8000-000000000505";
const SEMANTIC_ID = "observation-00000000-0000-4000-8000-000000000506";
const USER_OBSERVATION_ID = "observation-00000000-0000-4000-8000-000000000507";
const USER_INQUIRY_ID = "inquiry-00000000-0000-4000-8000-000000000508";
const EVIDENCE_ID = "evidence-00000000-0000-4000-8000-000000000509";
const PASS_ID = "memo-pass-00000000-0000-4000-8000-000000000510";
const INDEX_DIGEST = sha256Text("memo-trigger-empty-index");
const BASE_OBSERVATION_CONTEXT_BASIS = await observationContextBasisFixture({
	sourceReading: {
		readingId: READ_ID,
		episodeId: EPISODE_ID,
		sourceId: SOURCE_ID,
		faithfulSummary: "The source reports one bounded condition.",
		claims: [{ text: "One bounded condition.", locator: "result" }],
	},
	inquiryContext: null,
	relatedInquiryIds: [],
});

function custom(customType: string, data: unknown): PiBranchEntryLike {
	return { type: "custom", customType, data };
}

function lifecycle(data: unknown): PiBranchEntryLike {
	return custom(OBSERVER_LIFECYCLE_ENTRY, data);
}

function event(value: unknown): ObservationEvent {
	const prepared = prepareObservationEvent(value);
	if (!prepared.ok) assert.fail(JSON.stringify(prepared.issue));
	return prepared.value;
}

function observationEntry(value: ObservationEvent): PiBranchEntryLike {
	return custom(OBSERVER_OBSERVATION_ENTRY, encodeObservationEvent(value));
}

function candidate(input: {
	readonly id: string;
	readonly text: string;
	readonly origin: unknown;
}): CandidateCapturedEvent {
	const prepared = event({
		observer_observation: "observer-observation/v1",
		kind: "candidate-captured",
		episode_id: EPISODE_ID,
		candidate_id: input.id,
		origin: input.origin,
		text: input.text,
		content_hash: sha256Text(input.text),
		captured_at: "2026-08-02T10:00:00.000Z",
	});
	if (prepared.kind !== "candidate-captured") assert.fail("Expected candidate");
	return prepared;
}

function baseEntries(): {
	readonly entries: readonly PiBranchEntryLike[];
	readonly semantic: SemanticObservationRecordedEvent;
	readonly userHypothesis: UserHypothesisRecordedEvent;
} {
	const userCandidate = candidate({
		id: USER_CANDIDATE,
		text: "사용자는 기록 시점이 재진입 비용을 바꾼다고 가정한다.",
		origin: { kind: "user-input", input_source: "interactive" },
	});
	const toolCandidate = candidate({
		id: TOOL_CANDIDATE,
		text: "A bounded source result.",
		origin: {
			kind: "tool-result",
			tool_call_id: "tool-trigger-1",
			tool_name: "read",
		},
	});
	const read = event({
		observer_observation: "observer-observation/v1",
		kind: "source-read-recorded",
		episode_id: EPISODE_ID,
		read_id: READ_ID,
		candidate_ids: [TOOL_CANDIDATE],
		source: {
			kind: "external-material",
			source_id: SOURCE_ID,
			title: "Bounded source",
			lang: "en",
			uri: "https://example.com/bounded",
			revision: null,
			content_hash: null,
			retrieval_context: "read result",
		},
		faithful_summary: "The source reports one bounded condition.",
		claims: [{ text: "One bounded condition.", locator: "result" }],
		candidate_digest: observationCandidateDigest([toolCandidate]),
		index_digest: INDEX_DIGEST,
		index_inquiry_ids: [],
	});
	if (read.kind !== "source-read-recorded") assert.fail("Expected source read");
	const semantic = event({
		observer_observation: "observer-observation/v1",
		kind: "semantic-observation-recorded",
		episode_id: EPISODE_ID,
		observation_id: SEMANTIC_ID,
		read_id: READ_ID,
		hydration_id: null,
		related_inquiry_ids: [],
		stance: "uncertain",
		movement: "uncertain-association",
		rationale: "The condition may matter but does not yet revise an Inquiry.",
		observer_hypothesis: null,
		context_basis: BASE_OBSERVATION_CONTEXT_BASIS,
	});
	if (semantic.kind !== "semantic-observation-recorded") {
		assert.fail("Expected semantic observation");
	}
	const userHypothesis = event({
		observer_observation: "observer-observation/v1",
		kind: "user-hypothesis-recorded",
		episode_id: EPISODE_ID,
		observation_id: USER_OBSERVATION_ID,
		candidate_id: USER_CANDIDATE,
		inquiry_id: USER_INQUIRY_ID,
		original: "기록 시점이 재진입 비용을 바꾼다.",
		context: "사용자가 명시적으로 추적을 요청했다.",
	});
	if (userHypothesis.kind !== "user-hypothesis-recorded") {
		assert.fail("Expected user hypothesis");
	}
	return {
		entries: [
			lifecycle({
				protocol: OBSERVER_PROTOCOL,
				kind: "episode-opened",
				episodeId: EPISODE_ID,
				notebookId: "notebook-memo-trigger",
				lang: "ko",
			}),
			lifecycle({
				protocol: OBSERVER_PROTOCOL,
				kind: "activation-changed",
				enabled: true,
			}),
			observationEntry(userCandidate),
			observationEntry(toolCandidate),
			observationEntry(read),
			observationEntry(semantic),
			observationEntry(userHypothesis),
		],
		semantic,
		userHypothesis,
	};
}

function plan(
	entries: readonly PiBranchEntryLike[],
	requestId: MemoRequestId = REQUEST_ID,
) {
	return planObservationMemoRequest({
		observation: reconstructObservationSession(entries),
		memo: reconstructMemoSession(entries),
		requestId,
	});
}

function requestedScenario(): {
	readonly entries: readonly PiBranchEntryLike[];
	readonly context: ObservationMemoContext;
} {
	const base = baseEntries();
	const result = plan(base.entries);
	if (!result.ok || result.value.kind !== "append") {
		assert.fail(result.ok ? "Expected append plan" : result.issue.message);
	}
	const entries = [...base.entries, observationEntry(result.value.request)];
	const context = hydrateObservationMemoContext({
		observation: reconstructObservationSession(entries),
		memo: reconstructMemoSession(entries),
		inventory: [],
		requestId: result.value.request.requestId,
	});
	if (!context.ok) assert.fail(context.issue.message);
	return { entries, context: context.value };
}

async function decodeInstructionWithContext(
	value: Record<string, unknown>,
	context: ObservationMemoContext,
) {
	const pass = decodePreparedMemoPass(Reflect.get(value, "pass"));
	if (!pass.ok) assert.fail(pass.issue.message);
	const dispositions = Reflect.get(value, "dispositions");
	if (!Array.isArray(dispositions)) assert.fail("Expected dispositions array");
	const contextBasis = await memoContextBasisDataFixture({
		scopeId: context.request.requestId,
		episodeId: pass.value.episodeId,
		basisDigest: pass.value.basisDigest,
		relatedInquiryIds: pass.value.relatedInquiryIds,
		knownEvidenceIds: [
			...context.priorEvidenceIds,
			...pass.value.evidence.map((evidence) => evidence.evidenceId),
		].toSorted((left, right) => left.localeCompare(right)),
		passDigest: pass.value.digest,
		outcomeCount:
			pass.value.hypothesisOutcomes.length + pass.value.memoOutcomes.length,
		dispositionCount: dispositions.length,
	});
	return decodePreparedObservationMemoInstruction({
		value,
		context,
		contextBasis,
	});
}

function instructionRaw(
	context: ObservationMemoContext,
	overrides: {
		readonly dispositions?: readonly unknown[];
		readonly requestDigest?: string;
	} = {},
): Record<string, unknown> {
	return {
		observer_memo_instruction: "observer.memo-instruction/v1",
		request_id: context.request.requestId,
		request_digest: overrides.requestDigest ?? context.request.requestDigest,
		pass: {
			observer_memo_pass: "observer.prepared-memo-pass/v1",
			pass_id: PASS_ID,
			episode_id: EPISODE_ID,
			base_revision_id: context.request.baseMemoRevisionId,
			basis_digest: context.memoScope.basisDigest,
			related_inquiry_ids: context.memoScope.relatedInquiryIds,
			instruction_id: context.request.requestId,
			evidence: [
				{
					evidence_id: EVIDENCE_ID,
					kind: "source-claim",
					source_id: SOURCE_ID,
					summary: "The source reports one bounded condition.",
				},
			],
			hypothesis_outcomes: [
				{
					kind: "create",
					hypothesis: {
						inquiry_id: USER_INQUIRY_ID,
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
		dispositions: overrides.dispositions ?? [
			{
				observation_id: SEMANTIC_ID,
				decision: "integrated",
				hypothesis_inquiry_ids: [],
				memo_ids: [],
				evidence_ids: [EVIDENCE_ID],
				rationale: "The bounded claim is retained in working evidence.",
			},
			{
				observation_id: USER_OBSERVATION_ID,
				decision: "integrated",
				hypothesis_inquiry_ids: [USER_INQUIRY_ID],
				memo_ids: [],
				evidence_ids: [],
				rationale: "The explicit user hypothesis is registered unchanged.",
			},
		],
	};
}

describe("pure Observation Memo trigger", () => {
	test("builds a deterministic request-bound preparation guide", () => {
		const scenario = requestedScenario();
		const observation = reconstructObservationSession(scenario.entries);
		const memo = reconstructMemoSession(scenario.entries);
		const first = buildObservationMemoPreparationGuide({
			context: scenario.context,
			observation,
			memo,
		});
		const retry = buildObservationMemoPreparationGuide({
			context: scenario.context,
			observation,
			memo,
		});
		if (!first.ok) assert.fail(first.issue.message);
		if (!retry.ok) assert.fail(retry.issue.message);
		assert.deepEqual(first.value, retry.value);
		assert.deepEqual(first.value.request.observation_ids, [
			SEMANTIC_ID,
			USER_OBSERVATION_ID,
		]);
		assert.equal(
			first.value.instruction_seed.pass.pass_id,
			"memo-pass-00000000-0000-4000-8000-000000000501",
		);
		assert.equal(
			first.value.instruction_seed.request_digest,
			scenario.context.request.requestDigest,
		);
		assert.equal(first.value.instruction_seed.pass.instruction_id, REQUEST_ID);
		assert.deepEqual(first.value.required_coverage, {
			hypotheses: [
				{
					inquiryId: USER_INQUIRY_ID,
					episodeId: EPISODE_ID,
					origin: "user",
					original: "기록 시점이 재진입 비용을 바꾼다.",
					current: "기록 시점이 재진입 비용을 바꾼다.",
					revisionReason: null,
					evidenceIds: [],
				},
			],
			memos: [],
		});
		assert.deepEqual(first.value.submission_seed, {
			evidence: [],
			hypothesis_outcomes: [],
			memo_outcomes: [],
			dispositions: [],
		});
		assert.deepEqual(first.value.evidence_sources, [
			{
				source_id: SOURCE_ID,
				title: "Bounded source",
				faithful_summary: "The source reports one bounded condition.",
				claims: [{ text: "One bounded condition.", locator: "result" }],
			},
		]);
	});

	test("treats an Inquiry created by one requested Observation as pending when a later Observation relates to it", async () => {
		const pendingInquiryId = "inquiry-00000000-0000-4000-8000-000000000530";
		const firstContextBasis = await observationContextBasisFixture({
			sourceReading: {
				readingId: "source-read-00000000-0000-4000-8000-000000000532",
				episodeId: EPISODE_ID,
				sourceId: "source-00000000-0000-4000-8000-000000000533",
				faithfulSummary: "The first source suggests a new hypothesis.",
				claims: [{ text: "A new hypothesis is plausible.", locator: null }],
			},
			inquiryContext: null,
			relatedInquiryIds: [],
		});
		const firstCandidate = candidate({
			id: "candidate-00000000-0000-4000-8000-000000000531",
			text: "first source",
			origin: {
				kind: "tool-result",
				tool_call_id: "tool-pending-inquiry-first",
				tool_name: "read",
			},
		});
		const firstRead = event({
			observer_observation: "observer-observation/v1",
			kind: "source-read-recorded",
			episode_id: EPISODE_ID,
			read_id: "source-read-00000000-0000-4000-8000-000000000532",
			candidate_ids: [firstCandidate.candidateId],
			source: {
				kind: "external-material",
				source_id: "source-00000000-0000-4000-8000-000000000533",
				title: "First source",
				lang: "en",
				uri: "https://example.com/pending-first",
				revision: null,
				content_hash: null,
				retrieval_context: "first read result",
			},
			faithful_summary: "The first source suggests a new hypothesis.",
			claims: [{ text: "A new hypothesis is plausible.", locator: null }],
			candidate_digest: observationCandidateDigest([firstCandidate]),
			index_digest: INDEX_DIGEST,
			index_inquiry_ids: [],
		});
		if (firstRead.kind !== "source-read-recorded")
			assert.fail("Expected first SourceRead");
		const hypothesisObservation = event({
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: EPISODE_ID,
			observation_id: "observation-00000000-0000-4000-8000-000000000534",
			read_id: firstRead.readId,
			hydration_id: null,
			related_inquiry_ids: [],
			stance: "uncertain",
			movement: "independent-new-hypothesis",
			rationale: "The first source opens a new question.",
			observer_hypothesis: {
				inquiry_id: pendingInquiryId,
				original: "The new question remains useful across sources.",
			},
			context_basis: firstContextBasis,
		});
		if (hypothesisObservation.kind !== "semantic-observation-recorded")
			assert.fail("Expected hypothesis Observation");

		const secondCandidate = candidate({
			id: "candidate-00000000-0000-4000-8000-000000000535",
			text: "second source",
			origin: {
				kind: "tool-result",
				tool_call_id: "tool-pending-inquiry-second",
				tool_name: "read",
			},
		});
		const pendingIndexDigest = sha256Text("pending inquiry index");
		const secondRead = event({
			observer_observation: "observer-observation/v1",
			kind: "source-read-recorded",
			episode_id: EPISODE_ID,
			read_id: "source-read-00000000-0000-4000-8000-000000000536",
			candidate_ids: [secondCandidate.candidateId],
			source: {
				kind: "external-material",
				source_id: "source-00000000-0000-4000-8000-000000000537",
				title: "Second source",
				lang: "en",
				uri: "https://example.com/pending-second",
				revision: null,
				content_hash: null,
				retrieval_context: "second read result",
			},
			faithful_summary: "The second source supports the pending hypothesis.",
			claims: [{ text: "The hypothesis recurs.", locator: null }],
			candidate_digest: observationCandidateDigest([secondCandidate]),
			index_digest: pendingIndexDigest,
			index_inquiry_ids: [pendingInquiryId],
		});
		if (secondRead.kind !== "source-read-recorded")
			assert.fail("Expected second SourceRead");
		const hydration = event({
			observer_observation: "observer-observation/v1",
			kind: "inquiry-hydrated",
			episode_id: EPISODE_ID,
			hydration_id: "hydration-00000000-0000-4000-8000-000000000538",
			read_id: secondRead.readId,
			index_digest: pendingIndexDigest,
			inquiry_ids: [pendingInquiryId],
			context_digest: sha256Text("pending inquiry context"),
		});
		if (hydration.kind !== "inquiry-hydrated")
			assert.fail("Expected hydration");
		const secondContextBasis = await observationContextBasisFixture({
			sourceReading: {
				readingId: secondRead.readId,
				episodeId: EPISODE_ID,
				sourceId: secondRead.source.sourceId,
				faithfulSummary: secondRead.faithfulSummary,
				claims: secondRead.claims,
			},
			inquiryContext: {
				inquiryContextId: hydration.hydrationId,
				readingId: hydration.readId,
				inquiryIds: hydration.inquiryIds,
				contextDigest: hydration.contextDigest,
			},
			relatedInquiryIds: [pendingInquiryId],
		});
		const relatedObservation = event({
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: EPISODE_ID,
			observation_id: "observation-00000000-0000-4000-8000-000000000539",
			read_id: secondRead.readId,
			hydration_id: hydration.hydrationId,
			related_inquiry_ids: [pendingInquiryId],
			stance: "supports",
			movement: "repeated-support",
			rationale: "A later source supports the pending hypothesis.",
			observer_hypothesis: null,
			context_basis: secondContextBasis,
		});
		const entries = [
			lifecycle({
				protocol: OBSERVER_PROTOCOL,
				kind: "episode-opened",
				episodeId: EPISODE_ID,
				notebookId: "notebook-memo-trigger",
				lang: "ko",
			}),
			lifecycle({
				protocol: OBSERVER_PROTOCOL,
				kind: "activation-changed",
				enabled: true,
			}),
			observationEntry(firstCandidate),
			observationEntry(firstRead),
			observationEntry(hypothesisObservation),
			observationEntry(secondCandidate),
			observationEntry(secondRead),
			observationEntry(hydration),
			observationEntry(relatedObservation),
		];
		const planned = plan(entries);
		if (!planned.ok || planned.value.kind !== "append")
			assert.fail(planned.ok ? "Expected Memo request" : planned.issue.message);
		const requested = [...entries, observationEntry(planned.value.request)];
		const context = hydrateObservationMemoContext({
			observation: reconstructObservationSession(requested),
			memo: reconstructMemoSession(requested),
			inventory: [],
			requestId: planned.value.request.requestId,
		});
		if (!context.ok) assert.fail(context.issue.message);
		assert.deepEqual(context.value.memoScope.relatedInquiryIds, []);
		assert.equal(context.value.observations.length, 2);
	});

	test("plans one exact all-eligible request, resumes it, and leaves later observations for the next batch", async () => {
		const emptyEntries = baseEntries().entries.slice(0, 2);
		const empty = plan(emptyEntries);
		assert.deepEqual(empty, { ok: true, value: { kind: "none" } });

		const base = baseEntries();
		const append = plan(base.entries);
		if (!append.ok || append.value.kind !== "append") {
			assert.fail(append.ok ? "Expected append" : append.issue.message);
		}
		assert.deepEqual(append.value.request.observationIds, [
			SEMANTIC_ID,
			USER_OBSERVATION_ID,
		]);
		const requested = [...base.entries, observationEntry(append.value.request)];
		const resume = plan(
			requested,
			"memo-request-00000000-0000-4000-8000-000000000599",
		);
		if (!resume.ok || resume.value.kind !== "resume") {
			assert.fail(resume.ok ? "Expected resume" : resume.issue.message);
		}
		assert.equal(resume.value.request.requestId, REQUEST_ID);

		const laterCandidate = candidate({
			id: "candidate-00000000-0000-4000-8000-000000000511",
			text: "later user hypothesis",
			origin: { kind: "user-input", input_source: "interactive" },
		});
		const laterHypothesis = event({
			observer_observation: "observer-observation/v1",
			kind: "user-hypothesis-recorded",
			episode_id: EPISODE_ID,
			observation_id: "observation-00000000-0000-4000-8000-000000000512",
			candidate_id: laterCandidate.candidateId,
			inquiry_id: "inquiry-00000000-0000-4000-8000-000000000513",
			original: "Later hypothesis",
			context: "Arrived after the pending request.",
		});
		const laterToolCandidate = candidate({
			id: "candidate-00000000-0000-4000-8000-000000000514",
			text: "later source result",
			origin: {
				kind: "tool-result",
				tool_call_id: "tool-trigger-later",
				tool_name: "read",
			},
		});
		const laterRead = event({
			observer_observation: "observer-observation/v1",
			kind: "source-read-recorded",
			episode_id: EPISODE_ID,
			read_id: "source-read-00000000-0000-4000-8000-000000000515",
			candidate_ids: [laterToolCandidate.candidateId],
			source: {
				kind: "external-material",
				source_id: "source-00000000-0000-4000-8000-000000000516",
				title: "Later source",
				lang: "en",
				uri: "https://example.com/later",
				revision: null,
				content_hash: null,
				retrieval_context: "later read result",
			},
			faithful_summary: "This source arrived after request creation.",
			claims: [{ text: "A later claim.", locator: "result" }],
			candidate_digest: observationCandidateDigest([laterToolCandidate]),
			index_digest: INDEX_DIGEST,
			index_inquiry_ids: [],
		});
		if (laterRead.kind !== "source-read-recorded") {
			assert.fail("Expected later SourceRead");
		}
		const laterContextBasis = await observationContextBasisFixture({
			sourceReading: {
				readingId: laterRead.readId,
				episodeId: EPISODE_ID,
				sourceId: laterRead.source.sourceId,
				faithfulSummary: laterRead.faithfulSummary,
				claims: laterRead.claims,
			},
			inquiryContext: null,
			relatedInquiryIds: [],
		});
		const laterSemantic = event({
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: EPISODE_ID,
			observation_id: "observation-00000000-0000-4000-8000-000000000517",
			read_id: laterRead.readId,
			hydration_id: null,
			related_inquiry_ids: [],
			stance: "uncertain",
			movement: "uncertain-association",
			rationale: "This later Observation belongs to the next batch.",
			observer_hypothesis: null,
			context_basis: laterContextBasis,
		});
		const withLater = [
			...requested,
			observationEntry(laterCandidate),
			observationEntry(laterHypothesis),
			observationEntry(laterToolCandidate),
			observationEntry(laterRead),
			observationEntry(laterSemantic),
		];
		const context = hydrateObservationMemoContext({
			observation: reconstructObservationSession(withLater),
			memo: reconstructMemoSession(withLater),
			inventory: [],
			requestId: REQUEST_ID,
		});
		if (!context.ok) assert.fail(context.issue.message);
		assert.deepEqual(
			context.value.observations.map((item) => item.observationId),
			[SEMANTIC_ID, USER_OBSERVATION_ID],
		);
		assert.deepEqual(context.value.memoScope.sourceIds, [SOURCE_ID]);
	});

	test("rejects stale request digests and two unacknowledged requests while exact duplicates stutter", () => {
		const base = baseEntries();
		const append = plan(base.entries);
		if (!append.ok || append.value.kind !== "append")
			assert.fail("Expected request");
		const exactEntry = observationEntry(append.value.request);
		const duplicate = reconstructObservationSession([
			...base.entries,
			exactEntry,
			exactEntry,
		]);
		assert.equal(duplicate.issues.length, 0);
		assert.equal(duplicate.memoRequests.length, 1);

		const stale = event({
			observer_observation: "observer-observation/v1",
			kind: "memo-requested",
			episode_id: append.value.request.episodeId,
			request_id: append.value.request.requestId,
			base_memo_revision_id: append.value.request.baseMemoRevisionId,
			observation_ids: append.value.request.observationIds,
			request_digest: sha256Text("stale request"),
		});
		const staleReplay = reconstructObservationSession([
			...base.entries,
			observationEntry(stale),
		]);
		assert.equal(staleReplay.issues[0]?.code, "observation-session.order");

		const partial = event({
			observer_observation: "observer-observation/v1",
			kind: "memo-requested",
			episode_id: EPISODE_ID,
			request_id: REQUEST_ID,
			base_memo_revision_id: null,
			observation_ids: [SEMANTIC_ID],
			request_digest: observationMemoRequestDigest({
				episodeId: EPISODE_ID,
				baseMemoRevisionId: null,
				observations: [base.semantic],
			}),
		});
		const partialReplay = reconstructObservationSession([
			...base.entries,
			observationEntry(partial),
		]);
		assert.equal(partialReplay.issues[0]?.code, "observation-session.order");

		const laterCandidate = candidate({
			id: "candidate-00000000-0000-4000-8000-000000000518",
			text: "later pending-request hypothesis",
			origin: { kind: "user-input", input_source: "interactive" },
		});
		const laterHypothesis = event({
			observer_observation: "observer-observation/v1",
			kind: "user-hypothesis-recorded",
			episode_id: EPISODE_ID,
			observation_id: "observation-00000000-0000-4000-8000-000000000519",
			candidate_id: laterCandidate.candidateId,
			inquiry_id: "inquiry-00000000-0000-4000-8000-000000000520",
			original: "Later pending-request hypothesis",
			context: "This arrives while the first request remains pending.",
		});
		if (laterHypothesis.kind !== "user-hypothesis-recorded") {
			assert.fail("Expected later user hypothesis");
		}
		const secondRequestId: MemoRequestId =
			"memo-request-00000000-0000-4000-8000-000000000598";
		const validSecond = event({
			observer_observation: "observer-observation/v1",
			kind: "memo-requested",
			episode_id: EPISODE_ID,
			request_id: secondRequestId,
			base_memo_revision_id: null,
			observation_ids: [laterHypothesis.observationId],
			request_digest: observationMemoRequestDigest({
				episodeId: EPISODE_ID,
				baseMemoRevisionId: null,
				observations: [laterHypothesis],
			}),
		});
		const conflicting = reconstructObservationSession([
			...base.entries,
			exactEntry,
			observationEntry(laterCandidate),
			observationEntry(laterHypothesis),
			observationEntry(validSecond),
		]);
		assert.equal(
			conflicting.issues.some(
				(issue) => issue.code === "observation-session.conflict",
			),
			true,
		);
	});

	test("refines complete instructions and rejects missing coverage, missing references, and hypothesis mismatch", async () => {
		const scenario = requestedScenario();
		const valid = await decodeInstructionWithContext(
			instructionRaw(scenario.context),
			scenario.context,
		);
		if (!valid.ok) assert.fail(valid.issue.message);
		const encoded = encodeObservationMemoInstruction(valid.value);
		const stored = decodeStoredObservationMemoInstruction(encoded);
		assert.equal(stored.ok, true);
		const oldHistory = structuredClone(encoded);
		assert.ok(typeof oldHistory === "object" && oldHistory !== null);
		Reflect.deleteProperty(oldHistory, "context_basis");
		const unsupported = decodeStoredObservationMemoInstruction(oldHistory);
		assert.equal(unsupported.ok, false);
		if (!unsupported.ok) {
			assert.equal(unsupported.issue.code, "memo-instruction.shape");
		}

		const missing = await decodeInstructionWithContext(
			instructionRaw(scenario.context, {
				dispositions: [
					{
						observation_id: SEMANTIC_ID,
						decision: "integrated",
						hypothesis_inquiry_ids: [],
						memo_ids: [],
						evidence_ids: [EVIDENCE_ID],
						rationale: "Only one Observation is covered.",
					},
				],
			}),
			scenario.context,
		);
		assert.equal(missing.ok, false);
		if (!missing.ok)
			assert.equal(missing.issue.code, "memo-instruction.coverage");

		const absentReference = await decodeInstructionWithContext(
			instructionRaw(scenario.context, {
				dispositions: [
					{
						observation_id: SEMANTIC_ID,
						decision: "integrated",
						hypothesis_inquiry_ids: [],
						memo_ids: [],
						evidence_ids: ["evidence-00000000-0000-4000-8000-000000000999"],
						rationale: "References absent evidence.",
					},
					{
						observation_id: USER_OBSERVATION_ID,
						decision: "integrated",
						hypothesis_inquiry_ids: [USER_INQUIRY_ID],
						memo_ids: [],
						evidence_ids: [],
						rationale: "Preserves the user hypothesis.",
					},
				],
			}),
			scenario.context,
		);
		assert.equal(absentReference.ok, false);
		if (!absentReference.ok) {
			assert.equal(absentReference.issue.code, "memo-instruction.reference");
		}

		const hypothesisMismatch = await decodeInstructionWithContext(
			instructionRaw(scenario.context, {
				dispositions: [
					{
						observation_id: SEMANTIC_ID,
						decision: "integrated",
						hypothesis_inquiry_ids: [],
						memo_ids: [],
						evidence_ids: [EVIDENCE_ID],
						rationale: "Retains evidence.",
					},
					{
						observation_id: USER_OBSERVATION_ID,
						decision: "kept",
						hypothesis_inquiry_ids: [],
						memo_ids: [],
						evidence_ids: [],
						rationale: "Fails to reference the user Inquiry.",
					},
				],
			}),
			scenario.context,
		);
		assert.equal(hypothesisMismatch.ok, false);
		if (!hypothesisMismatch.ok) {
			assert.equal(hypothesisMismatch.issue.code, "memo-instruction.coverage");
		}
	});

	test("replays instruction order, exact duplicates, conflicts, and fork ancestry", async () => {
		const scenario = requestedScenario();
		const first = await decodeInstructionWithContext(
			instructionRaw(scenario.context),
			scenario.context,
		);
		if (!first.ok) assert.fail(first.issue.message);
		const firstEntry = custom(
			OBSERVER_MEMO_INSTRUCTION_ENTRY,
			encodeObservationMemoInstruction(first.value),
		);
		const replay = reconstructMemoInstructionSession([
			...scenario.entries,
			firstEntry,
			firstEntry,
		]);
		assert.equal(replay.issues.length, 0);
		assert.equal(replay.instructions.length, 1);
		assert.equal(replay.pendingInstall?.requestId, REQUEST_ID);

		const reordered = reconstructMemoInstructionSession([
			firstEntry,
			...scenario.entries,
		]);
		assert.equal(reordered.issues[0]?.code, "memo-instruction-session.order");

		const changed = await decodeInstructionWithContext(
			instructionRaw(scenario.context, {
				dispositions: [
					{
						observation_id: SEMANTIC_ID,
						decision: "integrated",
						hypothesis_inquiry_ids: [],
						memo_ids: [],
						evidence_ids: [EVIDENCE_ID],
						rationale: "A conflicting rationale for the same request.",
					},
					{
						observation_id: USER_OBSERVATION_ID,
						decision: "integrated",
						hypothesis_inquiry_ids: [USER_INQUIRY_ID],
						memo_ids: [],
						evidence_ids: [],
						rationale: "The explicit user hypothesis is registered unchanged.",
					},
				],
			}),
			scenario.context,
		);
		if (!changed.ok) assert.fail(changed.issue.message);
		const conflict = reconstructMemoInstructionSession([
			...scenario.entries,
			firstEntry,
			custom(
				OBSERVER_MEMO_INSTRUCTION_ENTRY,
				encodeObservationMemoInstruction(changed.value),
			),
		]);
		assert.equal(
			conflict.issues.some(
				(issue) => issue.code === "memo-instruction-session.conflict",
			),
			true,
		);

		const forkWithoutInstruction = reconstructMemoInstructionSession(
			scenario.entries,
		);
		assert.equal(forkWithoutInstruction.instructions.length, 0);
		assert.equal(forkWithoutInstruction.pendingInstall, null);
	});
});
