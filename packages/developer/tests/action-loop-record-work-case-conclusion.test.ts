import assert from "node:assert/strict";
import test from "node:test";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";

function workCase() {
	const result = openWorkCase({
		outcome: {
			statement:
				"The bounded behavior is implemented and supported by evidence.",
			acceptanceConditions: ["The requested behavior is verified."],
			constraints: ["No unrelated behavior changes."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

function conclusion(
	workCaseId: string,
	conclusionId: string,
): JudgmentConclusion {
	return Object.freeze({
		conclusionId,
		workCaseId,
		judgmentId: `judgment-${conclusionId}`,
		category: "Claim Assurance",
		subject: "The current evidence supports the bounded claim.",
		contextRevisionId: "context-revision-1",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current evidence is bounded and accounted."]),
		answer: "The bounded claim is supported.",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
}

test("accepted Conclusion advances canonical Work Case revision", () => {
	const current = workCase();
	const result = recordWorkCaseConclusion(
		current,
		conclusion(current.workCaseId, "conclusion-b"),
	);

	assert.equal(result.status, "recorded");
	if (result.status !== "recorded") return;
	assert.notEqual(result.value.revisionId, current.revisionId);
	assert.deepEqual(
		result.value.conclusions.map(({ conclusionId }) => conclusionId),
		["conclusion-b"],
	);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.conclusions), true);
});

test("record order cannot change Work Case revision", () => {
	const current = workCase();
	const firstA = recordWorkCaseConclusion(
		current,
		conclusion(current.workCaseId, "conclusion-a"),
	);
	const firstB = recordWorkCaseConclusion(
		current,
		conclusion(current.workCaseId, "conclusion-b"),
	);
	if (firstA.status !== "recorded" || firstB.status !== "recorded") return;
	const thenB = recordWorkCaseConclusion(
		firstA.value,
		conclusion(current.workCaseId, "conclusion-b"),
	);
	const thenA = recordWorkCaseConclusion(
		firstB.value,
		conclusion(current.workCaseId, "conclusion-a"),
	);

	assert.equal(thenB.status, "recorded");
	assert.equal(thenA.status, "recorded");
	if (thenB.status === "recorded" && thenA.status === "recorded") {
		assert.equal(thenB.value.revisionId, thenA.value.revisionId);
	}
});

test("duplicate Conclusion is idempotent", () => {
	const current = workCase();
	const accepted = conclusion(current.workCaseId, "conclusion-a");
	const first = recordWorkCaseConclusion(current, accepted);
	if (first.status !== "recorded") return;
	const duplicate = recordWorkCaseConclusion(first.value, accepted);

	assert.equal(duplicate.status, "unchanged");
	if (duplicate.status === "unchanged") {
		assert.equal(duplicate.value, first.value);
	}
});

test("cross-Case and stale Conclusion recording fail closed", () => {
	const current = workCase();
	const crossCase = recordWorkCaseConclusion(
		current,
		conclusion("work-case-other", "conclusion-a"),
	);
	const stale = recordWorkCaseConclusion(
		{ ...current, revisionId: "work_case_revision_stale" },
		conclusion(current.workCaseId, "conclusion-a"),
	);

	assert.equal(crossCase.status, "invalid");
	assert.equal(stale.status, "invalid");
	if (crossCase.status === "invalid") {
		assert.equal(crossCase.error.code, "identity-mismatch");
	}
	if (stale.status === "invalid") {
		assert.equal(stale.error.code, "stale-work-case");
	}
});
