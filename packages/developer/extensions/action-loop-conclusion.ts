import {
	closeJudgment,
	type JudgmentClosureProposal,
	type JudgmentClosureRefusal,
	type JudgmentConclusion,
} from "../src/action-loop/judgment/close-judgment.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { concludeActionLoopJudgment } from "../src/action-loop/work/action-loop-phase.ts";
import { currentLiveJudgment } from "./action-loop-judgment.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export type LiveJudgmentClosureProposal = Omit<
	JudgmentClosureProposal,
	"workCaseId" | "judgmentId" | "category" | "contextRevisionId"
>;

export type LiveJudgmentClosureResult =
	| {
			readonly status: "concluded";
			readonly state: LiveWorkCaseState;
			readonly conclusion: JudgmentConclusion;
	  }
	| {
			readonly status: "refused";
			readonly state: LiveWorkCaseState;
			readonly refusal: JudgmentClosureRefusal;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Synthesizes current Coverage and records only a valid Conclusion in Work Case. */
export function closeLiveJudgment(
	state: LiveWorkCaseState,
	proposal: LiveJudgmentClosureProposal,
): LiveJudgmentClosureResult {
	const judgment = currentLiveJudgment(state);
	if (judgment === undefined) {
		return { status: "invalid", message: "No current open Judgment" };
	}
	const needIds = new Set(
		judgment.contributionNeeds.map(
			({ contributionNeedId }) => contributionNeedId,
		),
	);
	const coverages = state.coverages.filter((coverage) =>
		needIds.has(coverage.contributionNeedId),
	);
	const closed = closeJudgment(judgment, coverages, {
		...proposal,
		workCaseId: state.workCase.workCaseId,
		judgmentId: judgment.judgmentId,
		category: judgment.category,
		contextRevisionId: judgment.contextRevisionId,
	});
	if (closed.status === "invalid") {
		return { status: "invalid", message: closed.error.message };
	}
	if (closed.status === "refused") {
		return { status: "refused", state, refusal: closed.value };
	}
	const recorded = recordWorkCaseConclusion(state.workCase, closed.value);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	if (recorded.status === "unchanged") {
		return { status: "concluded", state, conclusion: closed.value };
	}
	const transitioned = concludeActionLoopJudgment(state.phase, closed.value);
	if (transitioned.status === "invalid") {
		return { status: "invalid", message: transitioned.error.message };
	}
	return {
		status: "concluded",
		state: Object.freeze({
			...state,
			phase: transitioned.value,
			workCase: recorded.value,
		}),
		conclusion: closed.value,
	};
}
