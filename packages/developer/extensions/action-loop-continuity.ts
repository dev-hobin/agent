import {
	blockWorkCase,
	type BlockWorkCaseProposal,
} from "../src/action-loop/work/block-work-case.ts";
import {
	pauseWorkCase,
	type PauseWorkCaseProposal,
} from "../src/action-loop/work/pause-work-case.ts";
import {
	resumeBlockedWorkCase,
	type ResumeBlockedWorkCaseProposal,
} from "../src/action-loop/work/resume-blocked-work-case.ts";
import {
	resumePausedWorkCase,
	type ResumePausedWorkCaseProposal,
} from "../src/action-loop/work/resume-paused-work-case.ts";
import {
	resumeWaitingWorkCase,
	type ResumeWaitingWorkCaseProposal,
} from "../src/action-loop/work/resume-waiting-work-case.ts";
import {
	waitWorkCase,
	type WaitWorkCaseProposal,
} from "../src/action-loop/work/wait-work-case.ts";
import type {
	LiveBlockedWorkCaseState,
	LivePausedWorkCaseState,
	LiveWaitingWorkCaseState,
	LiveWorkCaseState,
} from "./action-loop-work-case.ts";

export const MAX_LIVE_CONTINUITY_TEXT = 2_000;

export type LivePauseResult =
	| { readonly status: "paused"; readonly state: LivePausedWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

export type LiveResumePausedResult =
	| { readonly status: "active"; readonly state: LiveWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

export type LiveWaitResult =
	| { readonly status: "waiting"; readonly state: LiveWaitingWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

export type LiveResumeWaitingResult =
	| { readonly status: "active"; readonly state: LiveWorkCaseState }
	| { readonly status: "waiting"; readonly state: LiveWaitingWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

export type LiveBlockResult =
	| { readonly status: "blocked"; readonly state: LiveBlockedWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

export type LiveResumeBlockedResult =
	| { readonly status: "active"; readonly state: LiveWorkCaseState }
	| { readonly status: "invalid"; readonly message: string };

/** Preserves the live projection while canonical ownership moves to paused. */
export function pauseLiveWorkCase(
	state: LiveWorkCaseState,
	proposal: PauseWorkCaseProposal,
): LivePauseResult {
	const result = pauseWorkCase(state.workCase, proposal);
	if (result.status === "invalid") {
		return { status: "invalid", message: result.error.message };
	}
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
	if (result.status === "invalid") {
		return { status: "invalid", message: result.error.message };
	}
	return {
		status: "active",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}

/** Preserves the live projection while observed external work becomes waiting. */
export function waitLiveWorkCase(
	state: LiveWorkCaseState,
	proposal: WaitWorkCaseProposal,
): LiveWaitResult {
	const result = waitWorkCase(state.workCase, proposal);
	if (result.status === "invalid") {
		return { status: "invalid", message: result.error.message };
	}
	return {
		status: "waiting",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}

/** Resumes waiting only when the exact external predicate is observed satisfied. */
export function resumeLiveWaitingWorkCase(
	state: LiveWaitingWorkCaseState,
	proposal: ResumeWaitingWorkCaseProposal,
): LiveResumeWaitingResult {
	const result = resumeWaitingWorkCase(state.workCase, proposal);
	if (result.status === "invalid") {
		return { status: "invalid", message: result.error.message };
	}
	if (result.status === "waiting") {
		return {
			status: "waiting",
			state: Object.freeze({ ...state, workCase: result.value }),
		};
	}
	return {
		status: "active",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}

/** Preserves the live projection after Claim Assurance accounts every blocker. */
export function blockLiveWorkCase(
	state: LiveWorkCaseState,
	proposal: BlockWorkCaseProposal,
): LiveBlockResult {
	const result = blockWorkCase(state.workCase, proposal);
	if (result.status === "invalid") {
		return { status: "invalid", message: result.error.message };
	}
	return {
		status: "blocked",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}

/** Resumes blocked ownership only after an observed change creates continuation. */
export function resumeLiveBlockedWorkCase(
	state: LiveBlockedWorkCaseState,
	proposal: ResumeBlockedWorkCaseProposal,
): LiveResumeBlockedResult {
	const result = resumeBlockedWorkCase(state.workCase, proposal);
	if (result.status === "invalid") {
		return { status: "invalid", message: result.error.message };
	}
	return {
		status: "active",
		state: Object.freeze({ ...state, workCase: result.value }),
	};
}
