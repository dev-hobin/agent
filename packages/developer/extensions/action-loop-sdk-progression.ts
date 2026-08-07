import type { SdkNamedCapability } from "../src/action-loop/sdk/capability-inventory-controller.ts";
import type { SdkDecisionRunner } from "../src/action-loop/sdk/decision-controller.ts";
import {
	progressJudgmentWithSdk,
	type SdkJudgmentCheckpoint,
	type SdkJudgmentProgressionResult,
} from "../src/action-loop/sdk/judgment-progression-controller.ts";
import type { LiveCapabilityInventory } from "./action-loop-capability-inventory.ts";
import {
	sdkJudgmentCheckpointEvent,
	type SdkJudgmentCheckpointSessionEvent,
} from "./action-loop-sdk-session.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_PROGRESS_JUDGMENT_TOOL =
	"developer_progress_judgment_with_sdk";

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
