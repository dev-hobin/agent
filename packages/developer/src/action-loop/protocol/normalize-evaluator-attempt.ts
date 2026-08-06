export const MAX_EVALUATOR_ATTEMPT_DETAIL_LENGTH = 4_096;

export interface EvaluatorAttemptProvenance {
	readonly adapter: string;
	readonly provider?: string;
	readonly model?: string;
}

export type EvaluatorAttempt =
	| {
			readonly outcome: "returned";
			readonly payload: unknown;
			readonly provenance: EvaluatorAttemptProvenance;
	  }
	| {
			readonly outcome: "refused" | "timed-out" | "failed";
			readonly detail?: string;
			readonly provenance: EvaluatorAttemptProvenance;
	  };

export interface ProposalRefinementError {
	readonly code: string;
	readonly message: string;
}

export type ProposalRefinementResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: ProposalRefinementError };

export type EvaluatorUnresolvedReason =
	| "refused"
	| "timed-out"
	| "failed"
	| "empty"
	| "malformed";

export type NormalizedEvaluatorAttempt<T> =
	| {
			readonly status: "proposal";
			readonly value: T;
			readonly provenance: EvaluatorAttemptProvenance;
	  }
	| {
			readonly status: "unresolved";
			readonly reason: EvaluatorUnresolvedReason;
			readonly detail?: string;
			readonly provenance: EvaluatorAttemptProvenance;
	  }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code: "invalid-attempt-provenance" | "invalid-attempt-detail";
				readonly path: string;
				readonly message: string;
			};
	  };

function canonicalOptionalText(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const normalized = value.trim();
	return normalized.length === 0 ? undefined : normalized;
}

function canonicalProvenance(
	provenance: EvaluatorAttemptProvenance,
):
	| { readonly ok: true; readonly value: EvaluatorAttemptProvenance }
	| {
			readonly ok: false;
			readonly result: NormalizedEvaluatorAttempt<never>;
	  } {
	if (
		typeof provenance !== "object" ||
		provenance === null ||
		typeof provenance.adapter !== "string" ||
		provenance.adapter.trim().length === 0
	) {
		return {
			ok: false,
			result: {
				status: "invalid",
				error: {
					code: "invalid-attempt-provenance",
					path: "attempt.provenance.adapter",
					message: "Expected a nonblank evaluator adapter identity",
				},
			},
		};
	}
	for (const [key, value] of [
		["provider", provenance.provider],
		["model", provenance.model],
	] as const) {
		if (value !== undefined && (typeof value !== "string" || value.trim().length === 0)) {
			return {
				ok: false,
				result: {
					status: "invalid",
					error: {
						code: "invalid-attempt-provenance",
						path: `attempt.provenance.${key}`,
						message: `Expected a nonblank ${key} identity`,
					},
				},
			};
		}
	}
	const provider = canonicalOptionalText(provenance.provider);
	const model = canonicalOptionalText(provenance.model);
	return {
		ok: true,
		value: Object.freeze({
			adapter: provenance.adapter.trim(),
			...(provider === undefined ? {} : { provider }),
			...(model === undefined ? {} : { model }),
		}),
	};
}

function isEmptyPayload(payload: unknown): boolean {
	return (
		payload === undefined ||
		payload === null ||
		(typeof payload === "string" && payload.trim().length === 0)
	);
}

/** Normalizes one evaluator transport attempt without granting domain success. */
export function normalizeEvaluatorAttempt<T>(
	attempt: EvaluatorAttempt,
	refine: (payload: unknown) => ProposalRefinementResult<T>,
): NormalizedEvaluatorAttempt<T> {
	const provenance = canonicalProvenance(attempt.provenance);
	if (!provenance.ok) return provenance.result;
	if (attempt.outcome !== "returned") {
		const detail = canonicalOptionalText(attempt.detail);
		if (detail !== undefined && detail.length > MAX_EVALUATOR_ATTEMPT_DETAIL_LENGTH) {
			return {
				status: "invalid",
				error: {
					code: "invalid-attempt-detail",
					path: "attempt.detail",
					message: "Evaluator attempt detail exceeds the bounded maximum",
				},
			};
		}
		return Object.freeze({
			status: "unresolved",
			reason: attempt.outcome,
			...(detail === undefined ? {} : { detail }),
			provenance: provenance.value,
		});
	}
	if (isEmptyPayload(attempt.payload)) {
		return Object.freeze({
			status: "unresolved",
			reason: "empty",
			provenance: provenance.value,
		});
	}
	let refined: ProposalRefinementResult<T>;
	try {
		refined = refine(attempt.payload);
	} catch (error) {
		return Object.freeze({
			status: "unresolved",
			reason: "malformed",
			detail: error instanceof Error ? error.message : "Proposal refinement failed",
			provenance: provenance.value,
		});
	}
	if (!refined.ok) {
		return Object.freeze({
			status: "unresolved",
			reason: "malformed",
			detail: `${refined.error.code}: ${refined.error.message}`,
			provenance: provenance.value,
		});
	}
	return Object.freeze({
		status: "proposal",
		value: refined.value,
		provenance: provenance.value,
	});
}
