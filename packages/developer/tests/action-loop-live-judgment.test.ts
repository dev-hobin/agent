import assert from "node:assert/strict";
import test from "node:test";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

function workCase() {
	const opened = openLiveWorkCase(undefined, {
		outcome: {
			statement: "The live Work Case owns one current Judgment.",
			acceptanceConditions: ["The Judgment remains revision-bound."],
			constraints: ["Skill names do not choose its Category."],
		},
		basis: ["The user delegated this bounded Outcome."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (opened.status !== "opened") {
		throw new Error("message" in opened ? opened.message : opened.status);
	}
	return opened.value;
}

function proposal() {
	return {
		category: "Contextual Adequacy" as const,
		subject: "The live Outcome interpretation.",
		question: "Does this interpretation fit the current context?",
		requirements: [
			{
				statement: "Consequential assumptions are explicit.",
				contributionNeeds: ["accepted behavior observation"],
			},
		],
		basis: ["The next route depends on one unresolved assumption."],
		provenance: { kind: "model" as const, source: "test-evaluator" },
	};
}

test("live Judgment records against the exact current Context revision", () => {
	const current = workCase();
	const result = openLiveJudgment(current, proposal());

	assert.equal(result.status, "opened");
	if (result.status !== "opened") return;
	assert.notEqual(
		result.state.workCase.revisionId,
		current.workCase.revisionId,
	);
	assert.equal(result.judgment.contextRevisionId, current.workCase.revisionId);
	assert.deepEqual(result.state.workCase.openJudgments, [result.judgment]);
});

test("exact duplicate stutters without advancing Work Case revision", () => {
	const current = workCase();
	const first = openLiveJudgment(current, proposal());
	if (first.status !== "opened") return;
	const repeated = openLiveJudgment(first.state, proposal());

	assert.equal(repeated.status, "unchanged");
	if (repeated.status === "unchanged") {
		assert.equal(repeated.state, first.state);
	}
});

test("missing Needs and malformed basis cannot mutate live Work Case", () => {
	const current = workCase();
	for (const attempted of [
		{
			...proposal(),
			requirements: [{ statement: "A requirement.", contributionNeeds: [] }],
		},
		{ ...proposal(), basis: [] },
	]) {
		const result = openLiveJudgment(current, attempted);
		assert.equal(result.status, "invalid");
		assert.deepEqual(current.workCase.openJudgments, []);
	}
});
