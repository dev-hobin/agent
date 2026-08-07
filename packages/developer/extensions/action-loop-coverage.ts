import {
	assessNeedCoverage,
	type NeedCoverage,
	type NeedCoverageProposal,
} from "../src/action-loop/need-coverage/assess-need-coverage.ts";
import { selectLiveContributionNeed } from "./action-loop-judgment.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_ASSESS_COVERAGE_TOOL = "developer_assess_coverage";

export type LiveNeedCoverageProposal = Omit<
	NeedCoverageProposal,
	"workCaseId" | "judgmentId" | "contributionNeedId"
> & {
	readonly contributionNeedId?: string;
};

export type LiveNeedCoverageResult =
	| {
			readonly status: "assessed" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly coverage: NeedCoverage;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Assesses all current Contributions for one Need without closing Judgment. */
export function assessLiveNeedCoverage(
	state: LiveWorkCaseState,
	proposal: LiveNeedCoverageProposal,
): LiveNeedCoverageResult {
	const need = selectLiveContributionNeed(state, proposal.contributionNeedId);
	if (need.status === "invalid") return need;
	const judgment = state.workCase.openJudgments[0];
	if (judgment === undefined) {
		return { status: "invalid", message: "No current open Judgment" };
	}
	const contributions = state.contributions.filter(
		(contribution) =>
			contribution.contributionNeedId === need.value.contributionNeedId,
	);
	const assessed = assessNeedCoverage(
		{
			workCaseId: state.workCase.workCaseId,
			judgmentId: judgment.judgmentId,
			contributionNeedId: need.value.contributionNeedId,
		},
		contributions,
		{
			...proposal,
			workCaseId: state.workCase.workCaseId,
			judgmentId: judgment.judgmentId,
			contributionNeedId: need.value.contributionNeedId,
		},
	);
	if (assessed.status === "invalid") {
		return { status: "invalid", message: assessed.error.message };
	}
	const existing = state.needCoverages.find(
		(coverage) =>
			coverage.contributionNeedId === need.value.contributionNeedId,
	);
	if (existing !== undefined) {
		return existing.coverageId === assessed.value.coverageId
			? { status: "unchanged", state, coverage: existing }
			: {
					status: "invalid",
					message:
						"Need already has a different current Coverage assessment",
				};
	}
	const needCoverages = Object.freeze(
		[...state.needCoverages, assessed.value].sort((left, right) =>
			left.coverageId.localeCompare(right.coverageId),
		),
	);
	return {
		status: "assessed",
		state: Object.freeze({ ...state, needCoverages }),
		coverage: assessed.value,
	};
}
