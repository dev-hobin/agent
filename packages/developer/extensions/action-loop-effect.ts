import type { ActionClearance } from "../src/action-loop/action/action-clearance.ts";
import {
	beginEffect,
	type PendingEffect,
} from "../src/action-loop/effect/begin-effect.ts";
import {
	acceptEffectObservation,
	type EffectObservation,
	type EffectObservationProposal,
} from "../src/action-loop/effect/effect-observation.ts";
import { acceptEffectRemediation } from "../src/action-loop/effect/accept-effect-remediation.ts";
import {
	settleEffect,
	type EffectSettlementProposal,
	type EffectSettlement,
	type UnsettledEffectAssessment,
} from "../src/action-loop/effect/effect-settlement.ts";
import {
	effectAssessmentId,
	recordWorkCaseEffectAssessment,
} from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffectRemediation } from "../src/action-loop/work/record-work-case-effect-remediation.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import {
	beginActionLoopEffect,
	remediateActionLoopEffect,
	settleActionLoopEffect,
} from "../src/action-loop/work/action-loop-phase.ts";
import { fingerprintPiToolResult } from "./action-loop-pi-action.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const MAX_LIVE_EFFECT_OBSERVATIONS_PER_EFFECT = 32;

export type LiveEffectBeginningResult =
	| {
			readonly status: "begun" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly effect: PendingEffect;
	  }
	| { readonly status: "invalid"; readonly message: string };

export interface LivePiToolResult {
	readonly isError: boolean;
	readonly content: readonly unknown[];
	readonly details?: unknown;
}

export interface LivePiToolEffectEvidence {
	readonly effectId: string;
	readonly toolName: string;
	readonly toolCallId: string;
	readonly result: LivePiToolResult;
}

export type LiveEffectObservationProposal = Omit<
	EffectObservationProposal,
	"workCaseId"
>;

export type LiveEffectObservationResult =
	| {
			readonly status: "observed" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly observation: EffectObservation;
	  }
	| { readonly status: "invalid"; readonly message: string };

export type LiveEffectSettlementProposal = Omit<
	EffectSettlementProposal,
	"workCaseId" | "effectId" | "provenance"
> & { readonly expectedCurrentAssessmentId?: string };

export type LiveEffectSettlementResult =
	| {
			readonly status: "settled" | "unsettled" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly assessment: EffectSettlement | UnsettledEffectAssessment;
	  }
	| { readonly status: "invalid"; readonly message: string };

export type LiveEffectRemediationResult =
	| {
			readonly status: "recorded" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly remediationId: string;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Begins one pending Effect only for an exact cleared Pi host occurrence. */
export function beginLiveActionEffect(
	state: LiveWorkCaseState,
	clearance: ActionClearance,
	occurrenceId: string,
): LiveEffectBeginningResult {
	const begun = beginEffect(clearance, {
		actionClearanceId: clearance.actionClearanceId,
		occurrenceId,
		controlledAction: clearance.controlledAction,
		source: "pi:tool-call",
	});
	if (begun.status === "invalid") {
		return { status: "invalid", message: begun.error.message };
	}
	const recorded = recordWorkCaseEffect(state.workCase, begun.value);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	if (recorded.status === "unchanged") {
		return { status: "unchanged", state, effect: begun.value };
	}
	const transitioned = beginActionLoopEffect(state.phase, begun.value);
	if (transitioned.status === "invalid") {
		return { status: "invalid", message: transitioned.error.message };
	}
	const piActionProposals = state.piActionProposals.filter(
		(proposal) => proposal.actionCandidateId !== clearance.actionCandidateId,
	);
	return {
		status: "begun",
		state: Object.freeze({
			...state,
			phase: transitioned.value,
			workCase: recorded.value,
			piActionProposals: Object.freeze(piActionProposals),
		}),
		effect: begun.value,
	};
}

/** Accepts one exact Effect Observation without inferring settlement. */
export function acceptLiveEffectObservation(
	state: LiveWorkCaseState,
	proposal: LiveEffectObservationProposal,
): LiveEffectObservationResult {
	const effect =
		state.phase.kind === "effect-assessment" &&
		state.phase.effect.effectId === proposal.effectId &&
		state.phase.effect.occurrenceId === proposal.occurrenceId
			? state.phase.effect
			: undefined;
	if (effect === undefined) {
		return {
			status: "invalid",
			message: `No pending Effect belongs to Observation occurrence: ${proposal.occurrenceId}`,
		};
	}
	const accepted = acceptEffectObservation(effect, {
		...proposal,
		workCaseId: state.workCase.workCaseId,
	});
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const current = state.effectObservations.find(
		(observation) =>
			observation.effectObservationId === accepted.value.effectObservationId ||
			(observation.effectId === effect.effectId &&
				observation.evidence.kind === accepted.value.evidence.kind &&
				observation.evidence.fingerprint ===
					accepted.value.evidence.fingerprint),
	);
	if (current !== undefined) {
		return { status: "unchanged", state, observation: current };
	}
	if (
		state.effectObservations.filter(
			(observation) => observation.effectId === effect.effectId,
		).length >= MAX_LIVE_EFFECT_OBSERVATIONS_PER_EFFECT
	) {
		return {
			status: "invalid",
			message: `Effect Observation inventory is capped at ${MAX_LIVE_EFFECT_OBSERVATIONS_PER_EFFECT} entries per Effect`,
		};
	}
	const effectObservations = Object.freeze(
		[...state.effectObservations, accepted.value].sort((left, right) =>
			left.effectObservationId.localeCompare(right.effectObservationId),
		),
	);
	return {
		status: "observed",
		state: Object.freeze({ ...state, effectObservations }),
		observation: accepted.value,
	};
}

/** Binds one exact finalized Pi result as evidence for a current Effect. */
export function observeLivePiToolResultForEffect(
	state: LiveWorkCaseState,
	input: LivePiToolEffectEvidence,
): LiveEffectObservationResult {
	const effect =
		state.phase.kind === "effect-assessment" &&
		state.phase.effect.effectId === input.effectId
			? state.phase.effect
			: undefined;
	if (effect === undefined) {
		return { status: "invalid", message: `Unknown Effect: ${input.effectId}` };
	}
	const evidence = fingerprintPiToolResult(input.toolName, {
		isError: input.result.isError,
		content: input.result.content,
		details: input.result.details ?? null,
	});
	if (evidence.status === "invalid") return evidence;
	return acceptLiveEffectObservation(state, {
		effectId: effect.effectId,
		occurrenceId: effect.occurrenceId,
		evidence: {
			kind: "tool-result",
			locator: `pi-tool-result:${input.toolCallId}`,
			fingerprint: evidence.fingerprint,
		},
		statement: `Pi finalized ${input.toolName} evidence with this exact canonical result: ${evidence.canonicalResult}`,
		limitations: [
			"Receipt of a finalized Pi tool result is not implicit Effect success; canonical settlement must interpret its exact content against every intended Effect.",
		],
		provenance: {
			kind: "tool",
			source: `pi:${input.toolName}:tool-result`,
		},
	});
}

/** Records the cleared Action result without inferring Effect settlement. */
export function observeLivePiToolResult(
	state: LiveWorkCaseState,
	toolName: string,
	occurrenceId: string,
	result: LivePiToolResult,
): LiveEffectObservationResult {
	const effect =
		state.phase.kind === "effect-assessment" &&
		state.phase.effect.occurrenceId === occurrenceId
			? state.phase.effect
			: undefined;
	if (effect === undefined) {
		return {
			status: "invalid",
			message: `No pending Effect belongs to Pi occurrence: ${occurrenceId}`,
		};
	}
	if (effect.controlledAction.kind !== `pi-tool-call:${toolName}`) {
		return {
			status: "invalid",
			message: "Pi tool result does not match the Effect controlled Action",
		};
	}
	return observeLivePiToolResultForEffect(state, {
		effectId: effect.effectId,
		toolName,
		toolCallId: occurrenceId,
		result,
	});
}

/** Accepts complete Effect accounting and records its current CAS assessment. */
export function settleLiveEffect(
	state: LiveWorkCaseState,
	effectId: string,
	proposal: LiveEffectSettlementProposal,
): LiveEffectSettlementResult {
	const effect =
		state.phase.kind === "effect-assessment" &&
		state.phase.effect.effectId === effectId
			? state.phase.effect
			: undefined;
	if (effect === undefined) {
		return {
			status: "invalid",
			message: `Effect is not recorded in the current Work Case: ${effectId}`,
		};
	}
	const current = state.workCase.currentEffectAssessments.find(
		(assessment) => assessment.effectId === effectId,
	);
	if (
		current !== undefined &&
		proposal.expectedCurrentAssessmentId === undefined
	) {
		return {
			status: "invalid",
			message:
				"expectedCurrentAssessmentId is required to replace the current Effect assessment",
		};
	}
	const settled = settleEffect(
		effect,
		state.effectObservations.filter(
			(observation) => observation.effectId === effectId,
		),
		{
			workCaseId: state.workCase.workCaseId,
			effectId,
			outcome: proposal.outcome,
			observationDispositions: proposal.observationDispositions,
			intendedEffectDispositions: proposal.intendedEffectDispositions,
			basis: proposal.basis,
			provenance: { kind: "model", source: "pi:tool-call" },
		},
	);
	if (settled.status === "invalid") {
		return { status: "invalid", message: settled.error.message };
	}
	const recorded = recordWorkCaseEffectAssessment(
		state.workCase,
		settled.value,
		proposal.expectedCurrentAssessmentId ?? null,
	);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	if (recorded.status === "unchanged") {
		return {
			status: "unchanged",
			state,
			assessment: current ?? settled.value,
		};
	}
	const transitioned = settleActionLoopEffect(state.phase, settled.value);
	if (transitioned.status === "invalid") {
		return { status: "invalid", message: transitioned.error.message };
	}
	return {
		status: settled.status,
		state: Object.freeze({
			...state,
			phase: transitioned.value,
			workCase: recorded.value,
		}),
		assessment: settled.value,
	};
}

/** Binds a current adverse settlement to a distinct current successful repair. */
export function recordLiveEffectRemediation(
	state: LiveWorkCaseState,
	adverseEffectId: string,
	remediationEffectId: string,
	basis: readonly string[],
): LiveEffectRemediationResult {
	const adverse =
		state.phase.kind === "effect-remediation"
			? state.phase.adverseSettlements.find(
					(settlement) => settlement.effectId === adverseEffectId,
				)
			: undefined;
	const remediation =
		state.phase.kind === "effect-remediation"
			? state.phase.successfulSettlements.find(
					(settlement) => settlement.effectId === remediationEffectId,
				)
			: undefined;
	if (adverse === undefined || remediation === undefined) {
		return {
			status: "invalid",
			message:
				"Effect remediation requires two current settled Effect assessments",
		};
	}
	const accepted = acceptEffectRemediation(adverse, remediation, {
		workCaseId: state.workCase.workCaseId,
		adverseEffectId,
		adverseEffectSettlementId: adverse.effectSettlementId,
		remediationEffectId,
		remediationEffectSettlementId: remediation.effectSettlementId,
		basis,
		provenance: { kind: "model", source: "pi:tool-call" },
	});
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const recorded = recordWorkCaseEffectRemediation(
		state.workCase,
		accepted.value,
	);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	if (recorded.status === "unchanged") {
		return {
			status: "unchanged",
			state,
			remediationId: accepted.value.effectRemediationId,
		};
	}
	const transitioned = remediateActionLoopEffect(state.phase, accepted.value);
	if (transitioned.status === "invalid") {
		return { status: "invalid", message: transitioned.error.message };
	}
	return {
		status: "recorded",
		state: Object.freeze({
			...state,
			phase: transitioned.value,
			workCase: recorded.value,
		}),
		remediationId: accepted.value.effectRemediationId,
	};
}

export function currentLiveEffectAssessmentId(
	state: LiveWorkCaseState,
	effectId: string,
): string | undefined {
	const current = state.workCase.currentEffectAssessments.find(
		(assessment) => assessment.effectId === effectId,
	);
	return current === undefined ? undefined : effectAssessmentId(current);
}
