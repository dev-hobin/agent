import { hashIdentity } from "../identity/hash-identity.ts";

export const ACTION_CANDIDATE_VERSION = "developer-action-candidate/v1";

const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type ActionCandidateProvenanceKind =
	| "model"
	| "human"
	| "tool"
	| "external";

export interface ControlledActionIdentity {
	readonly kind: string;
	readonly fingerprint: string;
}

export interface ActionCandidateProvenance {
	readonly kind: ActionCandidateProvenanceKind;
	readonly source: string;
}

export interface ActionCandidateProposal {
	readonly workCaseId: string;
	readonly controlledAction: ControlledActionIdentity;
	readonly summary: string;
	readonly intendedEffects: readonly string[];
	readonly requiredConclusionIds: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface ActionCandidate {
	readonly actionCandidateId: string;
	readonly workCaseId: string;
	readonly controlledAction: ControlledActionIdentity;
	readonly summary: string;
	readonly intendedEffects: readonly string[];
	readonly requiredConclusionIds: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export type ActionCandidateErrorCode =
	| "invalid-id"
	| "invalid-controlled-action"
	| "invalid-fingerprint"
	| "empty-summary"
	| "missing-intended-effect"
	| "invalid-intended-effect"
	| "missing-conclusion"
	| "invalid-conclusion"
	| "duplicate-value"
	| "unsupported-provenance"
	| "invalid-provenance";

export interface ActionCandidateError {
	readonly code: ActionCandidateErrorCode;
	readonly path: string;
	readonly message: string;
}

export type ActionCandidateAcceptanceResult =
	| { readonly status: "accepted"; readonly value: ActionCandidate }
	| { readonly status: "invalid"; readonly error: ActionCandidateError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: ActionCandidateError };

function invalid(
	code: ActionCandidateErrorCode,
	path: string,
	message: string,
): ActionCandidateAcceptanceResult {
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
	code: ActionCandidateErrorCode,
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
	readonly missingCode: "missing-intended-effect" | "missing-conclusion";
	readonly invalidCode: "invalid-intended-effect" | "invalid-conclusion";
	readonly validate: (value: string) => boolean;
}

function canonicalList(
	values: readonly string[],
	contract: CanonicalListContract,
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values) || values.length === 0) {
		return {
			ok: false,
			error: {
				code: contract.missingCode,
				path: contract.path,
				message: "Expected at least one value",
			},
		};
	}
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const raw = values[index];
		const value = typeof raw === "string" ? raw.trim() : "";
		if (!contract.validate(value)) {
			return {
				ok: false,
				error: {
					code: contract.invalidCode,
					path: `${contract.path}[${index}]`,
					message: "Expected a canonical nonblank value",
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
				message: "Unsupported Action Candidate provenance kind",
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

/** Accepts one exact controlled Action Candidate without granting clearance. */
export function acceptActionCandidate(
	proposal: ActionCandidateProposal,
): ActionCandidateAcceptanceResult {
	if (!validId(proposal.workCaseId)) {
		return invalid(
			"invalid-id",
			"proposal.workCaseId",
			"Expected a canonical Work Case ID",
		);
	}
	if (
		typeof proposal.controlledAction !== "object" ||
		proposal.controlledAction === null
	) {
		return invalid(
			"invalid-controlled-action",
			"proposal.controlledAction",
			"Expected an exact controlled Action identity",
		);
	}
	const actionKind = canonicalText(
		proposal.controlledAction.kind,
		"invalid-controlled-action",
		"proposal.controlledAction.kind",
	);
	if (!actionKind.ok) return { status: "invalid", error: actionKind.error };
	if (!/^[a-f0-9]{64}$/.test(proposal.controlledAction.fingerprint)) {
		return invalid(
			"invalid-fingerprint",
			"proposal.controlledAction.fingerprint",
			"Expected a lowercase SHA-256 fingerprint",
		);
	}
	const summary = canonicalText(
		proposal.summary,
		"empty-summary",
		"proposal.summary",
	);
	if (!summary.ok) return { status: "invalid", error: summary.error };
	const effects = canonicalList(proposal.intendedEffects, {
		path: "proposal.intendedEffects",
		missingCode: "missing-intended-effect",
		invalidCode: "invalid-intended-effect",
		validate: (value) => value.length > 0,
	});
	if (!effects.ok) return { status: "invalid", error: effects.error };
	const conclusions = canonicalList(proposal.requiredConclusionIds, {
		path: "proposal.requiredConclusionIds",
		missingCode: "missing-conclusion",
		invalidCode: "invalid-conclusion",
		validate: validId,
	});
	if (!conclusions.ok) return { status: "invalid", error: conclusions.error };
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	const controlledAction = Object.freeze({
		kind: actionKind.value,
		fingerprint: proposal.controlledAction.fingerprint,
	});
	const actionCandidateId = hashIdentity(
		"action_candidate",
		ACTION_CANDIDATE_VERSION,
		[
			proposal.workCaseId,
			"controlled-action",
			controlledAction.kind,
			controlledAction.fingerprint,
			"summary",
			summary.value,
			"intended-effects",
			String(effects.value.length),
			...effects.value,
			"required-conclusions",
			String(conclusions.value.length),
			...conclusions.value,
		],
	);
	return {
		status: "accepted",
		value: Object.freeze({
			actionCandidateId,
			workCaseId: proposal.workCaseId,
			controlledAction,
			summary: summary.value,
			intendedEffects: effects.value,
			requiredConclusionIds: conclusions.value,
			provenance: provenance.value,
		}),
	};
}
