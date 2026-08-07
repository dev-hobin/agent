import {
	acceptActionCandidate,
	type ActionCandidate,
	type ActionCandidateProposal,
} from "../src/action-loop/action/accept-action-candidate.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_PROPOSE_ACTION_TOOL = "developer_propose_action";

export type LiveActionCandidateProposal = Omit<
	ActionCandidateProposal,
	"workCaseId" | "provenance"
>;

export type LiveActionCandidateResult =
	| {
			readonly status: "accepted" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly candidate: ActionCandidate;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Records one exact Action Candidate without granting permission or clearance. */
export function acceptLiveActionCandidate(
	state: LiveWorkCaseState,
	proposal: LiveActionCandidateProposal,
): LiveActionCandidateResult {
	const accepted = acceptActionCandidate({
		...proposal,
		workCaseId: state.workCase.workCaseId,
		provenance: { kind: "model", source: "pi:tool-call" },
	});
	if (accepted.status === "invalid") {
		return { status: "invalid", message: accepted.error.message };
	}
	const recorded = recordWorkCaseActionCandidate(
		state.workCase,
		accepted.value,
	);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	return {
		status: recorded.status === "recorded" ? "accepted" : "unchanged",
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
		candidate: accepted.value,
	};
}
