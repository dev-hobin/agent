import assert from "node:assert/strict";
import test from "node:test";
import { acceptActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import { acceptActionClearance } from "../src/action-loop/action/action-clearance.ts";
import { beginEffect } from "../src/action-loop/effect/begin-effect.ts";
import { acceptEffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import { settleEffect } from "../src/action-loop/effect/effect-settlement.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { prepareClosureTarget } from "../src/action-loop/work/prepare-closure-target.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { recordWorkCaseEffectAssessment } from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import {
	deriveWorkCaseRevisionId,
	openWorkCase,
	type ActiveWorkCase,
} from "../src/action-loop/work/work-case.ts";

function openCase(): ActiveWorkCase {
	const result = openWorkCase({
		outcome: {
			statement: "The delegated behavior is complete and evidence-supported.",
			acceptanceConditions: ["The delegated behavior is present."],
			constraints: ["No unrelated behavior changes."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

function conclusion(
	workCaseId: string,
	category: JudgmentConclusion["category"],
	id: string,
): JudgmentConclusion {
	return Object.freeze({
		conclusionId: id,
		workCaseId,
		judgmentId: `judgment-${id}`,
		category,
		subject: "The current bounded claim is supported.",
		contextRevisionId: `context-${id}`,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([
			"Current bounded evidence supports this Conclusion.",
		]),
		answer: "The bounded claim is supported.",
		...(category === "Proportionate Intervention"
			? { interventionDisposition: "action-required" as const }
			: {}),
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
}

function recordConclusion(
	workCase: ActiveWorkCase,
	accepted: JudgmentConclusion,
): ActiveWorkCase {
	const result = recordWorkCaseConclusion(workCase, accepted);
	if (result.status !== "recorded") throw new Error(result.status);
	return result.value;
}

test("Claim Assurance seals every no-Action closure obligation", () => {
	const opened = openCase();
	const current = recordConclusion(
		opened,
		conclusion(opened.workCaseId, "Claim Assurance", "conclusion-claim"),
	);
	const result = prepareClosureTarget(current);

	assert.equal(result.status, "ready");
	if (result.status !== "ready") return;
	assert.equal(result.value.workCaseRevisionId, current.revisionId);
	assert.deepEqual(result.value.obligations.map(({ kind }) => kind).sort(), [
		"acceptance-condition",
		"constraint",
	]);
	assert.deepEqual(result.value.effectIds, []);
	assert.match(result.value.closureTargetId, /^closure_target_[a-f0-9]{64}$/);
});

test("missing Claim Assurance and stale Work Case cannot produce a target", () => {
	const opened = openCase();
	const missing = prepareClosureTarget(opened);
	const stale = prepareClosureTarget({
		...opened,
		revisionId: "work_case_revision_stale",
	});

	assert.equal(missing.status, "not-ready");
	assert.equal(stale.status, "invalid");
	if (missing.status === "not-ready") {
		assert.deepEqual(
			missing.blockers.map(({ code }) => code),
			["missing-claim-assurance"],
		);
	}
});

test("revision-consistent but incoherent inventory fails closed", () => {
	const opened = openCase();
	const current = recordConclusion(
		opened,
		conclusion(opened.workCaseId, "Claim Assurance", "conclusion-claim"),
	);
	const duplicatedConclusions = Object.freeze([
		...current.conclusions,
		...current.conclusions,
	]);
	const draft = { ...current, conclusions: duplicatedConclusions };
	const forged = {
		...draft,
		revisionId: deriveWorkCaseRevisionId(draft),
	};
	const result = prepareClosureTarget(forged);

	assert.equal(result.status, "invalid");
	if (result.status === "invalid") {
		assert.equal(result.error.code, "invalid-work-case-inventory");
	}
});

test("an occurred Effect cannot be omitted from closure readiness", () => {
	const opened = openCase();
	const warrant = conclusion(
		opened.workCaseId,
		"Proportionate Intervention",
		"conclusion-warrant",
	);
	let current = recordConclusion(opened, warrant);
	current = recordConclusion(
		current,
		conclusion(opened.workCaseId, "Claim Assurance", "conclusion-claim"),
	);
	const candidate = acceptActionCandidate({
		workCaseId: opened.workCaseId,
		controlledAction: { kind: "pi-tool-call", fingerprint: "a".repeat(64) },
		summary: "Apply the exact bounded change.",
		intendedEffects: ["The target artifact contains the change."],
		requiredConclusionIds: [warrant.conclusionId],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (candidate.status !== "accepted") return;
	const withCandidate = recordWorkCaseActionCandidate(current, candidate.value);
	if (withCandidate.status !== "recorded") return;
	const clearance = acceptActionClearance(
		candidate.value,
		[warrant],
		{
			actionCandidateId: candidate.value.actionCandidateId,
			status: "granted",
			source: "delegation:current-user-request",
			basis: ["The delegated work permits this Action."],
		},
		{
			workCaseId: opened.workCaseId,
			actionCandidateId: candidate.value.actionCandidateId,
			conclusionIds: [warrant.conclusionId],
			warrantBasis: ["The intervention Conclusion is current."],
			provenance: { kind: "model", source: "test-evaluator" },
		},
	);
	if (clearance.status !== "cleared") return;
	const withClearance = recordWorkCaseActionClearance(
		withCandidate.value,
		clearance.value,
	);
	if (withClearance.status !== "recorded") return;
	const effect = beginEffect(clearance.value, {
		occurrenceId: "tool-call-closure-target",
		actionClearanceId: clearance.value.actionClearanceId,
		controlledAction: clearance.value.controlledAction,
		source: "pi:tool_call",
	});
	if (effect.status !== "begun") return;
	const withEffect = recordWorkCaseEffect(withClearance.value, effect.value);
	if (withEffect.status !== "recorded") return;

	const missingAssessment = prepareClosureTarget(withEffect.value);
	assert.equal(missingAssessment.status, "not-ready");
	if (missingAssessment.status === "not-ready") {
		assert.equal(
			missingAssessment.blockers[0]?.code,
			"missing-effect-assessment",
		);
	}

	const intendedEffect = effect.value.intendedEffects[0];
	if (intendedEffect === undefined) return;
	const assessment = settleEffect(effect.value, [], {
		workCaseId: opened.workCaseId,
		effectId: effect.value.effectId,
		outcome: "unknown",
		observationDispositions: [],
		intendedEffectDispositions: [
			{
				intendedEffect,
				status: "unknown",
				observationIds: [],
				basis: ["No decisive Observation is available."],
			},
		],
		basis: ["The Effect remains unsettled."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (assessment.status !== "unsettled") return;
	const withAssessment = recordWorkCaseEffectAssessment(
		withEffect.value,
		assessment.value,
		null,
	);
	if (withAssessment.status !== "recorded") return;
	const unsettled = prepareClosureTarget(withAssessment.value);

	assert.equal(unsettled.status, "not-ready");
	if (unsettled.status === "not-ready") {
		assert.equal(unsettled.blockers[0]?.code, "unsettled-effect");
	}

	const observation = acceptEffectObservation(effect.value, {
		workCaseId: opened.workCaseId,
		effectId: effect.value.effectId,
		occurrenceId: effect.value.occurrenceId,
		evidence: {
			kind: "tool-result",
			locator: "pi://tool-result/closure-target",
			fingerprint: "b".repeat(64),
		},
		statement:
			"The controlled Action failed before producing its intended Effect.",
		limitations: [],
		provenance: { kind: "tool", source: "pi:tool_result" },
	});
	if (observation.status !== "accepted") return;
	const failed = settleEffect(effect.value, [observation.value], {
		workCaseId: opened.workCaseId,
		effectId: effect.value.effectId,
		outcome: "failed",
		observationDispositions: [
			{
				effectObservationId: observation.value.effectObservationId,
				status: "relied-on",
				basis: ["The exact tool result bears on the failed Effect."],
			},
		],
		intendedEffectDispositions: [
			{
				intendedEffect,
				status: "failed",
				observationIds: [observation.value.effectObservationId],
				basis: ["The intended Effect was not produced."],
			},
		],
		basis: ["The current evidence supports a failed settlement."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (failed.status !== "settled") return;
	const failedCurrent = recordWorkCaseEffectAssessment(
		withAssessment.value,
		failed.value,
		assessment.value.effectAssessmentId,
	);
	if (failedCurrent.status !== "recorded") return;
	const adverse = prepareClosureTarget(failedCurrent.value);
	assert.equal(adverse.status, "not-ready");
	if (adverse.status === "not-ready") {
		assert.equal(adverse.blockers[0]?.code, "adverse-effect");
	}
});
