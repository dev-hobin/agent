import type { ActionCandidateProvenance } from "../action/accept-action-candidate.ts";
import { hashIdentity } from "../identity/hash-identity.ts";
import type { PendingEffect } from "./begin-effect.ts";
import type { EffectObservation } from "./effect-observation.ts";

export const EFFECT_SETTLEMENT_VERSION = "developer-effect-settlement/v1";
export const EFFECT_ASSESSMENT_VERSION = "developer-effect-assessment/v1";

const OUTCOMES: ReadonlySet<string> = new Set([
	"observed-success",
	"observed-no-effect",
	"failed",
	"partially-applied",
	"pending",
	"unknown",
]);
const OBSERVATION_STATUSES: ReadonlySet<string> = new Set([
	"relied-on",
	"not-relied-on",
]);
const INTENDED_EFFECT_STATUSES: ReadonlySet<string> = new Set([
	"observed",
	"not-observed",
	"failed",
	"partially-observed",
	"unknown",
]);
const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type SettledEffectOutcome =
	| "observed-success"
	| "observed-no-effect"
	| "failed"
	| "partially-applied";
export type UnsettledEffectOutcome = "pending" | "unknown";
export type EffectSettlementOutcome =
	| SettledEffectOutcome
	| UnsettledEffectOutcome;
export type EffectObservationDispositionStatus = "relied-on" | "not-relied-on";
export type IntendedEffectDispositionStatus =
	| "observed"
	| "not-observed"
	| "failed"
	| "partially-observed"
	| "unknown";

export interface EffectObservationDispositionProposal {
	readonly effectObservationId: string;
	readonly status: EffectObservationDispositionStatus;
	readonly basis: readonly string[];
}

export interface IntendedEffectDispositionProposal {
	readonly intendedEffect: string;
	readonly status: IntendedEffectDispositionStatus;
	readonly observationIds: readonly string[];
	readonly basis: readonly string[];
}

export interface EffectSettlementProposal {
	readonly workCaseId: string;
	readonly effectId: string;
	readonly outcome: EffectSettlementOutcome;
	readonly observationDispositions: readonly EffectObservationDispositionProposal[];
	readonly intendedEffectDispositions: readonly IntendedEffectDispositionProposal[];
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface EffectObservationDisposition
	extends EffectObservationDispositionProposal {}

export interface IntendedEffectDisposition
	extends IntendedEffectDispositionProposal {}

interface EffectAccountingBase {
	readonly workCaseId: string;
	readonly effectId: string;
	readonly actionClearanceId: string;
	readonly occurrenceId: string;
	readonly observationDispositions: readonly EffectObservationDisposition[];
	readonly intendedEffectDispositions: readonly IntendedEffectDisposition[];
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface EffectSettlement extends EffectAccountingBase {
	readonly effectSettlementId: string;
	readonly outcome: SettledEffectOutcome;
}

export interface UnsettledEffectAssessment extends EffectAccountingBase {
	readonly effectAssessmentId: string;
	readonly outcome: UnsettledEffectOutcome;
}

export type EffectSettlementErrorCode =
	| "identity-mismatch"
	| "unsupported-outcome"
	| "duplicate-observation"
	| "cross-effect-observation"
	| "observation-accounting"
	| "unsupported-observation-status"
	| "intended-effect-accounting"
	| "unsupported-intended-effect-status"
	| "undeclared-observation"
	| "unrelied-observation"
	| "evidence-required"
	| "outcome-mismatch"
	| "empty-basis"
	| "invalid-basis"
	| "duplicate-value"
	| "unsupported-provenance"
	| "invalid-provenance";

export interface EffectSettlementError {
	readonly code: EffectSettlementErrorCode;
	readonly path: string;
	readonly message: string;
}

export type EffectSettlementResult =
	| { readonly status: "settled"; readonly value: EffectSettlement }
	| { readonly status: "unsettled"; readonly value: UnsettledEffectAssessment }
	| { readonly status: "invalid"; readonly error: EffectSettlementError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: EffectSettlementError };

function invalid(
	code: EffectSettlementErrorCode,
	path: string,
	message: string,
): EffectSettlementResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalBasis(
	values: readonly string[],
	path: string,
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values) || values.length === 0) {
		return {
			ok: false,
			error: { code: "empty-basis", path, message: "Expected explicit basis" },
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
					code: "invalid-basis",
					path: `${path}[${index}]`,
					message: "Expected a nonblank basis item",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${path}[${index}]`,
					message: "Basis duplicates an earlier normalized item",
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
				message: "Unsupported Effect settlement provenance kind",
			},
		};
	}
	if (
		typeof provenance.source !== "string" ||
		provenance.source.trim().length === 0
	) {
		return {
			ok: false,
			error: {
				code: "invalid-provenance",
				path: "proposal.provenance.source",
				message: "Expected nonblank provenance source",
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

function observationInventory(
	effect: PendingEffect,
	observations: readonly EffectObservation[],
): CanonicalResult<ReadonlyMap<string, EffectObservation>> {
	const inventory = new Map<string, EffectObservation>();
	for (let index = 0; index < observations.length; index += 1) {
		const observation = observations[index];
		if (observation === undefined) continue;
		if (
			observation.workCaseId !== effect.workCaseId ||
			observation.effectId !== effect.effectId ||
			observation.occurrenceId !== effect.occurrenceId
		) {
			return {
				ok: false,
				error: {
					code: "cross-effect-observation",
					path: `observations[${index}]`,
					message: "Observation belongs to another Effect occurrence",
				},
			};
		}
		if (inventory.has(observation.effectObservationId)) {
			return {
				ok: false,
				error: {
					code: "duplicate-observation",
					path: `observations[${index}].effectObservationId`,
					message: "Observation appears more than once",
				},
			};
		}
		inventory.set(observation.effectObservationId, observation);
	}
	return { ok: true, value: inventory };
}

function canonicalObservationDispositions(
	inventory: ReadonlyMap<string, EffectObservation>,
	proposals: readonly EffectObservationDispositionProposal[],
): CanonicalResult<readonly EffectObservationDisposition[]> {
	if (!Array.isArray(proposals)) {
		return {
			ok: false,
			error: {
				code: "observation-accounting",
				path: "proposal.observationDispositions",
				message: "Expected complete Observation accounting",
			},
		};
	}
	const byId = new Map<string, EffectObservationDisposition>();
	for (let index = 0; index < proposals.length; index += 1) {
		const proposal = proposals[index];
		if (
			proposal === undefined ||
			!inventory.has(proposal.effectObservationId) ||
			byId.has(proposal.effectObservationId)
		) {
			return {
				ok: false,
				error: {
					code: "observation-accounting",
					path: `proposal.observationDispositions[${index}].effectObservationId`,
					message: "Observation must be current and accounted exactly once",
				},
			};
		}
		if (!OBSERVATION_STATUSES.has(proposal.status)) {
			return {
				ok: false,
				error: {
					code: "unsupported-observation-status",
					path: `proposal.observationDispositions[${index}].status`,
					message: `Unsupported Observation disposition ${proposal.status}`,
				},
			};
		}
		const basis = canonicalBasis(
			proposal.basis,
			`proposal.observationDispositions[${index}].basis`,
		);
		if (!basis.ok) return basis;
		byId.set(
			proposal.effectObservationId,
			Object.freeze({
				effectObservationId: proposal.effectObservationId,
				status: proposal.status,
				basis: basis.value,
			}),
		);
	}
	if (byId.size !== inventory.size) {
		return {
			ok: false,
			error: {
				code: "observation-accounting",
				path: "proposal.observationDispositions",
				message: "Every current Observation requires one disposition",
			},
		};
	}
	return {
		ok: true,
		value: Object.freeze(
			[...byId.values()].sort((left, right) =>
				left.effectObservationId.localeCompare(right.effectObservationId),
			),
		),
	};
}

function canonicalObservationIds(
	values: readonly string[],
	inventory: ReadonlyMap<string, EffectObservation>,
	reliedIds: ReadonlySet<string>,
	path: string,
): CanonicalResult<readonly string[]> {
	if (!Array.isArray(values)) {
		return {
			ok: false,
			error: {
				code: "undeclared-observation",
				path,
				message: "Expected Observation IDs",
			},
		};
	}
	const ids = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const id = values[index];
		if (typeof id !== "string" || !inventory.has(id)) {
			return {
				ok: false,
				error: {
					code: "undeclared-observation",
					path: `${path}[${index}]`,
					message: "Observation is not current",
				},
			};
		}
		if (!reliedIds.has(id)) {
			return {
				ok: false,
				error: {
					code: "unrelied-observation",
					path: `${path}[${index}]`,
					message: "Cited Observation must be relied on",
				},
			};
		}
		if (ids.has(id)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${path}[${index}]`,
					message: "Observation is cited more than once",
				},
			};
		}
		ids.add(id);
	}
	return {
		ok: true,
		value: Object.freeze(
			[...ids].sort((left, right) => left.localeCompare(right)),
		),
	};
}

interface IntendedDispositionContext {
	readonly declared: ReadonlySet<string>;
	readonly inventory: ReadonlyMap<string, EffectObservation>;
	readonly reliedIds: ReadonlySet<string>;
	readonly alreadyAccounted: ReadonlySet<string>;
}

function canonicalIntendedEffectDisposition(
	proposal: IntendedEffectDispositionProposal | undefined,
	index: number,
	context: IntendedDispositionContext,
): CanonicalResult<IntendedEffectDisposition> {
	const path = `proposal.intendedEffectDispositions[${index}]`;
	if (
		proposal === undefined ||
		!context.declared.has(proposal.intendedEffect) ||
		context.alreadyAccounted.has(proposal.intendedEffect)
	) {
		return {
			ok: false,
			error: {
				code: "intended-effect-accounting",
				path: `${path}.intendedEffect`,
				message: "Intended Effect must be declared and accounted exactly once",
			},
		};
	}
	if (!INTENDED_EFFECT_STATUSES.has(proposal.status)) {
		return {
			ok: false,
			error: {
				code: "unsupported-intended-effect-status",
				path: `${path}.status`,
				message: `Unsupported intended Effect status ${proposal.status}`,
			},
		};
	}
	const observationIds = canonicalObservationIds(
		proposal.observationIds,
		context.inventory,
		context.reliedIds,
		`${path}.observationIds`,
	);
	if (!observationIds.ok) return observationIds;
	if (proposal.status !== "unknown" && observationIds.value.length === 0) {
		return {
			ok: false,
			error: {
				code: "evidence-required",
				path: `${path}.observationIds`,
				message: "Decisive intended Effect disposition requires evidence",
			},
		};
	}
	const basis = canonicalBasis(proposal.basis, `${path}.basis`);
	if (!basis.ok) return basis;
	return {
		ok: true,
		value: Object.freeze({
			intendedEffect: proposal.intendedEffect,
			status: proposal.status,
			observationIds: observationIds.value,
			basis: basis.value,
		}),
	};
}

function orderIntendedEffectDispositions(
	effect: PendingEffect,
	byEffect: ReadonlyMap<string, IntendedEffectDisposition>,
): CanonicalResult<readonly IntendedEffectDisposition[]> {
	if (byEffect.size !== effect.intendedEffects.length) {
		return {
			ok: false,
			error: {
				code: "intended-effect-accounting",
				path: "proposal.intendedEffectDispositions",
				message: "Every intended Effect requires one disposition",
			},
		};
	}
	const ordered: IntendedEffectDisposition[] = [];
	for (const intendedEffect of effect.intendedEffects) {
		const disposition = byEffect.get(intendedEffect);
		if (disposition === undefined) {
			return {
				ok: false,
				error: {
					code: "intended-effect-accounting",
					path: "proposal.intendedEffectDispositions",
					message: `Intended Effect has no disposition: ${intendedEffect}`,
				},
			};
		}
		ordered.push(disposition);
	}
	return { ok: true, value: Object.freeze(ordered) };
}

function canonicalIntendedEffectDispositions(
	effect: PendingEffect,
	inventory: ReadonlyMap<string, EffectObservation>,
	observationDispositions: readonly EffectObservationDisposition[],
	proposals: readonly IntendedEffectDispositionProposal[],
): CanonicalResult<readonly IntendedEffectDisposition[]> {
	if (!Array.isArray(proposals)) {
		return {
			ok: false,
			error: {
				code: "intended-effect-accounting",
				path: "proposal.intendedEffectDispositions",
				message: "Expected complete intended Effect accounting",
			},
		};
	}
	const reliedIds = new Set<string>();
	for (const disposition of observationDispositions) {
		if (disposition.status === "relied-on") {
			reliedIds.add(disposition.effectObservationId);
		}
	}
	const citedReliedIds = new Set<string>();
	const byEffect = new Map<string, IntendedEffectDisposition>();
	for (let index = 0; index < proposals.length; index += 1) {
		const canonical = canonicalIntendedEffectDisposition(
			proposals[index],
			index,
			{
				declared: new Set(effect.intendedEffects),
				inventory,
				reliedIds,
				alreadyAccounted: new Set(byEffect.keys()),
			},
		);
		if (!canonical.ok) return canonical;
		byEffect.set(canonical.value.intendedEffect, canonical.value);
		for (const id of canonical.value.observationIds) citedReliedIds.add(id);
	}
	for (const reliedId of reliedIds) {
		if (!citedReliedIds.has(reliedId)) {
			return {
				ok: false,
				error: {
					code: "observation-accounting",
					path: "proposal.intendedEffectDispositions",
					message: `Relied-on Observation is not applied: ${reliedId}`,
				},
			};
		}
	}
	return orderIntendedEffectDispositions(effect, byEffect);
}

function deriveOutcome(
	observationDispositions: readonly EffectObservationDisposition[],
	intended: readonly IntendedEffectDisposition[],
): EffectSettlementOutcome {
	const reliedCount = observationDispositions.filter(
		({ status }) => status === "relied-on",
	).length;
	if (reliedCount === 0) return "pending";
	const statuses = intended.map(({ status }) => status);
	if (
		statuses.includes("unknown") ||
		statuses.includes("partially-observed")
	)
		return "unknown";
	const observedCount = statuses.filter(
		(status) => status === "observed",
	).length;
	if (observedCount === statuses.length) return "observed-success";
	if (observedCount > 0) return "partially-applied";
	if (statuses.includes("failed")) return "failed";
	return "observed-no-effect";
}

interface EffectAccountingIdentityInput {
	readonly effect: PendingEffect;
	readonly outcome: EffectSettlementOutcome;
	readonly observations: readonly EffectObservationDisposition[];
	readonly intended: readonly IntendedEffectDisposition[];
	readonly basis: readonly string[];
}

function accountingIdentityParts(
	input: EffectAccountingIdentityInput,
): string[] {
	const parts = [
		input.effect.effectId,
		input.effect.actionClearanceId,
		input.effect.occurrenceId,
		"outcome",
		input.outcome,
	];
	for (const disposition of input.observations) {
		parts.push(
			"observation",
			disposition.effectObservationId,
			disposition.status,
			...disposition.basis,
		);
	}
	for (const disposition of input.intended) {
		parts.push(
			"intended-effect",
			disposition.intendedEffect,
			disposition.status,
			...disposition.observationIds,
			...disposition.basis,
		);
	}
	parts.push("basis", ...input.basis);
	return parts;
}

/** Derives settled or explicitly unsettled Effect accounting from current evidence. */
export function settleEffect(
	effect: PendingEffect,
	observations: readonly EffectObservation[],
	proposal: EffectSettlementProposal,
): EffectSettlementResult {
	if (
		proposal.workCaseId !== effect.workCaseId ||
		proposal.effectId !== effect.effectId
	) {
		return invalid(
			"identity-mismatch",
			"proposal",
			"Settlement proposal targets another Work Case or Effect",
		);
	}
	if (!OUTCOMES.has(proposal.outcome)) {
		return invalid(
			"unsupported-outcome",
			"proposal.outcome",
			`Unsupported Effect outcome ${proposal.outcome}`,
		);
	}
	const inventory = observationInventory(effect, observations);
	if (!inventory.ok) return { status: "invalid", error: inventory.error };
	const observationDispositions = canonicalObservationDispositions(
		inventory.value,
		proposal.observationDispositions,
	);
	if (!observationDispositions.ok) {
		return { status: "invalid", error: observationDispositions.error };
	}
	const intendedDispositions = canonicalIntendedEffectDispositions(
		effect,
		inventory.value,
		observationDispositions.value,
		proposal.intendedEffectDispositions,
	);
	if (!intendedDispositions.ok) {
		return { status: "invalid", error: intendedDispositions.error };
	}
	const basis = canonicalBasis(proposal.basis, "proposal.basis");
	if (!basis.ok) return { status: "invalid", error: basis.error };
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };
	const derived = deriveOutcome(
		observationDispositions.value,
		intendedDispositions.value,
	);
	if (proposal.outcome !== derived) {
		return invalid(
			"outcome-mismatch",
			"proposal.outcome",
			`Current accounting derives ${derived}, not ${proposal.outcome}`,
		);
	}
	const identityParts = accountingIdentityParts({
		effect,
		outcome: derived,
		observations: observationDispositions.value,
		intended: intendedDispositions.value,
		basis: basis.value,
	});
	const common = {
		workCaseId: effect.workCaseId,
		effectId: effect.effectId,
		actionClearanceId: effect.actionClearanceId,
		occurrenceId: effect.occurrenceId,
		observationDispositions: observationDispositions.value,
		intendedEffectDispositions: intendedDispositions.value,
		basis: basis.value,
		provenance: provenance.value,
	};
	if (derived === "pending" || derived === "unknown") {
		return {
			status: "unsettled",
			value: Object.freeze({
				...common,
				effectAssessmentId: hashIdentity(
					"effect_assessment",
					EFFECT_ASSESSMENT_VERSION,
					identityParts,
				),
				outcome: derived,
			}),
		};
	}
	return {
		status: "settled",
		value: Object.freeze({
			...common,
			effectSettlementId: hashIdentity(
				"effect_settlement",
				EFFECT_SETTLEMENT_VERSION,
				identityParts,
			),
			outcome: derived,
		}),
	};
}
