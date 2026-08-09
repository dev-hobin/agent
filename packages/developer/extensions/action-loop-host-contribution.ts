import {
	acceptHostContribution,
	type HostContribution,
	type HostContributionProposal,
} from "../src/action-loop/contribution/accept-host-contribution.ts";
import type { ResidualNeedProposal } from "../src/action-loop/contribution/accept-skill-contribution.ts";
import {
	currentLiveJudgment,
	selectLiveContributionNeed,
	type LiveContributionNeedSelectionResult,
} from "./action-loop-judgment.ts";
import type { LiveHostObservation } from "./action-loop-host-observation.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export interface LiveContributionNeedSelector {
	readonly requirement: string;
	readonly function: string;
}

export interface LiveHostContributionProposal {
	/** Trusted replay identity; never exposed by the model-facing tool schema. */
	readonly contributionNeedId?: string;
	readonly contributionNeed?: LiveContributionNeedSelector;
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

function selectHostContributionNeed(
	state: LiveWorkCaseState,
	selector?: LiveContributionNeedSelector,
	trustedContributionNeedId?: string,
): LiveContributionNeedSelectionResult {
	if (selector !== undefined && trustedContributionNeedId !== undefined) {
		return {
			status: "invalid",
			message:
				"Host Contribution cannot combine semantic and trusted Need selection",
		};
	}
	if (trustedContributionNeedId !== undefined) {
		return selectLiveContributionNeed(state, trustedContributionNeedId);
	}
	if (selector === undefined) return selectLiveContributionNeed(state);
	const requirementStatement = selector.requirement.trim();
	const needFunction = selector.function.trim();
	if (!requirementStatement || !needFunction) {
		return {
			status: "invalid",
			message:
				"contribution_need requires nonblank requirement and function text",
		};
	}
	const judgment = currentLiveJudgment(state);
	if (judgment === undefined) {
		return { status: "invalid", message: "No current open Judgment" };
	}
	const requirement = judgment.requirements.find(
		(candidate) => candidate.statement === requirementStatement,
	);
	if (requirement === undefined) {
		return {
			status: "invalid",
			message:
				"contribution_need requirement does not exactly match the current open Judgment",
		};
	}
	const contributionNeedIds = new Set(requirement.contributionNeedIds);
	const matchingNeeds = judgment.contributionNeeds.filter(
		(need) =>
			contributionNeedIds.has(need.contributionNeedId) &&
			need.function === needFunction,
	);
	const [matchingNeed] = matchingNeeds;
	if (matchingNeeds.length !== 1 || matchingNeed === undefined) {
		return {
			status: "invalid",
			message:
				"contribution_need function does not exactly match the selected Requirement",
		};
	}
	return { status: "selected", value: matchingNeed };
}

/** Lists current uncovered Needs by meaning while keeping trusted identities private. */
export function liveHostContributionRecoveryPrompt(
	state: LiveWorkCaseState,
): string {
	const judgment = currentLiveJudgment(state);
	if (judgment === undefined) return "Current open Judgment: none.";
	const coveredNeedIds = new Set(
		state.coverages
			.filter((coverage) => coverage.status === "covered")
			.map((coverage) => coverage.contributionNeedId),
	);
	const needs: LiveContributionNeedSelector[] = [];
	for (const requirement of judgment.requirements) {
		for (const contributionNeedId of requirement.contributionNeedIds) {
			const need = judgment.contributionNeeds.find(
				(candidate) => candidate.contributionNeedId === contributionNeedId,
			);
			if (need && !coveredNeedIds.has(need.contributionNeedId)) {
				needs.push({
					requirement: requirement.statement,
					function: need.function,
				});
			}
		}
	}
	if (needs.length === 0) {
		return "Current open Judgment has no uncovered Contribution Need.";
	}
	return [
		"Current uncovered Contribution Needs use semantic selectors; trusted identities are intentionally omitted:",
		...needs.map((need) => `- ${JSON.stringify(need)}`),
		needs.length === 1
			? "developer_accept_observation_contribution may omit contribution_need for this sole Need, or copy the listed semantic selector exactly."
			: "developer_accept_observation_contribution must set contribution_need to exactly one listed semantic selector.",
	].join("\n");
}

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
	const need = selectHostContributionNeed(
		state,
		proposal.contributionNeed,
		proposal.contributionNeedId,
	);
	if (need.status === "invalid") return need;
	const judgment = currentLiveJudgment(state);
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
	const coverages = Object.freeze(
		state.coverages.filter(
			(coverage) =>
				coverage.contributionNeedId !== need.value.contributionNeedId,
		),
	);
	return {
		status: "accepted",
		state: Object.freeze({ ...state, contributions, coverages }),
		contribution: accepted.value,
	};
}
