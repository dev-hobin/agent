import type { EffectRemediation } from "../effect/accept-effect-remediation.ts";
import type { ActiveWorkCase } from "./work-case.ts";
import {
	currentWorkCaseRecordingIssue,
	sealWorkCaseRevision,
} from "./work-case-recording.ts";

export type WorkCaseEffectRemediationRecordErrorCode =
	| "stale-work-case"
	| "invalid-work-case-inventory"
	| "identity-mismatch"
	| "missing-assessment"
	| "stale-assessment"
	| "adverse-effect-already-remediated";

export interface WorkCaseEffectRemediationRecordError {
	readonly code: WorkCaseEffectRemediationRecordErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseEffectRemediationRecordResult =
	| { readonly status: "recorded"; readonly value: ActiveWorkCase }
	| { readonly status: "unchanged"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: WorkCaseEffectRemediationRecordError;
	  };

function invalid(
	code: WorkCaseEffectRemediationRecordErrorCode,
	path: string,
	message: string,
): WorkCaseEffectRemediationRecordResult {
	return { status: "invalid", error: { code, path, message } };
}

function assessmentId(
	assessment: ActiveWorkCase["currentEffectAssessments"][number],
): string {
	return "effectSettlementId" in assessment
		? assessment.effectSettlementId
		: assessment.effectAssessmentId;
}

/** Records one remediation only while both exact settlements remain current. */
export function recordWorkCaseEffectRemediation(
	workCase: ActiveWorkCase,
	remediation: EffectRemediation,
): WorkCaseEffectRemediationRecordResult {
	const currentIssue = currentWorkCaseRecordingIssue(workCase);
	if (currentIssue) {
		return invalid(currentIssue.code, currentIssue.path, currentIssue.message);
	}
	if (remediation.workCaseId !== workCase.workCaseId) {
		return invalid(
			"identity-mismatch",
			"remediation.workCaseId",
			"Effect remediation belongs to another Work Case",
		);
	}
	const existing = workCase.effectRemediations.find(
		({ effectRemediationId }) =>
			effectRemediationId === remediation.effectRemediationId,
	);
	if (existing !== undefined) return { status: "unchanged", value: workCase };
	if (
		workCase.effectRemediations.some(
			({ adverseEffectId }) => adverseEffectId === remediation.adverseEffectId,
		)
	) {
		return invalid(
			"adverse-effect-already-remediated",
			"remediation.adverseEffectId",
			"The adverse Effect already has a current remediation",
		);
	}
	const adverse = workCase.currentEffectAssessments.find(
		({ effectId }) => effectId === remediation.adverseEffectId,
	);
	const resolving = workCase.currentEffectAssessments.find(
		({ effectId }) => effectId === remediation.remediationEffectId,
	);
	if (adverse === undefined || resolving === undefined) {
		return invalid(
			"missing-assessment",
			"remediation",
			"Both remediation assessments must be recorded in the Work Case",
		);
	}
	if (
		assessmentId(adverse) !== remediation.adverseEffectSettlementId ||
		assessmentId(resolving) !== remediation.remediationEffectSettlementId
	) {
		return invalid(
			"stale-assessment",
			"remediation",
			"Effect remediation does not bind the current assessments",
		);
	}
	const effectRemediations = Object.freeze(
		[...workCase.effectRemediations, remediation].sort((left, right) =>
			left.adverseEffectId.localeCompare(right.adverseEffectId),
		),
	);
	const sealed = sealWorkCaseRevision({ ...workCase, effectRemediations });
	if (sealed.status === "invalid") {
		return invalid(
			"invalid-work-case-inventory",
			sealed.issue.path,
			sealed.issue.message,
		);
	}
	return { status: "recorded", value: sealed.value };
}
