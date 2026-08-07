import type { OpenJudgment } from "../judgment/open-judgment.ts";
import {
	deriveWorkCaseRevisionId,
	type ActiveWorkCase,
	workCaseInventoryIssue,
} from "./work-case.ts";

export type WorkCaseJudgmentRecordErrorCode =
	| "stale-work-case"
	| "invalid-work-case-inventory"
	| "identity-mismatch"
	| "judgment-already-concluded";

export interface WorkCaseJudgmentRecordError {
	readonly code: WorkCaseJudgmentRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseJudgmentRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseJudgmentRecordError;
	  };

function invalid(
	code: WorkCaseJudgmentRecordErrorCode,
	path: string,
	message: string,
): WorkCaseJudgmentRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

/** Records one current open Judgment without selecting a Capability. */
export function recordWorkCaseJudgment(
	workCase: ActiveWorkCase,
	judgment: OpenJudgment,
): WorkCaseJudgmentRecordResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
		);
	}
	if (workCaseInventoryIssue(workCase) !== undefined) {
		return invalid(
			"invalid-work-case-inventory",
			"workCase",
			"Work Case closure inventory is relationally incoherent",
		);
	}
	if (judgment.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"judgment.workCaseId",
			"Judgment belongs to another Work Case",
		);
	}
	if (
		workCase.conclusions.some(
			({ judgmentId }) => judgmentId === judgment.judgmentId,
		)
	) {
		return invalid(
			"judgment-already-concluded",
			"judgment.judgmentId",
			"A Conclusion already closes this Judgment",
		);
	}
	if (
		workCase.openJudgments.some(
			({ judgmentId }) => judgmentId === judgment.judgmentId,
		)
	) {
		return { status: "unchanged", value: workCase };
	}
	const openJudgments = Object.freeze(
		[...workCase.openJudgments, judgment].sort((left, right) =>
			left.judgmentId.localeCompare(right.judgmentId),
		),
	);
	const nextState = { ...workCase, openJudgments };
	return {
		status: "recorded",
		value: Object.freeze({
			...nextState,
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
