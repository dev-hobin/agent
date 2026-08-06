import assert from "node:assert/strict";
import test from "node:test";
import { pauseWorkCase } from "../src/action-loop/work/pause-work-case.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";

function workCase() {
	const result = openWorkCase({
		outcome: {
			statement: "The delegated bounded work is completed.",
			acceptanceConditions: ["The result satisfies the delegated request."],
			constraints: [],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

test("explicit human decision pauses exactly one current Work Case revision", () => {
	const current = workCase();
	const result = pauseWorkCase(current, {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		reason: "Pause until the delegating user resumes the work.",
		decision: {
			kind: "human",
			decisionId: "user-message-pause-1",
			source: "delegating-user",
			basis: ["The user explicitly requested a pause."],
		},
	});

	assert.equal(result.status, "paused");
	if (result.status !== "paused") return;
	assert.equal(result.value.status, "paused");
	assert.equal(result.value.priorRevisionId, current.revisionId);
	assert.notEqual(result.value.revisionId, current.revisionId);
	assert.equal(result.value.effects, current.effects);
	assert.match(result.value.pause.workCasePauseId, /^work_case_pause_[a-f0-9]{64}$/);
	assert.equal(current.status, "active");
});

test("model, stale, cross-Case, or basis-free pause attempts fail closed", () => {
	const current = workCase();
	const base = {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		reason: "Pause current work.",
		decision: {
			kind: "human",
			decisionId: "user-message-pause-1",
			source: "delegating-user",
			basis: ["The user explicitly requested a pause."],
		},
	};
	const fixtures = [
		{
			proposal: {
				...base,
				decision: { ...base.decision, kind: "model" },
			},
			code: "human-decision-required",
		},
		{
			proposal: { ...base, expectedRevisionId: "work_case_revision_stale" },
			code: "identity-mismatch",
		},
		{
			proposal: { ...base, workCaseId: "work_case_other" },
			code: "identity-mismatch",
		},
		{
			proposal: {
				...base,
				decision: { ...base.decision, basis: [] },
			},
			code: "invalid-pause-decision",
		},
	];

	for (const fixture of fixtures) {
		const result = pauseWorkCase(current, fixture.proposal);
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid") assert.equal(result.error.code, fixture.code);
	}
});
