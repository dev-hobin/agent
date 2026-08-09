import type { ActionCandidate } from "../action/accept-action-candidate.ts";
import type { ActionClearance } from "../action/action-clearance.ts";
import type { PendingEffect } from "../effect/begin-effect.ts";
import type { EffectRemediation } from "../effect/accept-effect-remediation.ts";
import type {
	EffectSettlement,
	UnsettledEffectAssessment,
} from "../effect/effect-settlement.ts";
import type {
	JudgmentCategory,
	JudgmentConclusion,
	NoActionDisposition,
} from "../judgment/close-judgment.ts";
import type { OpenJudgment } from "../judgment/open-judgment.ts";

const ACTION_LOOP_PHASE = Symbol("developer.action-loop.phase");

type ActionLoopPhaseBrand = {
	readonly [ACTION_LOOP_PHASE]: true;
};

type InterventionPurpose = {
	readonly kind: "proportionate-intervention";
	readonly adverseSettlements: readonly EffectSettlement[];
};

type ClaimAssurancePurpose = {
	readonly kind: "claim-assurance";
	readonly intervention: JudgmentConclusion;
};

export type ActionLoopJudgmentPurpose =
	| InterventionPurpose
	| ClaimAssurancePurpose;

type Phase<T> = Readonly<T> &
	ActionLoopPhaseBrand & {
		readonly workCaseId: string;
	};

export type ActionLoopJudgmentOpeningPhase = Phase<{
	readonly kind: "judgment-opening";
	readonly purpose: ActionLoopJudgmentPurpose;
}>;

export type ActionLoopJudgmentActivePhase = Phase<{
	readonly kind: "judgment-active";
	readonly purpose: ActionLoopJudgmentPurpose;
	readonly judgment: OpenJudgment;
}>;

export type ActionLoopActionProposalPhase = Phase<{
	readonly kind: "action-proposal";
	readonly intervention: JudgmentConclusion;
	readonly adverseSettlements: readonly EffectSettlement[];
}>;

export type ActionLoopHostActionPendingPhase = Phase<{
	readonly kind: "host-action-pending";
	readonly intervention: JudgmentConclusion;
	readonly actionCandidate: ActionCandidate;
	readonly actionClearance: ActionClearance;
	readonly adverseSettlements: readonly EffectSettlement[];
}>;

export type ActionLoopEffectAssessmentPhase = Phase<{
	readonly kind: "effect-assessment";
	readonly effect: PendingEffect;
	readonly adverseSettlements: readonly EffectSettlement[];
}>;

export type ActionLoopEffectRemediationPhase = Phase<{
	readonly kind: "effect-remediation";
	readonly adverseSettlements: readonly [
		EffectSettlement,
		...EffectSettlement[],
	];
	readonly successfulSettlements: readonly [
		EffectSettlement,
		...EffectSettlement[],
	];
}>;

export type ActionLoopEffectRemediationRequiredPhase = Phase<{
	readonly kind: "effect-remediation-required";
	readonly intervention: JudgmentConclusion;
	readonly adverseSettlements: readonly [
		EffectSettlement,
		...EffectSettlement[],
	];
}>;

export type ActionLoopContinuityPhase = Phase<{
	readonly kind: "continuity";
	readonly disposition: Exclude<NoActionDisposition, "outcome-attained">;
	readonly intervention: JudgmentConclusion;
	readonly adverseSettlements: readonly EffectSettlement[];
}>;

export type ActionLoopCompletionReadyPhase = Phase<{
	readonly kind: "completion-ready";
	readonly intervention: JudgmentConclusion;
	readonly claimAssurance: JudgmentConclusion;
}>;

/**
 * Canonical control ownership. The former independent Boolean/count axes do not
 * occur in this type, so their invalid Cartesian combinations cannot be built.
 */
export type ActionLoopPhase =
	| ActionLoopJudgmentOpeningPhase
	| ActionLoopJudgmentActivePhase
	| ActionLoopActionProposalPhase
	| ActionLoopHostActionPendingPhase
	| ActionLoopEffectAssessmentPhase
	| ActionLoopEffectRemediationPhase
	| ActionLoopEffectRemediationRequiredPhase
	| ActionLoopContinuityPhase
	| ActionLoopCompletionReadyPhase;

export type ActionLoopPhaseTransitionErrorCode =
	| "phase-mismatch"
	| "work-case-mismatch"
	| "judgment-purpose-mismatch"
	| "judgment-identity-mismatch"
	| "intervention-disposition-mismatch"
	| "action-candidate-mismatch"
	| "action-clearance-mismatch"
	| "effect-identity-mismatch"
	| "effect-remediation-mismatch";

export type ActionLoopPhaseTransitionResult<
	T extends ActionLoopPhase = ActionLoopPhase,
> =
	| { readonly status: "transitioned"; readonly value: T }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code: ActionLoopPhaseTransitionErrorCode;
				readonly message: string;
			};
	  };

function invalid<T extends ActionLoopPhase>(
	code: ActionLoopPhaseTransitionErrorCode,
	message: string,
): ActionLoopPhaseTransitionResult<T> {
	return Object.freeze({
		status: "invalid",
		error: Object.freeze({ code, message }),
	});
}

function phase<const T extends object>(
	workCaseId: string,
	value: T,
): Phase<T> {
	const branded = { ...value, workCaseId } as T &
		Record<typeof ACTION_LOOP_PHASE, true> & { readonly workCaseId: string };
	Object.defineProperty(branded, ACTION_LOOP_PHASE, {
		value: true,
		enumerable: false,
		writable: false,
		configurable: false,
	});
	return Object.freeze(branded);
}

function frozenSettlements(
	settlements: readonly EffectSettlement[],
): readonly EffectSettlement[] {
	return Object.freeze([...settlements]);
}

function interventionPurpose(
	adverseSettlements: readonly EffectSettlement[],
): InterventionPurpose {
	return Object.freeze({
		kind: "proportionate-intervention",
		adverseSettlements: frozenSettlements(adverseSettlements),
	});
}

function claimAssurancePurpose(
	intervention: JudgmentConclusion,
): ClaimAssurancePurpose {
	return Object.freeze({ kind: "claim-assurance", intervention });
}

function judgmentOpening(
	workCaseId: string,
	purpose: ActionLoopJudgmentPurpose,
): ActionLoopJudgmentOpeningPhase {
	return phase(workCaseId, { kind: "judgment-opening", purpose });
}

function uniqueSettlements(
	settlements: readonly EffectSettlement[],
): readonly EffectSettlement[] {
	const byEffectId = new Map<string, EffectSettlement>();
	for (const settlement of settlements) {
		byEffectId.set(settlement.effectId, settlement);
	}
	return frozenSettlements([...byEffectId.values()]);
}

function nonEmptySettlements(
	settlements: readonly EffectSettlement[],
): readonly [EffectSettlement, ...EffectSettlement[]] | undefined {
	const unique = uniqueSettlements(settlements);
	const [first, ...rest] = unique;
	return first ? Object.freeze([first, ...rest]) : undefined;
}

export function initialActionLoopPhase(
	workCaseId: string,
): ActionLoopJudgmentOpeningPhase {
	return judgmentOpening(workCaseId, interventionPurpose([]));
}

export function requiredActionLoopJudgmentCategory(
	value: ActionLoopJudgmentOpeningPhase,
): Extract<JudgmentCategory, "Proportionate Intervention" | "Claim Assurance"> {
	return value.purpose.kind === "proportionate-intervention"
		? "Proportionate Intervention"
		: "Claim Assurance";
}

function activateJudgment(
	current: ActionLoopJudgmentOpeningPhase,
	purpose: ActionLoopJudgmentPurpose,
	judgment: OpenJudgment,
): ActionLoopPhaseTransitionResult<ActionLoopJudgmentActivePhase> {
	return Object.freeze({
		status: "transitioned",
		value: phase(current.workCaseId, {
			kind: "judgment-active",
			purpose,
			judgment,
		}),
	});
}

export function openActionLoopJudgment(
	current: ActionLoopPhase,
	judgment: OpenJudgment,
): ActionLoopPhaseTransitionResult<ActionLoopJudgmentActivePhase> {
	if (current.kind !== "judgment-opening") {
		return invalid(
			"phase-mismatch",
			`Judgment opening requires judgment-opening, received ${current.kind}.`,
		);
	}
	if (judgment.workCaseId !== current.workCaseId) {
		return invalid(
			"work-case-mismatch",
			"Opened Judgment does not belong to the current Work Case.",
		);
	}
	if (judgment.category !== requiredActionLoopJudgmentCategory(current)) {
		return invalid(
			"judgment-purpose-mismatch",
			"Opened Judgment category does not match canonical phase purpose.",
		);
	}
	return activateJudgment(current, current.purpose, judgment);
}

export function concludeActionLoopJudgment(
	current: ActionLoopPhase,
	conclusion: JudgmentConclusion,
): ActionLoopPhaseTransitionResult {
	if (current.kind !== "judgment-active") {
		return invalid(
			"phase-mismatch",
			`Judgment conclusion requires judgment-active, received ${current.kind}.`,
		);
	}
	if (conclusion.workCaseId !== current.workCaseId) {
		return invalid(
			"work-case-mismatch",
			"Judgment Conclusion does not belong to the current Work Case.",
		);
	}
	if (
		conclusion.judgmentId !== current.judgment.judgmentId ||
		conclusion.category !== current.judgment.category
	) {
		return invalid(
			"judgment-identity-mismatch",
			"Judgment Conclusion does not close the phase-owned Judgment.",
		);
	}
	if (current.purpose.kind === "claim-assurance") {
		if (
			conclusion.category !== "Claim Assurance" ||
			conclusion.interventionDisposition !== undefined ||
			conclusion.noActionDisposition !== undefined
		) {
			return invalid(
				"judgment-purpose-mismatch",
				"Claim Assurance purpose requires a Claim Assurance Conclusion.",
			);
		}
		return Object.freeze({
			status: "transitioned",
			value: phase(current.workCaseId, {
				kind: "completion-ready",
				intervention: current.purpose.intervention,
				claimAssurance: conclusion,
			}),
		});
	}
	if (
		conclusion.category !== "Proportionate Intervention" ||
		conclusion.interventionDisposition === undefined
	) {
		return invalid(
			"judgment-purpose-mismatch",
			"Intervention purpose requires a Proportionate Intervention Conclusion.",
		);
	}
	const adverseSettlements = current.purpose.adverseSettlements;
	if (conclusion.interventionDisposition === "action-required") {
		if (conclusion.noActionDisposition !== undefined) {
			return invalid(
				"intervention-disposition-mismatch",
				"An action-required Intervention cannot carry a no-Action disposition.",
			);
		}
		return Object.freeze({
			status: "transitioned",
			value: phase(current.workCaseId, {
				kind: "action-proposal",
				intervention: conclusion,
				adverseSettlements: frozenSettlements(adverseSettlements),
			}),
		});
	}
	const noActionDisposition = conclusion.noActionDisposition;
	if (noActionDisposition === undefined) {
		return invalid(
			"intervention-disposition-mismatch",
			"A no-Action Intervention requires an explicit disposition.",
		);
	}
	if (noActionDisposition === "blocked" || noActionDisposition === "waiting") {
		return Object.freeze({
			status: "transitioned",
			value: phase(current.workCaseId, {
				kind: "continuity",
				disposition: noActionDisposition,
				intervention: conclusion,
				adverseSettlements: frozenSettlements(adverseSettlements),
			}),
		});
	}
	const adverse = nonEmptySettlements(adverseSettlements);
	if (adverse) {
		return Object.freeze({
			status: "transitioned",
			value: phase(current.workCaseId, {
				kind: "effect-remediation-required",
				intervention: conclusion,
				adverseSettlements: adverse,
			}),
		});
	}
	return Object.freeze({
		status: "transitioned",
		value: judgmentOpening(
			current.workCaseId,
			claimAssurancePurpose(conclusion),
		),
	});
}

export function clearActionLoopAction(
	current: ActionLoopPhase,
	actionCandidate: ActionCandidate,
	actionClearance: ActionClearance,
): ActionLoopPhaseTransitionResult<ActionLoopHostActionPendingPhase> {
	if (current.kind !== "action-proposal") {
		return invalid(
			"phase-mismatch",
			`Action clearance requires action-proposal, received ${current.kind}.`,
		);
	}
	if (
		actionCandidate.workCaseId !== current.workCaseId ||
		actionClearance.workCaseId !== current.workCaseId
	) {
		return invalid(
			"work-case-mismatch",
			"Action Candidate or Clearance does not belong to the current Work Case.",
		);
	}
	if (
		!actionCandidate.requiredConclusionIds.includes(
			current.intervention.conclusionId,
		)
	) {
		return invalid(
			"action-candidate-mismatch",
			"Action Candidate does not consume the phase-owned Intervention.",
		);
	}
	if (
		actionClearance.actionCandidateId !== actionCandidate.actionCandidateId ||
		!actionClearance.conclusionIds.includes(current.intervention.conclusionId)
	) {
		return invalid(
			"action-clearance-mismatch",
			"Action Clearance does not authorize the phase-owned Candidate and Intervention.",
		);
	}
	return Object.freeze({
		status: "transitioned",
		value: phase(current.workCaseId, {
			kind: "host-action-pending",
			intervention: current.intervention,
			actionCandidate,
			actionClearance,
			adverseSettlements: frozenSettlements(current.adverseSettlements),
		}),
	});
}

export function beginActionLoopEffect(
	current: ActionLoopPhase,
	effect: PendingEffect,
): ActionLoopPhaseTransitionResult<ActionLoopEffectAssessmentPhase> {
	if (current.kind !== "host-action-pending") {
		return invalid(
			"phase-mismatch",
			`Effect beginning requires host-action-pending, received ${current.kind}.`,
		);
	}
	if (effect.workCaseId !== current.workCaseId) {
		return invalid(
			"work-case-mismatch",
			"Effect does not belong to the current Work Case.",
		);
	}
	if (
		effect.actionCandidateId !== current.actionCandidate.actionCandidateId ||
		effect.actionClearanceId !== current.actionClearance.actionClearanceId
	) {
		return invalid(
			"effect-identity-mismatch",
			"Effect does not account for the phase-owned host Action.",
		);
	}
	return Object.freeze({
		status: "transitioned",
		value: phase(current.workCaseId, {
			kind: "effect-assessment",
			effect,
			adverseSettlements: frozenSettlements(current.adverseSettlements),
		}),
	});
}

export function settleActionLoopEffect(
	current: ActionLoopPhase,
	assessment: EffectSettlement | UnsettledEffectAssessment,
): ActionLoopPhaseTransitionResult {
	if (current.kind !== "effect-assessment") {
		return invalid(
			"phase-mismatch",
			`Effect settlement requires effect-assessment, received ${current.kind}.`,
		);
	}
	if (
		assessment.workCaseId !== current.workCaseId ||
		assessment.effectId !== current.effect.effectId
	) {
		return invalid(
			"effect-identity-mismatch",
			"Effect assessment does not account for the phase-owned Effect.",
		);
	}
	if (!("effectSettlementId" in assessment)) {
		return Object.freeze({ status: "transitioned", value: current });
	}
	if (
		assessment.outcome === "failed" ||
		assessment.outcome === "partially-applied"
	) {
		return Object.freeze({
			status: "transitioned",
			value: judgmentOpening(
				current.workCaseId,
				interventionPurpose(
					uniqueSettlements([...current.adverseSettlements, assessment]),
				),
			),
		});
	}
	const adverse = nonEmptySettlements(current.adverseSettlements);
	if (assessment.outcome === "observed-success" && adverse) {
		return Object.freeze({
			status: "transitioned",
			value: phase(current.workCaseId, {
				kind: "effect-remediation",
				adverseSettlements: adverse,
				successfulSettlements: Object.freeze([assessment] as const),
			}),
		});
	}
	return Object.freeze({
		status: "transitioned",
		value: judgmentOpening(
			current.workCaseId,
			interventionPurpose(current.adverseSettlements),
		),
	});
}

export function remediateActionLoopEffect(
	current: ActionLoopPhase,
	remediation: EffectRemediation,
): ActionLoopPhaseTransitionResult {
	if (current.kind !== "effect-remediation") {
		return invalid(
			"phase-mismatch",
			`Effect remediation requires effect-remediation, received ${current.kind}.`,
		);
	}
	if (remediation.workCaseId !== current.workCaseId) {
		return invalid(
			"work-case-mismatch",
			"Effect Remediation does not belong to the current Work Case.",
		);
	}
	const adverse = current.adverseSettlements.find(
		(settlement) =>
			settlement.effectId === remediation.adverseEffectId &&
			settlement.effectSettlementId ===
				remediation.adverseEffectSettlementId,
	);
	const successful = current.successfulSettlements.find(
		(settlement) =>
			settlement.effectId === remediation.remediationEffectId &&
			settlement.effectSettlementId ===
				remediation.remediationEffectSettlementId,
	);
	if (!adverse || !successful) {
		return invalid(
			"effect-remediation-mismatch",
			"Effect Remediation does not bind phase-owned adverse and successful settlements.",
		);
	}
	const remainingAdverse = current.adverseSettlements.filter(
		(settlement) => settlement.effectId !== adverse.effectId,
	);
	const remainingSuccessful = current.successfulSettlements.filter(
		(settlement) => settlement.effectId !== successful.effectId,
	);
	const adverseTuple = nonEmptySettlements(remainingAdverse);
	const successfulTuple = nonEmptySettlements(remainingSuccessful);
	if (adverseTuple && successfulTuple) {
		return Object.freeze({
			status: "transitioned",
			value: phase(current.workCaseId, {
				kind: "effect-remediation",
				adverseSettlements: adverseTuple,
				successfulSettlements: successfulTuple,
			}),
		});
	}
	return Object.freeze({
		status: "transitioned",
		value: judgmentOpening(
			current.workCaseId,
			interventionPurpose(remainingAdverse),
		),
	});
}
