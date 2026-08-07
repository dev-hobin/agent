import assert from "node:assert/strict";
import test from "node:test";
import {
	MAX_LIVE_OUTCOME_TEXT,
	liveWorkCasePrompt,
	openLiveWorkCase,
	type LiveWorkCaseProposal,
} from "../extensions/action-loop-work-case.ts";

function proposal(
	statement = "The bounded Outcome is achieved.",
): LiveWorkCaseProposal {
	return {
		outcome: {
			statement,
			acceptanceConditions: ["The accepted condition is observable."],
			constraints: ["No unrelated effect occurs."],
		},
		basis: ["The current user request delegates this Outcome."],
		provenance: { kind: "model", source: "test-evaluator" },
	};
}

test("one bounded proposal opens process-local canonical work", () => {
	const opened = openLiveWorkCase(undefined, proposal());

	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	assert.match(opened.value.workCase.workCaseId, /^work_case_[a-f0-9]{64}$/);
	assert.match(
		liveWorkCasePrompt(opened.value),
		/Active Action Loop Work Case:/,
	);
	assert.match(
		liveWorkCasePrompt(opened.value),
		/grants no Action Clearance|does not imply Action Clearance/,
	);
	assert.ok(Object.isFrozen(opened.value));
});

test("an exact Outcome stutters while a different Outcome cannot replace active work", () => {
	const opened = openLiveWorkCase(undefined, proposal());
	if (opened.status !== "opened") return;
	const repeated = openLiveWorkCase(opened.value, {
		...proposal(),
		provenance: { kind: "human", source: "reviewer" },
	});
	const replacement = openLiveWorkCase(
		opened.value,
		proposal("A different Outcome replaces active work."),
	);

	assert.equal(repeated.status, "unchanged");
	assert.equal(replacement.status, "active-work-case-exists");
	if (repeated.status === "unchanged") {
		assert.equal(repeated.value, opened.value);
	}
});

test("oversized, duplicate, acceptance-free, or basis-free input fails before opening", () => {
	for (const attempted of [
		{
			...proposal(),
			outcome: {
				...proposal().outcome,
				statement: "x".repeat(MAX_LIVE_OUTCOME_TEXT + 1),
			},
		},
		{
			...proposal(),
			outcome: { ...proposal().outcome, acceptanceConditions: [] },
		},
		{
			...proposal(),
			outcome: {
				...proposal().outcome,
				constraints: ["same", " same "],
			},
		},
		{ ...proposal(), basis: [] },
	]) {
		assert.equal(openLiveWorkCase(undefined, attempted).status, "invalid");
	}
});
