import type { ActionCandidateProvenance } from "../action/accept-action-candidate.ts";
import { hashIdentity } from "../identity/hash-identity.ts";
import type { PendingEffect } from "./begin-effect.ts";

export const EFFECT_OBSERVATION_VERSION = "developer-effect-observation/v1";

const EVIDENCE_KINDS: ReadonlySet<string> = new Set([
	"tool-result",
	"artifact-state",
	"verifier-result",
	"process-state",
	"external-state",
]);
const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type EffectEvidenceKind =
	| "tool-result"
	| "artifact-state"
	| "verifier-result"
	| "process-state"
	| "external-state";

export interface EffectEvidence {
	readonly kind: EffectEvidenceKind;
	readonly locator: string;
	readonly fingerprint: string;
}

export interface EffectObservationProposal {
	readonly workCaseId: string;
	readonly effectId: string;
	readonly occurrenceId: string;
	readonly evidence: EffectEvidence;
	readonly statement: string;
	readonly limitations: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface EffectObservation {
	readonly effectObservationId: string;
	readonly workCaseId: string;
	readonly effectId: string;
	readonly occurrenceId: string;
	readonly evidence: EffectEvidence;
	readonly statement: string;
	readonly limitations: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export type EffectObservationErrorCode =
	| "identity-mismatch"
	| "unsupported-evidence-kind"
	| "invalid-evidence-locator"
	| "invalid-evidence-fingerprint"
	| "empty-statement"
	| "invalid-limitation"
	| "duplicate-value"
	| "unsupported-provenance"
	| "invalid-provenance";

export interface EffectObservationError {
	readonly code: EffectObservationErrorCode;
	readonly path: string;
	readonly message: string;
}

export type EffectObservationAcceptanceResult =
	| { readonly status: "accepted"; readonly value: EffectObservation }
	| { readonly status: "invalid"; readonly error: EffectObservationError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: EffectObservationError };

function invalid(
	code: EffectObservationErrorCode,
	path: string,
	message: string,
): EffectObservationAcceptanceResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(
	value: string,
	code: EffectObservationErrorCode,
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

function canonicalLimitations(
	values: readonly string[],
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values)) {
		return {
			ok: false,
			error: {
				code: "invalid-limitation",
				path: "proposal.limitations",
				message: "Expected a limitation list",
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
					code: "invalid-limitation",
					path: `proposal.limitations[${index}]`,
					message: "Expected a nonblank limitation",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `proposal.limitations[${index}]`,
					message: "Limitation duplicates an earlier normalized value",
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
				message: "Unsupported Effect Observation provenance kind",
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

/** Accepts exact evidence for one Effect without settling the Effect. */
export function acceptEffectObservation(
	effect: PendingEffect,
	proposal: EffectObservationProposal,
): EffectObservationAcceptanceResult {
	for (const [path, actual, expected] of [
		["proposal.workCaseId", proposal.workCaseId, effect.workCaseId],
		["proposal.effectId", proposal.effectId, effect.effectId],
		["proposal.occurrenceId", proposal.occurrenceId, effect.occurrenceId],
	] as const) {
		if (actual !== expected) {
			return invalid(
				"identity-mismatch",
				path,
				`Expected ${expected}, received ${actual}`,
			);
		}
	}
	if (
		typeof proposal.evidence !== "object" ||
		proposal.evidence === null ||
		!EVIDENCE_KINDS.has(proposal.evidence.kind)
	) {
		return invalid(
			"unsupported-evidence-kind",
			"proposal.evidence.kind",
			"Unsupported Effect evidence kind",
		);
	}
	const locator = canonicalText(
		proposal.evidence.locator,
		"invalid-evidence-locator",
		"proposal.evidence.locator",
	);
	if (!locator.ok) return { status: "invalid", error: locator.error };
	if (!/^[a-f0-9]{64}$/.test(proposal.evidence.fingerprint)) {
		return invalid(
			"invalid-evidence-fingerprint",
			"proposal.evidence.fingerprint",
			"Expected a lowercase SHA-256 fingerprint",
		);
	}
	const statement = canonicalText(
		proposal.statement,
		"empty-statement",
		"proposal.statement",
	);
	if (!statement.ok) return { status: "invalid", error: statement.error };
	const limitations = canonicalLimitations(proposal.limitations);
	if (!limitations.ok) {
		return { status: "invalid", error: limitations.error };
	}
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	const evidence = Object.freeze({
		kind: proposal.evidence.kind,
		locator: locator.value,
		fingerprint: proposal.evidence.fingerprint,
	});
	const effectObservationId = hashIdentity(
		"effect_observation",
		EFFECT_OBSERVATION_VERSION,
		[
			effect.effectId,
			effect.occurrenceId,
			"evidence",
			evidence.kind,
			evidence.locator,
			evidence.fingerprint,
			"statement",
			statement.value,
			"limitations",
			String(limitations.value.length),
			...limitations.value,
		],
	);
	return {
		status: "accepted",
		value: Object.freeze({
			effectObservationId,
			workCaseId: effect.workCaseId,
			effectId: effect.effectId,
			occurrenceId: effect.occurrenceId,
			evidence,
			statement: statement.value,
			limitations: limitations.value,
			provenance: provenance.value,
		}),
	};
}
