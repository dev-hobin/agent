import type {
	SdkActionCandidateResult,
	SdkControlledActionAdapter,
} from "../src/action-loop/sdk/action-controller.ts";
import {
	progressActionLoopWithSdk,
	type SdkActionLoopCheckpoint,
	type SdkActionLoopProgressionResult,
} from "../src/action-loop/sdk/action-loop-progression-controller.ts";
import type { PermissionDecision } from "../src/action-loop/action/action-clearance.ts";
import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import { recordWorkCaseEffectAssessment } from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffectRemediation } from "../src/action-loop/work/record-work-case-effect-remediation.ts";
import type { SdkNamedCapability } from "../src/action-loop/sdk/capability-inventory-controller.ts";
import type { SdkDecisionRunner } from "../src/action-loop/sdk/decision-controller.ts";
import {
	progressJudgmentWithSdk,
	type SdkJudgmentCheckpoint,
	type SdkJudgmentProgressionResult,
} from "../src/action-loop/sdk/judgment-progression-controller.ts";
import {
	acceptLivePiActionCandidate,
	assessLiveActionClearance,
} from "./action-loop-action.ts";
import type { LiveCapabilityInventory } from "./action-loop-capability-inventory.ts";
import {
	sdkActionClearedEvent,
	sdkEffectRemediatedEvent,
	sdkEffectSettledEvent,
	sdkJudgmentCheckpointEvent,
	sdkJudgmentOpenedEvent,
	sdkWorkCaseCompletedEvent,
	sdkWorkCaseOpenedEvent,
	type SdkJudgmentCheckpointSessionEvent,
} from "./action-loop-sdk-session.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL =
	"developer_progress_action_loop_with_sdk";

export type SdkActionLoopCheckpointSessionEvent =
	| ReturnType<typeof sdkWorkCaseOpenedEvent>
	| ReturnType<typeof sdkJudgmentOpenedEvent>
	| ReturnType<typeof sdkActionClearedEvent>
	| ReturnType<typeof sdkEffectSettledEvent>
	| ReturnType<typeof sdkEffectRemediatedEvent>
	| ReturnType<typeof sdkWorkCaseCompletedEvent>
	| SdkJudgmentCheckpointSessionEvent;

export interface LiveSdkActionLoopProgressionInput {
	readonly request: string;
	readonly state?: LiveWorkCaseState;
	readonly inventory: Pick<
		LiveCapabilityInventory,
		"boundCapabilitiesBySkillName"
	>;
	readonly runner: SdkDecisionRunner;
	readonly complete?: boolean;
	readonly actions?: readonly SdkControlledActionAdapter[];
	readonly authorizeAction?: (
		action: Extract<SdkActionCandidateResult, { readonly status: "accepted" }>,
	) => Promise<PermissionDecision> | PermissionDecision;
	readonly maxSteps: number;
	readonly appendCheckpoint: (
		event: SdkActionLoopCheckpointSessionEvent,
	) => Promise<void> | void;
}

export interface LiveSdkActionLoopProgressionResult {
	readonly result: SdkActionLoopProgressionResult;
	readonly state?: LiveWorkCaseState;
	readonly completedWorkCase?: CompletedWorkCase;
}

export interface LiveSdkJudgmentProgressionInput {
	readonly request: string;
	readonly state: LiveWorkCaseState;
	readonly inventory: Pick<
		LiveCapabilityInventory,
		"boundCapabilitiesBySkillName"
	>;
	readonly runner: SdkDecisionRunner;
	readonly maxSteps: number;
	readonly appendCheckpoint: (
		event: SdkJudgmentCheckpointSessionEvent,
	) => Promise<void> | void;
}

export interface LiveSdkJudgmentProgressionResult {
	readonly result: SdkJudgmentProgressionResult;
	readonly state: LiveWorkCaseState;
}

export function sdkActionLoopProgressionFailure(
	result: SdkActionLoopProgressionResult,
): string | undefined {
	switch (result.status) {
		case "runtime-failure":
		case "invariant-failure":
		case "checkpoint-failure":
			return `SDK Action Loop progression stopped at ${result.stage}: ${result.message}`;
		default:
			return undefined;
	}
}

export function sdkActionLoopProgressionSummary(
	result: SdkActionLoopProgressionResult,
): string {
	switch (result.status) {
		case "ready-for-action":
			return "The current Work Case has acknowledged Conclusions and is ready for Action progression.";
		case "ready-for-host-action":
			return "One exact controlled Action is cleared for the Pi host.";
		case "effect-pending":
			return "The current controlled Action has begun Effect accounting and must be observed before settlement.";
		case "effect-settled":
			return `The current Effect was canonically settled as ${result.outcome}.`;
		case "effect-unsettled":
			return `The current Effect remains ${result.outcome}. Gather one new exact finalized host Observation with an observational tool before progressing again; repeating without new Effect evidence cannot advance.`;
		case "effect-remediated":
			return "One current adverse Effect was bound to an exact observed-success remediation.";
		case "remediation-required":
			return "A current adverse Effect still requires a proportionate remediation or an explicit hold.";
		case "ready-for-completion":
			return "Every current Effect has a settled assessment; the Work Case is ready for completion progression.";
		case "completion-not-ready":
			return "The complete current Closure Target remains blocked.";
		case "completed":
			return "The current Work Case was completed after revision-bound closure revalidation.";
		case "action-not-cleared":
			return "Host permission or current canonical warrants did not clear the proposed Action.";
		case "judgment-concluded":
			return "The SDK controller opened and concluded the current Judgment from acknowledged checkpoints.";
		case "needs-context":
			return "The current Judgment needs additional Context before progression can continue.";
		case "judgment-refused": {
			const blockerCodes = [
				...new Set(result.refusal.blockers.map((blocker) => blocker.code)),
			];
			return `The current evidence canonically refused Judgment closure (${blockerCodes.join(", ")}). Repeating progression without new accepted evidence cannot advance.`;
		}
		case "bounded-stop":
			return `SDK Action Loop progression reached a bounded stop at ${result.stage}; acknowledged checkpoints are preserved.`;
		default:
			return "SDK Action Loop progression did not advance.";
	}
}

export function sdkJudgmentProgressionFailure(
	result: SdkJudgmentProgressionResult,
): string | undefined {
	switch (result.status) {
		case "runtime-failure":
		case "invariant-failure":
		case "checkpoint-failure":
			return `SDK Judgment progression stopped at ${result.stage}: ${result.message}`;
		default:
			return undefined;
	}
}

export function sdkJudgmentProgressionSummary(
	result: SdkJudgmentProgressionResult,
): string {
	switch (result.status) {
		case "concluded":
			return "The current Judgment was concluded from complete acknowledged Coverage.";
		case "needs-context":
			return "The current Judgment needs additional Context before progression can continue.";
		case "refused":
			return "The current evidence canonically refused Judgment closure.";
		case "bounded-stop":
			return `SDK Judgment progression reached a bounded stop at ${result.stage}; acknowledged checkpoints are preserved.`;
		default:
			return "SDK Judgment progression did not advance.";
	}
}

function appendUniqueBy<T>(
	values: readonly T[],
	value: T,
	identity: (candidate: T) => string,
): readonly T[] {
	const valueId = identity(value);
	const existing = values.find((candidate) => identity(candidate) === valueId);
	if (existing !== undefined) {
		if (existing !== value) {
			throw new Error(`SDK checkpoint identity ${valueId} already exists.`);
		}
		return values;
	}
	return Object.freeze([...values, value]);
}

export function sdkActionLoopCheckpointEvent(
	checkpoint: SdkActionLoopCheckpoint,
): SdkActionLoopCheckpointSessionEvent {
	switch (checkpoint.kind) {
		case "work-case-completed":
			return sdkWorkCaseCompletedEvent(checkpoint.result);
		case "work-case-opened":
			return sdkWorkCaseOpenedEvent(checkpoint.result);
		case "judgment-opened":
			return sdkJudgmentOpenedEvent(checkpoint.result);
		case "effect-settled":
			return sdkEffectSettledEvent({
				result: checkpoint.result,
				revisionId: checkpoint.workCase.revisionId,
				...(checkpoint.expectedCurrentAssessmentId
					? {
							expectedCurrentAssessmentId:
								checkpoint.expectedCurrentAssessmentId,
						}
					: {}),
			});
		case "effect-remediated":
			return sdkEffectRemediatedEvent({
				result: checkpoint.result,
				revisionId: checkpoint.workCase.revisionId,
			});
		case "action-cleared":
			return sdkActionClearedEvent({
				action: checkpoint.action,
				clearance: checkpoint.clearance,
				revisionId: checkpoint.workCase.revisionId,
			});
		default:
			return sdkJudgmentCheckpointEvent(checkpoint);
	}
}

export function applySdkActionLoopCheckpoint(
	state: LiveWorkCaseState | undefined,
	checkpoint: SdkActionLoopCheckpoint,
): LiveWorkCaseState {
	switch (checkpoint.kind) {
		case "work-case-completed":
			throw new Error(
				"SDK Work Case completion must be applied as a terminal projection.",
			);
		case "work-case-opened":
			if (state)
				throw new Error("SDK Work Case opening cannot replace active work.");
			return Object.freeze({
				workCase: checkpoint.result.workCase,
				contextRevisionId: checkpoint.result.workCase.revisionId,
				openingBasis: checkpoint.result.basis,
				applicabilityAssessments: Object.freeze([]),
				capabilityAssignments: Object.freeze([]),
				referenceSelections: Object.freeze([]),
				sealedSkillContexts: Object.freeze([]),
				contributions: Object.freeze([]),
				needCoverages: Object.freeze([]),
				piActionProposals: Object.freeze([]),
				effectObservations: Object.freeze([]),
			});
		case "judgment-opened":
			if (!state) throw new Error("SDK Judgment opening requires active work.");
			return Object.freeze({ ...state, workCase: checkpoint.result.workCase });
		case "effect-settled": {
			if (!state)
				throw new Error("SDK Effect settlement requires active work.");
			const assessment =
				checkpoint.result.status === "settled"
					? checkpoint.result.settlement
					: checkpoint.result.assessment;
			const recorded = recordWorkCaseEffectAssessment(
				state.workCase,
				assessment,
				checkpoint.expectedCurrentAssessmentId ?? null,
			);
			if (recorded.status === "invalid") {
				throw new Error(recorded.error.message);
			}
			if (recorded.value.revisionId !== checkpoint.workCase.revisionId) {
				throw new Error("SDK Effect checkpoint identity drifted.");
			}
			return Object.freeze({ ...state, workCase: recorded.value });
		}
		case "effect-remediated": {
			if (!state)
				throw new Error("SDK Effect remediation requires active work.");
			const recorded = recordWorkCaseEffectRemediation(
				state.workCase,
				checkpoint.result.remediation,
			);
			if (recorded.status === "invalid") {
				throw new Error(recorded.error.message);
			}
			if (recorded.value.revisionId !== checkpoint.workCase.revisionId) {
				throw new Error("SDK Effect remediation checkpoint identity drifted.");
			}
			return Object.freeze({ ...state, workCase: recorded.value });
		}
		case "action-cleared": {
			if (!state) throw new Error("SDK Action clearance requires active work.");
			if (
				checkpoint.action.toolName !== "bash" &&
				checkpoint.action.toolName !== "edit" &&
				checkpoint.action.toolName !== "write"
			) {
				throw new Error("SDK Action is not a controlled Pi built-in.");
			}
			const accepted = acceptLivePiActionCandidate(state, {
				toolName: checkpoint.action.toolName,
				toolInput: checkpoint.action.toolInput,
				summary: checkpoint.action.candidate.summary,
				intendedEffects: checkpoint.action.candidate.intendedEffects,
				requiredConclusionIds:
					checkpoint.action.candidate.requiredConclusionIds,
			});
			if (accepted.status === "invalid") throw new Error(accepted.message);
			const cleared = assessLiveActionClearance(
				accepted.state,
				accepted.candidate.actionCandidateId,
				checkpoint.clearance.clearance.permission,
			);
			if (cleared.status !== "cleared") {
				throw new Error(
					cleared.status === "invalid"
						? cleared.message
						: "SDK Action did not reproduce its exact Clearance.",
				);
			}
			if (
				cleared.clearance.actionClearanceId !==
					checkpoint.clearance.clearance.actionClearanceId ||
				cleared.state.workCase.revisionId !== checkpoint.workCase.revisionId
			) {
				throw new Error(
					`SDK Action checkpoint identity drifted: clearance ${cleared.clearance.actionClearanceId}/${checkpoint.clearance.clearance.actionClearanceId}, revision ${cleared.state.workCase.revisionId}/${checkpoint.workCase.revisionId}.`,
				);
			}
			return cleared.state;
		}
		default:
			if (!state)
				throw new Error("SDK Judgment checkpoint requires active work.");
			return applySdkJudgmentCheckpoint(state, checkpoint);
	}
}

/** Applies only an already-admitted SDK checkpoint to the in-memory projection. */
export function applySdkJudgmentCheckpoint(
	state: LiveWorkCaseState,
	checkpoint: SdkJudgmentCheckpoint,
): LiveWorkCaseState {
	switch (checkpoint.kind) {
		case "capability-inventory-assessed": {
			let applicabilityAssessments = state.applicabilityAssessments;
			let capabilityAssignments = state.capabilityAssignments;
			for (const disposition of checkpoint.result.dispositions) {
				applicabilityAssessments = appendUniqueBy(
					applicabilityAssessments,
					disposition.assessment,
					(assessment) =>
						`${assessment.contributionNeedId}:${assessment.capabilityRevisionId}`,
				);
				if (disposition.assignment) {
					capabilityAssignments = appendUniqueBy(
						capabilityAssignments,
						disposition.assignment,
						(assignment) => assignment.assignmentId,
					);
				}
			}
			return Object.freeze({
				...state,
				applicabilityAssessments,
				capabilityAssignments,
			});
		}
		case "capability-context-prepared": {
			let referenceSelections = state.referenceSelections;
			if (checkpoint.result.selection) {
				referenceSelections = appendUniqueBy(
					referenceSelections,
					checkpoint.result.selection,
					(selection) => selection.selectionId,
				);
			}
			const sealedSkillContexts =
				checkpoint.result.status === "sealed"
					? appendUniqueBy(
							state.sealedSkillContexts,
							checkpoint.result.context,
							(context) => context.sealedContextId,
						)
					: state.sealedSkillContexts;
			return Object.freeze({
				...state,
				referenceSelections,
				sealedSkillContexts,
			});
		}
		case "contribution-accepted":
			return Object.freeze({
				...state,
				contributions: appendUniqueBy(
					state.contributions,
					checkpoint.result.contribution,
					(contribution) => contribution.contributionId,
				),
			});
		case "coverage-assessed":
			return Object.freeze({
				...state,
				needCoverages: appendUniqueBy(
					state.needCoverages,
					checkpoint.result.coverage,
					(coverage) => coverage.coverageId,
				),
			});
		case "judgment-concluded":
			return Object.freeze({ ...state, workCase: checkpoint.workCase });
		default:
			return checkpoint satisfies never;
	}
}

export async function progressLiveActionLoopWithSdk(
	input: LiveSdkActionLoopProgressionInput,
): Promise<LiveSdkActionLoopProgressionResult> {
	let current = input.state;
	let completedWorkCase: CompletedWorkCase | undefined;
	const capabilities: readonly SdkNamedCapability[] = Object.freeze(
		[...input.inventory.boundCapabilitiesBySkillName.entries()]
			.map(([name, entry]) => ({ name, entry }))
			.sort((left, right) => left.name.localeCompare(right.name)),
	);
	const result = await progressActionLoopWithSdk({
		request: input.request,
		...(current
			? {
					state: {
						workCase: current.workCase,
						applicabilityAssessments: current.applicabilityAssessments,
						assignments: current.capabilityAssignments,
						selections: current.referenceSelections,
						contexts: current.sealedSkillContexts,
						contributions: current.contributions,
						coverages: current.needCoverages,
					},
				}
			: {}),
		capabilities,
		effectObservations: current?.effectObservations ?? [],
		complete: input.complete ?? false,
		...(input.actions ? { actions: input.actions } : {}),
		...(input.authorizeAction
			? { authorizeAction: input.authorizeAction }
			: {}),
		runner: input.runner,
		maxSteps: input.maxSteps,
		async checkpoint(checkpoint) {
			if (checkpoint.kind === "work-case-completed") {
				await input.appendCheckpoint(sdkActionLoopCheckpointEvent(checkpoint));
				completedWorkCase = checkpoint.result.workCase;
				current = undefined;
				return;
			}
			const next = applySdkActionLoopCheckpoint(current, checkpoint);
			await input.appendCheckpoint(sdkActionLoopCheckpointEvent(checkpoint));
			current = next;
		},
	});
	return {
		result,
		...(current ? { state: current } : {}),
		...(completedWorkCase ? { completedWorkCase } : {}),
	};
}

/**
 * Connects SDK-owned Judgment progression to one Pi branch checkpoint callback.
 * Projection mutation occurs only after the semantic event append succeeds.
 */
export async function progressLiveJudgmentWithSdk(
	input: LiveSdkJudgmentProgressionInput,
): Promise<LiveSdkJudgmentProgressionResult> {
	let current = input.state;
	const capabilities: readonly SdkNamedCapability[] = Object.freeze(
		[...input.inventory.boundCapabilitiesBySkillName.entries()]
			.map(([name, entry]) => ({ name, entry }))
			.sort((left, right) => left.name.localeCompare(right.name)),
	);
	const result = await progressJudgmentWithSdk({
		request: input.request,
		state: {
			workCase: current.workCase,
			applicabilityAssessments: current.applicabilityAssessments,
			assignments: current.capabilityAssignments,
			selections: current.referenceSelections,
			contexts: current.sealedSkillContexts,
			contributions: current.contributions,
			coverages: current.needCoverages,
		},
		capabilities,
		runner: input.runner,
		maxSteps: input.maxSteps,
		async checkpoint(checkpoint) {
			const next = applySdkJudgmentCheckpoint(current, checkpoint);
			await input.appendCheckpoint(sdkJudgmentCheckpointEvent(checkpoint));
			current = next;
		},
	});
	return { result, state: current };
}
