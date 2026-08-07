import assert from "node:assert/strict";
import test from "node:test";
import {
	openJudgment,
	type JudgmentOpeningProposal,
} from "../src/action-loop/judgment/open-judgment.ts";

function proposal(): JudgmentOpeningProposal {
	return {
		workCaseId: "work-case-1",
		category: "Claim Assurance",
		subject: "The package completion Claim.",
		question: "What does the current evidence support?",
		contextRevisionId: "context-revision-1",
		requirements: [
			{
				statement: "Every completion obligation has claim-relevant evidence.",
				contributionNeeds: [
					"claim-relevant verifier",
					"pass-but-wrong counterexample search",
				],
			},
		],
		basis: ["The active Work Case is approaching a completion Claim."],
		provenance: { kind: "model", source: "test-evaluator" },
	};
}

test("Category, Subject, and Context open one content-bound Judgment", () => {
	const opened = openJudgment(proposal());
	const anotherEvaluator = openJudgment({
		...proposal(),
		provenance: { kind: "human", source: "reviewer" },
	});

	assert.equal(opened.status, "opened");
	assert.equal(anotherEvaluator.status, "opened");
	if (opened.status !== "opened" || anotherEvaluator.status !== "opened") {
		return;
	}
	assert.match(opened.value.judgmentId, /^open_judgment_[a-f0-9]{64}$/);
	assert.equal(opened.value.judgmentId, anotherEvaluator.value.judgmentId);
	assert.equal(opened.value.requirements.length, 1);
	assert.equal(opened.value.contributionNeeds.length, 2);
	assert.deepEqual(
		opened.value.requirements[0]?.contributionNeedIds,
		opened.value.contributionNeeds
			.map(({ contributionNeedId }) => contributionNeedId)
			.sort(),
	);
	assert.ok(Object.isFrozen(opened.value));
});

test("Requirement and Need order cannot change Judgment identity", () => {
	const first = proposal();
	const reversed = {
		...first,
		requirements: [
			{
				...first.requirements[0]!,
				contributionNeeds: [
					...first.requirements[0]!.contributionNeeds,
				].reverse(),
			},
		],
	};
	const left = openJudgment(first);
	const right = openJudgment(reversed);

	assert.equal(left.status, "opened");
	assert.equal(right.status, "opened");
	if (left.status === "opened" && right.status === "opened") {
		assert.equal(left.value.judgmentId, right.value.judgmentId);
	}
});

test("missing Needs, duplicate Requirements, malformed IDs, and basis-free proposals fail closed", () => {
	for (const attempted of [
		{ ...proposal(), workCaseId: " work-case-1 " },
		{
			...proposal(),
			requirements: [{ statement: "A requirement.", contributionNeeds: [] }],
		},
		{
			...proposal(),
			requirements: [...proposal().requirements, ...proposal().requirements],
		},
		{ ...proposal(), basis: [] },
	]) {
		assert.equal(openJudgment(attempted).status, "invalid");
	}
});
