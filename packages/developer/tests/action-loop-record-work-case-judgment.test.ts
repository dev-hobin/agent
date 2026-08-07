import assert from "node:assert/strict";
import test from "node:test";
import { openJudgment } from "../src/action-loop/judgment/open-judgment.ts";
import { recordWorkCaseJudgment } from "../src/action-loop/work/record-work-case-judgment.ts";
import {
	deriveWorkCaseRevisionId,
	openWorkCase,
} from "../src/action-loop/work/work-case.ts";

function fixture() {
	const opened = openWorkCase({
		outcome: {
			statement: "The active Work Case owns every consequential Judgment.",
			acceptanceConditions: ["The open Judgment remains revision-bound."],
			constraints: ["No Skill name determines its Category."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const judgment = openJudgment({
		workCaseId: opened.value.workCaseId,
		category: "Contextual Adequacy",
		subject: "The active Outcome and repository context.",
		question: "Does the proposed interpretation fit current context?",
		contextRevisionId: "context-revision-1",
		requirements: [
			{
				statement: "Consequential assumptions and Constraints are explicit.",
				contributionNeeds: ["accepted behavior observation"],
			},
		],
		basis: ["The next route depends on one unresolved contextual assumption."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (judgment.status !== "opened") throw new Error(judgment.error.message);
	return { workCase: opened.value, judgment: judgment.value };
}

test("one open Judgment advances the owning Work Case revision", () => {
	const current = fixture();
	const result = recordWorkCaseJudgment(current.workCase, current.judgment);

	assert.equal(result.status, "recorded");
	if (result.status !== "recorded") return;
	assert.notEqual(result.value.revisionId, current.workCase.revisionId);
	assert.deepEqual(result.value.openJudgments, [current.judgment]);
	assert.equal(Object.isFrozen(result.value.openJudgments), true);
});

test("an exact duplicate Judgment is idempotent", () => {
	const current = fixture();
	const first = recordWorkCaseJudgment(current.workCase, current.judgment);
	if (first.status !== "recorded") return;
	const duplicate = recordWorkCaseJudgment(first.value, current.judgment);

	assert.equal(duplicate.status, "unchanged");
	if (duplicate.status === "unchanged") {
		assert.equal(duplicate.value, first.value);
	}
});

test("cross-Case, stale, and revision-consistent incoherent recording fail closed", () => {
	const current = fixture();
	const crossCase = recordWorkCaseJudgment(current.workCase, {
		...current.judgment,
		workCaseId: "work-case-other",
	});
	const stale = recordWorkCaseJudgment(
		{ ...current.workCase, revisionId: "work-case-revision-stale" },
		current.judgment,
	);
	const incoherentDraft = {
		...current.workCase,
		openJudgments: [
			{ ...current.judgment, workCaseId: "work-case-other" },
		],
	};
	const incoherent = recordWorkCaseJudgment(
		{
			...incoherentDraft,
			revisionId: deriveWorkCaseRevisionId(incoherentDraft),
		},
		current.judgment,
	);

	assert.equal(crossCase.status, "invalid");
	assert.equal(stale.status, "invalid");
	assert.equal(incoherent.status, "invalid");
});
