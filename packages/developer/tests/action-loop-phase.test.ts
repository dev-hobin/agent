import assert from "node:assert/strict";
import test from "node:test";

import type { ActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import type { ActionClearance } from "../src/action-loop/action/action-clearance.ts";
import type { PendingEffect } from "../src/action-loop/effect/begin-effect.ts";
import type { EffectRemediation } from "../src/action-loop/effect/accept-effect-remediation.ts";
import type { EffectSettlement } from "../src/action-loop/effect/effect-settlement.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import {
	beginActionLoopEffect,
	clearActionLoopAction,
	initialActionLoopPhase,
	remediateActionLoopEffect,
	requiredActionLoopJudgmentCategory,
	settleActionLoopEffect,
	type ActionLoopActionProposalPhase,
	type ActionLoopPhase,
} from "../src/action-loop/work/action-loop-phase.ts";
import {
	advancePhaseWithConclusion,
	phaseAfterConclusions,
} from "./fixtures/action-loop-phase.ts";

const workCaseId = "work-case-phase-model";

function intervention(
	name: string,
	disposition: "action-required" | "no-action",
	noActionDisposition?: "outcome-attained" | "blocked" | "waiting",
): JudgmentConclusion {
	return Object.freeze({
		conclusionId: `conclusion-${name}`,
		workCaseId,
		judgmentId: `judgment-${name}`,
		category: "Proportionate Intervention",
		subject: `${name} intervention`,
		contextRevisionId: `context-${name}`,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([`${name} has bounded evidence.`]),
		provenance: Object.freeze({ kind: "model", source: "phase:test" }),
		answer: `${name} is the current bounded intervention.`,
		interventionDisposition: disposition,
		...(noActionDisposition ? { noActionDisposition } : {}),
	});
}

function claimAssurance(name: string): JudgmentConclusion {
	return Object.freeze({
		conclusionId: `conclusion-${name}`,
		workCaseId,
		judgmentId: `judgment-${name}`,
		category: "Claim Assurance",
		subject: `${name} assurance`,
		contextRevisionId: `context-${name}`,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([`${name} assurance has bounded evidence.`]),
		provenance: Object.freeze({ kind: "model", source: "phase:test" }),
		answer: `${name} is assured by current evidence.`,
	});
}

function actionArtifacts(
	warrant: JudgmentConclusion,
	name: string,
): {
	readonly candidate: ActionCandidate;
	readonly clearance: ActionClearance;
} {
	const controlledAction = Object.freeze({
		kind: `pi-tool-call:${name}`,
		fingerprint: name.slice(0, 1).repeat(64),
	});
	const candidate: ActionCandidate = Object.freeze({
		actionCandidateId: `candidate-${name}`,
		workCaseId,
		controlledAction,
		summary: `Run ${name}.`,
		intendedEffects: Object.freeze([`${name} reaches its intended state.`]),
		requiredConclusionIds: Object.freeze([warrant.conclusionId]),
		provenance: Object.freeze({ kind: "model", source: "phase:test" }),
	});
	const clearance: ActionClearance = Object.freeze({
		actionClearanceId: `clearance-${name}`,
		workCaseId,
		actionCandidateId: candidate.actionCandidateId,
		controlledAction,
		intendedEffects: candidate.intendedEffects,
		conclusionIds: candidate.requiredConclusionIds,
		warrantBasis: Object.freeze(["The current Intervention warrants Action."]),
		permission: Object.freeze({
			actionCandidateId: candidate.actionCandidateId,
			status: "granted",
			source: "phase:test-host",
			basis: Object.freeze(["The host grants this exact Action."]),
		}),
		provenance: Object.freeze({ kind: "external", source: "phase:test-host" }),
	});
	return { candidate, clearance };
}

function pendingEffect(
	candidate: ActionCandidate,
	clearance: ActionClearance,
	name: string,
): PendingEffect {
	return Object.freeze({
		effectId: `effect-${name}`,
		workCaseId,
		actionCandidateId: candidate.actionCandidateId,
		actionClearanceId: clearance.actionClearanceId,
		occurrenceId: `occurrence-${name}`,
		controlledAction: candidate.controlledAction,
		intendedEffects: candidate.intendedEffects,
		occurrenceSource: "phase:test-host",
		status: "pending",
	});
}

function settlement(
	effect: PendingEffect,
	outcome: EffectSettlement["outcome"],
): EffectSettlement {
	return Object.freeze({
		effectSettlementId: `settlement-${effect.effectId}`,
		workCaseId,
		effectId: effect.effectId,
		actionClearanceId: effect.actionClearanceId,
		occurrenceId: effect.occurrenceId,
		outcome,
		observationDispositions: Object.freeze([]),
		intendedEffectDispositions: Object.freeze([]),
		basis: Object.freeze(["The exact Effect is fully accounted for."]),
		provenance: Object.freeze({ kind: "model", source: "phase:test" }),
	});
}

const phaseKinds = [
	"judgment-opening",
	"judgment-active",
	"action-proposal",
	"host-action-pending",
	"effect-assessment",
	"effect-remediation",
	"effect-remediation-required",
	"continuity",
	"completion-ready",
] as const satisfies readonly ActionLoopPhase["kind"][];
const allPhaseKindsCovered: Exclude<
	ActionLoopPhase["kind"],
	(typeof phaseKinds)[number]
> extends never
	? true
	: false = true;
type UnbrandedActionProposal = Pick<
	ActionLoopActionProposalPhase,
	Extract<keyof ActionLoopActionProposalPhase, string>
>;
const phaseBrandRequired: UnbrandedActionProposal extends ActionLoopPhase
	? false
	: true = true;

type RemovedControlAxis = Extract<
	keyof ActionLoopPhase,
	| "openJudgments"
	| "pendingActionClearances"
	| "effectPhase"
	| "intervention"
	| "claimAssurances"
>;
// @ts-expect-error No removed Cartesian control axis belongs to ActionLoopPhase.
const impossibleRemovedAxis: RemovedControlAxis = "openJudgments";
void impossibleRemovedAxis;

test("canonical control ownership has exactly nine discriminated phases", () => {
	assert.equal(allPhaseKindsCovered, true);
	assert.equal(phaseBrandRequired, true);
	assert.equal(new Set(phaseKinds).size, 9);
	const initial = initialActionLoopPhase(workCaseId);
	assert.equal(initial.kind, "judgment-opening");
	assert.equal(
		requiredActionLoopJudgmentCategory(initial),
		"Proportionate Intervention",
	);
	assert.equal(Object.isFrozen(initial), true);
	assert.equal(Object.keys(initial).includes("openJudgments"), false);
	assert.equal(Object.keys(initial).includes("effectPhase"), false);
});

test("removed Cartesian axes cannot construct a canonical phase", () => {
	const serialized = JSON.stringify(initialActionLoopPhase(workCaseId));
	assert.equal(serialized.includes("openJudgments"), false);
	assert.equal(serialized.includes("pendingActionClearances"), false);
	assert.equal(serialized.includes("claimAssurances"), false);
});

test("no-Action meaning selects only Assurance, continuity, or remediation", () => {
	const attained = intervention("attained", "no-action", "outcome-attained");
	const assuranceOpening = phaseAfterConclusions(workCaseId, [attained]);
	assert.equal(assuranceOpening.kind, "judgment-opening");
	if (assuranceOpening.kind !== "judgment-opening") return;
	assert.equal(
		requiredActionLoopJudgmentCategory(assuranceOpening),
		"Claim Assurance",
	);

	const blocked = phaseAfterConclusions(workCaseId, [
		intervention("blocked", "no-action", "blocked"),
	]);
	assert.deepEqual(
		{
			kind: blocked.kind,
			disposition: "disposition" in blocked ? blocked.disposition : undefined,
		},
		{ kind: "continuity", disposition: "blocked" },
	);

	const waiting = phaseAfterConclusions(workCaseId, [
		intervention("waiting", "no-action", "waiting"),
	]);
	assert.deepEqual(
		{
			kind: waiting.kind,
			disposition: "disposition" in waiting ? waiting.disposition : undefined,
		},
		{ kind: "continuity", disposition: "waiting" },
	);
});

test("Claim Assurance produces CompletionReady without independent count axes", () => {
	const attained = intervention("complete", "no-action", "outcome-attained");
	const assured = claimAssurance("complete");
	const completed = phaseAfterConclusions(workCaseId, [attained, assured]);
	assert.equal(completed.kind, "completion-ready");
	if (completed.kind !== "completion-ready") return;
	assert.equal(completed.intervention, attained);
	assert.equal(completed.claimAssurance, assured);
});

test("phase transitions carry exact Action, Effect, and remediation ownership", () => {
	const original = intervention("original", "action-required");
	const actionPhase = phaseAfterConclusions(workCaseId, [original]);
	assert.equal(actionPhase.kind, "action-proposal");
	const originalAction = actionArtifacts(original, "adverse");
	const cleared = clearActionLoopAction(
		actionPhase,
		originalAction.candidate,
		originalAction.clearance,
	);
	assert.equal(cleared.status, "transitioned");
	if (cleared.status !== "transitioned") return;
	assert.equal(cleared.value.kind, "host-action-pending");

	const adverseEffect = pendingEffect(
		originalAction.candidate,
		originalAction.clearance,
		"adverse",
	);
	const begun = beginActionLoopEffect(cleared.value, adverseEffect);
	assert.equal(begun.status, "transitioned");
	if (begun.status !== "transitioned") return;
	const adverse = settlement(adverseEffect, "partially-applied");
	const adverseOpening = settleActionLoopEffect(begun.value, adverse);
	assert.equal(adverseOpening.status, "transitioned");
	if (adverseOpening.status !== "transitioned") return;
	assert.equal(adverseOpening.value.kind, "judgment-opening");

	const repair = intervention("repair", "action-required");
	const repairActionPhase = advancePhaseWithConclusion(
		adverseOpening.value,
		repair,
	);
	const repairAction = actionArtifacts(repair, "repair");
	const repairCleared = clearActionLoopAction(
		repairActionPhase,
		repairAction.candidate,
		repairAction.clearance,
	);
	assert.equal(repairCleared.status, "transitioned");
	if (repairCleared.status !== "transitioned") return;
	const repairEffect = pendingEffect(
		repairAction.candidate,
		repairAction.clearance,
		"repair",
	);
	const repairBegun = beginActionLoopEffect(repairCleared.value, repairEffect);
	assert.equal(repairBegun.status, "transitioned");
	if (repairBegun.status !== "transitioned") return;
	const successful = settlement(repairEffect, "observed-success");
	const remediating = settleActionLoopEffect(repairBegun.value, successful);
	assert.equal(remediating.status, "transitioned");
	if (remediating.status !== "transitioned") return;
	assert.equal(remediating.value.kind, "effect-remediation");
	if (remediating.value.kind !== "effect-remediation") return;

	const remediation: EffectRemediation = Object.freeze({
		effectRemediationId: "remediation-adverse-repair",
		workCaseId,
		adverseEffectId: adverse.effectId,
		adverseEffectSettlementId: adverse.effectSettlementId,
		remediationEffectId: successful.effectId,
		remediationEffectSettlementId: successful.effectSettlementId,
		basis: Object.freeze(["The repair restores the exact adverse state."]),
		provenance: Object.freeze({ kind: "model", source: "phase:test" }),
	});
	const remediated = remediateActionLoopEffect(remediating.value, remediation);
	assert.equal(remediated.status, "transitioned");
	if (remediated.status !== "transitioned") return;
	assert.equal(remediated.value.kind, "judgment-opening");
});

test("out-of-phase transitions fail without manufacturing another phase", () => {
	const original = intervention("wrong-order", "action-required");
	const action = actionArtifacts(original, "wrong-order");
	const result = clearActionLoopAction(
		initialActionLoopPhase(workCaseId),
		action.candidate,
		action.clearance,
	);
	assert.deepEqual(result, {
		status: "invalid",
		error: {
			code: "phase-mismatch",
			message:
				"Action clearance requires action-proposal, received judgment-opening.",
		},
	});
});
