import type { BoundPiCapabilityEntry } from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import {
	acceptCapabilityApplicability,
	type AcceptedApplicabilityAssessment,
	type CapabilityApplicabilityProposal,
	type CapabilityAssignment,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	selectLiveContributionNeed,
	type LiveContributionNeedSelection,
} from "./action-loop-judgment.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_ASSESS_CAPABILITY_TOOL = "developer_assess_capability";

type LiveBoundCapability = Pick<BoundPiCapabilityEntry, "capability">;

export type LiveCapabilityApplicabilityProposal = Omit<
	CapabilityApplicabilityProposal,
	| "workCaseId"
	| "judgmentId"
	| "contributionNeedId"
	| "capabilityRevisionId"
> & {
	readonly contributionNeedId?: string;
};

export type LiveCapabilityApplicabilityResult =
	| {
			readonly status: "assessed" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly need: LiveContributionNeedSelection;
			readonly assessment: AcceptedApplicabilityAssessment;
			readonly assignment?: CapabilityAssignment;
	  }
	| { readonly status: "invalid"; readonly message: string };

function sameList(left: readonly string[], right: readonly string[]): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function sameAssessment(
	left: AcceptedApplicabilityAssessment,
	right: AcceptedApplicabilityAssessment,
): boolean {
	return (
		left.workCaseId === right.workCaseId &&
		left.judgmentId === right.judgmentId &&
		left.contributionNeedId === right.contributionNeedId &&
		left.capabilityId === right.capabilityId &&
		left.capabilityRevisionId === right.capabilityRevisionId &&
		left.status === right.status &&
		sameList(left.matchedWhen, right.matchedWhen) &&
		sameList(left.matchedUnless, right.matchedUnless) &&
		sameList(left.basis, right.basis) &&
		sameList(left.missingContext, right.missingContext)
	);
}

function assessmentKey(
	assessment: Pick<
		AcceptedApplicabilityAssessment,
		"contributionNeedId" | "capabilityRevisionId"
	>,
): string {
	return `${assessment.contributionNeedId}\u0000${assessment.capabilityRevisionId}`;
}

/** Accepts one current Capability applicability assessment without selecting References. */
export function assessLiveCapabilityApplicability(
	state: LiveWorkCaseState,
	entry: LiveBoundCapability,
	proposal: LiveCapabilityApplicabilityProposal,
): LiveCapabilityApplicabilityResult {
	const need = selectLiveContributionNeed(state, proposal.contributionNeedId);
	if (need.status === "invalid") return need;
	const judgment = state.workCase.openJudgments[0];
	if (judgment === undefined) {
		return { status: "invalid", message: "No current open Judgment" };
	}
	const accepted = acceptCapabilityApplicability(
		{
			workCaseId: state.workCase.workCaseId,
			judgmentId: judgment.judgmentId,
			contributionNeedId: need.value.contributionNeedId,
			capability: entry.capability,
		},
		{
			...proposal,
			workCaseId: state.workCase.workCaseId,
			judgmentId: judgment.judgmentId,
			contributionNeedId: need.value.contributionNeedId,
			capabilityRevisionId: entry.capability.capabilityRevisionId,
		},
	);
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const key = assessmentKey(accepted.assessment);
	const existing = state.applicabilityAssessments.find(
		(assessment) => assessmentKey(assessment) === key,
	);
	if (existing !== undefined) {
		if (!sameAssessment(existing, accepted.assessment)) {
			return {
				status: "invalid",
				message:
					"Capability already has a different assessment for this Need and Context",
			};
		}
		return {
			status: "unchanged",
			state,
			need: need.value,
			assessment: existing,
			assignment: state.capabilityAssignments.find(
				(assignment) => assessmentKey(assignment) === key,
			),
		};
	}
	const applicabilityAssessments = Object.freeze(
		[...state.applicabilityAssessments, accepted.assessment].sort((left, right) =>
			assessmentKey(left).localeCompare(assessmentKey(right)),
		),
	);
	const capabilityAssignments =
		accepted.status === "assigned"
			? Object.freeze(
					[...state.capabilityAssignments, accepted.assignment].sort(
						(left, right) => left.assignmentId.localeCompare(right.assignmentId),
					),
				)
			: state.capabilityAssignments;
	return {
		status: "assessed",
		state: Object.freeze({
			...state,
			applicabilityAssessments,
			capabilityAssignments,
		}),
		need: need.value,
		assessment: accepted.assessment,
		...(accepted.status === "assigned"
			? { assignment: accepted.assignment }
			: {}),
	};
}

/** Finds the exact current assignment required before routing one Capability. */
export function assignedLiveCapability(
	state: LiveWorkCaseState,
	entry: LiveBoundCapability,
	contributionNeedId: string,
): CapabilityAssignment | undefined {
	return state.capabilityAssignments.find(
		(assignment) =>
			assignment.contributionNeedId === contributionNeedId &&
			assignment.capabilityRevisionId ===
				entry.capability.capabilityRevisionId,
	);
}
