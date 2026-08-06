import { hashIdentity } from "../identity/hash-identity.ts";
import type { JudgmentConclusion } from "../judgment/close-judgment.ts";
import type {
	ActionCandidate,
	ActionCandidateProvenance,
	ControlledActionIdentity,
} from "./accept-action-candidate.ts";

export const ACTION_CLEARANCE_VERSION = "developer-action-clearance/v1";

const PERMISSION_STATUSES: ReadonlySet<string> = new Set([
	"granted",
	"denied",
	"unknown",
]);
const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type PermissionStatus = "granted" | "denied" | "unknown";

export interface PermissionDecision {
	readonly actionCandidateId: string;
	readonly status: PermissionStatus;
	readonly source: string;
	readonly basis: readonly string[];
}

export interface ActionClearanceProposal {
	readonly workCaseId: string;
	readonly actionCandidateId: string;
	readonly conclusionIds: readonly string[];
	readonly warrantBasis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface ActionClearanceAssessment {
	readonly workCaseId: string;
	readonly actionCandidateId: string;
	readonly conclusionIds: readonly string[];
	readonly missingConclusionIds: readonly string[];
	readonly warrantSatisfied: boolean;
	readonly warrantBasis: readonly string[];
	readonly permission: PermissionDecision;
	readonly provenance: ActionCandidateProvenance;
}

export interface ActionClearance {
	readonly actionClearanceId: string;
	readonly workCaseId: string;
	readonly actionCandidateId: string;
	readonly controlledAction: ControlledActionIdentity;
	readonly intendedEffects: readonly string[];
	readonly conclusionIds: readonly string[];
	readonly warrantBasis: readonly string[];
	readonly permission: PermissionDecision & { readonly status: "granted" };
	readonly provenance: ActionCandidateProvenance;
}

export type ActionClearanceBlocker =
	| { readonly code: "missing-conclusion"; readonly conclusionId: string }
	| { readonly code: "permission-denied" }
	| { readonly code: "permission-unknown" };

export type ActionClearanceErrorCode =
	| "identity-mismatch"
	| "duplicate-conclusion"
	| "cross-work-case-conclusion"
	| "unexpected-conclusion"
	| "invalid-conclusion"
	| "unsupported-permission-status"
	| "invalid-permission-source"
	| "empty-permission-basis"
	| "invalid-permission-basis"
	| "empty-warrant-basis"
	| "invalid-warrant-basis"
	| "unsupported-provenance"
	| "invalid-provenance";

export interface ActionClearanceError {
	readonly code: ActionClearanceErrorCode;
	readonly path: string;
	readonly message: string;
}

export type ActionClearanceAcceptanceResult =
	| { readonly status: "cleared"; readonly value: ActionClearance }
	| {
			readonly status: "not-cleared";
			readonly assessment: ActionClearanceAssessment;
			readonly blockers: readonly ActionClearanceBlocker[];
	  }
	| { readonly status: "invalid"; readonly error: ActionClearanceError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: ActionClearanceError };

function invalid(
	code: ActionClearanceErrorCode,
	path: string,
	message: string,
): ActionClearanceAcceptanceResult {
	return { status: "invalid", error: { code, path, message } };
}

function validId(value: string): boolean {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value === value.trim() &&
		!value.includes("\0")
	);
}

function canonicalText(
	value: string,
	code: ActionClearanceErrorCode,
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

function canonicalBasis(
	values: readonly string[],
	path: string,
	emptyCode: "empty-permission-basis" | "empty-warrant-basis",
	invalidCode: "invalid-permission-basis" | "invalid-warrant-basis",
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values) || values.length === 0) {
		return {
			ok: false,
			error: { code: emptyCode, path, message: "Expected explicit basis" },
		};
	}
	const canonical: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const raw = values[index];
		const value = typeof raw === "string" ? raw.trim() : "";
		if (value.length === 0) {
			return {
				ok: false,
				error: {
					code: invalidCode,
					path: `${path}[${index}]`,
					message: "Expected a nonblank basis item",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: invalidCode,
					path: `${path}[${index}]`,
					message: "Basis item duplicates an earlier normalized item",
				},
			};
		}
		seen.add(value);
		canonical.push(value);
	}
	canonical.sort((left, right) => left.localeCompare(right));
	return { ok: true, value: Object.freeze(canonical) };
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
				message: "Unsupported clearance proposal provenance kind",
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

function conclusionInventory(
	candidate: ActionCandidate,
	conclusions: readonly JudgmentConclusion[],
): CanonicalResult<ReadonlyMap<string, JudgmentConclusion>> {
	const inventory = new Map<string, JudgmentConclusion>();
	for (let index = 0; index < conclusions.length; index += 1) {
		const conclusion = conclusions[index];
		if (conclusion === undefined || !validId(conclusion.conclusionId)) {
			return {
				ok: false,
				error: {
					code: "invalid-conclusion",
					path: `conclusions[${index}].conclusionId`,
					message: "Expected a canonical Conclusion ID",
				},
			};
		}
		if (conclusion.workCaseId !== candidate.workCaseId) {
			return {
				ok: false,
				error: {
					code: "cross-work-case-conclusion",
					path: `conclusions[${index}].workCaseId`,
					message: "Conclusion belongs to another Work Case",
				},
			};
		}
		if (inventory.has(conclusion.conclusionId)) {
			return {
				ok: false,
				error: {
					code: "duplicate-conclusion",
					path: `conclusions[${index}].conclusionId`,
					message: "Conclusion appears more than once",
				},
			};
		}
		inventory.set(conclusion.conclusionId, conclusion);
	}
	return { ok: true, value: inventory };
}

function canonicalProposalConclusionIds(
	candidate: ActionCandidate,
	values: readonly string[],
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values)) {
		return {
			ok: false,
			error: {
				code: "invalid-conclusion",
				path: "proposal.conclusionIds",
				message: "Expected Conclusion IDs",
			},
		};
	}
	const declared = new Set(candidate.requiredConclusionIds);
	const proposed = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index];
		if (typeof value !== "string" || !validId(value)) {
			return {
				ok: false,
				error: {
					code: "invalid-conclusion",
					path: `proposal.conclusionIds[${index}]`,
					message: "Expected a canonical Conclusion ID",
				},
			};
		}
		if (!declared.has(value)) {
			return {
				ok: false,
				error: {
					code: "unexpected-conclusion",
					path: `proposal.conclusionIds[${index}]`,
					message: "Conclusion is not required by the Action Candidate",
				},
			};
		}
		if (proposed.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-conclusion",
					path: `proposal.conclusionIds[${index}]`,
					message: "Conclusion appears more than once",
				},
			};
		}
		proposed.add(value);
	}
	for (const required of candidate.requiredConclusionIds) {
		if (!proposed.has(required)) {
			return {
				ok: false,
				error: {
					code: "invalid-conclusion",
					path: "proposal.conclusionIds",
					message: `Required Conclusion is not accounted: ${required}`,
				},
			};
		}
	}
	return {
		ok: true,
		value: Object.freeze([...candidate.requiredConclusionIds]),
	};
}

function canonicalPermission(
	candidate: ActionCandidate,
	permission: PermissionDecision,
): CanonicalResult<PermissionDecision> {
	if (permission.actionCandidateId !== candidate.actionCandidateId) {
		return {
			ok: false,
			error: {
				code: "identity-mismatch",
				path: "permission.actionCandidateId",
				message: `Expected ${candidate.actionCandidateId}, received ${permission.actionCandidateId}`,
			},
		};
	}
	if (!PERMISSION_STATUSES.has(permission.status)) {
		return {
			ok: false,
			error: {
				code: "unsupported-permission-status",
				path: "permission.status",
				message: `Unsupported permission status ${permission.status}`,
			},
		};
	}
	const source = canonicalText(
		permission.source,
		"invalid-permission-source",
		"permission.source",
	);
	if (!source.ok) return source;
	const basis = canonicalBasis(
		permission.basis,
		"permission.basis",
		"empty-permission-basis",
		"invalid-permission-basis",
	);
	if (!basis.ok) return basis;
	return {
		ok: true,
		value: Object.freeze({
			actionCandidateId: permission.actionCandidateId,
			status: permission.status,
			source: source.value,
			basis: basis.value,
		}),
	};
}

/** Clears one exact Action only when warrant and permission are both present. */
export function acceptActionClearance(
	candidate: ActionCandidate,
	conclusions: readonly JudgmentConclusion[],
	permission: PermissionDecision,
	proposal: ActionClearanceProposal,
): ActionClearanceAcceptanceResult {
	if (proposal.workCaseId !== candidate.workCaseId) {
		return invalid(
			"identity-mismatch",
			"proposal.workCaseId",
			`Expected ${candidate.workCaseId}, received ${proposal.workCaseId}`,
		);
	}
	if (proposal.actionCandidateId !== candidate.actionCandidateId) {
		return invalid(
			"identity-mismatch",
			"proposal.actionCandidateId",
			`Expected ${candidate.actionCandidateId}, received ${proposal.actionCandidateId}`,
		);
	}
	const inventory = conclusionInventory(candidate, conclusions);
	if (!inventory.ok) return { status: "invalid", error: inventory.error };
	const conclusionIds = canonicalProposalConclusionIds(
		candidate,
		proposal.conclusionIds,
	);
	if (!conclusionIds.ok) {
		return { status: "invalid", error: conclusionIds.error };
	}
	const warrantBasis = canonicalBasis(
		proposal.warrantBasis,
		"proposal.warrantBasis",
		"empty-warrant-basis",
		"invalid-warrant-basis",
	);
	if (!warrantBasis.ok) {
		return { status: "invalid", error: warrantBasis.error };
	}
	const currentPermission = canonicalPermission(candidate, permission);
	if (!currentPermission.ok) {
		return { status: "invalid", error: currentPermission.error };
	}
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	const missingConclusionIds = Object.freeze(
		candidate.requiredConclusionIds.filter((id) => !inventory.value.has(id)),
	);
	const assessment: ActionClearanceAssessment = Object.freeze({
		workCaseId: candidate.workCaseId,
		actionCandidateId: candidate.actionCandidateId,
		conclusionIds: conclusionIds.value,
		missingConclusionIds,
		warrantSatisfied: missingConclusionIds.length === 0,
		warrantBasis: warrantBasis.value,
		permission: currentPermission.value,
		provenance: provenance.value,
	});
	const blockers: ActionClearanceBlocker[] = missingConclusionIds.map(
		(conclusionId) => ({ code: "missing-conclusion", conclusionId }),
	);
	if (currentPermission.value.status === "denied") {
		blockers.push({ code: "permission-denied" });
	} else if (currentPermission.value.status === "unknown") {
		blockers.push({ code: "permission-unknown" });
	}
	if (blockers.length > 0) {
		return {
			status: "not-cleared",
			assessment,
			blockers: Object.freeze(blockers),
		};
	}

	const grantedPermission = Object.freeze({
		...currentPermission.value,
		status: "granted" as const,
	});
	const actionClearanceId = hashIdentity(
		"action_clearance",
		ACTION_CLEARANCE_VERSION,
		[
			candidate.actionCandidateId,
			"conclusions",
			String(conclusionIds.value.length),
			...conclusionIds.value,
			"warrant-basis",
			String(warrantBasis.value.length),
			...warrantBasis.value,
			"permission-source",
			grantedPermission.source,
			"permission-basis",
			String(grantedPermission.basis.length),
			...grantedPermission.basis,
		],
	);
	return {
		status: "cleared",
		value: Object.freeze({
			actionClearanceId,
			workCaseId: candidate.workCaseId,
			actionCandidateId: candidate.actionCandidateId,
			controlledAction: Object.freeze({ ...candidate.controlledAction }),
			intendedEffects: Object.freeze([...candidate.intendedEffects]),
			conclusionIds: conclusionIds.value,
			warrantBasis: warrantBasis.value,
			permission: grantedPermission,
			provenance: provenance.value,
		}),
	};
}
