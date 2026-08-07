import assert from "node:assert/strict";
import test from "node:test";

import { recordLiveEffectRemediation } from "../extensions/action-loop-effect.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

test("live remediation cannot invent missing or unsettled Effect assessments", () => {
	const opened = openLiveWorkCase(undefined, {
		outcome: {
			statement: "An adverse Effect is repaired without rewriting history.",
			acceptanceConditions: ["The repaired state is observed."],
			constraints: ["The adverse Effect remains visible."],
		},
		basis: ["The bounded repair is delegated."],
		provenance: { kind: "human", source: "test" },
	});
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	assert.deepEqual(
		recordLiveEffectRemediation(
			opened.value,
			"effect-adverse",
			"effect-repair",
			["The repair addresses the adverse consequence."],
		),
		{
			status: "invalid",
			message:
				"Effect remediation requires two current settled Effect assessments",
		},
	);
});
