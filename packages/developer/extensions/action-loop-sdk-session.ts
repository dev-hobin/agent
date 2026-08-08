import type { CapabilityAssignment } from "../src/action-loop/routing/accept-applicability.ts";
import type {
	SdkActionCandidateResult,
	SdkActionClearanceResult,
} from "../src/action-loop/sdk/action-controller.ts";
import type { SdkCapabilityInventoryResult } from "../src/action-loop/sdk/capability-inventory-controller.ts";
import type { SdkCapabilityContextResult } from "../src/action-loop/sdk/context-sealing-controller.ts";
import type { SdkWorkCaseCompletionResult } from "../src/action-loop/sdk/completion-controller.ts";
import type { SdkJudgmentConclusionResult } from "../src/action-loop/sdk/conclusion-controller.ts";
import type { SdkSkillContributionResult } from "../src/action-loop/sdk/contribution-controller.ts";
import type { SdkNeedCoverageResult } from "../src/action-loop/sdk/coverage-controller.ts";
import type { SdkEffectSettlementResult } from "../src/action-loop/sdk/effect-controller.ts";
import type { SdkEffectRemediationResult } from "../src/action-loop/sdk/effect-remediation-controller.ts";
import type { SdkJudgmentOpeningResult } from "../src/action-loop/sdk/judgment-controller.ts";
import type { SdkJudgmentCheckpoint } from "../src/action-loop/sdk/judgment-progression-controller.ts";
import type { SdkWorkCaseOpeningResult } from "../src/action-loop/sdk/work-case-controller.ts";
import {
	actionLoopActionClearedEvent,
	actionLoopCapabilityInventoryAssessedEvent,
	actionLoopContributionAcceptedEvent,
	actionLoopCoverageAssessedEvent,
	actionLoopEffectRemediatedEvent,
	actionLoopEffectSettledEvent,
	actionLoopJudgmentConcludedEvent,
	actionLoopJudgmentOpenedEvent,
	actionLoopReferencesSelectedEvent,
	actionLoopUnstructuredContextSealedEvent,
	actionLoopWorkCaseCompletedEvent,
	actionLoopWorkCaseOpenedEvent,
	type ActionLoopActionClearedEvent,
	type ActionLoopCapabilityInventoryAssessedEvent,
	type ActionLoopContributionAcceptedEvent,
	type ActionLoopCoverageAssessedEvent,
	type ActionLoopEffectRemediatedEvent,
	type ActionLoopEffectSettledEvent,
	type ActionLoopJudgmentConcludedEvent,
	type ActionLoopJudgmentOpenedEvent,
	type ActionLoopReferencesSelectedEvent,
	type ActionLoopUnstructuredContextSealedEvent,
	type ActionLoopWorkCaseCompletedEvent,
	type ActionLoopWorkCaseOpenedEvent,
} from "./action-loop-session-event.ts";

export function sdkActionClearedEvent(input: {
	readonly action: Extract<
		SdkActionCandidateResult,
		{ readonly status: "accepted" }
	>;
	readonly clearance: Extract<
		SdkActionClearanceResult,
		{ readonly status: "cleared" }
	>;
	readonly revisionId: string;
}): ActionLoopActionClearedEvent {
	if (
		input.action.candidate.actionCandidateId !==
		input.clearance.clearance.actionCandidateId
	) {
		throw new Error("SDK Action Candidate and Clearance do not match.");
	}
	if (
		input.action.toolName !== "bash" &&
		input.action.toolName !== "edit" &&
		input.action.toolName !== "write"
	) {
		throw new Error(
			`SDK Action ${input.action.toolName} is not a controlled Pi built-in.`,
		);
	}
	return actionLoopActionClearedEvent(
		{
			toolName: input.action.toolName,
			toolInput: { ...input.action.toolInput },
			summary: input.action.candidate.summary,
			intendedEffects: [...input.action.candidate.intendedEffects],
			requiredConclusionIds: [...input.action.candidate.requiredConclusionIds],
		},
		input.action.candidate.actionCandidateId,
		input.clearance.clearance.actionClearanceId,
		input.revisionId,
		{
			...input.clearance.clearance.permission,
			basis: [...input.clearance.clearance.permission.basis],
		},
	);
}

export function sdkEffectSettledEvent(input: {
	readonly result: Extract<
		SdkEffectSettlementResult,
		{ readonly status: "settled" | "unsettled" }
	>;
	readonly revisionId: string;
	readonly expectedCurrentAssessmentId?: string;
}): ActionLoopEffectSettledEvent {
	const assessment =
		input.result.status === "settled"
			? input.result.settlement
			: input.result.assessment;
	const assessmentId =
		"effectSettlementId" in assessment
			? assessment.effectSettlementId
			: assessment.effectAssessmentId;
	return actionLoopEffectSettledEvent(
		assessment.effectId,
		{
			outcome: assessment.outcome,
			observationDispositions: assessment.observationDispositions.map(
				(disposition) => ({
					...disposition,
					basis: [...disposition.basis],
				}),
			),
			intendedEffectDispositions: assessment.intendedEffectDispositions.map(
				(disposition) => ({
					...disposition,
					observationIds: [...disposition.observationIds],
					basis: [...disposition.basis],
				}),
			),
			basis: [...assessment.basis],
			...(input.expectedCurrentAssessmentId
				? {
						expectedCurrentAssessmentId: input.expectedCurrentAssessmentId,
					}
				: {}),
		},
		assessmentId,
		input.revisionId,
	);
}

export function sdkEffectRemediatedEvent(input: {
	readonly result: Extract<
		SdkEffectRemediationResult,
		{ readonly status: "remediated" }
	>;
	readonly revisionId: string;
}): ActionLoopEffectRemediatedEvent {
	return actionLoopEffectRemediatedEvent({
		adverseEffectId: input.result.remediation.adverseEffectId,
		remediationEffectId: input.result.remediation.remediationEffectId,
		basis: [...input.result.remediation.basis],
		remediationId: input.result.remediation.effectRemediationId,
		revisionId: input.revisionId,
	});
}

export function sdkWorkCaseCompletedEvent(
	result: Extract<
		SdkWorkCaseCompletionResult,
		{ readonly status: "completed" }
	>,
): ActionLoopWorkCaseCompletedEvent {
	return actionLoopWorkCaseCompletedEvent(
		{
			closureTargetId: result.target.closureTargetId,
			mode: result.claim.mode,
			obligationDispositions: result.claim.obligationDispositions.map(
				(disposition) => ({
					...disposition,
					conclusionIds: [...disposition.conclusionIds],
					effectAssessmentIds: [...disposition.effectAssessmentIds],
					effectRemediationIds: [...disposition.effectRemediationIds],
					basis: [...disposition.basis],
				}),
			),
			basis: [...result.claim.basis],
		},
		result.workCase,
	);
}

export function sdkWorkCaseOpenedEvent(
	result: Extract<SdkWorkCaseOpeningResult, { readonly status: "opened" }>,
): ActionLoopWorkCaseOpenedEvent {
	return actionLoopWorkCaseOpenedEvent(
		{
			outcome: {
				statement: result.workCase.outcome.statement,
				acceptanceConditions: result.workCase.outcome.acceptanceConditions,
				constraints: result.workCase.outcome.constraints,
			},
			basis: result.basis,
			provenance: result.workCase.provenance,
		},
		{ workCase: result.workCase },
	);
}

export function sdkJudgmentOpenedEvent(
	result: Extract<
		SdkJudgmentOpeningResult,
		{ readonly status: "opened" | "unchanged" }
	>,
): ActionLoopJudgmentOpenedEvent {
	const needsById = new Map(
		result.judgment.contributionNeeds.map((need) => [
			need.contributionNeedId,
			need,
		]),
	);
	return actionLoopJudgmentOpenedEvent(
		{
			category: result.judgment.category,
			subject: result.judgment.subject,
			question: result.judgment.question,
			requirements: result.judgment.requirements.map((requirement) => ({
				statement: requirement.statement,
				contributionNeeds: requirement.contributionNeedIds.map(
					(contributionNeedId) => {
						const need = needsById.get(contributionNeedId);
						if (need === undefined) {
							throw new Error(
								`Judgment ${result.judgment.judgmentId} lost Contribution Need ${contributionNeedId}.`,
							);
						}
						return need.function;
					},
				),
			})),
			basis: [...result.judgment.basis],
			provenance: result.judgment.provenance,
		},
		result.judgment.judgmentId,
		result.workCase.revisionId,
	);
}

export function sdkCapabilityInventoryAssessedEvent(
	result: Extract<
		SdkCapabilityInventoryResult,
		{ readonly status: "assessed" }
	>,
): ActionLoopCapabilityInventoryAssessedEvent {
	const contributionNeedIds = new Set(
		result.dispositions.map(
			(disposition) => disposition.assessment.contributionNeedId,
		),
	);
	if (contributionNeedIds.size !== 1) {
		throw new Error(
			"SDK Capability inventory result must bind exactly one Contribution Need.",
		);
	}
	const [contributionNeedId] = contributionNeedIds;
	if (contributionNeedId === undefined) {
		throw new Error("SDK Capability inventory result is empty.");
	}
	return actionLoopCapabilityInventoryAssessedEvent({
		contributionNeedId,
		assessments: result.dispositions.map((disposition) => ({
			skillName: disposition.name,
			capabilityRevisionId: disposition.assessment.capabilityRevisionId,
			proposal: {
				contributionNeedId,
				status: disposition.assessment.status,
				matchedWhen: [...disposition.assessment.matchedWhen],
				matchedUnless: [...disposition.assessment.matchedUnless],
				basis: [...disposition.assessment.basis],
				missingContext: [...disposition.assessment.missingContext],
			},
			expected: {
				contributionNeedId,
				status: disposition.assessment.status,
				...(disposition.assignment
					? { assignmentId: disposition.assignment.assignmentId }
					: {}),
			},
		})),
	});
}

export type SdkCapabilityContextSessionEvent =
	| ActionLoopReferencesSelectedEvent
	| ActionLoopUnstructuredContextSealedEvent;

export type SdkJudgmentCheckpointSessionEvent =
	| ActionLoopCapabilityInventoryAssessedEvent
	| SdkCapabilityContextSessionEvent
	| ActionLoopContributionAcceptedEvent
	| ActionLoopCoverageAssessedEvent
	| ActionLoopJudgmentConcludedEvent;

/** Converts one controller-owned checkpoint into the existing semantic Pi event. */
export function sdkJudgmentCheckpointEvent(
	checkpoint: SdkJudgmentCheckpoint,
): SdkJudgmentCheckpointSessionEvent {
	switch (checkpoint.kind) {
		case "capability-inventory-assessed":
			return sdkCapabilityInventoryAssessedEvent(checkpoint.result);
		case "capability-context-prepared":
			return sdkCapabilityContextEvent({
				skillName: checkpoint.skillName,
				assignment: checkpoint.assignment,
				result: checkpoint.result,
			});
		case "contribution-accepted":
			return sdkContributionAcceptedEvent({
				skillName: checkpoint.skillName,
				result: checkpoint.result,
			});
		case "coverage-assessed":
			return sdkNeedCoverageAssessedEvent(checkpoint.result);
		case "judgment-concluded":
			return sdkJudgmentConcludedEvent({
				result: checkpoint.result,
				revisionId: checkpoint.workCase.revisionId,
			});
		default:
			return checkpoint satisfies never;
	}
}

export function sdkContributionAcceptedEvent(input: {
	readonly skillName: string;
	readonly result: Extract<
		SdkSkillContributionResult,
		{ readonly status: "accepted" }
	>;
}): ActionLoopContributionAcceptedEvent {
	const contribution = input.result.contribution;
	return actionLoopContributionAcceptedEvent(
		input.skillName,
		contribution.capabilityRevisionId,
		{
			contributionNeedId: contribution.contributionNeedId,
			localStatus: contribution.localStatus,
			result: contribution.result,
			referenceApplications: contribution.referenceApplications.map(
				(application) => ({ ...application }),
			),
			limitations: [...contribution.limitations],
			residualNeeds: contribution.residualNeeds.map((need) => ({
				kind: need.kind,
				description: need.description,
				basis: [...need.basis],
			})),
			provenance: { ...contribution.provenance },
		},
		contribution.contributionId,
	);
}

export function sdkJudgmentConcludedEvent(input: {
	readonly result: Extract<
		SdkJudgmentConclusionResult,
		{ readonly status: "concluded" }
	>;
	readonly revisionId: string;
}): ActionLoopJudgmentConcludedEvent {
	const conclusion = input.result.conclusion;
	return actionLoopJudgmentConcludedEvent(
		{
			outcome: "conclude",
			answer: conclusion.answer,
			refusalReasons: [],
			requirementDispositions: conclusion.requirementDispositions.map(
				(disposition) => ({
					...disposition,
					coverageIds: [...disposition.coverageIds],
					basis: [...disposition.basis],
				}),
			),
			basis: [...conclusion.basis],
			provenance: { ...conclusion.provenance },
		},
		conclusion.conclusionId,
		input.revisionId,
	);
}

export function sdkNeedCoverageAssessedEvent(
	result: Extract<SdkNeedCoverageResult, { readonly status: "assessed" }>,
): ActionLoopCoverageAssessedEvent {
	const coverage = result.coverage;
	return actionLoopCoverageAssessedEvent(
		{
			contributionNeedId: coverage.contributionNeedId,
			status: coverage.status,
			dispositions: coverage.dispositions.map((disposition) => ({
				...disposition,
				basis: [...disposition.basis],
			})),
			conflicts: coverage.conflicts.map((conflict) => ({
				...conflict,
				basis: [...conflict.basis],
			})),
			basis: [...coverage.basis],
			provenance: { ...coverage.provenance },
		},
		coverage.coverageId,
	);
}

export function sdkCapabilityContextEvent(input: {
	readonly skillName: string;
	readonly assignment: CapabilityAssignment;
	readonly result: Extract<
		SdkCapabilityContextResult,
		{ readonly status: "sealed" | "needs-context" }
	>;
}): SdkCapabilityContextSessionEvent {
	if (input.result.status === "sealed" && "routing" in input.result.context) {
		return actionLoopUnstructuredContextSealedEvent(
			input.skillName,
			input.assignment.capabilityRevisionId,
			input.assignment.assignmentId,
			input.result.context.sealedContextId,
		);
	}
	const selection = input.result.selection;
	if (selection === undefined) {
		throw new Error(
			`Structured Assignment ${input.assignment.assignmentId} has no Reference Selection.`,
		);
	}
	return actionLoopReferencesSelectedEvent({
		skillName: input.skillName,
		capabilityRevisionId: input.assignment.capabilityRevisionId,
		contributionNeedId: input.assignment.contributionNeedId,
		dispositions: selection.dispositions.map((disposition) => ({
			...disposition,
			basis: [...disposition.basis],
		})),
		selectionId: selection.selectionId,
		...(input.result.status === "sealed"
			? { sealedContextId: input.result.context.sealedContextId }
			: {}),
	});
}
