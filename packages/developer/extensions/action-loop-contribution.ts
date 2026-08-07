import {
	acceptSkillContribution,
	type SkillContribution,
	type SkillContributionProposal,
} from "../src/action-loop/contribution/accept-skill-contribution.ts";
import type { BoundPiCapabilityEntry } from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import { assignedLiveCapability } from "./action-loop-applicability.ts";
import { selectLiveContributionNeed } from "./action-loop-judgment.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_ACCEPT_CONTRIBUTION_TOOL =
	"developer_accept_contribution";

type LiveBoundCapability = Pick<BoundPiCapabilityEntry, "capability">;

export type LiveSkillContributionProposal = Omit<
	SkillContributionProposal,
	| "workCaseId"
	| "judgmentId"
	| "contributionNeedId"
	| "assignmentId"
	| "capabilityId"
	| "capabilityRevisionId"
	| "sealedContextId"
> & {
	readonly contributionNeedId?: string;
};

export type LiveSkillContributionResult =
	| {
			readonly status: "accepted" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly contribution: SkillContribution;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Accepts one Skill-local result without granting Need Coverage or Conclusion. */
export function acceptLiveSkillContribution(
	state: LiveWorkCaseState,
	entry: LiveBoundCapability,
	proposal: LiveSkillContributionProposal,
): LiveSkillContributionResult {
	const need = selectLiveContributionNeed(state, proposal.contributionNeedId);
	if (need.status === "invalid") return need;
	const assignment = assignedLiveCapability(
		state,
		entry,
		need.value.contributionNeedId,
	);
	if (assignment === undefined) {
		return {
			status: "invalid",
			message: "Contribution requires the exact current Capability Assignment",
		};
	}
	const context = state.sealedSkillContexts.find(
		(candidate) => candidate.assignmentId === assignment.assignmentId,
	);
	if (context === undefined) {
		return {
			status: "invalid",
			message: "Contribution requires one current sealed Skill context",
		};
	}
	const judgment = state.workCase.openJudgments[0];
	if (judgment === undefined) {
		return { status: "invalid", message: "No current open Judgment" };
	}
	const accepted = acceptSkillContribution(assignment, context, {
		...proposal,
		workCaseId: state.workCase.workCaseId,
		judgmentId: judgment.judgmentId,
		contributionNeedId: need.value.contributionNeedId,
		assignmentId: assignment.assignmentId,
		capabilityId: assignment.capabilityId,
		capabilityRevisionId: assignment.capabilityRevisionId,
		sealedContextId: context.sealedContextId,
	});
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const existing = state.contributions.find(
		(contribution): contribution is SkillContribution =>
			"assignmentId" in contribution &&
			contribution.assignmentId === assignment.assignmentId &&
			contribution.contributionNeedId === need.value.contributionNeedId &&
			contribution.sealedContextId === context.sealedContextId,
	);
	if (existing !== undefined) {
		return existing.contributionId === accepted.value.contributionId
			? { status: "unchanged", state, contribution: existing }
			: {
					status: "invalid",
					message:
						"Assignment already has a different Contribution for this sealed Context",
				};
	}
	const contributions = Object.freeze(
		[...state.contributions, accepted.value].sort((left, right) =>
			left.contributionId.localeCompare(right.contributionId),
		),
	);
	const needCoverages = Object.freeze(
		state.needCoverages.filter(
			(coverage) =>
				coverage.contributionNeedId !== need.value.contributionNeedId,
		),
	);
	return {
		status: "accepted",
		state: Object.freeze({ ...state, contributions, needCoverages }),
		contribution: accepted.value,
	};
}
