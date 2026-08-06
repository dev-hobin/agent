import type {
	EffectSettlement,
	UnsettledEffectAssessment,
} from "../effect/effect-settlement.ts";
import {
	deriveWorkCaseRevisionId,
	type ActiveWorkCase,
} from "./work-case.ts";

export type CurrentEffectAssessment =
	| EffectSettlement
	| UnsettledEffectAssessment;

export type WorkCaseEffectAssessmentRecordErrorCode =
	| "stale-work-case"
	| "identity-mismatch"
	| "missing-effect"
	| "stale-effect-assessment";

export interface WorkCaseEffectAssessmentRecordError {
	readonly code: WorkCaseEffectAssessmentRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseEffectAssessmentRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseEffectAssessmentRecordError;
	  };

function invalid(
	code: WorkCaseEffectAssessmentRecordErrorCode,
	path: string,
	message: string,
): WorkCaseEffectAssessmentRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

export function effectAssessmentId(
	assessment: CurrentEffectAssessment,
): string {
	return "effectSettlementId" in assessment
		? assessment.effectSettlementId
		: assessment.effectAssessmentId;
}

/** Replaces one Effect's current assessment with compare-and-set semantics. */
export function recordWorkCaseEffectAssessment(
	workCase: ActiveWorkCase,
	assessment: CurrentEffectAssessment,
	expectedCurrentAssessmentId: string | null,
): WorkCaseEffectAssessmentRecordResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
		);
	}
	if (assessment.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"assessment.workCaseId",
			"Effect assessment belongs to another Work Case",
		);
	}
	const effect = workCase.effects.find(
		({ effectId }) => effectId === assessment.effectId,
	);
	if (effect === undefined) {
		return invalid(
			"missing-effect",
			"assessment.effectId",
			"Assessed Effect is not recorded",
		);
	}
	if (
		effect.actionClearanceId !== assessment.actionClearanceId ||
		effect.occurrenceId !== assessment.occurrenceId
	) {
		return invalid(
			"identity-mismatch",
			"assessment",
			"Assessment does not preserve the recorded Effect occurrence",
		);
	}
	const current = workCase.currentEffectAssessments.find(
		({ effectId }) => effectId === assessment.effectId,
	);
	if (
		current !== undefined &&
		effectAssessmentId(current) === effectAssessmentId(assessment)
	) {
		return { status: "unchanged", value: workCase };
	}
	const currentId = current === undefined ? null : effectAssessmentId(current);
	if (currentId !== expectedCurrentAssessmentId) {
		return invalid(
			"stale-effect-assessment",
			"expectedCurrentAssessmentId",
			"Expected assessment does not match the Effect's current assessment",
		);
	}
	const currentEffectAssessments = Object.freeze(
		[
			...workCase.currentEffectAssessments.filter(
				({ effectId }) => effectId !== assessment.effectId,
			),
			assessment,
		].sort((left, right) => left.effectId.localeCompare(right.effectId)),
	);
	const nextState = { ...workCase, currentEffectAssessments };
	return {
		status: "recorded",
		value: Object.freeze({
			...nextState,
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
