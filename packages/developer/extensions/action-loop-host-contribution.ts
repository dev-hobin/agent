import {
	acceptHostContribution,
	type HostContribution,
	type HostContributionProposal,
} from "../src/action-loop/contribution/accept-host-contribution.ts";
import type { ResidualNeedProposal } from "../src/action-loop/contribution/accept-skill-contribution.ts";
import { selectLiveContributionNeed } from "./action-loop-judgment.ts";
import type { LiveHostObservation } from "./action-loop-host-observation.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL =
	"developer_accept_observation_contribution";

export interface LiveHostContributionProposal {
	readonly contributionNeedId?: string;
	readonly localStatus: "resolved" | "partial";
	readonly result: string;
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeedProposal[];
	readonly basis: readonly string[];
}

export type LiveHostContributionResult =
	| {
			readonly status: "accepted" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly contribution: HostContribution;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Records an exact host Observation as one Need-bound open-world Contribution. */
export function acceptLiveHostContribution(
	state: LiveWorkCaseState,
	observation: LiveHostObservation,
	proposal: LiveHostContributionProposal,
): LiveHostContributionResult {
	if (observation.workCaseId !== state.workCase.workCaseId) {
		return {
			status: "invalid",
			message: "Host Observation does not belong to the current Work Case",
		};
	}
	const need = selectLiveContributionNeed(state, proposal.contributionNeedId);
	if (need.status === "invalid") return need;
	const judgment = state.workCase.openJudgments[0];
	if (!judgment)
		return { status: "invalid", message: "No current open Judgment" };
	const acceptedProposal: HostContributionProposal = {
		workCaseId: state.workCase.workCaseId,
		judgmentId: judgment.judgmentId,
		contributionNeedId: need.value.contributionNeedId,
		localStatus: proposal.localStatus,
		result: proposal.result,
		limitations: proposal.limitations,
		residualNeeds: proposal.residualNeeds,
		basis: proposal.basis,
		provenance: { kind: "model", source: "pi:tool-call" },
	};
	const accepted = acceptHostContribution(
		{
			workCaseId: state.workCase.workCaseId,
			judgmentId: judgment.judgmentId,
			contributionNeedId: need.value.contributionNeedId,
		},
		{
			observationId: observation.observationId,
			kind: observation.kind,
			source: observation.source,
			statement: observation.statement,
			evidenceFingerprint: observation.evidenceFingerprint,
			basis: observation.basis,
		},
		acceptedProposal,
	);
	if (accepted.status === "invalid") return accepted;
	const existing = state.contributions.find(
		(contribution) =>
			contribution.contributionId === accepted.value.contributionId,
	);
	if (existing) {
		return {
			status: "unchanged",
			state,
			contribution: accepted.value,
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
