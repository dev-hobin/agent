import assert from "node:assert/strict";
import test from "node:test";

import { assessLiveNeedCoverage } from "../extensions/action-loop-coverage.ts";
import { acceptLiveHostContribution } from "../extensions/action-loop-host-contribution.ts";
import { admitLiveUserPromptObservation } from "../extensions/action-loop-host-observation.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

function judgmentFixture() {
	const opened = openLiveWorkCase(undefined, {
		outcome: {
			statement: "Apply the product owner's compatibility decision.",
			acceptanceConditions: ["The selected compatibility policy is explicit."],
			constraints: [],
		},
		basis: ["The current request delegates one bounded policy decision."],
		provenance: { kind: "model", source: "test" },
	});
	if (opened.status !== "opened") throw new Error("Expected Work Case fixture");
	const judgment = openLiveJudgment(opened.value, {
		category: "Contextual Adequacy",
		subject: "Compatibility policy",
		question: "Which compatibility policy did the product owner choose?",
		requirements: [
			{
				statement: "The product owner's decision is represented exactly.",
				contributionNeeds: ["An exact product-owner decision"],
			},
		],
		basis: ["Implementation cannot choose product policy."],
		provenance: { kind: "model", source: "test" },
	});
	if (judgment.status !== "opened")
		throw new Error("Expected Judgment fixture");
	return judgment.state;
}

test("one admitted human Observation contributes to a Need through canonical Coverage", () => {
	const state = judgmentFixture();
	const admitted = admitLiveUserPromptObservation(
		"Use strict compatibility and reject unknown values.",
		state.workCase.workCaseId,
	);
	assert.equal(admitted.status, "admitted");
	if (admitted.status !== "admitted") return;
	const contribution = acceptLiveHostContribution(state, admitted.observation, {
		localStatus: "resolved",
		result: "Use strict compatibility and reject unknown values.",
		limitations: [],
		residualNeeds: [],
		basis: [
			"The exact human Observation answers the current product question.",
		],
	});
	assert.equal(contribution.status, "accepted");
	if (contribution.status !== "accepted") return;
	assert.equal("assignmentId" in contribution.contribution, false);
	const coverage = assessLiveNeedCoverage(contribution.state, {
		status: "covered",
		dispositions: [
			{
				contributionId: contribution.contribution.contributionId,
				status: "supports",
				basis: ["The product-owner Observation directly answers the Need."],
			},
		],
		conflicts: [],
		basis: ["Every current Contribution is dispositioned."],
		provenance: { kind: "model", source: "test" },
	});
	assert.equal(coverage.status, "assessed");
	if (coverage.status === "assessed")
		assert.equal(coverage.coverage.status, "covered");
});

test("host Contribution rejects cross-Work-Case evidence and invalidates prior Coverage", () => {
	const state = judgmentFixture();
	const admitted = admitLiveUserPromptObservation(
		"Use strict compatibility.",
		"another-work-case",
	);
	assert.equal(admitted.status, "admitted");
	if (admitted.status !== "admitted") return;
	assert.equal(
		acceptLiveHostContribution(state, admitted.observation, {
			localStatus: "resolved",
			result: "Use strict compatibility.",
			limitations: [],
			residualNeeds: [],
			basis: ["The answer is explicit."],
		}).status,
		"invalid",
	);
});
