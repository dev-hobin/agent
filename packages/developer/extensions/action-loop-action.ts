import {
	acceptActionCandidate,
	type ActionCandidate,
	type ActionCandidateProposal,
} from "../src/action-loop/action/accept-action-candidate.ts";
import {
	acceptActionClearance,
	CURRENT_ACTION_WARRANT_BASIS,
	type ActionClearance,
	type ActionClearanceAssessment,
	type ActionClearanceBlocker,
	type PermissionDecision,
} from "../src/action-loop/action/action-clearance.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { clearActionLoopAction } from "../src/action-loop/work/action-loop-phase.ts";
import {
	bindPiControlledAction,
	type ControlledPiToolName,
} from "./action-loop-pi-action.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export type LiveActionCandidateProposal = Omit<
	ActionCandidateProposal,
	"workCaseId" | "provenance"
>;

export interface LivePiActionCandidateProposal {
	readonly toolName: ControlledPiToolName;
	readonly toolInput: Readonly<Record<string, unknown>>;
	readonly summary: string;
	readonly intendedEffects: readonly string[];
	readonly requiredConclusionIds: readonly string[];
}

export type LiveActionCandidateResult =
	| {
			readonly status: "accepted" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly candidate: ActionCandidate;
	  }
	| { readonly status: "invalid"; readonly message: string };

export type LiveActionClearanceResult =
	| {
			readonly status: "cleared" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly clearance: ActionClearance;
	  }
	| {
			readonly status: "not-cleared";
			readonly state: LiveWorkCaseState;
			readonly assessment: ActionClearanceAssessment;
			readonly blockers: readonly ActionClearanceBlocker[];
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Records one exact Action Candidate without granting permission or clearance. */
export function acceptLiveActionCandidate(
	state: LiveWorkCaseState,
	proposal: LiveActionCandidateProposal,
): LiveActionCandidateResult {
	const accepted = acceptActionCandidate({
		...proposal,
		workCaseId: state.workCase.workCaseId,
		provenance: { kind: "model", source: "pi:tool-call" },
	});
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const recorded = recordWorkCaseActionCandidate(
		state.workCase,
		accepted.value,
	);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	return {
		status: recorded.status === "recorded" ? "accepted" : "unchanged",
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
		candidate: accepted.value,
	};
}

/** Derives rather than model-authors the exact Pi tool-call identity. */
export function acceptLivePiActionCandidate(
	state: LiveWorkCaseState,
	proposal: LivePiActionCandidateProposal,
): LiveActionCandidateResult {
	const controlledAction = bindPiControlledAction(
		proposal.toolName,
		proposal.toolInput,
	);
	if (controlledAction.status === "invalid") return controlledAction;
	const accepted = acceptLiveActionCandidate(state, {
		controlledAction: controlledAction.value,
		summary: proposal.summary,
		intendedEffects: proposal.intendedEffects,
		requiredConclusionIds: proposal.requiredConclusionIds,
	});
	if (accepted.status === "invalid") return accepted;
	const conflicting = state.piActionProposals.find(
		(candidate) =>
			candidate.actionCandidateId !== accepted.candidate.actionCandidateId,
	);
	if (conflicting) {
		return {
			status: "invalid",
			message:
				"A different cleared Pi Action remains unconsumed; execute or explicitly reset current ownership before proposing another.",
		};
	}
	const current = accepted.state.piActionProposals.find(
		(candidate) =>
			candidate.actionCandidateId === accepted.candidate.actionCandidateId,
	);
	return {
		...accepted,
		state:
			current !== undefined
				? accepted.state
				: Object.freeze({
						...accepted.state,
						piActionProposals: Object.freeze([
							...accepted.state.piActionProposals,
							Object.freeze({
								actionCandidateId: accepted.candidate.actionCandidateId,
								toolName: proposal.toolName,
								toolInput: Object.freeze({ ...proposal.toolInput }),
							}),
						]),
					}),
	};
}

/** Finds a current Clearance only for the exact observed Pi tool input. */
export function matchingLiveActionClearance(
	state: LiveWorkCaseState,
	toolName: string,
	toolInput: Readonly<Record<string, unknown>>,
): ActionClearance | undefined {
	if (state.phase.kind !== "host-action-pending") return undefined;
	const controlledAction = bindPiControlledAction(toolName, toolInput);
	if (controlledAction.status === "invalid") return undefined;
	const clearance = state.phase.actionClearance;
	return clearance.controlledAction.kind === controlledAction.value.kind &&
		clearance.controlledAction.fingerprint ===
			controlledAction.value.fingerprint
		? clearance
		: undefined;
}

/** Lists only the Pi built-in owned by the current host-Action phase. */
export function clearedLivePiToolNames(
	state: LiveWorkCaseState | undefined,
): readonly ControlledPiToolName[] {
	if (state?.phase.kind !== "host-action-pending") return [];
	const name = state.phase.actionClearance.controlledAction.kind.replace(
		"pi-tool-call:",
		"",
	);
	return name === "bash" || name === "edit" || name === "write"
		? Object.freeze([name])
		: [];
}

/** Applies an adapter-owned host Permission Decision to one recorded Candidate. */
export function assessLiveActionClearance(
	state: LiveWorkCaseState,
	actionCandidateId: string,
	permission: PermissionDecision,
): LiveActionClearanceResult {
	const candidate = state.workCase.actionCandidates.find(
		(current) => current.actionCandidateId === actionCandidateId,
	);
	if (candidate === undefined) {
		return {
			status: "invalid",
			message: `Action Candidate is not recorded in the current Work Case: ${actionCandidateId}`,
		};
	}
	const accepted = acceptActionClearance(
		candidate,
		state.workCase.conclusions,
		permission,
		{
			workCaseId: state.workCase.workCaseId,
			actionCandidateId,
			conclusionIds: candidate.requiredConclusionIds,
			warrantBasis: CURRENT_ACTION_WARRANT_BASIS,
			provenance: { kind: "external", source: permission.source },
		},
	);
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	if (accepted.status === "not-cleared") {
		return {
			status: "not-cleared",
			state,
			assessment: accepted.assessment,
			blockers: accepted.blockers,
		};
	}
	const recorded = recordWorkCaseActionClearance(
		state.workCase,
		accepted.value,
	);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	if (recorded.status === "unchanged") {
		return { status: "unchanged", state, clearance: accepted.value };
	}
	const transitioned = clearActionLoopAction(
		state.phase,
		candidate,
		accepted.value,
	);
	if (transitioned.status === "invalid") {
		return { status: "invalid", message: transitioned.error.message };
	}
	return {
		status: "cleared",
		state: Object.freeze({
			...state,
			phase: transitioned.value,
			workCase: recorded.value,
		}),
		clearance: accepted.value,
	};
}
