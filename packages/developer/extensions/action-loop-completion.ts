import {
	acceptClosureClaim,
	type ClosureObligationDispositionProposal,
} from "../src/action-loop/work/accept-closure-claim.ts";
import {
	completeWorkCase,
	type CompletedWorkCase,
} from "../src/action-loop/work/complete-work-case.ts";
import {
	prepareClosureTarget,
	type SealedClosureTarget,
	type ClosureTargetBlocker,
} from "../src/action-loop/work/prepare-closure-target.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_PREPARE_CLOSURE_TOOL = "developer_prepare_closure";
export const ACTION_LOOP_COMPLETE_WORK_CASE_TOOL =
	"developer_complete_work_case";

export type LiveClosurePreparationResult =
	| { readonly status: "ready"; readonly target: SealedClosureTarget }
	| {
			readonly status: "not-ready";
			readonly blockers: readonly ClosureTargetBlocker[];
	  }
	| { readonly status: "invalid"; readonly message: string };

export interface LiveCompletionProposal {
	readonly closureTargetId: string;
	readonly mode: "completed" | "no-change";
	readonly obligationDispositions: readonly ClosureObligationDispositionProposal[];
	readonly basis: readonly string[];
}

export type LiveCompletionResult =
	| {
			readonly status: "completed";
			readonly value: CompletedWorkCase;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Prepares closure only from the complete canonical Work Case inventory. */
export function prepareLiveWorkCaseClosure(
	state: LiveWorkCaseState,
): LiveClosurePreparationResult {
	const prepared = prepareClosureTarget(state.workCase);
	if (prepared.status === "invalid") {
		return { status: "invalid", message: prepared.error.message };
	}
	return prepared.status === "ready"
		? { status: "ready", target: prepared.value }
		: { status: "not-ready", blockers: prepared.blockers };
}

/** Accepts exact closure accounting and atomically revalidates completion. */
export function completeLiveWorkCase(
	state: LiveWorkCaseState,
	proposal: LiveCompletionProposal,
): LiveCompletionResult {
	const prepared = prepareLiveWorkCaseClosure(state);
	if (prepared.status === "invalid") return prepared;
	if (prepared.status === "not-ready") {
		return {
			status: "invalid",
			message: `Work Case closure is not ready: ${prepared.blockers.map((blocker) => blocker.code).join(", ")}`,
		};
	}
	if (prepared.target.closureTargetId !== proposal.closureTargetId) {
		return {
			status: "invalid",
			message:
				"Closure Target is stale or belongs to another Work Case revision",
		};
	}
	const claim = acceptClosureClaim(prepared.target, {
		workCaseId: state.workCase.workCaseId,
		closureTargetId: prepared.target.closureTargetId,
		mode: proposal.mode,
		obligationDispositions: proposal.obligationDispositions,
		basis: proposal.basis,
		provenance: { kind: "model", source: "pi:tool-call" },
	});
	if (claim.status === "invalid") {
		return { status: "invalid", message: claim.error.message };
	}
	const completed = completeWorkCase(
		state.workCase,
		prepared.target,
		claim.value,
	);
	return completed.status === "completed"
		? completed
		: { status: "invalid", message: completed.refusal.message };
}

export function liveCompletedWorkCasePrompt(
	completed: CompletedWorkCase | undefined,
): string {
	if (completed === undefined) return "Completed Action Loop Work Case: none";
	return [
		`Completed Action Loop Work Case: ${completed.workCaseId}`,
		`Completed revision: ${completed.revisionId}`,
		`Closure Target: ${completed.closureTarget.closureTargetId}`,
		`Closure Claim: ${completed.closureClaim.closureClaimId} · ${completed.closureClaim.mode}`,
	].join("\n");
}
