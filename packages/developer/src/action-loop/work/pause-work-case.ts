import { hashIdentity } from "../identity/hash-identity.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_PAUSE_VERSION = "developer-work-case-pause/v1";

export interface PauseDecisionProposal {
	readonly kind: string;
	readonly decisionId: string;
	readonly source: string;
	readonly basis: readonly string[];
}

export interface HumanPauseDecision extends PauseDecisionProposal {
	readonly kind: "human";
}

export interface PauseWorkCaseProposal {
	readonly workCaseId: string;
	readonly expectedRevisionId: string;
	readonly reason: string;
	readonly decision: PauseDecisionProposal;
}

export interface WorkCasePause {
	readonly workCasePauseId: string;
	readonly reason: string;
	readonly decision: HumanPauseDecision;
}

export interface PausedWorkCase
	extends Omit<ActiveWorkCase, "status" | "revisionId"> {
	readonly status: "paused";
	readonly revisionId: string;
	readonly priorRevisionId: string;
	readonly pause: WorkCasePause;
}

export type PauseWorkCaseResult =
	| { readonly status: "paused"; readonly value: PausedWorkCase }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code:
					| "stale-work-case"
					| "invalid-work-case-inventory"
					| "identity-mismatch"
					| "human-decision-required"
					| "invalid-pause-decision";
				readonly path: string;
				readonly message: string;
			};
	  };

function invalid(
	code: Extract<PauseWorkCaseResult, { status: "invalid" }>["error"]["code"],
	path: string,
	message: string,
): PauseWorkCaseResult {
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
	const strings: string[] = [];
	for (const value of values) {
		const normalized = canonicalText(value);
		if (normalized === undefined) return undefined;
		strings.push(normalized);
	}
	if (new Set(strings).size !== strings.length) return undefined;
	return Object.freeze(
		strings.sort((left, right) => left.localeCompare(right)),
	);
}

/** Pauses one current Work Case only on an explicit human decision. */
export function pauseWorkCase(
	workCase: ActiveWorkCase,
	proposal: PauseWorkCaseProposal,
): PauseWorkCaseResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
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
			"Pause proposal does not bind the current Work Case revision",
		);
	}
	if (proposal.decision?.kind !== "human") {
		return invalid(
			"human-decision-required",
			"proposal.decision.kind",
			"Pausing a Work Case requires an explicit human decision",
		);
	}
	const reason = canonicalText(proposal.reason);
	const decisionId = canonicalText(proposal.decision.decisionId);
	const source = canonicalText(proposal.decision.source);
	const basis = canonicalBasis(proposal.decision.basis);
	if (
		reason === undefined ||
		decisionId === undefined ||
		source === undefined ||
		basis === undefined
	) {
		return invalid(
			"invalid-pause-decision",
			"proposal",
			"Pause reason and human decision evidence must be explicit",
		);
	}
	const decision = Object.freeze({
		kind: "human" as const,
		decisionId,
		source,
		basis,
	});
	const workCasePauseId = hashIdentity(
		"work_case_pause",
		WORK_CASE_PAUSE_VERSION,
		[
			workCase.workCaseId,
			workCase.revisionId,
			reason,
			decisionId,
			source,
			...basis,
		],
	);
	const pause = Object.freeze({ workCasePauseId, reason, decision });
	return {
		status: "paused",
		value: Object.freeze({
			...workCase,
			status: "paused",
			priorRevisionId: workCase.revisionId,
			revisionId: hashIdentity(
				"work_case_pause_revision",
				WORK_CASE_PAUSE_VERSION,
				[workCase.revisionId, workCasePauseId],
			),
			pause,
		}),
	};
}
