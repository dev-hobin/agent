import { hashIdentity } from "../identity/hash-identity.ts";
import { effectAssessmentId } from "./record-work-case-effect-assessment.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const CLOSURE_TARGET_VERSION = "developer-closure-target/v1";

export interface ClosureObligation {
	readonly closureObligationId: string;
	readonly kind: "acceptance-condition" | "constraint";
	readonly statement: string;
}

export interface SealedClosureTarget {
	readonly closureTargetId: string;
	readonly workCaseId: string;
	readonly workCaseRevisionId: string;
	readonly outcomeId: string;
	readonly obligations: readonly ClosureObligation[];
	readonly conclusionIds: readonly string[];
	readonly actionCandidateIds: readonly string[];
	readonly actionClearanceIds: readonly string[];
	readonly effectIds: readonly string[];
	readonly effectAssessmentIds: readonly string[];
	readonly effectRemediationIds: readonly string[];
}

export type ClosureTargetBlockerCode =
	| "open-judgment"
	| "missing-claim-assurance"
	| "missing-no-action-intervention"
	| "noncompletion-disposition"
	| "missing-effect-assessment"
	| "unsettled-effect"
	| "adverse-effect";

export interface ClosureTargetBlocker {
	readonly code: ClosureTargetBlockerCode;
	readonly subjectId: string;
	readonly message: string;
}

export type ClosureTargetPreparationResult =
	| { readonly status: "ready"; readonly value: SealedClosureTarget }
	| {
			readonly status: "not-ready";
			readonly blockers: readonly ClosureTargetBlocker[];
	  }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code: "stale-work-case" | "invalid-work-case-inventory";
				readonly path: string;
				readonly message: string;
			};
	  };

function sorted(ids: readonly string[]): readonly string[] {
	return Object.freeze(
		[...ids].sort((left, right) => left.localeCompare(right)),
	);
}

function closureObligations(
	workCase: ActiveWorkCase,
): readonly ClosureObligation[] {
	const obligations: ClosureObligation[] = [];
	for (const [kind, statements] of [
		["acceptance-condition", workCase.outcome.acceptanceConditions],
		["constraint", workCase.outcome.constraints],
	] as const) {
		for (const statement of statements) {
			obligations.push(
				Object.freeze({
					closureObligationId: hashIdentity(
						"closure_obligation",
						CLOSURE_TARGET_VERSION,
						[workCase.outcome.outcomeId, kind, statement],
					),
					kind,
					statement,
				}),
			);
		}
	}
	obligations.sort((left, right) =>
		left.closureObligationId.localeCompare(right.closureObligationId),
	);
	return Object.freeze(obligations);
}

function effectBlockers(
	workCase: ActiveWorkCase,
): readonly ClosureTargetBlocker[] {
	const blockers: ClosureTargetBlocker[] = [];
	const assessments = new Map(
		workCase.currentEffectAssessments.map((assessment) => [
			assessment.effectId,
			assessment,
		]),
	);
	const remediatedEffectIds = new Set(
		workCase.effectRemediations.map(({ adverseEffectId }) => adverseEffectId),
	);
	for (const effect of workCase.effects) {
		const assessment = assessments.get(effect.effectId);
		if (assessment === undefined) {
			blockers.push(
				Object.freeze({
					code: "missing-effect-assessment",
					subjectId: effect.effectId,
					message: "Occurred Effect has no current assessment",
				}),
			);
			continue;
		}
		if (assessment.outcome === "pending" || assessment.outcome === "unknown") {
			blockers.push(
				Object.freeze({
					code: "unsettled-effect",
					subjectId: effect.effectId,
					message: `Effect remains ${assessment.outcome}`,
				}),
			);
			continue;
		}
		if (
			(assessment.outcome === "failed" ||
				assessment.outcome === "partially-applied") &&
			!remediatedEffectIds.has(effect.effectId)
		) {
			blockers.push(
				Object.freeze({
					code: "adverse-effect",
					subjectId: effect.effectId,
					message: `Effect outcome requires resolution: ${assessment.outcome}`,
				}),
			);
		}
	}
	return Object.freeze(blockers);
}

/** Seals the complete current closure inventory without caller-selected subsets. */
export function prepareClosureTarget(
	workCase: ActiveWorkCase,
): ClosureTargetPreparationResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return {
			status: "invalid",
			error: {
				code: "stale-work-case",
				path: "workCase.revisionId",
				message: "Work Case revision does not match its closure inventory",
			},
		};
	}
	const inventoryIssue = workCaseInventoryIssue(workCase);
	if (inventoryIssue !== undefined) {
		return {
			status: "invalid",
			error: {
				code: "invalid-work-case-inventory",
				path: inventoryIssue.path,
				message: inventoryIssue.message,
			},
		};
	}
	const blockers = [
		...workCase.openJudgments.map((judgment) =>
			Object.freeze({
				code: "open-judgment" as const,
				subjectId: judgment.judgmentId,
				message: `Judgment remains open: ${judgment.question}`,
			}),
		),
		...effectBlockers(workCase),
	];
	const hasClaimAssurance = workCase.conclusions.some(
		({ category }) => category === "Claim Assurance",
	);
	if (!hasClaimAssurance) {
		blockers.push(
			Object.freeze({
				code: "missing-claim-assurance",
				subjectId: workCase.outcome.outcomeId,
				message: "Outcome closure requires a Claim Assurance Conclusion",
			}),
		);
	}
	const noActionIntervention = workCase.conclusions.find(
		(conclusion) =>
			conclusion.category === "Proportionate Intervention" &&
			conclusion.interventionDisposition === "no-action",
	);
	if (
		noActionIntervention?.noActionDisposition === "blocked" ||
		noActionIntervention?.noActionDisposition === "waiting"
	) {
		blockers.push(
			Object.freeze({
				code: "noncompletion-disposition" as const,
				subjectId: noActionIntervention.conclusionId,
				message:
					"A blocked or waiting no-Action disposition cannot become Completion",
			}),
		);
	}
	if (
		hasClaimAssurance &&
		workCase.effects.length === 0 &&
		noActionIntervention === undefined
	) {
		blockers.push(
			Object.freeze({
				code: "missing-no-action-intervention",
				subjectId: workCase.outcome.outcomeId,
				message:
					"A Work Case with no Effects can close only after a no-action Proportionate Intervention Conclusion",
			}),
		);
	}
	if (blockers.length > 0) {
		return {
			status: "not-ready",
			blockers: Object.freeze(blockers),
		};
	}

	const obligations = closureObligations(workCase);
	const conclusionIds = sorted(
		workCase.conclusions.map(({ conclusionId }) => conclusionId),
	);
	const actionCandidateIds = sorted(
		workCase.actionCandidates.map(({ actionCandidateId }) => actionCandidateId),
	);
	const actionClearanceIds = sorted(
		workCase.actionClearances.map(({ actionClearanceId }) => actionClearanceId),
	);
	const effectIds = sorted(workCase.effects.map(({ effectId }) => effectId));
	const effectAssessmentIds = sorted(
		workCase.currentEffectAssessments.map(effectAssessmentId),
	);
	const effectRemediationIds = sorted(
		workCase.effectRemediations.map(
			({ effectRemediationId }) => effectRemediationId,
		),
	);
	const identityParts = [
		workCase.workCaseId,
		workCase.revisionId,
		workCase.outcome.outcomeId,
		"obligations",
		...obligations.map(({ closureObligationId }) => closureObligationId),
		"conclusions",
		...conclusionIds,
		"action-candidates",
		...actionCandidateIds,
		"action-clearances",
		...actionClearanceIds,
		"effects",
		...effectIds,
		"effect-assessments",
		...effectAssessmentIds,
		"effect-remediations",
		...effectRemediationIds,
	];
	return {
		status: "ready",
		value: Object.freeze({
			closureTargetId: hashIdentity(
				"closure_target",
				CLOSURE_TARGET_VERSION,
				identityParts,
			),
			workCaseId: workCase.workCaseId,
			workCaseRevisionId: workCase.revisionId,
			outcomeId: workCase.outcome.outcomeId,
			obligations,
			conclusionIds,
			actionCandidateIds,
			actionClearanceIds,
			effectIds,
			effectAssessmentIds,
			effectRemediationIds,
		}),
	};
}
