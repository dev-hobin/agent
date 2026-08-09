import type { SdkJudgmentCategory } from "./judgment-controller.ts";

export type ActionLoopEffectPhase =
	| "none"
	| "incomplete"
	| "settled-nonadverse"
	| "settled-adverse"
	| "settled-mixed";

export type ActionLoopInterventionState =
	| "absent"
	| "action-required"
	| "outcome-attained"
	| "blocked"
	| "waiting"
	| "invalid"
	| "multiple";

export interface ActionLoopTransitionFacts {
	readonly hasConclusions: boolean;
	readonly openJudgments: 0 | 1 | "many";
	readonly pendingActionClearances: 0 | 1 | "many";
	readonly effectPhase: ActionLoopEffectPhase;
	readonly intervention: ActionLoopInterventionState;
	readonly claimAssurances: 0 | 1 | "many";
}

export type ActionLoopTransitionDecision =
	| {
			readonly kind: "invariant-failure";
			readonly code:
				| "multiple-open-judgments"
				| "multiple-pending-action-clearances"
				| "multiple-claim-assurances"
				| "multiple-current-interventions"
				| "invalid-intervention-disposition"
				| "incoherent-control-state";
	  }
	| { readonly kind: "progress-open-judgment" }
	| {
			readonly kind: "open-judgment";
			readonly requiredCategory?: SdkJudgmentCategory;
	  }
	| { readonly kind: "ready-for-host-action" }
	| { readonly kind: "progress-effect" }
	| { readonly kind: "progress-remediation" }
	| { readonly kind: "remediation-required" }
	| { readonly kind: "propose-action" }
	| {
			readonly kind: "continuity-required";
			readonly disposition: "blocked" | "waiting";
	  }
	| { readonly kind: "ready-for-completion" };

function invariant(
	code: Extract<
		ActionLoopTransitionDecision,
		{ readonly kind: "invariant-failure" }
	>["code"],
): ActionLoopTransitionDecision {
	return Object.freeze({ kind: "invariant-failure", code });
}

function ownershipFailure(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision | undefined {
	if (facts.openJudgments === "many") {
		return invariant("multiple-open-judgments");
	}
	if (facts.pendingActionClearances === "many") {
		return invariant("multiple-pending-action-clearances");
	}
	if (facts.claimAssurances === "many") {
		return invariant("multiple-claim-assurances");
	}
	if (facts.intervention === "multiple") {
		return invariant("multiple-current-interventions");
	}
	if (facts.intervention === "invalid") {
		return invariant("invalid-intervention-disposition");
	}
	if (
		facts.claimAssurances === 1 &&
		facts.intervention !== "outcome-attained"
	) {
		return invariant("incoherent-control-state");
	}
	return undefined;
}

function openJudgmentDecision(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision {
	const adverseAttainment =
		facts.intervention === "outcome-attained" &&
		(facts.effectPhase === "settled-adverse" ||
			facts.effectPhase === "settled-mixed");
	if (
		facts.pendingActionClearances !== 0 ||
		facts.effectPhase === "incomplete" ||
		facts.claimAssurances !== 0 ||
		facts.intervention === "action-required" ||
		facts.intervention === "blocked" ||
		facts.intervention === "waiting" ||
		adverseAttainment
	) {
		return invariant("incoherent-control-state");
	}
	return Object.freeze({ kind: "progress-open-judgment" });
}

function pendingActionDecision(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision {
	if (
		!facts.hasConclusions ||
		facts.effectPhase === "incomplete" ||
		facts.intervention !== "absent" ||
		facts.claimAssurances !== 0
	) {
		return invariant("incoherent-control-state");
	}
	return Object.freeze({ kind: "ready-for-host-action" });
}

function initialDecision(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision {
	if (
		facts.effectPhase !== "none" ||
		facts.intervention !== "absent" ||
		facts.claimAssurances !== 0
	) {
		return invariant("incoherent-control-state");
	}
	return Object.freeze({ kind: "open-judgment" });
}

function incompleteEffectDecision(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision {
	if (facts.intervention !== "absent" || facts.claimAssurances !== 0) {
		return invariant("incoherent-control-state");
	}
	return Object.freeze({ kind: "progress-effect" });
}

function mixedEffectDecision(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision {
	if (facts.intervention !== "absent" || facts.claimAssurances !== 0) {
		return invariant("incoherent-control-state");
	}
	return Object.freeze({ kind: "progress-remediation" });
}

function interventionDecision(
	facts: ActionLoopTransitionFacts,
	adverse: boolean,
): ActionLoopTransitionDecision {
	switch (facts.intervention) {
		case "absent":
			return Object.freeze({
				kind: "open-judgment",
				requiredCategory: "Proportionate Intervention",
			});
		case "action-required":
			return Object.freeze({ kind: "propose-action" });
		case "blocked":
		case "waiting":
			return Object.freeze({
				kind: "continuity-required",
				disposition: facts.intervention,
			});
		case "outcome-attained":
			if (adverse) return Object.freeze({ kind: "remediation-required" });
			return facts.claimAssurances === 0
				? Object.freeze({
						kind: "open-judgment",
						requiredCategory: "Claim Assurance",
					})
				: Object.freeze({ kind: "ready-for-completion" });
		default:
			return invariant("incoherent-control-state");
	}
}

/**
 * Decides one canonical route from finite controller facts. Model-authored text
 * is deliberately absent: a proposal can only produce admitted facts or be
 * rejected before this policy is evaluated.
 */
export function decideActionLoopTransition(
	facts: ActionLoopTransitionFacts,
): ActionLoopTransitionDecision {
	const invalid = ownershipFailure(facts);
	if (invalid) return invalid;
	if (facts.openJudgments === 1) return openJudgmentDecision(facts);
	if (facts.pendingActionClearances === 1) {
		return pendingActionDecision(facts);
	}
	if (!facts.hasConclusions) return initialDecision(facts);
	if (facts.effectPhase === "incomplete") {
		return incompleteEffectDecision(facts);
	}
	if (facts.effectPhase === "settled-mixed") {
		return mixedEffectDecision(facts);
	}
	return interventionDecision(
		facts,
		facts.effectPhase === "settled-adverse",
	);
}
