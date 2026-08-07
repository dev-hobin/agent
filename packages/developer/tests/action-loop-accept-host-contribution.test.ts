import assert from "node:assert/strict";
import test from "node:test";

import { acceptHostContribution } from "../src/action-loop/contribution/accept-host-contribution.ts";

const target = {
	workCaseId: "work-case-1",
	judgmentId: "judgment-1",
	contributionNeedId: "need-1",
};
const observation = {
	observationId: "observation-1",
	kind: "human" as const,
	source: "pi:user-prompt",
	statement: "The product owner chose the strict compatibility policy.",
	evidenceFingerprint: "prompt-sha-1",
	basis: ["Pi admitted the exact current user prompt."],
};
const proposal = {
	...target,
	localStatus: "resolved" as const,
	result: "Use the strict compatibility policy.",
	limitations: [],
	residualNeeds: [],
	basis: ["The exact human Observation answers the current functional Need."],
	provenance: { kind: "model" as const, source: "pi:tool-call" },
};

test("exact host evidence becomes an open-world Contribution without implying Coverage", () => {
	const first = acceptHostContribution(target, observation, proposal);
	const second = acceptHostContribution(target, observation, {
		...proposal,
		provenance: { kind: "human", source: "another evaluator" },
	});
	assert.equal(first.status, "accepted");
	assert.equal(second.status, "accepted");
	if (first.status !== "accepted" || second.status !== "accepted") return;
	assert.equal(first.value.contributionId, second.value.contributionId);
	assert.equal(first.value.observationKind, "human");
	assert.equal(first.value.localStatus, "resolved");
	assert.equal("assignmentId" in first.value, false);
	assert.match(first.value.basis.join("\n"), /exact current user prompt/);
});

test("stale, invented, partial, or malformed host evidence fails closed", () => {
	assert.equal(
		acceptHostContribution(target, observation, {
			...proposal,
			contributionNeedId: "need-other",
		}).status,
		"invalid",
	);
	assert.equal(
		acceptHostContribution(
			target,
			{ ...observation, kind: "model" as never },
			proposal,
		).status,
		"invalid",
	);
	assert.equal(
		acceptHostContribution(target, observation, {
			...proposal,
			localStatus: "resolved",
			residualNeeds: [
				{
					kind: "residual",
					description: "The decision remains unknown.",
					basis: ["The source did not answer the question."],
				},
			],
		}).status,
		"invalid",
	);
	assert.equal(
		acceptHostContribution(target, observation, { ...proposal, basis: [] })
			.status,
		"invalid",
	);
});
