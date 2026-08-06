import type { PendingEffect } from "../effect/begin-effect.ts";
import { deriveWorkCaseRevisionId, type ActiveWorkCase } from "./work-case.ts";

export type WorkCaseEffectRecordErrorCode =
	| "stale-work-case"
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
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
		);
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
	const nextState = { ...workCase, effects };
	return {
		status: "recorded",
		value: Object.freeze({
			...nextState,
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
