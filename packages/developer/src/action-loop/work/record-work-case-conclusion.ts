import type { JudgmentConclusion } from "../judgment/close-judgment.ts";
import { deriveWorkCaseRevisionId, type ActiveWorkCase } from "./work-case.ts";

export type WorkCaseConclusionRecordErrorCode =
	| "stale-work-case"
	| "identity-mismatch"
	| "invalid-conclusion";

export interface WorkCaseConclusionRecordError {
	readonly code: WorkCaseConclusionRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseConclusionRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseConclusionRecordError;
	  };

function invalid(
	code: WorkCaseConclusionRecordErrorCode,
	path: string,
	message: string,
): WorkCaseConclusionRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

function hasCurrentRevision(workCase: ActiveWorkCase): boolean {
	return workCase.revisionId === deriveWorkCaseRevisionId(workCase);
}

/** Records one already-accepted Conclusion in its canonical active Work Case. */
export function recordWorkCaseConclusion(
	workCase: ActiveWorkCase,
	conclusion: JudgmentConclusion,
): WorkCaseConclusionRecordResult {
	if (!hasCurrentRevision(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
		);
	}
	if (
		(conclusion.category === "Proportionate Intervention" &&
			conclusion.interventionDisposition !== "action-required" &&
			conclusion.interventionDisposition !== "no-action") ||
		(conclusion.category !== "Proportionate Intervention" &&
			conclusion.interventionDisposition !== undefined)
	) {
		return invalid(
			"invalid-conclusion",
			"conclusion.interventionDisposition",
			"Conclusion intervention disposition does not match its Judgment Category",
		);
	}
	if (conclusion.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"conclusion.workCaseId",
			"Conclusion belongs to another Work Case",
		);
	}
	if (
		workCase.conclusions.some(
			({ conclusionId }) => conclusionId === conclusion.conclusionId,
		)
	) {
		return { status: "unchanged", value: workCase };
	}
	const openJudgment = workCase.openJudgments.find(
		({ judgmentId }) => judgmentId === conclusion.judgmentId,
	);
	if (
		openJudgment !== undefined &&
		(openJudgment.category !== conclusion.category ||
			openJudgment.subject !== conclusion.subject ||
			openJudgment.contextRevisionId !== conclusion.contextRevisionId)
	) {
		return invalid(
			"identity-mismatch",
			"conclusion",
			"Conclusion changes the identity of its open Judgment",
		);
	}
	const conclusions = Object.freeze(
		[...workCase.conclusions, conclusion].sort((left, right) =>
			left.conclusionId.localeCompare(right.conclusionId),
		),
	);
	const openJudgments = Object.freeze(
		workCase.openJudgments.filter(
			({ judgmentId }) => judgmentId !== conclusion.judgmentId,
		),
	);
	const nextState = {
		...workCase,
		openJudgments,
		conclusions,
	};
	return {
		status: "recorded",
		value: Object.freeze({
			...nextState,
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
