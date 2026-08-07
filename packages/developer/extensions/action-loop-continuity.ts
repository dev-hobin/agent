import {
	pauseWorkCase,
	type PauseWorkCaseProposal,
} from "../src/action-loop/work/pause-work-case.ts";
import {
	resumePausedWorkCase,
	type ResumePausedWorkCaseProposal,
} from "../src/action-loop/work/resume-paused-work-case.ts";
import type {
	LivePausedWorkCaseState,
	LiveWorkCaseState,
} from "./action-loop-work-case.ts";

export const MAX_LIVE_CONTINUITY_TEXT = 2_000;

export type LivePauseResult =
	| { readonly status: "paused"; readonly state: LivePausedWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

export type LiveResumePausedResult =
	| { readonly status: "active"; readonly state: LiveWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

/** Preserves the live projection while canonical ownership moves to paused. */
export function pauseLiveWorkCase(
	state: LiveWorkCaseState,
	proposal: PauseWorkCaseProposal,
): LivePauseResult {
	const result = pauseWorkCase(state.workCase, proposal);
	if (result.status === "invalid") return { status: "invalid", message: result.error.message };
	return {
		status: "paused",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}

/** Preserves the live projection while a human-owned pause returns to active. */
export function resumeLivePausedWorkCase(
	state: LivePausedWorkCaseState,
	proposal: ResumePausedWorkCaseProposal,
): LiveResumePausedResult {
	const result = resumePausedWorkCase(state.workCase, proposal);
	if (result.status === "invalid") return { status: "invalid", message: result.error.message };
	return {
		status: "active",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}
