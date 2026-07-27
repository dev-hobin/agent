import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import {
	decodeOneShotEvent,
	decodeOneShotFinishAction,
	decodeOneShotStartAction,
	encodeOneShotEvent,
	OBSERVER_ONE_SHOT_ENTRY,
	OBSERVER_ONE_SHOT_PROTOCOL,
	planOneShotCompletion,
	planOneShotRequest,
	reconstructOneShotSession,
	refineOneShotIntent,
	type OneShotCompletedEvent,
	type OneShotIntent,
	type OneShotRequestedEvent,
} from "../src/one-shot-trigger.ts";
import type { PiBranchEntryLike } from "../src/pi-session.ts";

const REQUEST_ID = "one-shot-00000000-0000-4000-8000-000000000801";
const OTHER_REQUEST_ID = "one-shot-00000000-0000-4000-8000-000000000802";
const EPISODE_ID = "episode-one-shot-pure";
const CANDIDATE_A = "candidate-00000000-0000-4000-8000-000000000803";
const CANDIDATE_B = "candidate-00000000-0000-4000-8000-000000000804";
const READ_A = "source-read-00000000-0000-4000-8000-000000000805";
const READ_B = "source-read-00000000-0000-4000-8000-000000000806";
const OBSERVATION_A = "observation-00000000-0000-4000-8000-000000000807";
const OBSERVATION_B = "observation-00000000-0000-4000-8000-000000000808";
const INLINE_TEXT =
	"Inline material: immediate notes preserve retrieval cues. Observer 관점으로 봐줘.";
const RETRIEVED_TEXT = "이 PDF를 Observer 관점으로 봐줘: /tmp/material.pdf";

function startValue(
	text: string,
	kind: "inline-user-message" | "retrieved-tool-results",
): Readonly<Record<string, unknown>> {
	return {
		observer_action: "observer-sidecar/v1",
		action: "one-shot-start",
		user_message_digest: sha256Text(text),
		material: { kind },
	};
}

function refine(
	text: string,
	kind: "inline-user-message" | "retrieved-tool-results",
	requestId = REQUEST_ID,
): OneShotIntent {
	const refined = refineOneShotIntent({
		value: startValue(text, kind),
		latestUser: { text, inputSource: "interactive" },
		requestId,
	});
	if (!refined.ok) assert.fail(refined.issue.message);
	return refined.value;
}

function custom(data: unknown): PiBranchEntryLike {
	return { type: "custom", customType: OBSERVER_ONE_SHOT_ENTRY, data };
}

function requested(intent: OneShotIntent): OneShotRequestedEvent {
	const planned = planOneShotRequest({
		intent,
		episodeId: EPISODE_ID,
		session: reconstructOneShotSession([]),
	});
	if (!planned.ok) assert.fail(planned.issue.message);
	return planned.value.request;
}

function complete(request: OneShotRequestedEvent): OneShotCompletedEvent {
	const entries = [custom(encodeOneShotEvent(request))];
	const planned = planOneShotCompletion({
		requestId: request.requestId,
		episodeId: request.episodeId,
		session: reconstructOneShotSession(entries),
		candidates: [{ candidateId: CANDIDATE_A }],
		sourceReads: [{ readId: READ_A, candidateIds: [CANDIDATE_A] }],
		observations: [{ observationId: OBSERVATION_A, readId: READ_A }],
	});
	if (!planned.ok) assert.fail(planned.issue.message);
	return planned.value;
}

describe("pure One-shot trigger and session", () => {
	test("strictly refines inline and retrieved intents without collapsing provenance", () => {
		const inline = refine(INLINE_TEXT, "inline-user-message");
		assert.equal(inline.material, "inline-user-message");
		assert.equal(inline.exactUserText, INLINE_TEXT);
		assert.equal(inline.userMessageDigest, sha256Text(INLINE_TEXT));
		assert.equal(inline.inputSource, "interactive");

		const retrieved = refine(RETRIEVED_TEXT, "retrieved-tool-results");
		assert.equal(retrieved.material, "retrieved-tool-results");
		assert.equal(retrieved.exactUserText, RETRIEVED_TEXT);
		assert.notEqual(retrieved.exactUserText, INLINE_TEXT);

		assert.equal(
			decodeOneShotStartAction({
				...startValue(INLINE_TEXT, "inline-user-message"),
				extra: true,
			}).ok,
			false,
		);
		assert.equal(
			decodeOneShotStartAction({
				observer_action: "observer-sidecar/v1",
				action: "one-shot-start",
				user_message_digest: sha256Text(INLINE_TEXT),
				material: { kind: "inline-user-message", extra: true },
			}).ok,
			false,
		);
		assert.equal(
			refineOneShotIntent({
				value: startValue(INLINE_TEXT, "inline-user-message"),
				latestUser: { text: "Different latest message", inputSource: "rpc" },
				requestId: REQUEST_ID,
			}).ok,
			false,
		);
		assert.equal(
			refineOneShotIntent({
				value: startValue(INLINE_TEXT, "inline-user-message"),
				latestUser: null,
				requestId: REQUEST_ID,
			}).ok,
			false,
		);
		assert.deepEqual(
			decodeOneShotFinishAction({
				observer_action: "observer-sidecar/v1",
				action: "one-shot-finish",
				request_id: REQUEST_ID,
			}),
			{
				ok: true,
				value: {
					observerAction: "observer-sidecar/v1",
					action: "one-shot-finish",
					requestId: REQUEST_ID,
				},
			},
		);
		assert.equal(
			decodeOneShotFinishAction({
				observer_action: "observer-sidecar/v1",
				action: "one-shot-finish",
				request_id: REQUEST_ID,
				extra: true,
			}).ok,
			false,
		);
	});

	test("plans, replays, resumes, and serializes one exact request", () => {
		const intent = refine(INLINE_TEXT, "inline-user-message");
		const request = requested(intent);
		assert.equal(request.material, "inline-user-message");
		assert.equal(request.userMessageDigest, sha256Text(INLINE_TEXT));
		const encoded = encodeOneShotEvent(request);
		assert.deepEqual(decodeOneShotEvent(encoded), {
			ok: true,
			value: request,
		});
		assert.equal(
			decodeOneShotEvent({
				...encoded,
				material: "retrieved-tool-results",
				extra: true,
			}).ok,
			false,
		);

		const entries = [custom(encoded)];
		const session = reconstructOneShotSession(entries);
		assert.equal(session.issues.length, 0);
		assert.equal(session.pendingRequest?.requestId, REQUEST_ID);
		const resumed = planOneShotRequest({
			intent: refine(INLINE_TEXT, "inline-user-message", OTHER_REQUEST_ID),
			episodeId: EPISODE_ID,
			session,
		});
		if (!resumed.ok) assert.fail(resumed.issue.message);
		assert.equal(resumed.value.kind, "resume");
		assert.equal(resumed.value.request.requestId, REQUEST_ID);

		const overlap = planOneShotRequest({
			intent: refine(
				RETRIEVED_TEXT,
				"retrieved-tool-results",
				OTHER_REQUEST_ID,
			),
			episodeId: EPISODE_ID,
			session,
		});
		assert.equal(overlap.ok, false);
		const duplicate = reconstructOneShotSession([...entries, custom(encoded)]);
		assert.equal(duplicate.issues.length, 0);
		assert.equal(duplicate.requests.length, 1);
	});

	test("requires complete candidate-read-observation coverage before completion", () => {
		const request = requested(refine(RETRIEVED_TEXT, "retrieved-tool-results"));
		const session = reconstructOneShotSession([
			custom(encodeOneShotEvent(request)),
		]);
		const base = {
			requestId: request.requestId,
			episodeId: request.episodeId,
			session,
			candidates: [{ candidateId: CANDIDATE_A }, { candidateId: CANDIDATE_B }],
			sourceReads: [
				{ readId: READ_A, candidateIds: [CANDIDATE_A] },
				{ readId: READ_B, candidateIds: [CANDIDATE_B] },
			],
			observations: [
				{ observationId: OBSERVATION_A, readId: READ_A },
				{ observationId: OBSERVATION_B, readId: READ_B },
			],
		};
		assert.equal(planOneShotCompletion({ ...base, candidates: [] }).ok, false);
		assert.equal(
			planOneShotCompletion({
				...base,
				sourceReads: [{ readId: READ_A, candidateIds: [CANDIDATE_A] }],
			}).ok,
			false,
		);
		assert.equal(
			planOneShotCompletion({
				...base,
				observations: [{ observationId: OBSERVATION_A, readId: READ_A }],
			}).ok,
			false,
		);
		const planned = planOneShotCompletion(base);
		if (!planned.ok) assert.fail(planned.issue.message);
		assert.deepEqual(planned.value.observationIds, [
			OBSERVATION_A,
			OBSERVATION_B,
		]);
		assert.deepEqual(decodeOneShotEvent(encodeOneShotEvent(planned.value)), {
			ok: true,
			value: planned.value,
		});
		const completedSession = reconstructOneShotSession([
			custom(encodeOneShotEvent(request)),
			custom(encodeOneShotEvent(planned.value)),
		]);
		const resumed = planOneShotCompletion({ ...base, session: completedSession });
		if (!resumed.ok) assert.fail(resumed.issue.message);
		assert.deepEqual(resumed.value, planned.value);
		assert.equal(
			planOneShotCompletion({
				...base,
				session: completedSession,
				observations: [
					{ observationId: OBSERVATION_A, readId: READ_A },
					{ observationId: OBSERVATION_A, readId: READ_B },
				],
			}).ok,
			false,
		);
	});

	test("fails closed for reordered, conflicting, and malformed history", () => {
		const request = requested(refine(INLINE_TEXT, "inline-user-message"));
		const completion = complete(request);
		const encodedRequest = encodeOneShotEvent(request);
		const encodedCompletion = encodeOneShotEvent(completion);
		const completed = reconstructOneShotSession([
			custom(encodedRequest),
			custom(encodedCompletion),
			custom(encodedCompletion),
		]);
		assert.equal(completed.issues.length, 0);
		assert.equal(completed.pendingRequest, null);
		assert.deepEqual(completed.completedRequestIds, [REQUEST_ID]);

		const reordered = reconstructOneShotSession([
			custom(encodedCompletion),
			custom(encodedRequest),
		]);
		assert.equal(reordered.issues[0]?.code, "one-shot.history");
		const conflict = reconstructOneShotSession([
			custom(encodedRequest),
			custom({ ...encodedRequest, material: "retrieved-tool-results" }),
		]);
		assert.equal(conflict.issues[0]?.code, "one-shot.conflict");
		const overlap = reconstructOneShotSession([
			custom(encodedRequest),
			custom({
				protocol: OBSERVER_ONE_SHOT_PROTOCOL,
				kind: "one-shot-requested",
				request_id: OTHER_REQUEST_ID,
				episode_id: EPISODE_ID,
				user_message_digest: sha256Text(RETRIEVED_TEXT),
				material: "retrieved-tool-results",
			}),
		]);
		assert.equal(overlap.issues[0]?.code, "one-shot.pending");
		const malformed = reconstructOneShotSession([
			custom({ protocol: OBSERVER_ONE_SHOT_PROTOCOL, kind: "unknown" }),
		]);
		assert.equal(malformed.issues[0]?.code, "one-shot.shape");
	});
});
