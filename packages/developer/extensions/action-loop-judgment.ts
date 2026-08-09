import type { ActionCandidateProvenance } from "../src/action-loop/action/accept-action-candidate.ts";
import {
	openJudgment,
	type JudgmentOpeningProposal,
	type OpenJudgment,
} from "../src/action-loop/judgment/open-judgment.ts";
import { recordWorkCaseJudgment } from "../src/action-loop/work/record-work-case-judgment.ts";
import { openActionLoopJudgment } from "../src/action-loop/work/action-loop-phase.ts";
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

export function currentLiveJudgment(
	state: LiveWorkCaseState,
): OpenJudgment | undefined {
	return state.phase.kind === "judgment-active"
		? state.phase.judgment
		: undefined;
}

/** Selects one current functional Need without deriving it from a Capability name. */
export function selectLiveContributionNeed(
	state: LiveWorkCaseState,
	contributionNeedId?: string,
): LiveContributionNeedSelectionResult {
	const judgment = currentLiveJudgment(state);
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
					message:
						"Selected Contribution Need does not belong to the current open Judgment",
				}
			: { status: "selected", value: selected };
	}
	if (judgment.contributionNeeds.length !== 1) {
		return {
			status: "invalid",
			message:
				"A Contribution Need selection is required when the current open Judgment has several Contribution Needs",
		};
	}
	return { status: "selected", value: judgment.contributionNeeds[0] };
}

/** Opens and records one Judgment against the exact current live Context revision. */
export function openLiveJudgment(
	state: LiveWorkCaseState,
	proposal: LiveJudgmentProposal,
): LiveJudgmentOpeningResult {
	const currentOpenJudgment = currentLiveJudgment(state);
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
	if (recorded.status === "unchanged") {
		return { status: "unchanged", state, judgment: judgment.value };
	}
	const transitioned = openActionLoopJudgment(state.phase, judgment.value);
	if (transitioned.status === "invalid") {
		return { status: "invalid", message: transitioned.error.message };
	}
	return {
		status: "opened",
		state: Object.freeze({
			...state,
			phase: transitioned.value,
			workCase: recorded.value,
		}),
		judgment: judgment.value,
	};
}
