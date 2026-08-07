import type { ActionClearance } from "../src/action-loop/action/action-clearance.ts";
import {
	beginEffect,
	type PendingEffect,
} from "../src/action-loop/effect/begin-effect.ts";
import {
	acceptEffectObservation,
	type EffectObservation,
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
import { fingerprintPiToolResult } from "./action-loop-pi-action.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_SETTLE_EFFECT_TOOL = "developer_settle_effect";
export const ACTION_LOOP_RECORD_REMEDIATION_TOOL =
	"developer_record_effect_remediation";

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
	readonly details: unknown;
}

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
	return {
		status: recorded.status === "recorded" ? "begun" : "unchanged",
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
		effect: begun.value,
	};
}

/** Records a Pi tool result as evidence without inferring Effect settlement. */
export function observeLivePiToolResult(
	state: LiveWorkCaseState,
	toolName: string,
	occurrenceId: string,
	result: LivePiToolResult,
): LiveEffectObservationResult {
	const effect = state.workCase.effects.find(
		(current) => current.occurrenceId === occurrenceId,
	);
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
	const evidence = fingerprintPiToolResult(toolName, {
		isError: result.isError,
		content: result.content,
		details: result.details ?? null,
	});
	if (evidence.status === "invalid") return evidence;
	const accepted = acceptEffectObservation(effect, {
		workCaseId: state.workCase.workCaseId,
		effectId: effect.effectId,
		occurrenceId,
		evidence: {
			kind: "tool-result",
			locator: `pi-tool-result:${occurrenceId}`,
			fingerprint: evidence.fingerprint,
		},
		statement: result.isError
			? "Pi reported a tool execution error for the cleared Action occurrence."
			: "Pi returned from the cleared Action occurrence without reporting a tool execution error.",
		limitations: [
			"A Pi tool result does not by itself establish any intended Effect as successful.",
		],
		provenance: { kind: "tool", source: `pi:${toolName}:tool-result` },
	});
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const current = state.effectObservations.find(
		(observation) => observation.effectId === effect.effectId,
	);
	if (current !== undefined) {
		return current.effectObservationId === accepted.value.effectObservationId
			? { status: "unchanged", state, observation: current }
			: {
					status: "invalid",
					message: "A different Pi tool result Observation already exists for this Effect",
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

/** Accepts complete Effect accounting and records its current CAS assessment. */
export function settleLiveEffect(
	state: LiveWorkCaseState,
	effectId: string,
	proposal: LiveEffectSettlementProposal,
): LiveEffectSettlementResult {
	const effect = state.workCase.effects.find(
		(current) => current.effectId === effectId,
	);
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
	return {
		status:
			recorded.status === "unchanged" ? "unchanged" : settled.status,
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
		assessment:
			recorded.status === "unchanged" && current !== undefined
				? current
				: settled.value,
	};
}

/** Binds a current adverse settlement to a distinct current successful repair. */
export function recordLiveEffectRemediation(
	state: LiveWorkCaseState,
	adverseEffectId: string,
	remediationEffectId: string,
	basis: readonly string[],
): LiveEffectRemediationResult {
	const adverse = state.workCase.currentEffectAssessments.find(
		(assessment) => assessment.effectId === adverseEffectId,
	);
	const remediation = state.workCase.currentEffectAssessments.find(
		(assessment) => assessment.effectId === remediationEffectId,
	);
	if (
		adverse === undefined ||
		remediation === undefined ||
		!("effectSettlementId" in adverse) ||
		!("effectSettlementId" in remediation)
	) {
		return {
			status: "invalid",
			message: "Effect remediation requires two current settled Effect assessments",
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
	return {
		status: recorded.status,
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
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
