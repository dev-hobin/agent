import type { ActionCandidateProvenance } from "../action/accept-action-candidate.ts";
import type { EffectSettlement } from "./effect-settlement.ts";
import { hashIdentity } from "../identity/hash-identity.ts";

export const EFFECT_REMEDIATION_VERSION = "developer-effect-remediation/v1";

const MAX_BASIS_ITEMS = 16;
const MAX_TEXT_LENGTH = 4_096;
const PROVENANCE_KINDS = new Set(["model", "human", "tool", "external"]);

export interface EffectRemediationProposal {
	readonly workCaseId: string;
	readonly adverseEffectId: string;
	readonly adverseEffectSettlementId: string;
	readonly remediationEffectId: string;
	readonly remediationEffectSettlementId: string;
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface EffectRemediation {
	readonly effectRemediationId: string;
	readonly workCaseId: string;
	readonly adverseEffectId: string;
	readonly adverseEffectSettlementId: string;
	readonly remediationEffectId: string;
	readonly remediationEffectSettlementId: string;
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export type EffectRemediationErrorCode =
	| "identity-mismatch"
	| "not-adverse"
	| "remediation-not-successful"
	| "same-effect"
	| "invalid-basis"
	| "duplicate-basis"
	| "unsupported-provenance"
	| "invalid-provenance";

export interface EffectRemediationError {
	readonly code: EffectRemediationErrorCode;
	readonly path: string;
	readonly message: string;
}

export type EffectRemediationAcceptanceResult =
	| { readonly status: "accepted"; readonly value: EffectRemediation }
	| { readonly status: "invalid"; readonly error: EffectRemediationError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: EffectRemediationError };

function invalid(
	code: EffectRemediationErrorCode,
	path: string,
	message: string,
): EffectRemediationAcceptanceResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalBasis(values: readonly string[]): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values) || values.length === 0 || values.length > MAX_BASIS_ITEMS) {
		return {
			ok: false,
			error: {
				code: "invalid-basis",
				path: "proposal.basis",
				message: `Expected between 1 and ${MAX_BASIS_ITEMS} basis statements`,
			},
		};
	}
	const basis: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const value = typeof values[index] === "string" ? values[index].trim() : "";
		if (value.length === 0 || value.length > MAX_TEXT_LENGTH) {
			return {
				ok: false,
				error: {
					code: "invalid-basis",
					path: `proposal.basis[${index}]`,
					message: "Expected a bounded nonblank basis statement",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-basis",
					path: `proposal.basis[${index}]`,
					message: "Basis statement duplicates an earlier normalized value",
				},
			};
		}
		seen.add(value);
		basis.push(value);
	}
	basis.sort((left, right) => left.localeCompare(right));
	return { ok: true, value: Object.freeze(basis) };
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
				message: "Unsupported Effect remediation provenance kind",
			},
		};
	}
	const source = typeof provenance.source === "string" ? provenance.source.trim() : "";
	if (source.length === 0 || source.length > MAX_TEXT_LENGTH) {
		return {
			ok: false,
			error: {
				code: "invalid-provenance",
				path: "proposal.provenance.source",
				message: "Expected bounded nonblank provenance source",
			},
		};
	}
	return { ok: true, value: Object.freeze({ kind: provenance.kind, source }) };
}

/** Binds one adverse settlement to a distinct observed-success remediation. */
export function acceptEffectRemediation(
	adverse: EffectSettlement,
	remediation: EffectSettlement,
	proposal: EffectRemediationProposal,
): EffectRemediationAcceptanceResult {
	if (
		proposal.workCaseId !== adverse.workCaseId ||
		proposal.workCaseId !== remediation.workCaseId ||
		proposal.adverseEffectId !== adverse.effectId ||
		proposal.adverseEffectSettlementId !== adverse.effectSettlementId ||
		proposal.remediationEffectId !== remediation.effectId ||
		proposal.remediationEffectSettlementId !== remediation.effectSettlementId
	) {
		return invalid(
			"identity-mismatch",
			"proposal",
			"Effect remediation does not bind the supplied settlements",
		);
	}
	if (adverse.outcome !== "failed" && adverse.outcome !== "partially-applied") {
		return invalid(
			"not-adverse",
			"adverse.outcome",
			"Only a failed or partially-applied Effect requires remediation",
		);
	}
	if (remediation.outcome !== "observed-success") {
		return invalid(
			"remediation-not-successful",
			"remediation.outcome",
			"Remediation requires an observed-success settlement",
		);
	}
	if (adverse.effectId === remediation.effectId) {
		return invalid(
			"same-effect",
			"proposal.remediationEffectId",
			"An adverse Effect cannot remediate itself",
		);
	}
	const basis = canonicalBasis(proposal.basis);
	if (!basis.ok) return { status: "invalid", error: basis.error };
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	return {
		status: "accepted",
		value: Object.freeze({
			effectRemediationId: hashIdentity(
				"effect_remediation",
				EFFECT_REMEDIATION_VERSION,
				[
					proposal.workCaseId,
					proposal.adverseEffectId,
					proposal.adverseEffectSettlementId,
					proposal.remediationEffectId,
					proposal.remediationEffectSettlementId,
					"basis",
					String(basis.value.length),
					...basis.value,
				],
			),
			workCaseId: proposal.workCaseId,
			adverseEffectId: proposal.adverseEffectId,
			adverseEffectSettlementId: proposal.adverseEffectSettlementId,
			remediationEffectId: proposal.remediationEffectId,
			remediationEffectSettlementId: proposal.remediationEffectSettlementId,
			basis: basis.value,
			provenance: provenance.value,
		}),
	};
}
