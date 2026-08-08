import type {
	EffectSettlement,
	UnsettledEffectAssessment,
} from "../effect/effect-settlement.ts";
import type { ActiveWorkCase } from "./work-case.ts";
import {
	currentWorkCaseRecordingIssue,
	sealWorkCaseRevision,
} from "./work-case-recording.ts";

export type CurrentEffectAssessment =
	| EffectSettlement
	| UnsettledEffectAssessment;

export type WorkCaseEffectAssessmentRecordErrorCode =
	| "stale-work-case"
	| "invalid-work-case-inventory"
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
	const currentIssue = currentWorkCaseRecordingIssue(workCase);
	if (currentIssue) {
		return invalid(currentIssue.code, currentIssue.path, currentIssue.message);
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
	const effectRemediations = Object.freeze(
		workCase.effectRemediations.filter(
			({ adverseEffectId, remediationEffectId }) =>
				adverseEffectId !== assessment.effectId &&
				remediationEffectId !== assessment.effectId,
		),
	);
	const sealed = sealWorkCaseRevision({
		...workCase,
		currentEffectAssessments,
		effectRemediations,
	});
	if (sealed.status === "invalid") {
		return invalid(
			"invalid-work-case-inventory",
			sealed.issue.path,
			sealed.issue.message,
		);
	}
	return { status: "recorded", value: sealed.value };
}
