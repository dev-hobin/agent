import type { ActionCandidateProvenance } from "../src/action-loop/action/accept-action-candidate.ts";
import {
	openJudgment,
	type JudgmentOpeningProposal,
	type OpenJudgment,
} from "../src/action-loop/judgment/open-judgment.ts";
import { recordWorkCaseJudgment } from "../src/action-loop/work/record-work-case-judgment.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_OPEN_JUDGMENT_TOOL = "developer_open_judgment";

export type LiveJudgmentProposal = Omit<
	JudgmentOpeningProposal,
	"workCaseId" | "contextRevisionId" | "provenance"
> & {
	readonly provenance: ActionCandidateProvenance;
};

export type LiveJudgmentOpeningResult =
	| {
			readonly status: "opened" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly judgment: OpenJudgment;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Opens and records one Judgment against the exact current live Context revision. */
export function openLiveJudgment(
	state: LiveWorkCaseState,
	proposal: LiveJudgmentProposal,
): LiveJudgmentOpeningResult {
	const judgment = openJudgment({
		...proposal,
		workCaseId: state.workCase.workCaseId,
		contextRevisionId: state.contextRevisionId,
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
