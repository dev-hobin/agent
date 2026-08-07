import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import {
	acceptLivePiActionCandidate,
	assessLiveActionClearance,
} from "./action-loop-action.ts";
import {
	assessLiveCapabilityApplicability,
	assignedLiveCapability,
} from "./action-loop-applicability.ts";
import type { LiveCapabilityInventoryResult } from "./action-loop-capability-inventory.ts";
import { completeLiveWorkCase } from "./action-loop-completion.ts";
import { closeLiveJudgment } from "./action-loop-conclusion.ts";
import { acceptLiveSkillContribution } from "./action-loop-contribution.ts";
import { acceptLiveHostContribution } from "./action-loop-host-contribution.ts";
import { assessLiveNeedCoverage } from "./action-loop-coverage.ts";
import {
	sealLiveUnstructuredCapability,
	selectAndSealLiveStructuredCapability,
} from "./action-loop-context.ts";
import {
	acceptLiveEffectObservation,
	beginLiveActionEffect,
	currentLiveEffectAssessmentId,
	recordLiveEffectRemediation,
	settleLiveEffect,
} from "./action-loop-effect.ts";
import {
	blockLiveWorkCase,
	pauseLiveWorkCase,
	resumeLiveBlockedWorkCase,
	resumeLivePausedWorkCase,
	resumeLiveWaitingWorkCase,
	waitLiveWorkCase,
} from "./action-loop-continuity.ts";
import { openLiveJudgment } from "./action-loop-judgment.ts";
import {
	extractReplayEvent,
	type ActionLoopActionClearedEvent,
	type ActionLoopBlockedWorkCaseResumedEvent,
	type ActionLoopCapabilityAssessedEvent,
	type ActionLoopContributionAcceptedEvent,
	type ActionLoopHostContributionAcceptedEvent,
	type ActionLoopCoverageAssessedEvent,
	type ActionLoopEffectBegunEvent,
	type ActionLoopEffectObservedEvent,
	type ActionLoopEffectRemediatedEvent,
	type ActionLoopEffectSettledEvent,
	type ActionLoopJudgmentConcludedEvent,
	type ActionLoopJudgmentOpenedEvent,
	type ActionLoopPausedWorkCaseResumedEvent,
	type ActionLoopReferencesSelectedEvent,
	type ActionLoopSessionBranchEntry,
	type ActionLoopSessionEvent,
	type ActionLoopUnstructuredContextSealedEvent,
	type ActionLoopWorkCaseBlockedEvent,
	type ActionLoopWorkCaseCompletedEvent,
	type ActionLoopWaitingWorkCaseResumedEvent,
	type ActionLoopWorkCaseOpenedEvent,
	type ActionLoopWorkCasePausedEvent,
	type ActionLoopWorkCaseWaitingEvent,
} from "./action-loop-session-event.ts";
import {
	isLiveBlockedWorkCaseState,
	isLivePausedWorkCaseState,
	isLiveWaitingWorkCaseState,
	openLiveWorkCase,
	type LiveBlockedWorkCaseState,
	type LiveHeldWorkCaseState,
	type LivePausedWorkCaseState,
	type LiveWaitingWorkCaseState,
	type LiveWorkCaseState,
} from "./action-loop-work-case.ts";
import {
	DEVELOPER_MODE_ENTRY,
	decodeDeveloperModeEvent,
} from "./developer-mode.ts";

export * from "./action-loop-session-event.ts";

export type ActionLoopSessionReplayResult =
	| {
			readonly status: "ready";
			readonly activeWorkCase?: LiveWorkCaseState;
			readonly heldWorkCase?: LiveHeldWorkCaseState;
			readonly completedWorkCase?: CompletedWorkCase;
			readonly appliedTransitions: number;
	  }
	| {
			readonly status: "unavailable";
			readonly entryIndex: number;
			readonly message: string;
	  };

function unavailable(
	entryIndex: number,
	message: string,
): ActionLoopSessionReplayResult {
	return { status: "unavailable", entryIndex, message };
}

function currentCapability(
	inventory: LiveCapabilityInventoryResult | undefined,
	skillName: string,
	capabilityRevisionId: string,
) {
	if (!inventory || inventory.status !== "ready") return undefined;
	const entry = inventory.value.boundCapabilitiesBySkillName.get(skillName);
	return entry?.capability.capabilityRevisionId === capabilityRevisionId
		? entry
		: undefined;
}

interface ReplayProjection {
	readonly activeWorkCase?: LiveWorkCaseState;
	readonly heldWorkCase?: LiveHeldWorkCaseState;
	readonly completedWorkCase?: CompletedWorkCase;
}

type AppliedEventResult =
	| { readonly status: "applied"; readonly projection: ReplayProjection }
	| { readonly status: "unavailable"; readonly message: string };

function applied(
	activeWorkCase: LiveWorkCaseState,
	completedWorkCase?: CompletedWorkCase,
): AppliedEventResult {
	return {
		status: "applied",
		projection: {
			activeWorkCase,
			...(completedWorkCase ? { completedWorkCase } : {}),
		},
	};
}

function appliedHeld(heldWorkCase: LiveHeldWorkCaseState): AppliedEventResult {
	return {
		status: "applied",
		projection: { heldWorkCase },
	};
}

function eventUnavailable(message: string): AppliedEventResult {
	return { status: "unavailable", message };
}

function unreachableSessionEvent(value: never): never {
	throw new Error(`Unsupported Action Loop session event: ${String(value)}`);
}

function replayWorkCaseOpening(
	projection: ReplayProjection,
	event: ActionLoopWorkCaseOpenedEvent,
): AppliedEventResult {
	if (projection.heldWorkCase) {
		return eventUnavailable(
			"Persisted Work Case opening cannot replace nonterminal branch ownership.",
		);
	}
	const opened = openLiveWorkCase(projection.activeWorkCase, event.proposal);
	if (
		(opened.status !== "opened" && opened.status !== "unchanged") ||
		opened.value.workCase.workCaseId !== event.expected.workCaseId ||
		opened.value.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseId
	) {
		return eventUnavailable(
			"Persisted Work Case opening does not reproduce its exact canonical identity.",
		);
	}
	return applied(opened.value);
}

function replayJudgmentOpening(
	state: LiveWorkCaseState,
	event: ActionLoopJudgmentOpenedEvent,
): AppliedEventResult {
	const opened = openLiveJudgment(state, event.proposal);
	if (
		opened.status === "invalid" ||
		opened.judgment.judgmentId !== event.expected.judgmentId ||
		opened.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.judgmentId
	) {
		return eventUnavailable(
			"Persisted Judgment opening does not reproduce its exact canonical identity.",
		);
	}
	return applied(opened.state);
}

function replayCapabilityAssessment(
	state: LiveWorkCaseState,
	event: ActionLoopCapabilityAssessedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): AppliedEventResult {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	if (!capability) {
		return eventUnavailable(
			`Capability ${event.skillName}@${event.capabilityRevisionId} is not in the current Pi-admitted inventory.`,
		);
	}
	const assessed = assessLiveCapabilityApplicability(
		state,
		capability,
		event.proposal,
	);
	const expectedTransitionId =
		event.expected.assignmentId ??
		`${event.capabilityRevisionId}:${event.expected.contributionNeedId}:${event.expected.status}`;
	if (
		assessed.status === "invalid" ||
		assessed.assessment.contributionNeedId !==
			event.expected.contributionNeedId ||
		assessed.assessment.status !== event.expected.status ||
		assessed.assignment?.assignmentId !== event.expected.assignmentId ||
		event.transitionId !== expectedTransitionId
	) {
		return eventUnavailable(
			"Persisted Capability assessment does not reproduce its exact Assignment.",
		);
	}
	return applied(assessed.state);
}

async function replayReferenceSelection(
	state: LiveWorkCaseState,
	event: ActionLoopReferencesSelectedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	if (!capability || capability.routing !== "structured") {
		return eventUnavailable(
			`Structured Capability ${event.skillName}@${event.capabilityRevisionId} is unavailable for exact Reference reacquisition.`,
		);
	}
	const assignment = assignedLiveCapability(
		state,
		capability,
		event.contributionNeedId,
	);
	if (!assignment) {
		return eventUnavailable(
			"Persisted Reference selection has no exact current Capability Assignment.",
		);
	}
	const selected = await selectAndSealLiveStructuredCapability(
		state,
		capability,
		assignment,
		event.dispositions,
	);
	if (
		selected.status === "invalid" ||
		selected.selectionId !== event.expected.selectionId ||
		selected.context?.sealedContextId !== event.expected.sealedContextId ||
		event.transitionId !== event.expected.selectionId
	) {
		return eventUnavailable(
			"Persisted Reference selection or sealed bytes drifted from its exact identity.",
		);
	}
	return applied(selected.state);
}

async function replayUnstructuredContext(
	state: LiveWorkCaseState,
	event: ActionLoopUnstructuredContextSealedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	const assignment = state.capabilityAssignments.find(
		(candidate) => candidate.assignmentId === event.assignmentId,
	);
	if (!capability || capability.routing !== "unstructured" || !assignment) {
		return eventUnavailable(
			`Unstructured Capability ${event.skillName}@${event.capabilityRevisionId} is unavailable for exact Skill reacquisition.`,
		);
	}
	const sealed = await sealLiveUnstructuredCapability(
		state,
		capability,
		assignment,
	);
	if (
		sealed.status === "invalid" ||
		sealed.context.sealedContextId !== event.expected.sealedContextId ||
		event.transitionId !== event.expected.sealedContextId
	) {
		return eventUnavailable(
			"Persisted unstructured Skill bytes drifted from their exact sealed identity.",
		);
	}
	return applied(sealed.state);
}

function replayContribution(
	state: LiveWorkCaseState,
	event: ActionLoopContributionAcceptedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): AppliedEventResult {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	if (!capability) {
		return eventUnavailable(
			`Contribution Capability ${event.skillName}@${event.capabilityRevisionId} is unavailable.`,
		);
	}
	const accepted = acceptLiveSkillContribution(
		state,
		capability,
		event.proposal,
	);
	if (
		accepted.status === "invalid" ||
		accepted.contribution.contributionId !== event.expected.contributionId ||
		event.transitionId !== event.expected.contributionId
	) {
		return eventUnavailable(
			"Persisted Skill Contribution does not reproduce its exact canonical identity.",
		);
	}
	return applied(accepted.state);
}

function replayHostContribution(
	state: LiveWorkCaseState,
	event: ActionLoopHostContributionAcceptedEvent,
): AppliedEventResult {
	const accepted = acceptLiveHostContribution(
		state,
		{
			...event.observation,
			workCaseId: state.workCase.workCaseId,
		},
		event.proposal,
	);
	if (
		accepted.status === "invalid" ||
		accepted.contribution.contributionId !== event.expected.contributionId ||
		event.transitionId !== event.expected.contributionId
	) {
		return eventUnavailable(
			"Persisted host Contribution does not reproduce its exact canonical identity.",
		);
	}
	return applied(accepted.state);
}

function replayCoverage(
	state: LiveWorkCaseState,
	event: ActionLoopCoverageAssessedEvent,
): AppliedEventResult {
	const assessed = assessLiveNeedCoverage(state, event.proposal);
	if (
		assessed.status === "invalid" ||
		assessed.coverage.coverageId !== event.expected.coverageId ||
		event.transitionId !== event.expected.coverageId
	) {
		return eventUnavailable(
			"Persisted Need Coverage does not reproduce its exact canonical identity.",
		);
	}
	return applied(assessed.state);
}

function replayConclusion(
	state: LiveWorkCaseState,
	event: ActionLoopJudgmentConcludedEvent,
): AppliedEventResult {
	const closed = closeLiveJudgment(state, event.proposal);
	if (
		closed.status !== "concluded" ||
		closed.conclusion.conclusionId !== event.expected.conclusionId ||
		closed.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.conclusionId
	) {
		return eventUnavailable(
			"Persisted Judgment Conclusion does not reproduce its exact canonical identity.",
		);
	}
	return applied(closed.state);
}

function replayActionClearance(
	state: LiveWorkCaseState,
	event: ActionLoopActionClearedEvent,
): AppliedEventResult {
	const accepted = acceptLivePiActionCandidate(state, event.proposal);
	if (
		accepted.status === "invalid" ||
		accepted.candidate.actionCandidateId !== event.expected.actionCandidateId
	) {
		return eventUnavailable(
			"Persisted Action Candidate does not reproduce its exact canonical identity.",
		);
	}
	const clearance = assessLiveActionClearance(
		accepted.state,
		accepted.candidate.actionCandidateId,
		{
			actionCandidateId: accepted.candidate.actionCandidateId,
			status: "granted",
			source: "pi:default-permission-policy",
			basis: [
				"The live adapter inherits Pi's default permission policy without adding a separate approval step.",
			],
		},
	);
	if (
		clearance.status !== "cleared" ||
		clearance.clearance.actionClearanceId !==
			event.expected.actionClearanceId ||
		clearance.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.actionClearanceId
	) {
		return eventUnavailable(
			"Persisted Action Clearance does not reproduce its exact canonical identity.",
		);
	}
	return applied(clearance.state);
}

function replayEffectBeginning(
	state: LiveWorkCaseState,
	event: ActionLoopEffectBegunEvent,
): AppliedEventResult {
	const clearance = state.workCase.actionClearances.find(
		(candidate) => candidate.actionClearanceId === event.actionClearanceId,
	);
	if (!clearance) {
		return eventUnavailable(
			"Persisted Effect beginning has no exact Action Clearance.",
		);
	}
	const begun = beginLiveActionEffect(state, clearance, event.occurrenceId);
	if (
		begun.status === "invalid" ||
		begun.effect.effectId !== event.expected.effectId ||
		begun.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.effectId
	) {
		return eventUnavailable(
			"Persisted Effect beginning does not reproduce its exact canonical identity.",
		);
	}
	return applied(begun.state);
}

function replayEffectObservation(
	state: LiveWorkCaseState,
	event: ActionLoopEffectObservedEvent,
): AppliedEventResult {
	const observed = acceptLiveEffectObservation(state, event.proposal);
	if (
		observed.status === "invalid" ||
		observed.observation.effectObservationId !==
			event.expected.effectObservationId ||
		event.transitionId !== event.expected.effectObservationId
	) {
		return eventUnavailable(
			"Persisted Effect Observation does not reproduce its exact canonical identity.",
		);
	}
	return applied(observed.state);
}

function replayEffectSettlement(
	state: LiveWorkCaseState,
	event: ActionLoopEffectSettledEvent,
): AppliedEventResult {
	const settled = settleLiveEffect(state, event.effectId, event.proposal);
	const assessmentId =
		settled.status === "invalid"
			? undefined
			: currentLiveEffectAssessmentId(settled.state, event.effectId);
	if (
		settled.status === "invalid" ||
		assessmentId !== event.expected.assessmentId ||
		settled.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.assessmentId
	) {
		return eventUnavailable(
			"Persisted Effect settlement does not reproduce its exact current assessment.",
		);
	}
	return applied(settled.state);
}

function replayEffectRemediation(
	state: LiveWorkCaseState,
	event: ActionLoopEffectRemediatedEvent,
): AppliedEventResult {
	const remediated = recordLiveEffectRemediation(
		state,
		event.adverseEffectId,
		event.remediationEffectId,
		event.basis,
	);
	if (
		remediated.status === "invalid" ||
		remediated.remediationId !== event.expected.remediationId ||
		remediated.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.remediationId
	) {
		return eventUnavailable(
			"Persisted Effect remediation does not reproduce its exact canonical identity.",
		);
	}
	return applied(remediated.state);
}

function replayWorkCaseCompletion(
	state: LiveWorkCaseState,
	event: ActionLoopWorkCaseCompletedEvent,
): AppliedEventResult {
	const completed = completeLiveWorkCase(state, event.proposal);
	if (
		completed.status !== "completed" ||
		completed.value.workCaseId !== event.expected.workCaseId ||
		completed.value.revisionId !== event.expected.revisionId ||
		completed.value.closureTarget.closureTargetId !==
			event.expected.closureTargetId ||
		completed.value.closureClaim.closureClaimId !==
			event.expected.closureClaimId ||
		event.transitionId !== event.expected.closureClaimId
	) {
		return eventUnavailable(
			"Persisted Work Case completion does not reproduce its exact revision-bound closure.",
		);
	}
	return {
		status: "applied",
		projection: { completedWorkCase: completed.value },
	};
}

function replayWorkCasePause(
	state: LiveWorkCaseState,
	event: ActionLoopWorkCasePausedEvent,
): AppliedEventResult {
	const result = pauseLiveWorkCase(state, event.proposal);
	if (
		result.status !== "paused" ||
		result.state.workCase.pause.workCasePauseId !==
			event.expected.workCasePauseId ||
		result.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCasePauseId
	) {
		return eventUnavailable(
			"Persisted Work Case pause does not reproduce its exact human-owned revision.",
		);
	}
	return appliedHeld(result.state);
}

function replayPausedWorkCaseResume(
	state: LivePausedWorkCaseState,
	event: ActionLoopPausedWorkCaseResumedEvent,
): AppliedEventResult {
	const result = resumeLivePausedWorkCase(state, event.proposal);
	const workCaseResumeId =
		result.status === "active"
			? result.state.workCase.continuityIds.at(-1)
			: undefined;
	if (
		result.status !== "active" ||
		workCaseResumeId !== event.expected.workCaseResumeId ||
		result.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseResumeId
	) {
		return eventUnavailable(
			"Persisted paused Work Case resume does not reproduce its exact human-owned continuity revision.",
		);
	}
	return applied(result.state);
}

function replayWorkCaseWaiting(
	state: LiveWorkCaseState,
	event: ActionLoopWorkCaseWaitingEvent,
): AppliedEventResult {
	const result = waitLiveWorkCase(state, event.proposal);
	if (
		result.status !== "waiting" ||
		result.state.workCase.wait.workCaseWaitId !==
			event.expected.workCaseWaitId ||
		result.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseWaitId
	) {
		return eventUnavailable(
			"Persisted Work Case wait does not reproduce its exact observed-condition revision.",
		);
	}
	return appliedHeld(result.state);
}

function replayWaitingWorkCaseResume(
	state: LiveWaitingWorkCaseState,
	event: ActionLoopWaitingWorkCaseResumedEvent,
): AppliedEventResult {
	const result = resumeLiveWaitingWorkCase(state, event.proposal);
	const workCaseWaitResumeId =
		result.status === "active"
			? result.state.workCase.continuityIds.at(-1)
			: undefined;
	if (
		result.status !== "active" ||
		workCaseWaitResumeId !== event.expected.workCaseWaitResumeId ||
		result.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseWaitResumeId
	) {
		return eventUnavailable(
			"Persisted waiting Work Case resume does not reproduce its exact predicate-bound continuity revision.",
		);
	}
	return applied(result.state);
}

function replayWorkCaseBlocked(
	state: LiveWorkCaseState,
	event: ActionLoopWorkCaseBlockedEvent,
): AppliedEventResult {
	const result = blockLiveWorkCase(state, event.proposal);
	if (
		result.status !== "blocked" ||
		result.state.workCase.block.workCaseBlockId !==
			event.expected.workCaseBlockId ||
		result.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseBlockId
	) {
		return eventUnavailable(
			"Persisted Work Case block does not reproduce its exact Claim Assurance revision.",
		);
	}
	return appliedHeld(result.state);
}

function replayBlockedWorkCaseResume(
	state: LiveBlockedWorkCaseState,
	event: ActionLoopBlockedWorkCaseResumedEvent,
): AppliedEventResult {
	const result = resumeLiveBlockedWorkCase(state, event.proposal);
	const workCaseUnblockId =
		result.status === "active"
			? result.state.workCase.continuityIds.at(-1)
			: undefined;
	if (
		result.status !== "active" ||
		workCaseUnblockId !== event.expected.workCaseUnblockId ||
		result.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseUnblockId
	) {
		return eventUnavailable(
			"Persisted blocked Work Case resume does not reproduce its exact observed-continuation revision.",
		);
	}
	return applied(result.state);
}

async function replayOwnedEvent(
	state: LiveWorkCaseState,
	event: Exclude<
		ActionLoopSessionEvent,
		| ActionLoopWorkCaseOpenedEvent
		| ActionLoopPausedWorkCaseResumedEvent
		| ActionLoopWaitingWorkCaseResumedEvent
		| ActionLoopBlockedWorkCaseResumedEvent
	>,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	switch (event.kind) {
		case "work-case-paused":
			return replayWorkCasePause(state, event);
		case "work-case-waiting":
			return replayWorkCaseWaiting(state, event);
		case "work-case-blocked":
			return replayWorkCaseBlocked(state, event);
		case "judgment-opened":
			return replayJudgmentOpening(state, event);
		case "capability-assessed":
			return replayCapabilityAssessment(state, event, inventory);
		case "references-selected":
			return replayReferenceSelection(state, event, inventory);
		case "unstructured-context-sealed":
			return replayUnstructuredContext(state, event, inventory);
		case "contribution-accepted":
			return replayContribution(state, event, inventory);
		case "host-contribution-accepted":
			return replayHostContribution(state, event);
		case "coverage-assessed":
			return replayCoverage(state, event);
		case "judgment-concluded":
			return replayConclusion(state, event);
		case "action-cleared":
			return replayActionClearance(state, event);
		case "effect-begun":
			return replayEffectBeginning(state, event);
		case "effect-observed":
			return replayEffectObservation(state, event);
		case "effect-settled":
			return replayEffectSettlement(state, event);
		case "effect-remediated":
			return replayEffectRemediation(state, event);
		case "work-case-completed":
			return replayWorkCaseCompletion(state, event);
		default:
			return unreachableSessionEvent(event);
	}
}

async function replaySessionEvent(
	projection: ReplayProjection,
	event: ActionLoopSessionEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	if (event.kind === "work-case-opened") {
		return replayWorkCaseOpening(projection, event);
	}
	if (event.kind === "paused-work-case-resumed") {
		if (
			!projection.heldWorkCase ||
			!isLivePausedWorkCaseState(projection.heldWorkCase)
		) {
			return eventUnavailable(
				"Persisted paused Work Case resume has no paused branch owner.",
			);
		}
		return replayPausedWorkCaseResume(projection.heldWorkCase, event);
	}
	if (event.kind === "waiting-work-case-resumed") {
		if (
			!projection.heldWorkCase ||
			!isLiveWaitingWorkCaseState(projection.heldWorkCase)
		) {
			return eventUnavailable(
				"Persisted waiting Work Case resume has no waiting branch owner.",
			);
		}
		return replayWaitingWorkCaseResume(projection.heldWorkCase, event);
	}
	if (event.kind === "blocked-work-case-resumed") {
		if (
			!projection.heldWorkCase ||
			!isLiveBlockedWorkCaseState(projection.heldWorkCase)
		) {
			return eventUnavailable(
				"Persisted blocked Work Case resume has no blocked branch owner.",
			);
		}
		return replayBlockedWorkCaseResume(projection.heldWorkCase, event);
	}
	if (projection.heldWorkCase) {
		return eventUnavailable(
			`Persisted ${event.kind} transition cannot mutate ${projection.heldWorkCase.workCase.status} branch ownership.`,
		);
	}
	if (!projection.activeWorkCase) {
		return eventUnavailable(
			`Persisted ${event.kind} transition has no active Work Case owner.`,
		);
	}
	return replayOwnedEvent(projection.activeWorkCase, event, inventory);
}

export async function replayActionLoopSession(
	entries: readonly ActionLoopSessionBranchEntry[],
	inventory?: LiveCapabilityInventoryResult,
): Promise<ActionLoopSessionReplayResult> {
	let projection: ReplayProjection = {};
	let appliedTransitions = 0;

	for (const [entryIndex, entry] of entries.entries()) {
		if (entry.customType === DEVELOPER_MODE_ENTRY) {
			const event = decodeDeveloperModeEvent(entry.data);
			if (event && !event.enabled) projection = {};
		}
		const extracted = extractReplayEvent(entry);
		if (extracted.status === "absent") continue;
		if (extracted.status === "invalid") {
			return unavailable(
				entryIndex,
				"Claimed Action Loop session event is malformed or unsupported.",
			);
		}
		const replayed = await replaySessionEvent(
			projection,
			extracted.event,
			inventory,
		);
		if (replayed.status === "unavailable") {
			return unavailable(entryIndex, replayed.message);
		}
		projection = replayed.projection;
		appliedTransitions += 1;
	}

	return {
		status: "ready",
		...projection,
		appliedTransitions,
	};
}
