import type { ActionCandidateProvenance } from "../src/action-loop/action/accept-action-candidate.ts";
import {
	openJudgment,
	type JudgmentOpeningProposal,
	type OpenJudgment,
} from "../src/action-loop/judgment/open-judgment.ts";
import { recordWorkCaseJudgment } from "../src/action-loop/work/record-work-case-judgment.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export type LiveJudgmentProposal = Omit<
	JudgmentOpeningProposal,
	"workCaseId" | "contextRevisionId" | "provenance"
> & {
	readonly provenance: ActionCandidateProvenance;
};

export interface LiveContributionNeedSelection {
	readonly contributionNeedId: string;
	readonly function: string;
}

export type LiveContributionNeedSelectionResult =
	| {
			readonly status: "selected";
			readonly value: LiveContributionNeedSelection;
	  }
	| { readonly status: "invalid"; readonly message: string };

export type LiveJudgmentOpeningResult =
	| {
			readonly status: "opened" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly judgment: OpenJudgment;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Selects one current functional Need without deriving it from a Capability name. */
export function selectLiveContributionNeed(
	state: LiveWorkCaseState,
	contributionNeedId?: string,
): LiveContributionNeedSelectionResult {
	const judgment = state.workCase.openJudgments[0];
	if (judgment === undefined) {
		return {
			status: "invalid",
			message:
				"No current open Judgment. Open one before routing a Contribution Need.",
		};
	}
	const requestedId = contributionNeedId?.trim();
	if (requestedId) {
		const selected = judgment.contributionNeeds.find(
			(need) => need.contributionNeedId === requestedId,
		);
		return selected === undefined
			? {
					status: "invalid",
					message: `Contribution Need does not belong to the current open Judgment: ${requestedId}`,
				}
			: { status: "selected", value: selected };
	}
	if (judgment.contributionNeeds.length !== 1) {
		return {
			status: "invalid",
			message:
				"contribution_need_id is required when the current open Judgment has several Contribution Needs",
		};
	}
	return { status: "selected", value: judgment.contributionNeeds[0] };
}

/** Opens and records one Judgment against the exact current live Context revision. */
export function openLiveJudgment(
	state: LiveWorkCaseState,
	proposal: LiveJudgmentProposal,
): LiveJudgmentOpeningResult {
	const currentOpenJudgment = state.workCase.openJudgments[0];
	const judgment = openJudgment({
		...proposal,
		workCaseId: state.workCase.workCaseId,
		contextRevisionId:
			currentOpenJudgment?.contextRevisionId ?? state.workCase.revisionId,
	});
	if (judgment.status === "invalid") {
		return { status: "invalid", message: judgment.error.message };
	}
	if (
		state.workCase.openJudgments.length > 0 &&
		!state.workCase.openJudgments.some(
			({ judgmentId }) => judgmentId === judgment.value.judgmentId,
		)
	) {
		return {
			status: "invalid",
			message:
				"A different Judgment is already open in the live Work Case slice",
		};
	}
	const recorded = recordWorkCaseJudgment(state.workCase, judgment.value);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	return {
		status: recorded.status === "recorded" ? "opened" : "unchanged",
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
		judgment: judgment.value,
	};
}
