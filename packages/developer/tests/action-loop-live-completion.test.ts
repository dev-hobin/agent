import assert from "node:assert/strict";
import test from "node:test";

import { prepareLiveWorkCaseClosure } from "../extensions/action-loop-completion.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

test("live closure preparation exposes canonical blockers without caller-selected inventory", () => {
	const opened = openLiveWorkCase(undefined, {
		outcome: {
			statement: "One bounded Outcome is closed from canonical inventory.",
			acceptanceConditions: ["Current evidence satisfies the Outcome."],
			constraints: [],
		},
		basis: ["The caller delegated one bounded Outcome."],
		provenance: { kind: "human", source: "test" },
	});
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const prepared = prepareLiveWorkCaseClosure(opened.value);
	assert.equal(prepared.status, "not-ready");
	if (prepared.status === "not-ready") {
		assert.deepEqual(
			prepared.blockers.map((blocker) => blocker.code),
			["missing-claim-assurance"],
		);
	}
});
