import assert from "node:assert/strict";
import test from "node:test";
import {
	MAX_EVALUATOR_ATTEMPT_DETAIL_LENGTH,
	normalizeEvaluatorAttempt,
	type ProposalRefinementResult,
} from "../src/action-loop/protocol/normalize-evaluator-attempt.ts";

interface ExampleProposal {
	readonly answer: string;
}

function refine(payload: unknown): ProposalRefinementResult<ExampleProposal> {
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("answer" in payload) ||
		typeof payload.answer !== "string" ||
		payload.answer.trim().length === 0
	) {
		return {
			ok: false,
			error: { code: "invalid-answer", message: "Expected a nonblank answer" },
		};
	}
	return { ok: true, value: Object.freeze({ answer: payload.answer.trim() }) };
}

const provenance = {
	adapter: "pi-structured-output",
	provider: "provider-a",
	model: "model-a",
} as const;

test("only a successfully refined returned payload becomes a proposal", () => {
	const result = normalizeEvaluatorAttempt(
		{ outcome: "returned", payload: { answer: " bounded " }, provenance },
		refine,
	);

	assert.equal(result.status, "proposal");
	if (result.status === "proposal") {
		assert.deepEqual(result.value, { answer: "bounded" });
		assert.deepEqual(result.provenance, provenance);
	}
});

test("refusal, timeout, failure, and empty output remain unresolved", () => {
	const fixtures = [
		{ attempt: { outcome: "refused", provenance } as const, reason: "refused" },
		{ attempt: { outcome: "timed-out", provenance } as const, reason: "timed-out" },
		{ attempt: { outcome: "failed", detail: "transport error", provenance } as const, reason: "failed" },
		{ attempt: { outcome: "returned", payload: "  ", provenance } as const, reason: "empty" },
		{ attempt: { outcome: "returned", payload: null, provenance } as const, reason: "empty" },
	];

	for (const fixture of fixtures) {
		const result = normalizeEvaluatorAttempt(fixture.attempt, refine);
		assert.equal(result.status, "unresolved", fixture.reason);
		if (result.status === "unresolved") {
			assert.equal(result.reason, fixture.reason);
			assert.equal("value" in result, false);
		}
	}
});

test("malformed output and refiner exceptions cannot imply success", () => {
	const malformed = normalizeEvaluatorAttempt(
		{ outcome: "returned", payload: { answer: "" }, provenance },
		refine,
	);
	const thrown = normalizeEvaluatorAttempt(
		{ outcome: "returned", payload: { answer: "value" }, provenance },
		() => {
			throw new Error("decoder crashed");
		},
	);

	assert.equal(malformed.status, "unresolved");
	assert.equal(thrown.status, "unresolved");
	if (malformed.status === "unresolved") {
		assert.equal(malformed.reason, "malformed");
	}
	if (thrown.status === "unresolved") {
		assert.equal(thrown.reason, "malformed");
	}
});

test("attempt provenance and diagnostic detail are bounded", () => {
	const invalidProvenance = normalizeEvaluatorAttempt(
		{
			outcome: "returned",
			payload: { answer: "value" },
			provenance: { adapter: " " },
		},
		refine,
	);
	const oversized = normalizeEvaluatorAttempt(
		{
			outcome: "failed",
			detail: "x".repeat(MAX_EVALUATOR_ATTEMPT_DETAIL_LENGTH + 1),
			provenance,
		},
		refine,
	);

	assert.equal(invalidProvenance.status, "invalid");
	assert.equal(oversized.status, "invalid");
	if (invalidProvenance.status === "invalid") {
		assert.equal(invalidProvenance.error.code, "invalid-attempt-provenance");
	}
	if (oversized.status === "invalid") {
		assert.equal(oversized.error.code, "invalid-attempt-detail");
	}
});
