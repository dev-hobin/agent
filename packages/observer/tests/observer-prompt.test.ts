import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import { OBSERVER_PROTOCOL } from "../src/lifecycle.ts";
import {
	encodeObservationEvent,
	observationMemoRequestDigest,
	OBSERVER_OBSERVATION_ENTRY,
	prepareObservationEvent,
	type ObservationEvent,
} from "../src/observation-profile.ts";
import { observationCandidateDigest } from "../src/observation-session.ts";
import { observerTurnContext } from "../extensions/material-review-runtime.ts";
import { observerSidecarContext } from "../src/observer-prompt.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";
import {
	encodeMaterialReviewEvent,
	OBSERVER_MATERIAL_REVIEW_ENTRY,
	type MaterialReviewRequestedEvent,
} from "../src/material-review-trigger.ts";
import {
	encodeSaveRequestEvent,
	OBSERVER_SAVE_REQUEST_ENTRY,
	type SaveRequestEvent,
} from "../src/save-trigger.ts";

const CANDIDATE_ID = "candidate-00000000-0000-4000-8000-000000000001";
const READ_ID = "source-read-00000000-0000-4000-8000-000000000001";
const SOURCE_ID = "source-00000000-0000-4000-8000-000000000001";
const EMPTY_INDEX_DIGEST =
	"1ad0ce7b19aa65f512ef4407092c282b55456fc59d8bb96ba5fabd778e7bf87b";

function activation(enabled: boolean): PiBranchEntryLike {
	return {
		type: "custom",
		customType: OBSERVER_LIFECYCLE_ENTRY,
		data: {
			protocol: OBSERVER_PROTOCOL,
			kind: "activation-changed",
			enabled,
		},
	};
}

function lifecycle(enabled: boolean): PiBranchEntryLike[] {
	return [
		{
			type: "custom",
			customType: OBSERVER_LIFECYCLE_ENTRY,
			data: {
				protocol: OBSERVER_PROTOCOL,
				kind: "notebook-selected",
				notebookId: "notebook-00000000-0000-4000-8000-000000000001",
			},
		},
		{
			type: "custom",
			customType: OBSERVER_LIFECYCLE_ENTRY,
			data: {
				protocol: OBSERVER_PROTOCOL,
				kind: "episode-opened",
				episodeId: "episode-prompt-1",
				notebookId: "notebook-00000000-0000-4000-8000-000000000001",
				lang: "en",
			},
		},
		activation(enabled),
	];
}

function event(value: unknown): ObservationEvent {
	const prepared = prepareObservationEvent(value);
	if (!prepared.ok) assert.fail(prepared.issue.message);
	return prepared.value;
}

function entry(value: ObservationEvent): PiBranchEntryLike {
	return {
		type: "custom",
		customType: OBSERVER_OBSERVATION_ENTRY,
		data: encodeObservationEvent(value),
	};
}

describe("Observer hidden Sidecar context", () => {
	test("keeps routine Sidecar work out of the foreground agent context", () => {
		assert.equal(
			observerTurnContext({
				turnState: {
					toolUsed: false,
					latestUser: null,
					scriptedMaterialRequest: null,
					blockedRequestId: null,
					agentRunSequence: 1,
					activeAgentRunId: 1,
					materialReviewRun: null,
					nominatableToolResults: new Map(),
					stagedMaterialReviewRetry: null,
				},
				entries: lifecycle(true),
			}),
			null,
		);
	});

	test("is absent when OFF and exposes only pending staged identifiers when ON", () => {
		const candidate = event({
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: "episode-prompt-1",
			candidate_id: CANDIDATE_ID,
			origin: {
				kind: "tool-result",
				tool_call_id: "tool-call-prompt",
				tool_name: "read",
				nomination_reason: "It establishes a source claim for the inquiry.",
			},
			text: "A source result that still needs source-first interpretation.",
			content_hash: sha256Text(
				"A source result that still needs source-first interpretation.",
			),
			captured_at: "2026-08-01T12:00:00.000Z",
		});
		assert.equal(
			observerSidecarContext([...lifecycle(false), entry(candidate)]),
			null,
		);
		const context = observerSidecarContext(
			[...lifecycle(true), entry(candidate)],
			[
				{
					toolCallId: "tool-call-eligible",
					toolName: "fetch_content",
					isError: false,
				},
			],
		);
		assert.match(context ?? "", /source meaning faithfully/u);
		assert.match(context ?? "", /A tool execution is not an Observation/u);
		assert.match(context ?? "", /nominate-tool-results/u);
		assert.match(context ?? "", /tool-call-eligible/u);
		assert.match(context ?? "", /not captured Observer candidates/u);
		assert.match(context ?? "", /establishes a source claim/u);
		assert.match(context ?? "", new RegExp(CANDIDATE_ID, "u"));
		assert.doesNotMatch(context ?? "", /Standing Inquiry title/u);
	});

	test("resumes a pending hypothesis review from exact user context while Mode is OFF", () => {
		const candidate = event({
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: "episode-prompt-1",
			candidate_id: CANDIDATE_ID,
			origin: {
				kind: "explicit-user-hypothesis",
				input_source: "interactive",
			},
			text: "Context review should be part of hypothesis tracking.",
			content_hash: sha256Text(
				"Context review should be part of hypothesis tracking.",
			),
			captured_at: "2026-08-01T12:00:00.000Z",
		});
		const hypothesis = event({
			observer_observation: "observer-observation/v1",
			kind: "user-hypothesis-recorded",
			episode_id: "episode-prompt-1",
			observation_id: "observation-00000000-0000-4000-8000-000000000020",
			candidate_id: CANDIDATE_ID,
			inquiry_id: "inquiry-00000000-0000-4000-8000-000000000020",
			original: "Context review should be part of hypothesis tracking.",
			context: "The user supplied an explicit rationale.",
		});
		const context = observerSidecarContext([
			...lifecycle(false),
			entry(candidate),
			entry(hypothesis),
		]);
		assert.match(context ?? "", /<observer-hypothesis-context-review>/u);
		assert.match(
			context ?? "",
			/hypothesis_observation_id=observation-00000000-0000-4000-8000-000000000020/u,
		);
		assert.match(context ?? "", /The user supplied an explicit rationale/u);
		assert.match(context ?? "", /action hypothesis-context-review/u);
		assert.match(context ?? "", /Insufficient context is a valid assessment/u);
	});

	test("projects a pending Memo request even when Mode is OFF", () => {
		const candidate = event({
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: "episode-prompt-1",
			candidate_id: CANDIDATE_ID,
			origin: { kind: "user-input", input_source: "interactive" },
			text: "A user hypothesis",
			content_hash: sha256Text("A user hypothesis"),
			captured_at: "2026-08-01T12:00:00.000Z",
		});
		const hypothesis = event({
			observer_observation: "observer-observation/v1",
			kind: "user-hypothesis-recorded",
			episode_id: "episode-prompt-1",
			observation_id: "observation-00000000-0000-4000-8000-000000000021",
			candidate_id: CANDIDATE_ID,
			inquiry_id: "inquiry-00000000-0000-4000-8000-000000000022",
			original: "A user hypothesis",
			context: "Explicit user proposal",
		});
		if (hypothesis.kind !== "user-hypothesis-recorded") {
			assert.fail("Expected user hypothesis");
		}
		const request = event({
			observer_observation: "observer-observation/v1",
			kind: "memo-requested",
			episode_id: "episode-prompt-1",
			request_id: "memo-request-00000000-0000-4000-8000-000000000023",
			base_memo_revision_id: null,
			observation_ids: [hypothesis.observationId],
			request_digest: observationMemoRequestDigest({
				episodeId: "episode-prompt-1",
				baseMemoRevisionId: null,
				observations: [hypothesis],
			}),
		});
		const pendingEntries = [
			...lifecycle(true),
			entry(candidate),
			entry(hypothesis),
			entry(request),
			activation(false),
		];
		const context = observerSidecarContext(pendingEntries);
		assert.match(context ?? "", /<observer-memo-request>/u);
		assert.match(
			context ?? "",
			/memo-request-00000000-0000-4000-8000-000000000023/u,
		);
		assert.match(context ?? "", /action load-memo-context/u);
		assert.match(context ?? "", /submission_seed/u);
		assert.match(context ?? "", /never resend or nest locked fields/u);
		assert.match(context ?? "", /required_coverage/u);
		assert.match(context ?? "", /revise-incubating/u);
		assert.match(context ?? "", /revise-promotion-candidate/u);
		assert.match(context ?? "", /Never combine any revise kind/u);
		assert.doesNotMatch(context ?? "", /final Memo reconciliation/u);
		assert.doesNotMatch(context ?? "", /<observer-sidecar>/u);
		const piggyback = observerSidecarContext(pendingEntries, [], {
			piggyback: true,
			memoScope: '{"ok":true,"memo_reconciliation":{"required_coverage":[]}}',
			standingIndex:
				'{"digest":"standing-digest","inquiries":[{"inquiryId":"inquiry-visible"}]}',
		});
		assert.match(piggyback ?? "", /loaded Memo context locally/u);
		assert.match(piggyback ?? "", /Set observer-commit\.memo/u);
		assert.match(piggyback ?? "", /at most one observer_sidecar call/u);
		assert.match(piggyback ?? "", /without a follow-up model request/u);
		assert.match(piggyback ?? "", /current_standing_index=/u);
		assert.match(piggyback ?? "", /inquiry-visible/u);
		assert.doesNotMatch(
			piggyback ?? "",
			/Call observer_sidecar action load-memo-context/u,
		);
		if (request.kind !== "memo-requested") assert.fail("Expected Memo request");
		assert.equal(
			observerTurnContext({
				turnState: {
					toolUsed: true,
					latestUser: null,
					scriptedMaterialRequest: null,
					blockedRequestId: request.requestId,
					agentRunSequence: 0,
					activeAgentRunId: null,
					materialReviewRun: null,
					nominatableToolResults: new Map(),
					stagedMaterialReviewRetry: null,
				},
				entries: pendingEntries,
			}),
			null,
		);

		const continuation = event({
			observer_observation: "observer-observation/v1",
			kind: "review-save-continuation-requested",
			episode_id: "episode-prompt-1",
			memo_request_id: request.requestId,
			base_save_request_count: 0,
		});
		const finalContext = observerSidecarContext([
			...lifecycle(true),
			entry(candidate),
			entry(hypothesis),
			entry(request),
			entry(continuation),
			activation(false),
		]);
		assert.match(finalContext ?? "", /final Memo reconciliation/u);
		assert.match(finalContext ?? "", /continues to the proposal/u);
	});

	test("projects a pending save request while OFF without exposing locked values", () => {
		const request: SaveRequestEvent = {
			protocol: "observer.save-request/v1",
			kind: "save-requested",
			requestId: "save-request-00000000-0000-4000-8000-000000000024",
			proposalId: "proposal-00000000-0000-4000-8000-000000000025",
			requestDigest:
				"0000000000000000000000000000000000000000000000000000000000000026",
			episodeId: "episode-prompt-1",
			notebookId: "notebook-00000000-0000-4000-8000-000000000001",
			root: "/tmp/observer-prompt",
			episodeLanguage: "en",
			memoRevisionId: null,
			sourceReadIds: [],
		};
		const context = observerSidecarContext([
			...lifecycle(false),
			{
				type: "custom",
				customType: OBSERVER_SAVE_REQUEST_ENTRY,
				data: encodeSaveRequestEvent(request),
			},
		]);
		assert.match(context ?? "", /<observer-save-request>/u);
		assert.equal(context?.includes(request.requestId), true);
		assert.match(context ?? "", /action load-save-context/u);
		assert.match(context ?? "", /exactly once unless it returns an error/u);
		assert.match(
			context ?? "",
			/After loading context successfully, do not call load-save-context again/u,
		);
		assert.match(
			context ?? "",
			/submit only request_id, summary, and records/u,
		);
		assert.equal(context?.includes(request.proposalId), false);
		assert.equal(context?.includes(request.root), false);
		const piggyback = observerSidecarContext(
			[
				...lifecycle(false),
				{
					type: "custom",
					customType: OBSERVER_SAVE_REQUEST_ENTRY,
					data: encodeSaveRequestEvent(request),
				},
			],
			[],
			{
				piggyback: true,
				saveScope: '{"ok":true,"save_context":{"required_records":[]}}',
			},
		);
		assert.match(piggyback ?? "", /loaded save context locally/u);
		assert.match(piggyback ?? "", /Set observer-commit\.save/u);
		assert.doesNotMatch(
			piggyback ?? "",
			/Call observer_sidecar action load-save-context/u,
		);
	});

	test("keeps suspended material candidates out of unrelated tool guidance", () => {
		const request: MaterialReviewRequestedEvent = {
			protocol: "observer.material-review/v1",
			kind: "material-review-requested",
			requestId: "material-review-00000000-0000-4000-8000-000000000030",
			episodeId: "episode-prompt-1",
			userMessageDigest: "3".repeat(64),
			material: "retrieved-tool-results",
		};
		const candidate = event({
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: "episode-prompt-1",
			candidate_id: CANDIDATE_ID,
			origin: {
				kind: "tool-result",
				tool_call_id: "tool-call-material-prompt",
				tool_name: "fetch_content",
			},
			text: "Request-linked PDF material.",
			content_hash: sha256Text("Request-linked PDF material."),
			captured_at: "2026-08-01T12:00:00.000Z",
			one_shot_request_id: request.requestId,
		});
		const entries = [
			...lifecycle(true),
			{
				type: "custom" as const,
				customType: OBSERVER_MATERIAL_REVIEW_ENTRY,
				data: encodeMaterialReviewEvent(request),
			},
			entry(candidate),
		];
		const continuous = observerSidecarContext(entries);
		assert.match(continuous ?? "", /Pending candidates \(0\)/u);
		assert.doesNotMatch(continuous ?? "", new RegExp(CANDIDATE_ID, "u"));
		const suspended = observerTurnContext({
			turnState: {
				toolUsed: false,
				latestUser: null,
				scriptedMaterialRequest: null,
				blockedRequestId: null,
				agentRunSequence: 1,
				activeAgentRunId: null,
				materialReviewRun: null,
				nominatableToolResults: new Map(),
				stagedMaterialReviewRetry: null,
			},
			entries,
		});
		assert.match(suspended ?? "", /suspended outside its explicit run/u);
		assert.doesNotMatch(suspended ?? "", new RegExp(CANDIDATE_ID, "u"));
		const active = observerTurnContext({
			turnState: {
				toolUsed: false,
				latestUser: null,
				scriptedMaterialRequest: null,
				blockedRequestId: null,
				agentRunSequence: 2,
				activeAgentRunId: 2,
				materialReviewRun: {
					agentRunId: 2,
					requestId: request.requestId,
					material: request.material,
				},
				nominatableToolResults: new Map(),
				stagedMaterialReviewRetry: null,
			},
			entries,
		});
		assert.match(active ?? "", new RegExp(CANDIDATE_ID, "u"));
		assert.match(active ?? "", /uncovered request-linked candidate ID/u);
		assert.doesNotMatch(active ?? "", /<observer-sidecar>/u);
	});

	test("moves a consumed candidate to the pending read stage", () => {
		const candidate = event({
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: "episode-prompt-1",
			candidate_id: CANDIDATE_ID,
			origin: {
				kind: "tool-result",
				tool_call_id: "tool-call-prompt",
				tool_name: "read",
			},
			text: "Source result",
			content_hash: sha256Text("Source result"),
			captured_at: "2026-08-01T12:00:00.000Z",
		});
		if (candidate.kind !== "candidate-captured")
			assert.fail("Expected candidate");
		const read = event({
			observer_observation: "observer-observation/v1",
			kind: "source-read-recorded",
			episode_id: "episode-prompt-1",
			read_id: READ_ID,
			candidate_ids: [CANDIDATE_ID],
			source: {
				kind: "external-material",
				source_id: SOURCE_ID,
				title: "Source",
				lang: "en",
				uri: "https://example.com/source",
				revision: null,
				content_hash: null,
				retrieval_context: "read result",
			},
			faithful_summary: "The source reports one bounded fact.",
			claims: [{ text: "One bounded fact.", locator: null }],
			candidate_digest: observationCandidateDigest([candidate]),
			index_digest: EMPTY_INDEX_DIGEST,
			index_inquiry_ids: [],
		});
		const context = observerSidecarContext([
			...lifecycle(true),
			entry(candidate),
			entry(read),
		]);
		assert.match(context ?? "", /Pending candidates \(0\)/u);
		assert.match(context ?? "", new RegExp(READ_ID, "u"));
	});
});
