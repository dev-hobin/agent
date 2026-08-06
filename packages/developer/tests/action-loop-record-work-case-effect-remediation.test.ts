import assert from "node:assert/strict";
import test from "node:test";
import { acceptActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import { acceptActionClearance } from "../src/action-loop/action/action-clearance.ts";
import { acceptEffectRemediation } from "../src/action-loop/effect/accept-effect-remediation.ts";
import { beginEffect, type PendingEffect } from "../src/action-loop/effect/begin-effect.ts";
import type { EffectSettlement } from "../src/action-loop/effect/effect-settlement.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { recordWorkCaseEffectAssessment } from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffectRemediation } from "../src/action-loop/work/record-work-case-effect-remediation.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import { openWorkCase, type ActiveWorkCase } from "../src/action-loop/work/work-case.ts";

function openCase(): ActiveWorkCase {
	const result = openWorkCase({
		outcome: {
			statement: "The adverse consequence is repaired without hiding history.",
			acceptanceConditions: ["The target artifact has the accepted final state."],
			constraints: ["The failed occurrence remains accounted for."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

function conclusion(workCaseId: string): JudgmentConclusion {
	return Object.freeze({
		conclusionId: "conclusion-remediation-action",
		workCaseId,
		judgmentId: "judgment-remediation-action",
		category: "Proportionate Intervention",
		subject: "Apply one bounded repair.",
		contextRevisionId: "context-remediation-action",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["A bounded repair is proportionate."]),
		answer: "Apply the repair.",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
}

function addEffect(
	workCase: ActiveWorkCase,
	warrant: JudgmentConclusion,
	label: string,
): { readonly workCase: ActiveWorkCase; readonly effect: PendingEffect } {
	const candidate = acceptActionCandidate({
		workCaseId: workCase.workCaseId,
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint: label.repeat(64).slice(0, 64),
		},
		summary: `Run ${label}.`,
		intendedEffects: [`${label} reaches its intended state.`],
		requiredConclusionIds: [warrant.conclusionId],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (candidate.status !== "accepted") throw new Error(candidate.error.message);
	const withCandidate = recordWorkCaseActionCandidate(workCase, candidate.value);
	if (withCandidate.status !== "recorded") throw new Error(withCandidate.status);
	const clearance = acceptActionClearance(
		candidate.value,
		[warrant],
		{
			actionCandidateId: candidate.value.actionCandidateId,
			status: "granted",
			source: "delegation:current-user-request",
			basis: ["The delegated work permits the bounded Action."],
		},
		{
			workCaseId: workCase.workCaseId,
			actionCandidateId: candidate.value.actionCandidateId,
			conclusionIds: [warrant.conclusionId],
			warrantBasis: ["The current Conclusion warrants the Action."],
			provenance: { kind: "model", source: "test-evaluator" },
		},
	);
	if (clearance.status !== "cleared") throw new Error(clearance.status);
	const withClearance = recordWorkCaseActionClearance(
		withCandidate.value,
		clearance.value,
	);
	if (withClearance.status !== "recorded") throw new Error(withClearance.status);
	const effect = beginEffect(clearance.value, {
		occurrenceId: `occurrence-${label}`,
		actionClearanceId: clearance.value.actionClearanceId,
		controlledAction: clearance.value.controlledAction,
		source: "pi:tool_call",
	});
	if (effect.status !== "begun") throw new Error(effect.error.message);
	const recorded = recordWorkCaseEffect(withClearance.value, effect.value);
	if (recorded.status !== "recorded") throw new Error(recorded.status);
	return { workCase: recorded.value, effect: effect.value };
}

function assessment(
	effect: PendingEffect,
	outcome: EffectSettlement["outcome"],
): EffectSettlement {
	return Object.freeze({
		effectSettlementId: `settlement-${effect.effectId}-${outcome}`,
		workCaseId: effect.workCaseId,
		effectId: effect.effectId,
		actionClearanceId: effect.actionClearanceId,
		occurrenceId: effect.occurrenceId,
		outcome,
		observationDispositions: Object.freeze([]),
		intendedEffectDispositions: Object.freeze([]),
		basis: Object.freeze(["The bounded test fixture supplies this settlement."]),
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
}

function remediationCase(): {
	readonly workCase: ActiveWorkCase;
	readonly remediation: ReturnType<typeof acceptEffectRemediation>;
} {
	const opened = openCase();
	const warrant = conclusion(opened.workCaseId);
	const withConclusion = recordWorkCaseConclusion(opened, warrant);
	if (withConclusion.status !== "recorded") throw new Error(withConclusion.status);
	const adverseEffect = addEffect(withConclusion.value, warrant, "a");
	const resolvingEffect = addEffect(adverseEffect.workCase, warrant, "b");
	const adverse = assessment(adverseEffect.effect, "partially-applied");
	const withAdverse = recordWorkCaseEffectAssessment(
		resolvingEffect.workCase,
		adverse,
		null,
	);
	if (withAdverse.status !== "recorded") throw new Error(withAdverse.status);
	const resolving = assessment(resolvingEffect.effect, "observed-success");
	const withResolving = recordWorkCaseEffectAssessment(
		withAdverse.value,
		resolving,
		null,
	);
	if (withResolving.status !== "recorded") throw new Error(withResolving.status);
	return {
		workCase: withResolving.value,
		remediation: acceptEffectRemediation(adverse, resolving, {
			workCaseId: opened.workCaseId,
			adverseEffectId: adverse.effectId,
			adverseEffectSettlementId: adverse.effectSettlementId,
			remediationEffectId: resolving.effectId,
			remediationEffectSettlementId: resolving.effectSettlementId,
			basis: ["The successful second Effect repairs the first partial Effect."],
			provenance: { kind: "model", source: "test-evaluator" },
		}),
	};
}

test("Work Case records one current remediation and advances revision", () => {
	const fixture = remediationCase();
	assert.equal(fixture.remediation.status, "accepted");
	if (fixture.remediation.status !== "accepted") return;
	const recorded = recordWorkCaseEffectRemediation(
		fixture.workCase,
		fixture.remediation.value,
	);

	assert.equal(recorded.status, "recorded");
	if (recorded.status !== "recorded") return;
	assert.notEqual(recorded.value.revisionId, fixture.workCase.revisionId);
	assert.deepEqual(recorded.value.effectRemediations, [
		fixture.remediation.value,
	]);
	assert.equal(
		recordWorkCaseEffectRemediation(recorded.value, fixture.remediation.value)
			.status,
		"unchanged",
	);
});

test("reassessment invalidates a remediation bound to the replaced settlement", () => {
	const fixture = remediationCase();
	if (fixture.remediation.status !== "accepted") return;
	const remediation = fixture.remediation.value;
	const recorded = recordWorkCaseEffectRemediation(
		fixture.workCase,
		remediation,
	);
	if (recorded.status !== "recorded") return;
	const current = recorded.value.currentEffectAssessments.find(
		({ effectId }) => effectId === remediation.remediationEffectId,
	);
	if (current === undefined || !("effectSettlementId" in current)) return;
	const reassessed: EffectSettlement = Object.freeze({
		...current,
		effectSettlementId: `${current.effectSettlementId}-reassessed`,
		basis: Object.freeze(["New evidence replaced the resolving assessment."]),
	});
	const result = recordWorkCaseEffectAssessment(
		recorded.value,
		reassessed,
		current.effectSettlementId,
	);

	assert.equal(result.status, "recorded");
	if (result.status === "recorded") {
		assert.deepEqual(result.value.effectRemediations, []);
	}
});

test("stale, cross-Case, and second current remediation fail closed", () => {
	const fixture = remediationCase();
	if (fixture.remediation.status !== "accepted") return;
	const recorded = recordWorkCaseEffectRemediation(
		fixture.workCase,
		fixture.remediation.value,
	);
	if (recorded.status !== "recorded") return;

	assert.equal(
		recordWorkCaseEffectRemediation(
			{ ...recorded.value, revisionId: "work-case-revision-stale" },
			fixture.remediation.value,
		).status,
		"invalid",
	);
	assert.equal(
		recordWorkCaseEffectRemediation(fixture.workCase, {
			...fixture.remediation.value,
			effectRemediationId: "effect-remediation-other",
			workCaseId: "work-case-other",
		}).status,
		"invalid",
	);
	assert.equal(
		recordWorkCaseEffectRemediation(recorded.value, {
			...fixture.remediation.value,
			effectRemediationId: "effect-remediation-second",
		}).status,
		"invalid",
	);
});
