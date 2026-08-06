import assert from "node:assert/strict";
import test from "node:test";
import { acceptActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import { acceptActionClearance } from "../src/action-loop/action/action-clearance.ts";
import { beginEffect } from "../src/action-loop/effect/begin-effect.ts";
import { acceptEffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import { settleEffect } from "../src/action-loop/effect/effect-settlement.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { acceptClosureClaim } from "../src/action-loop/work/accept-closure-claim.ts";
import { completeWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import { prepareClosureTarget } from "../src/action-loop/work/prepare-closure-target.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { recordWorkCaseEffectAssessment } from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";

function conclusion(
	workCaseId: string,
	category: JudgmentConclusion["category"],
	id: string,
	answer: string,
): JudgmentConclusion {
	return Object.freeze({
		conclusionId: id,
		workCaseId,
		judgmentId: `judgment-${id}`,
		category,
		subject: answer,
		contextRevisionId: `context-${id}`,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current bounded evidence supports this Conclusion."]),
		answer,
		provenance: Object.freeze({ kind: "model", source: "slice-evaluator" }),
	});
}

test("Outcome-bound Action reaches evidence-bounded canonical completion", () => {
	const opened = openWorkCase({
		outcome: {
			statement: "The exact delegated change is implemented and verified.",
			acceptanceConditions: ["The target artifact contains the delegated change."],
			constraints: ["No unrelated artifact changes."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (opened.status !== "opened") return;
	const warrant = conclusion(
		opened.value.workCaseId,
		"Proportionate Intervention",
		"conclusion-warrant",
		"The exact bounded Action is warranted.",
	);
	const withWarrant = recordWorkCaseConclusion(opened.value, warrant);
	if (withWarrant.status !== "recorded") return;
	const candidate = acceptActionCandidate({
		workCaseId: opened.value.workCaseId,
		controlledAction: { kind: "pi-tool-call", fingerprint: "a".repeat(64) },
		summary: "Apply the exact delegated change.",
		intendedEffects: ["The target artifact contains the delegated change."],
		requiredConclusionIds: [warrant.conclusionId],
		provenance: { kind: "model", source: "slice-evaluator" },
	});
	if (candidate.status !== "accepted") return;
	const withCandidate = recordWorkCaseActionCandidate(
		withWarrant.value,
		candidate.value,
	);
	if (withCandidate.status !== "recorded") return;
	const clearance = acceptActionClearance(
		candidate.value,
		[warrant],
		{
			actionCandidateId: candidate.value.actionCandidateId,
			status: "granted",
			source: "delegation:current-user-request",
			basis: ["The current delegation permits this exact bounded Action."],
		},
		{
			workCaseId: opened.value.workCaseId,
			actionCandidateId: candidate.value.actionCandidateId,
			conclusionIds: [warrant.conclusionId],
			warrantBasis: ["The required intervention Conclusion is current."],
			provenance: { kind: "model", source: "slice-evaluator" },
		},
	);
	if (clearance.status !== "cleared") return;
	const withClearance = recordWorkCaseActionClearance(
		withCandidate.value,
		clearance.value,
	);
	if (withClearance.status !== "recorded") return;
	const effect = beginEffect(clearance.value, {
		occurrenceId: "tool-call-completion-slice",
		actionClearanceId: clearance.value.actionClearanceId,
		controlledAction: clearance.value.controlledAction,
		source: "pi:tool_call",
	});
	if (effect.status !== "begun") return;
	const withEffect = recordWorkCaseEffect(withClearance.value, effect.value);
	if (withEffect.status !== "recorded") return;
	const observation = acceptEffectObservation(effect.value, {
		workCaseId: opened.value.workCaseId,
		effectId: effect.value.effectId,
		occurrenceId: effect.value.occurrenceId,
		evidence: {
			kind: "artifact-state",
			locator: "file:///workspace/src/target.ts",
			fingerprint: "b".repeat(64),
		},
		statement: "The target artifact contains the delegated change.",
		limitations: [],
		provenance: { kind: "tool", source: "filesystem-observer" },
	});
	if (observation.status !== "accepted") return;
	const intendedEffect = effect.value.intendedEffects[0];
	if (intendedEffect === undefined) return;
	const settlement = settleEffect(effect.value, [observation.value], {
		workCaseId: opened.value.workCaseId,
		effectId: effect.value.effectId,
		outcome: "observed-success",
		observationDispositions: [
			{
				effectObservationId: observation.value.effectObservationId,
				status: "relied-on",
				basis: ["The exact artifact Observation bears on the intended Effect."],
			},
		],
		intendedEffectDispositions: [
			{
				intendedEffect,
				status: "observed",
				observationIds: [observation.value.effectObservationId],
				basis: ["The artifact Observation satisfies the intended Effect."],
			},
		],
		basis: ["Every current Observation and intended Effect is accounted."],
		provenance: { kind: "model", source: "slice-evaluator" },
	});
	if (settlement.status !== "settled") return;
	const withSettlement = recordWorkCaseEffectAssessment(
		withEffect.value,
		settlement.value,
		null,
	);
	if (withSettlement.status !== "recorded") return;
	const claimAssurance = conclusion(
		opened.value.workCaseId,
		"Claim Assurance",
		"conclusion-claim-assurance",
		"Current evidence supports the bounded completion claim.",
	);
	const current = recordWorkCaseConclusion(
		withSettlement.value,
		claimAssurance,
	);
	if (current.status !== "recorded") return;
	const target = prepareClosureTarget(current.value);
	if (target.status !== "ready") return;
	const claim = acceptClosureClaim(target.value, {
		workCaseId: current.value.workCaseId,
		closureTargetId: target.value.closureTargetId,
		mode: "completed",
		obligationDispositions: target.value.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: target.value.conclusionIds,
			effectAssessmentIds: target.value.effectAssessmentIds,
			basis: [`Current evidence satisfies: ${obligation.statement}`],
		})),
		basis: ["Every current closure obligation and evidence item is accounted."],
		provenance: { kind: "model", source: "slice-evaluator" },
	});
	if (claim.status !== "accepted") return;
	const completed = completeWorkCase(current.value, target.value, claim.value);

	assert.equal(completed.status, "completed");
	if (completed.status === "completed") {
		assert.equal(completed.value.status, "complete");
		assert.equal(completed.value.effects.length, 1);
		assert.equal(completed.value.currentEffectAssessments.length, 1);
		assert.equal(completed.value.closureClaim.mode, "completed");
	}
});
