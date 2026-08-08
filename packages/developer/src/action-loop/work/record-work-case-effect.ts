import type { PendingEffect } from "../effect/begin-effect.ts";
import type { ActiveWorkCase } from "./work-case.ts";
import {
	currentWorkCaseRecordingIssue,
	sealWorkCaseRevision,
} from "./work-case-recording.ts";

export type WorkCaseEffectRecordErrorCode =
	| "stale-work-case"
	| "invalid-work-case-inventory"
	| "identity-mismatch"
	| "missing-action-clearance"
	| "duplicate-occurrence";

export interface WorkCaseEffectRecordError {
	readonly code: WorkCaseEffectRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseEffectRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseEffectRecordError;
	  };

function invalid(
	code: WorkCaseEffectRecordErrorCode,
	path: string,
	message: string,
): WorkCaseEffectRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

/** Records one occurred Effect only beneath its canonical Action Clearance. */
export function recordWorkCaseEffect(
	workCase: ActiveWorkCase,
	effect: PendingEffect,
): WorkCaseEffectRecordResult {
	const currentIssue = currentWorkCaseRecordingIssue(workCase);
	if (currentIssue) {
		return invalid(currentIssue.code, currentIssue.path, currentIssue.message);
	}
	if (effect.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"effect.workCaseId",
			"Effect belongs to another Work Case",
		);
	}
	if (workCase.effects.some(({ effectId }) => effectId === effect.effectId)) {
		return { status: "unchanged", value: workCase };
	}
	if (
		workCase.effects.some(
			({ occurrenceId }) => occurrenceId === effect.occurrenceId,
		)
	) {
		return invalid(
			"duplicate-occurrence",
			"effect.occurrenceId",
			"Host occurrence is already represented by another Effect",
		);
	}
	const clearance = workCase.actionClearances.find(
		({ actionClearanceId }) => actionClearanceId === effect.actionClearanceId,
	);
	if (clearance === undefined) {
		return invalid(
			"missing-action-clearance",
			"effect.actionClearanceId",
			"Effect Action Clearance is not recorded",
		);
	}
	if (
		clearance.actionCandidateId !== effect.actionCandidateId ||
		clearance.controlledAction.kind !== effect.controlledAction.kind ||
		clearance.controlledAction.fingerprint !==
			effect.controlledAction.fingerprint ||
		clearance.intendedEffects.length !== effect.intendedEffects.length ||
		clearance.intendedEffects.some(
			(intendedEffect, index) =>
				intendedEffect !== effect.intendedEffects[index],
		)
	) {
		return invalid(
			"identity-mismatch",
			"effect",
			"Effect does not preserve its recorded Action Clearance",
		);
	}
	const effects = Object.freeze(
		[...workCase.effects, effect].sort((left, right) =>
			left.effectId.localeCompare(right.effectId),
		),
	);
	const sealed = sealWorkCaseRevision({ ...workCase, effects });
	if (sealed.status === "invalid") {
		return invalid(
			"invalid-work-case-inventory",
			sealed.issue.path,
			sealed.issue.message,
		);
	}
	return { status: "recorded", value: sealed.value };
}
