import type { ActionCandidate } from "../action/accept-action-candidate.ts";
import { deriveWorkCaseRevisionId, type ActiveWorkCase } from "./work-case.ts";

export type WorkCaseActionCandidateRecordErrorCode =
	| "stale-work-case"
	| "identity-mismatch"
	| "missing-conclusion";

export interface WorkCaseActionCandidateRecordError {
	readonly code: WorkCaseActionCandidateRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseActionCandidateRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseActionCandidateRecordError;
	  };

function invalid(
	code: WorkCaseActionCandidateRecordErrorCode,
	path: string,
	message: string,
): WorkCaseActionCandidateRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

/** Records an accepted Action Candidate only after its warrant is canonical. */
export function recordWorkCaseActionCandidate(
	workCase: ActiveWorkCase,
	candidate: ActionCandidate,
): WorkCaseActionCandidateRecordResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
		);
	}
	if (candidate.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"candidate.workCaseId",
			"Action Candidate belongs to another Work Case",
		);
	}
	if (
		workCase.actionCandidates.some(
			({ actionCandidateId }) =>
				actionCandidateId === candidate.actionCandidateId,
		)
	) {
		return { status: "unchanged", value: workCase };
	}
	const conclusionIds = new Set(
		workCase.conclusions.map(({ conclusionId }) => conclusionId),
	);
	const missingConclusionId = candidate.requiredConclusionIds.find(
		(conclusionId) => !conclusionIds.has(conclusionId),
	);
	if (missingConclusionId !== undefined) {
		return invalid(
			"missing-conclusion",
			"candidate.requiredConclusionIds",
			`Required Conclusion is not recorded: ${missingConclusionId}`,
		);
	}
	const actionCandidates = Object.freeze(
		[...workCase.actionCandidates, candidate].sort((left, right) =>
			left.actionCandidateId.localeCompare(right.actionCandidateId),
		),
	);
	const nextState = { ...workCase, actionCandidates };
	return {
		status: "recorded",
		value: Object.freeze({
			...nextState,
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
