import { hashIdentity } from "../identity/hash-identity.ts";
import type { ClosureClaim } from "./accept-closure-claim.ts";
import {
	prepareClosureTarget,
	type SealedClosureTarget,
} from "./prepare-closure-target.ts";
import {
	deriveWorkCaseRevisionId,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_COMPLETION_VERSION = "developer-work-case-completion/v1";

export interface CompletedWorkCase
	extends Omit<ActiveWorkCase, "status" | "revisionId"> {
	readonly status: "complete";
	readonly revisionId: string;
	readonly priorRevisionId: string;
	readonly closureTarget: SealedClosureTarget;
	readonly closureClaim: ClosureClaim;
}

export type WorkCaseCompletionRefusalCode =
	| "stale-work-case"
	| "closure-not-ready"
	| "stale-closure-target"
	| "identity-mismatch";

export interface WorkCaseCompletionRefusal {
	readonly code: WorkCaseCompletionRefusalCode;
	readonly message: string;
}

export type WorkCaseCompletionResult =
	| { readonly status: "completed"; readonly value: CompletedWorkCase }
	| { readonly status: "refused"; readonly refusal: WorkCaseCompletionRefusal };

function refused(
	code: WorkCaseCompletionRefusalCode,
	message: string,
): WorkCaseCompletionResult {
	return { status: "refused", refusal: { code, message } };
}

/** Atomically revalidates closure against the current revision and completes it. */
export function completeWorkCase(
	workCase: ActiveWorkCase,
	target: SealedClosureTarget,
	claim: ClosureClaim,
): WorkCaseCompletionResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return refused(
			"stale-work-case",
			"Work Case revision does not match its closure inventory",
		);
	}
	const currentTarget = prepareClosureTarget(workCase);
	if (currentTarget.status !== "ready") {
		return refused(
			"closure-not-ready",
			"Current Work Case cannot produce a complete Closure Target",
		);
	}
	if (
		target.workCaseId !== workCase.workCaseId ||
		target.workCaseRevisionId !== workCase.revisionId ||
		target.closureTargetId !== currentTarget.value.closureTargetId
	) {
		return refused(
			"stale-closure-target",
			"Closure Target does not represent the complete current Work Case",
		);
	}
	if (
		claim.workCaseId !== workCase.workCaseId ||
		claim.workCaseRevisionId !== workCase.revisionId ||
		claim.closureTargetId !== target.closureTargetId
	) {
		return refused(
			"identity-mismatch",
			"Closure Claim does not bind the current Closure Target",
		);
	}
	const priorRevisionId = workCase.revisionId;
	const revisionId = hashIdentity(
		"work_case_completion",
		WORK_CASE_COMPLETION_VERSION,
		[workCase.workCaseId, priorRevisionId, claim.closureClaimId],
	);
	return {
		status: "completed",
		value: Object.freeze({
			...workCase,
			status: "complete",
			revisionId,
			priorRevisionId,
			closureTarget: target,
			closureClaim: claim,
		}),
	};
}
