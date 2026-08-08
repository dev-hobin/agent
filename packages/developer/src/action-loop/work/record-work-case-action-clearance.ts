import type { ActionClearance } from "../action/action-clearance.ts";
import type { ActiveWorkCase } from "./work-case.ts";
import {
	currentWorkCaseRecordingIssue,
	sealWorkCaseRevision,
} from "./work-case-recording.ts";

export type WorkCaseActionClearanceRecordErrorCode =
	| "stale-work-case"
	| "invalid-work-case-inventory"
	| "identity-mismatch"
	| "missing-action-candidate"
	| "missing-conclusion";

export interface WorkCaseActionClearanceRecordError {
	readonly code: WorkCaseActionClearanceRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseActionClearanceRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseActionClearanceRecordError;
	  };

function invalid(
	code: WorkCaseActionClearanceRecordErrorCode,
	path: string,
	message: string,
): WorkCaseActionClearanceRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

/** Records permission and warrant clearance for a canonical Action Candidate. */
export function recordWorkCaseActionClearance(
	workCase: ActiveWorkCase,
	clearance: ActionClearance,
): WorkCaseActionClearanceRecordResult {
	const currentIssue = currentWorkCaseRecordingIssue(workCase);
	if (currentIssue) {
		return invalid(currentIssue.code, currentIssue.path, currentIssue.message);
	}
	if (clearance.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"clearance.workCaseId",
			"Action Clearance belongs to another Work Case",
		);
	}
	if (
		workCase.actionClearances.some(
			({ actionClearanceId }) =>
				actionClearanceId === clearance.actionClearanceId,
		)
	) {
		return { status: "unchanged", value: workCase };
	}
	const candidate = workCase.actionCandidates.find(
		({ actionCandidateId }) =>
			actionCandidateId === clearance.actionCandidateId,
	);
	if (candidate === undefined) {
		return invalid(
			"missing-action-candidate",
			"clearance.actionCandidateId",
			"Cleared Action Candidate is not recorded",
		);
	}
	if (
		candidate.controlledAction.kind !== clearance.controlledAction.kind ||
		candidate.controlledAction.fingerprint !==
			clearance.controlledAction.fingerprint ||
		candidate.intendedEffects.length !== clearance.intendedEffects.length ||
		candidate.intendedEffects.some(
			(effect, index) => effect !== clearance.intendedEffects[index],
		)
	) {
		return invalid(
			"identity-mismatch",
			"clearance.controlledAction",
			"Clearance does not preserve the recorded controlled Action and Effects",
		);
	}
	const conclusionIds = new Set(
		workCase.conclusions.map(({ conclusionId }) => conclusionId),
	);
	const missingConclusionId = clearance.conclusionIds.find(
		(conclusionId) => !conclusionIds.has(conclusionId),
	);
	if (missingConclusionId !== undefined) {
		return invalid(
			"missing-conclusion",
			"clearance.conclusionIds",
			`Cleared Conclusion is not recorded: ${missingConclusionId}`,
		);
	}
	const actionClearances = Object.freeze(
		[...workCase.actionClearances, clearance].sort((left, right) =>
			left.actionClearanceId.localeCompare(right.actionClearanceId),
		),
	);
	const sealed = sealWorkCaseRevision({ ...workCase, actionClearances });
	if (sealed.status === "invalid") {
		return invalid(
			"invalid-work-case-inventory",
			sealed.issue.path,
			sealed.issue.message,
		);
	}
	return { status: "recorded", value: sealed.value };
}
