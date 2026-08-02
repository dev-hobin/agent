import assert from "node:assert/strict";
import test from "node:test";

import {
	judgmentPolicyDirections,
	parseJudgmentAuthoringPolicyJson,
} from "../src/index.ts";

const source = JSON.stringify({
	specVersion: "0.1",
	when: ["A shape remains unresolved."],
	unless: ["A concrete candidate only needs review."],
	references: [
		{
			path: "references/shape.md",
			when: [
				"A recursive data shape needs explicit base, self-reference, and combination distinctions.",
			],
		},
	],
});

test("directions deterministically expose when, winning unless, and independent references", () => {
	const policy = parseJudgmentAuthoringPolicyJson(source);
	const first = judgmentPolicyDirections(policy).markdown;
	const second = judgmentPolicyDirections(
		parseJudgmentAuthoringPolicyJson(source),
	).markdown;
	assert.equal(first, second);
	assert.match(first, /exclusions win/u);
	assert.match(first, /references\/shape\.md/u);
	assert.doesNotMatch(first, /questionId|needId|canInform/u);
});
