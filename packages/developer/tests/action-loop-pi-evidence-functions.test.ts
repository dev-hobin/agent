import assert from "node:assert/strict";
import test from "node:test";

import { piActionLoopEvidenceFunctions } from "../extensions/action-loop-pi-controller.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { initialActionLoopPhase } from "../src/action-loop/work/action-loop-phase.ts";
import { phaseAfterConclusions } from "./fixtures/action-loop-phase.ts";

const workCaseId = "work-case-pi-evidence";
const conclusionEvidence = /current canonical Conclusions/;

function attainedIntervention(): JudgmentConclusion {
	return Object.freeze({
		conclusionId: "conclusion-attained",
		workCaseId,
		judgmentId: "judgment-attained",
		category: "Proportionate Intervention",
		subject: "Attained outcome",
		contextRevisionId: "context-attained",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Exact current evidence establishes the outcome."]),
		provenance: Object.freeze({ kind: "model", source: "pi-evidence:test" }),
		answer: "No further Action is warranted.",
		interventionDisposition: "no-action",
		noActionDisposition: "outcome-attained",
	});
}

test("Pi scopes canonical Conclusion evidence to Claim Assurance", () => {
	const intervention = piActionLoopEvidenceFunctions({
		phase: initialActionLoopPhase(workCaseId),
	});
	assert.equal(intervention.length, 2);
	assert.doesNotMatch(intervention.join("\n"), conclusionEvidence);

	const claimAssurance = piActionLoopEvidenceFunctions({
		phase: phaseAfterConclusions(workCaseId, [attainedIntervention()]),
	});
	assert.equal(claimAssurance.length, 3);
	assert.match(claimAssurance.join("\n"), /Only for Claim Assurance/);
	assert.match(claimAssurance.join("\n"), conclusionEvidence);
});
