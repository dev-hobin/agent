import type { ActionCandidateProvenance } from "../action/accept-action-candidate.ts";
import { hashIdentity } from "../identity/hash-identity.ts";
import type { SealedClosureTarget } from "./prepare-closure-target.ts";

export const CLOSURE_CLAIM_VERSION = "developer-closure-claim/v1";

const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export interface ClosureObligationDispositionProposal {
	readonly closureObligationId: string;
	readonly conclusionIds: readonly string[];
	readonly effectAssessmentIds: readonly string[];
	readonly basis: readonly string[];
}

export interface ClosureClaimProposal {
	readonly workCaseId: string;
	readonly closureTargetId: string;
	readonly mode: "completed" | "no-change";
	readonly obligationDispositions: readonly ClosureObligationDispositionProposal[];
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface ClosureObligationDisposition {
	readonly closureObligationId: string;
	readonly status: "satisfied";
	readonly conclusionIds: readonly string[];
	readonly effectAssessmentIds: readonly string[];
	readonly basis: readonly string[];
}

export interface ClosureClaim {
	readonly closureClaimId: string;
	readonly workCaseId: string;
	readonly workCaseRevisionId: string;
	readonly closureTargetId: string;
	readonly mode: "completed" | "no-change";
	readonly obligationDispositions: readonly ClosureObligationDisposition[];
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export type ClosureClaimErrorCode =
	| "identity-mismatch"
	| "unsupported-mode"
	| "obligation-accounting"
	| "undeclared-evidence"
	| "evidence-accounting"
	| "evidence-required"
	| "empty-basis"
	| "invalid-provenance";

export interface ClosureClaimError {
	readonly code: ClosureClaimErrorCode;
	readonly path: string;
	readonly message: string;
}

export type ClosureClaimAcceptanceResult =
	| { readonly status: "accepted"; readonly value: ClosureClaim }
	| { readonly status: "invalid"; readonly error: ClosureClaimError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: ClosureClaimError };

interface DispositionContext {
	readonly obligationIds: ReadonlySet<string>;
	readonly accountedIds: ReadonlySet<string>;
	readonly conclusionIds: ReadonlySet<string>;
	readonly effectAssessmentIds: ReadonlySet<string>;
}

interface CanonicalDispositionAccounting {
	readonly dispositions: readonly ClosureObligationDisposition[];
	readonly citedConclusionIds: ReadonlySet<string>;
	readonly citedEffectAssessmentIds: ReadonlySet<string>;
}

function canonicalStrings(
	values: readonly string[],
	path: string,
	allowed?: ReadonlySet<string>,
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values)) {
		return {
			ok: false,
			error: {
				code: allowed === undefined ? "empty-basis" : "undeclared-evidence",
				path,
				message: "Expected a list",
			},
		};
	}
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const raw = values[index];
		const value = typeof raw === "string" ? raw.trim() : "";
		if (value.length === 0 || seen.has(value)) {
			return {
				ok: false,
				error: {
					code: allowed === undefined ? "empty-basis" : "undeclared-evidence",
					path: `${path}[${index}]`,
					message: "Expected a unique nonblank value",
				},
			};
		}
		if (allowed !== undefined && !allowed.has(value)) {
			return {
				ok: false,
				error: {
					code: "undeclared-evidence",
					path: `${path}[${index}]`,
					message: `Evidence is not present in the Closure Target: ${value}`,
				},
			};
		}
		seen.add(value);
		normalized.push(value);
	}
	normalized.sort((left, right) => left.localeCompare(right));
	return { ok: true, value: Object.freeze(normalized) };
}

function canonicalBasis(
	values: readonly string[],
	path: string,
): CanonicalResult<readonly string[]> {
	const result = canonicalStrings(values, path);
	if (!result.ok) return result;
	if (result.value.length === 0) {
		return {
			ok: false,
			error: { code: "empty-basis", path, message: "Expected explicit basis" },
		};
	}
	return result;
}

function canonicalDisposition(
	proposal: ClosureObligationDispositionProposal | undefined,
	index: number,
	context: DispositionContext,
): CanonicalResult<ClosureObligationDisposition> {
	const path = `proposal.obligationDispositions[${index}]`;
	if (
		proposal === undefined ||
		!context.obligationIds.has(proposal.closureObligationId) ||
		context.accountedIds.has(proposal.closureObligationId)
	) {
		return {
			ok: false,
			error: {
				code: "obligation-accounting",
				path: `${path}.closureObligationId`,
				message: "Obligation must be declared and accounted exactly once",
			},
		};
	}
	const conclusionIds = canonicalStrings(
		proposal.conclusionIds,
		`${path}.conclusionIds`,
		context.conclusionIds,
	);
	if (!conclusionIds.ok) return conclusionIds;
	const effectAssessmentIds = canonicalStrings(
		proposal.effectAssessmentIds,
		`${path}.effectAssessmentIds`,
		context.effectAssessmentIds,
	);
	if (!effectAssessmentIds.ok) return effectAssessmentIds;
	if (conclusionIds.value.length + effectAssessmentIds.value.length === 0) {
		return {
			ok: false,
			error: {
				code: "evidence-required",
				path,
				message: "Satisfied obligation requires current target evidence",
			},
		};
	}
	const basis = canonicalBasis(proposal.basis, `${path}.basis`);
	if (!basis.ok) return basis;
	return {
		ok: true,
		value: Object.freeze({
			closureObligationId: proposal.closureObligationId,
			status: "satisfied",
			conclusionIds: conclusionIds.value,
			effectAssessmentIds: effectAssessmentIds.value,
			basis: basis.value,
		}),
	};
}

function canonicalDispositionAccounting(
	target: SealedClosureTarget,
	proposals: readonly ClosureObligationDispositionProposal[],
): CanonicalResult<CanonicalDispositionAccounting> {
	if (!Array.isArray(proposals)) {
		return {
			ok: false,
			error: {
				code: "obligation-accounting",
				path: "proposal.obligationDispositions",
				message: "Expected complete Closure obligation accounting",
			},
		};
	}
	const byId = new Map<string, ClosureObligationDisposition>();
	const citedConclusionIds = new Set<string>();
	const citedEffectAssessmentIds = new Set<string>();
	for (let index = 0; index < proposals.length; index += 1) {
		const disposition = canonicalDisposition(proposals[index], index, {
			obligationIds: new Set(
				target.obligations.map(
					({ closureObligationId }) => closureObligationId,
				),
			),
			accountedIds: new Set(byId.keys()),
			conclusionIds: new Set(target.conclusionIds),
			effectAssessmentIds: new Set(target.effectAssessmentIds),
		});
		if (!disposition.ok) return disposition;
		byId.set(disposition.value.closureObligationId, disposition.value);
		for (const id of disposition.value.conclusionIds)
			citedConclusionIds.add(id);
		for (const id of disposition.value.effectAssessmentIds) {
			citedEffectAssessmentIds.add(id);
		}
	}
	if (byId.size !== target.obligations.length) {
		return {
			ok: false,
			error: {
				code: "obligation-accounting",
				path: "proposal.obligationDispositions",
				message: "Every Closure obligation requires one disposition",
			},
		};
	}
	const dispositions: ClosureObligationDisposition[] = [];
	for (const obligation of target.obligations) {
		const disposition = byId.get(obligation.closureObligationId);
		if (disposition === undefined) {
			return {
				ok: false,
				error: {
					code: "obligation-accounting",
					path: "proposal.obligationDispositions",
					message: `Missing obligation: ${obligation.closureObligationId}`,
				},
			};
		}
		dispositions.push(disposition);
	}
	return {
		ok: true,
		value: {
			dispositions: Object.freeze(dispositions),
			citedConclusionIds,
			citedEffectAssessmentIds,
		},
	};
}

function allEvidenceApplied(
	target: SealedClosureTarget,
	accounting: CanonicalDispositionAccounting,
): boolean {
	return (
		target.conclusionIds.every((id) => accounting.citedConclusionIds.has(id)) &&
		target.effectAssessmentIds.every((id) =>
			accounting.citedEffectAssessmentIds.has(id),
		)
	);
}

function canonicalProvenance(
	provenance: ActionCandidateProvenance,
): CanonicalResult<ActionCandidateProvenance> {
	if (
		typeof provenance !== "object" ||
		provenance === null ||
		!PROVENANCE_KINDS.has(provenance.kind) ||
		typeof provenance.source !== "string" ||
		provenance.source.trim().length === 0
	) {
		return {
			ok: false,
			error: {
				code: "invalid-provenance",
				path: "proposal.provenance",
				message: "Expected explicit Closure Claim provenance",
			},
		};
	}
	return {
		ok: true,
		value: Object.freeze({
			kind: provenance.kind,
			source: provenance.source.trim(),
		}),
	};
}

function claimIdentityParts(
	target: SealedClosureTarget,
	mode: ClosureClaim["mode"],
	dispositions: readonly ClosureObligationDisposition[],
	basis: readonly string[],
): string[] {
	const parts = [target.closureTargetId, mode];
	for (const disposition of dispositions) {
		parts.push(
			disposition.closureObligationId,
			"conclusions",
			...disposition.conclusionIds,
			"effect-assessments",
			...disposition.effectAssessmentIds,
			"basis",
			...disposition.basis,
		);
	}
	parts.push("claim-basis", ...basis);
	return parts;
}

/** Accepts complete evidence accounting without changing Work Case status. */
export function acceptClosureClaim(
	target: SealedClosureTarget,
	proposal: ClosureClaimProposal,
): ClosureClaimAcceptanceResult {
	if (
		proposal.workCaseId !== target.workCaseId ||
		proposal.closureTargetId !== target.closureTargetId
	) {
		return {
			status: "invalid",
			error: {
				code: "identity-mismatch",
				path: "proposal",
				message: "Closure Claim does not bind the sealed Closure Target",
			},
		};
	}
	if (proposal.mode !== "completed" && proposal.mode !== "no-change") {
		return {
			status: "invalid",
			error: {
				code: "unsupported-mode",
				path: "proposal.mode",
				message: "Unsupported Closure Claim mode",
			},
		};
	}
	const accounting = canonicalDispositionAccounting(
		target,
		proposal.obligationDispositions,
	);
	if (!accounting.ok) return { status: "invalid", error: accounting.error };
	if (!allEvidenceApplied(target, accounting.value)) {
		return {
			status: "invalid",
			error: {
				code: "evidence-accounting",
				path: "proposal.obligationDispositions",
				message:
					"Every current Conclusion and Effect assessment must be applied",
			},
		};
	}
	const basis = canonicalBasis(proposal.basis, "proposal.basis");
	if (!basis.ok) return { status: "invalid", error: basis.error };
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };
	return {
		status: "accepted",
		value: Object.freeze({
			closureClaimId: hashIdentity(
				"closure_claim",
				CLOSURE_CLAIM_VERSION,
				claimIdentityParts(
					target,
					proposal.mode,
					accounting.value.dispositions,
					basis.value,
				),
			),
			workCaseId: target.workCaseId,
			workCaseRevisionId: target.workCaseRevisionId,
			closureTargetId: target.closureTargetId,
			mode: proposal.mode,
			obligationDispositions: accounting.value.dispositions,
			basis: basis.value,
			provenance: provenance.value,
		}),
	};
}
