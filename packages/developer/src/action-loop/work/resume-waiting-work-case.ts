import { hashIdentity } from "../identity/hash-identity.ts";
import {
	WORK_CASE_WAIT_VERSION,
	type WaitingWorkCase,
} from "./wait-work-case.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_WAIT_RESUME_VERSION =
	"developer-work-case-wait-resume/v1";

export interface ResumePredicateAssessmentProposal {
	readonly resumePredicate: string;
	readonly status: "satisfied" | "not-satisfied" | "unknown";
	readonly observationKind: string;
	readonly observationId: string;
	readonly source: string;
	readonly basis: readonly string[];
}

export interface ResumeWaitingWorkCaseProposal {
	readonly workCaseId: string;
	readonly expectedRevisionId: string;
	readonly assessment: ResumePredicateAssessmentProposal;
}

export type ResumeWaitingWorkCaseResult =
	| { readonly status: "active"; readonly value: ActiveWorkCase }
	| { readonly status: "waiting"; readonly value: WaitingWorkCase }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code:
					| "stale-waiting-work-case"
					| "invalid-work-case-inventory"
					| "identity-mismatch"
					| "observation-required"
					| "invalid-resume-assessment";
				readonly path: string;
				readonly message: string;
			};
	  };

function invalid(
	code: Extract<
		ResumeWaitingWorkCaseResult,
		{ status: "invalid" }
	>["error"]["code"],
	path: string,
	message: string,
): ResumeWaitingWorkCaseResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(value: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length === 0 ? undefined : normalized;
}

function canonicalBasis(
	values: readonly string[],
): readonly string[] | undefined {
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const normalized: string[] = [];
	for (const value of values) {
		const text = canonicalText(value);
		if (text === undefined) return undefined;
		normalized.push(text);
	}
	if (new Set(normalized).size !== normalized.length) return undefined;
	return Object.freeze(
		normalized.sort((left, right) => left.localeCompare(right)),
	);
}

interface CanonicalResumeAssessment {
	readonly status: ResumePredicateAssessmentProposal["status"];
	readonly observationKind: "human" | "tool" | "external";
	readonly observationId: string;
	readonly source: string;
	readonly basis: readonly string[];
}

type CanonicalAssessmentResult =
	| { readonly ok: true; readonly value: CanonicalResumeAssessment }
	| {
			readonly ok: false;
			readonly result: ResumeWaitingWorkCaseResult;
	  };

function canonicalAssessment(
	proposal: ResumePredicateAssessmentProposal,
	expectedPredicate: string,
): CanonicalAssessmentResult {
	if (canonicalText(proposal.resumePredicate) !== expectedPredicate) {
		return {
			ok: false,
			result: invalid(
				"identity-mismatch",
				"proposal.assessment.resumePredicate",
				"Resume assessment does not bind the waiting predicate",
			),
		};
	}
	if (
		proposal.status !== "satisfied" &&
		proposal.status !== "not-satisfied" &&
		proposal.status !== "unknown"
	) {
		return {
			ok: false,
			result: invalid(
				"invalid-resume-assessment",
				"proposal.assessment.status",
				"Unsupported resume predicate assessment status",
			),
		};
	}
	if (
		proposal.observationKind !== "human" &&
		proposal.observationKind !== "tool" &&
		proposal.observationKind !== "external"
	) {
		return {
			ok: false,
			result: invalid(
				"observation-required",
				"proposal.assessment.observationKind",
				"Resume assessment requires a human, tool, or external Observation",
			),
		};
	}
	const observationId = canonicalText(proposal.observationId);
	const source = canonicalText(proposal.source);
	const basis = canonicalBasis(proposal.basis);
	if (
		observationId === undefined ||
		source === undefined ||
		basis === undefined
	) {
		return {
			ok: false,
			result: invalid(
				"invalid-resume-assessment",
				"proposal.assessment",
				"Resume assessment evidence must be explicit",
			),
		};
	}
	return {
		ok: true,
		value: {
			status: proposal.status,
			observationKind: proposal.observationKind,
			observationId,
			source,
			basis,
		},
	};
}

/** Resumes waiting only when current Observation satisfies its exact predicate. */
export function resumeWaitingWorkCase(
	workCase: WaitingWorkCase,
	proposal: ResumeWaitingWorkCaseProposal,
): ResumeWaitingWorkCaseResult {
	const inventoryRevisionId = deriveWorkCaseRevisionId(workCase);
	const expectedWaitingRevisionId = hashIdentity(
		"work_case_wait_revision",
		WORK_CASE_WAIT_VERSION,
		[workCase.priorRevisionId, workCase.wait.workCaseWaitId],
	);
	if (
		workCase.priorRevisionId !== inventoryRevisionId ||
		workCase.revisionId !== expectedWaitingRevisionId
	) {
		return invalid(
			"stale-waiting-work-case",
			"workCase.revisionId",
			"Waiting Work Case does not preserve its prior inventory revision",
		);
	}
	const issue = workCaseInventoryIssue(workCase);
	if (issue !== undefined) {
		return invalid("invalid-work-case-inventory", issue.path, issue.message);
	}
	if (
		proposal.workCaseId !== workCase.workCaseId ||
		proposal.expectedRevisionId !== workCase.revisionId
	) {
		return invalid(
			"identity-mismatch",
			"proposal",
			"Resume assessment does not bind the waiting Work Case revision",
		);
	}
	const assessment = canonicalAssessment(
		proposal.assessment,
		workCase.wait.resumePredicate,
	);
	if (!assessment.ok) return assessment.result;
	if (assessment.value.status !== "satisfied") {
		return { status: "waiting", value: workCase };
	}
	const workCaseWaitResumeId = hashIdentity(
		"work_case_wait_resume",
		WORK_CASE_WAIT_RESUME_VERSION,
		[
			workCase.workCaseId,
			workCase.revisionId,
			workCase.wait.resumePredicate,
			assessment.value.observationKind,
			assessment.value.observationId,
			assessment.value.source,
			...assessment.value.basis,
		],
	);
	const continuityIds = Object.freeze([
		...workCase.continuityIds,
		workCase.wait.workCaseWaitId,
		workCaseWaitResumeId,
	]);
	const {
		wait: _wait,
		priorRevisionId: _priorRevisionId,
		revisionId: _revisionId,
		status: _status,
		...preserved
	} = workCase;
	const nextState = { ...preserved, continuityIds };
	return {
		status: "active",
		value: Object.freeze({
			...nextState,
			status: "active",
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
