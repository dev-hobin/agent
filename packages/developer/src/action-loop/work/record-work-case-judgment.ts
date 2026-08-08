import type { OpenJudgment } from "../judgment/open-judgment.ts";
import type { ActiveWorkCase } from "./work-case.ts";
import {
	currentWorkCaseRecordingIssue,
	sealWorkCaseRevision,
} from "./work-case-recording.ts";

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
	const currentIssue = currentWorkCaseRecordingIssue(workCase);
	if (currentIssue) {
		return invalid(currentIssue.code, currentIssue.path, currentIssue.message);
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
	const sealed = sealWorkCaseRevision({ ...workCase, openJudgments });
	if (sealed.status === "invalid") {
		return invalid(
			"invalid-work-case-inventory",
			sealed.issue.path,
			sealed.issue.message,
		);
	}
	return { status: "recorded", value: sealed.value };
}
