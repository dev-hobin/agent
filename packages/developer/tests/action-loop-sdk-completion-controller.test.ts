import assert from "node:assert/strict";
import test from "node:test";

import { sdkWorkCaseCompletedEvent } from "../extensions/action-loop-sdk-session.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { completeWorkCaseWithSdk } from "../src/action-loop/sdk/completion-controller.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

function activeWorkCaseWithClaimAssurance() {
	const opened = openWorkCase({
		outcome: {
			statement: "The bounded configuration is complete and verified.",
			acceptanceConditions: [
				"The accepted configuration value is represented.",
			],
			constraints: ["No unrelated state is changed."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const assurance: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-sdk-completion-assurance",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-sdk-completion-assurance",
		category: "Claim Assurance",
		subject: "Current completion evidence",
		contextRevisionId: "context-sdk-completion-assurance",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([
			"Current bounded evidence supports the completion claim.",
		]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "The bounded configuration claim is supported.",
	});
	const recorded = recordWorkCaseConclusion(opened.value, assurance);
	if (recorded.status !== "recorded") {
		throw new Error(
			recorded.status === "invalid" ? recorded.error.message : "not recorded",
		);
	}
	return recorded.value;
}

test("SDK Completion accounts for all current evidence and revalidates the revision", async () => {
	const workCase = activeWorkCaseWithClaimAssurance();
	const result = await completeWorkCaseWithSdk({
		request:
			"Complete the bounded configuration work only when fully supported.",
		workCase,
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						mode: "completed",
						basis_json:
							'["Every current closure obligation and evidence item is accounted for."]',
						obligation_0_conclusion_indices_json: "[]",
						obligation_0_effect_indices_json: "[]",
						obligation_0_remediation_indices_json: "[]",
						obligation_0_basis:
							"The acceptance condition is represented by current evidence.",
						obligation_1_conclusion_indices_json: "[]",
						obligation_1_effect_indices_json: "[]",
						obligation_1_remediation_indices_json: "[]",
						obligation_1_basis:
							"The constraint is represented by current evidence.",
					},
					{
						mode: "completed",
						basis_json:
							'["Every current closure obligation and evidence item is accounted for."]',
						obligation_0_conclusion_indices_json: "[0]",
						obligation_0_effect_indices_json: "[]",
						obligation_0_remediation_indices_json: "[]",
						obligation_0_basis:
							"Claim Assurance supports the acceptance condition.",
						obligation_1_conclusion_indices_json: "[0]",
						obligation_1_effect_indices_json: "[]",
						obligation_1_remediation_indices_json: "[]",
						obligation_1_basis:
							"Claim Assurance also accounts for the bounded constraint.",
					},
				],
			},
		]),
	});
	assert.equal(result.status, "completed");
	if (result.status !== "completed") return;
	assert.equal(result.workCase.status, "complete");
	assert.equal(result.workCase.priorRevisionId, workCase.revisionId);
	assert.equal(result.claim.obligationDispositions.length, 2);
	assert.equal(result.decision.toolCalls, 2);
	assert.equal(result.decision.toolErrors, 1);
	const event = sdkWorkCaseCompletedEvent(result);
	assert.equal(event.kind, "work-case-completed");
	assert.equal(event.expected.revisionId, result.workCase.revisionId);
});

test("SDK Completion stops before a model session when Claim Assurance is missing", async () => {
	const opened = openWorkCase({
		outcome: {
			statement: "The bounded work is complete.",
			acceptanceConditions: ["The result is represented."],
			constraints: [],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const result = await completeWorkCaseWithSdk({
		request: "Complete the work.",
		workCase: opened.value,
		runner: scriptedSdkRunner([]),
	});
	assert.equal(result.status, "not-ready");
	if (result.status !== "not-ready") return;
	assert.ok(
		result.blockers.some(
			(blocker) => blocker.code === "missing-claim-assurance",
		),
	);
});
