import { hashIdentity } from "../identity/hash-identity.ts";
import {
	WORK_CASE_PAUSE_VERSION,
	type PausedWorkCase,
} from "./pause-work-case.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_RESUME_VERSION = "developer-work-case-resume/v1";

export interface ResumeDecisionProposal {
	readonly kind: string;
	readonly decisionId: string;
	readonly source: string;
	readonly basis: readonly string[];
}

export interface ResumePausedWorkCaseProposal {
	readonly workCaseId: string;
	readonly expectedRevisionId: string;
	readonly decision: ResumeDecisionProposal;
}

export type ResumePausedWorkCaseResult =
	| { readonly status: "active"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code:
					| "stale-paused-work-case"
					| "invalid-work-case-inventory"
					| "identity-mismatch"
					| "human-decision-required"
					| "invalid-resume-decision";
				readonly path: string;
				readonly message: string;
			};
	  };

function invalid(
	code: Extract<
		ResumePausedWorkCaseResult,
		{ status: "invalid" }
	>["error"]["code"],
	path: string,
	message: string,
): ResumePausedWorkCaseResult {
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

/** Resumes a paused Work Case with a new continuity-bound active revision. */
export function resumePausedWorkCase(
	workCase: PausedWorkCase,
	proposal: ResumePausedWorkCaseProposal,
): ResumePausedWorkCaseResult {
	const inventoryRevisionId = deriveWorkCaseRevisionId(workCase);
	const expectedPausedRevisionId = hashIdentity(
		"work_case_pause_revision",
		WORK_CASE_PAUSE_VERSION,
		[workCase.priorRevisionId, workCase.pause.workCasePauseId],
	);
	if (
		workCase.priorRevisionId !== inventoryRevisionId ||
		workCase.revisionId !== expectedPausedRevisionId
	) {
		return invalid(
			"stale-paused-work-case",
			"workCase.revisionId",
			"Paused Work Case does not preserve its prior inventory revision",
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
			"Resume proposal does not bind the paused Work Case revision",
		);
	}
	if (proposal.decision?.kind !== "human") {
		return invalid(
			"human-decision-required",
			"proposal.decision.kind",
			"Resuming a paused Work Case requires an explicit human decision",
		);
	}
	const decisionId = canonicalText(proposal.decision.decisionId);
	const source = canonicalText(proposal.decision.source);
	const basis = canonicalBasis(proposal.decision.basis);
	if (decisionId === undefined || source === undefined || basis === undefined) {
		return invalid(
			"invalid-resume-decision",
			"proposal.decision",
			"Human resume decision evidence must be explicit",
		);
	}
	const workCaseResumeId = hashIdentity(
		"work_case_resume",
		WORK_CASE_RESUME_VERSION,
		[workCase.workCaseId, workCase.revisionId, decisionId, source, ...basis],
	);
	const continuityIds = Object.freeze([
		...workCase.continuityIds,
		workCase.pause.workCasePauseId,
		workCaseResumeId,
	]);
	const {
		pause: _pause,
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
