import type {
	ActionCandidate,
	ActionCandidateProvenance,
} from "../action/accept-action-candidate.ts";
import type { ActionClearance } from "../action/action-clearance.ts";
import type { PendingEffect } from "../effect/begin-effect.ts";
import type {
	EffectSettlement,
	UnsettledEffectAssessment,
} from "../effect/effect-settlement.ts";
import { hashIdentity } from "../identity/hash-identity.ts";
import type { JudgmentConclusion } from "../judgment/close-judgment.ts";

export const OUTCOME_VERSION = "developer-outcome/v1";
export const WORK_CASE_VERSION = "developer-work-case/v1";
export const WORK_CASE_REVISION_VERSION = "developer-work-case-revision/v1";

const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export interface OutcomeProposal {
	readonly statement: string;
	readonly acceptanceConditions: readonly string[];
	readonly constraints: readonly string[];
}

export interface WorkCaseProposal {
	readonly outcome: OutcomeProposal;
	readonly provenance: ActionCandidateProvenance;
}

export interface Outcome {
	readonly outcomeId: string;
	readonly statement: string;
	readonly acceptanceConditions: readonly string[];
	readonly constraints: readonly string[];
}

export interface ActiveWorkCase {
	readonly workCaseId: string;
	readonly revisionId: string;
	readonly outcome: Outcome;
	readonly status: "active";
	readonly conclusions: readonly JudgmentConclusion[];
	readonly actionCandidates: readonly ActionCandidate[];
	readonly actionClearances: readonly ActionClearance[];
	readonly effects: readonly PendingEffect[];
	readonly currentEffectAssessments: readonly (
		| EffectSettlement
		| UnsettledEffectAssessment
	)[];
	readonly provenance: ActionCandidateProvenance;
}

export type WorkCaseOpeningErrorCode =
	| "empty-outcome"
	| "missing-acceptance-condition"
	| "invalid-acceptance-condition"
	| "invalid-constraint"
	| "duplicate-value"
	| "unsupported-provenance"
	| "invalid-provenance";

export interface WorkCaseOpeningError {
	readonly code: WorkCaseOpeningErrorCode;
	readonly path: string;
	readonly message: string;
}

export type WorkCaseOpeningResult =
	| { readonly status: "opened"; readonly value: ActiveWorkCase }
	| { readonly status: "invalid"; readonly error: WorkCaseOpeningError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: WorkCaseOpeningError };

function invalid(
	code: WorkCaseOpeningErrorCode,
	path: string,
	message: string,
): WorkCaseOpeningResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(
	value: string,
	code: WorkCaseOpeningErrorCode,
	path: string,
): CanonicalResult<string> {
	if (typeof value !== "string" || value.trim().length === 0) {
		return {
			ok: false,
			error: { code, path, message: "Expected a nonblank string" },
		};
	}
	return { ok: true, value: value.trim() };
}

interface CanonicalListContract {
	readonly path: string;
	readonly emptyCode?: "missing-acceptance-condition";
	readonly invalidCode: "invalid-acceptance-condition" | "invalid-constraint";
}

function canonicalList(
	values: readonly string[],
	contract: CanonicalListContract,
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values)) {
		return {
			ok: false,
			error: {
				code: contract.invalidCode,
				path: contract.path,
				message: "Expected a list",
			},
		};
	}
	if (contract.emptyCode !== undefined && values.length === 0) {
		return {
			ok: false,
			error: {
				code: contract.emptyCode,
				path: contract.path,
				message: "Expected at least one acceptance condition",
			},
		};
	}
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const raw = values[index];
		const value = typeof raw === "string" ? raw.trim() : "";
		if (value.length === 0) {
			return {
				ok: false,
				error: {
					code: contract.invalidCode,
					path: `${contract.path}[${index}]`,
					message: "Expected a nonblank value",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${contract.path}[${index}]`,
					message: "Value duplicates an earlier normalized value",
				},
			};
		}
		seen.add(value);
		normalized.push(value);
	}
	normalized.sort((left, right) => left.localeCompare(right));
	return { ok: true, value: Object.freeze(normalized) };
}

function canonicalProvenance(
	provenance: ActionCandidateProvenance,
): CanonicalResult<ActionCandidateProvenance> {
	if (
		typeof provenance !== "object" ||
		provenance === null ||
		!PROVENANCE_KINDS.has(provenance.kind)
	) {
		return {
			ok: false,
			error: {
				code: "unsupported-provenance",
				path: "proposal.provenance.kind",
				message: "Unsupported Work Case provenance kind",
			},
		};
	}
	const source = canonicalText(
		provenance.source,
		"invalid-provenance",
		"proposal.provenance.source",
	);
	if (!source.ok) return source;
	return {
		ok: true,
		value: Object.freeze({ kind: provenance.kind, source: source.value }),
	};
}

type WorkCaseRevisionState = Omit<
	ActiveWorkCase,
	"revisionId" | "status" | "provenance" | "outcome"
>;

function sortedIds(ids: readonly string[]): readonly string[] {
	return [...ids].sort((left, right) => left.localeCompare(right));
}

/** Derives the current Work Case revision from its complete closure inventory. */
export function deriveWorkCaseRevisionId(
	state: WorkCaseRevisionState,
): string {
	const assessmentIds = state.currentEffectAssessments.map((assessment) =>
		"effectSettlementId" in assessment
			? assessment.effectSettlementId
			: assessment.effectAssessmentId,
	);
	return hashIdentity("work_case_revision", WORK_CASE_REVISION_VERSION, [
		state.workCaseId,
		"conclusions",
		String(state.conclusions.length),
		...sortedIds(state.conclusions.map(({ conclusionId }) => conclusionId)),
		"action-candidates",
		String(state.actionCandidates.length),
		...sortedIds(
			state.actionCandidates.map(({ actionCandidateId }) => actionCandidateId),
		),
		"action-clearances",
		String(state.actionClearances.length),
		...sortedIds(
			state.actionClearances.map(({ actionClearanceId }) => actionClearanceId),
		),
		"effects",
		String(state.effects.length),
		...sortedIds(state.effects.map(({ effectId }) => effectId)),
		"current-effect-assessments",
		String(assessmentIds.length),
		...sortedIds(assessmentIds),
	]);
}

/** Opens one active Work Case around one bounded Outcome. */
export function openWorkCase(
	proposal: WorkCaseProposal,
): WorkCaseOpeningResult {
	if (typeof proposal.outcome !== "object" || proposal.outcome === null) {
		return invalid("empty-outcome", "proposal.outcome", "Expected an Outcome");
	}
	const statement = canonicalText(
		proposal.outcome.statement,
		"empty-outcome",
		"proposal.outcome.statement",
	);
	if (!statement.ok) return { status: "invalid", error: statement.error };
	const acceptanceConditions = canonicalList(
		proposal.outcome.acceptanceConditions,
		{
			path: "proposal.outcome.acceptanceConditions",
			emptyCode: "missing-acceptance-condition",
			invalidCode: "invalid-acceptance-condition",
		},
	);
	if (!acceptanceConditions.ok) {
		return { status: "invalid", error: acceptanceConditions.error };
	}
	const constraints = canonicalList(proposal.outcome.constraints, {
		path: "proposal.outcome.constraints",
		invalidCode: "invalid-constraint",
	});
	if (!constraints.ok) return { status: "invalid", error: constraints.error };
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	const outcomeId = hashIdentity("outcome", OUTCOME_VERSION, [
		statement.value,
		"acceptance-conditions",
		String(acceptanceConditions.value.length),
		...acceptanceConditions.value,
		"constraints",
		String(constraints.value.length),
		...constraints.value,
	]);
	const outcome = Object.freeze({
		outcomeId,
		statement: statement.value,
		acceptanceConditions: acceptanceConditions.value,
		constraints: constraints.value,
	});
	const workCaseId = hashIdentity("work_case", WORK_CASE_VERSION, [outcomeId]);
	const revisionId = deriveWorkCaseRevisionId({
		workCaseId,
		conclusions: [],
		actionCandidates: [],
		actionClearances: [],
		effects: [],
		currentEffectAssessments: [],
	});
	return {
		status: "opened",
		value: Object.freeze({
			workCaseId,
			revisionId,
			outcome,
			status: "active",
			conclusions: Object.freeze([]),
			actionCandidates: Object.freeze([]),
			actionClearances: Object.freeze([]),
			effects: Object.freeze([]),
			currentEffectAssessments: Object.freeze([]),
			provenance: provenance.value,
		}),
	};
}
