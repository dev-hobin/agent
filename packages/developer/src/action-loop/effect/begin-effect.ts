import type { ActionClearance } from "../action/action-clearance.ts";
import { hashIdentity } from "../identity/hash-identity.ts";
import type { ControlledActionIdentity } from "../action/accept-action-candidate.ts";

export const EFFECT_VERSION = "developer-effect/v1";

export interface ControlledActionOccurrence {
	readonly occurrenceId: string;
	readonly actionClearanceId: string;
	readonly controlledAction: ControlledActionIdentity;
	readonly source: string;
}

export interface PendingEffect {
	readonly effectId: string;
	readonly workCaseId: string;
	readonly actionCandidateId: string;
	readonly actionClearanceId: string;
	readonly occurrenceId: string;
	readonly controlledAction: ControlledActionIdentity;
	readonly intendedEffects: readonly string[];
	readonly occurrenceSource: string;
	readonly status: "pending";
}

export type EffectBeginningErrorCode =
	| "identity-mismatch"
	| "controlled-action-mismatch"
	| "invalid-occurrence-id"
	| "invalid-source";

export interface EffectBeginningError {
	readonly code: EffectBeginningErrorCode;
	readonly path: string;
	readonly message: string;
}

export type EffectBeginningResult =
	| { readonly status: "begun"; readonly value: PendingEffect }
	| { readonly status: "invalid"; readonly error: EffectBeginningError };

function invalid(
	code: EffectBeginningErrorCode,
	path: string,
	message: string,
): EffectBeginningResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(value: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	if (normalized.length === 0 || normalized.includes("\0")) return undefined;
	return normalized;
}

/** Begins pending Effect tracking for one exact cleared host occurrence. */
export function beginEffect(
	clearance: ActionClearance,
	occurrence: ControlledActionOccurrence,
): EffectBeginningResult {
	if (occurrence.actionClearanceId !== clearance.actionClearanceId) {
		return invalid(
			"identity-mismatch",
			"occurrence.actionClearanceId",
			`Expected ${clearance.actionClearanceId}, received ${occurrence.actionClearanceId}`,
		);
	}
	const occurrenceId = canonicalText(occurrence.occurrenceId);
	if (occurrenceId === undefined || occurrenceId !== occurrence.occurrenceId) {
		return invalid(
			"invalid-occurrence-id",
			"occurrence.occurrenceId",
			"Expected a canonical host occurrence ID",
		);
	}
	if (
		typeof occurrence.controlledAction !== "object" ||
		occurrence.controlledAction === null ||
		occurrence.controlledAction.kind !== clearance.controlledAction.kind ||
		occurrence.controlledAction.fingerprint !==
			clearance.controlledAction.fingerprint
	) {
		return invalid(
			"controlled-action-mismatch",
			"occurrence.controlledAction",
			"Host occurrence does not match the cleared controlled Action",
		);
	}
	const source = canonicalText(occurrence.source);
	if (source === undefined) {
		return invalid(
			"invalid-source",
			"occurrence.source",
			"Host occurrence requires a nonblank source",
		);
	}

	const effectId = hashIdentity("effect", EFFECT_VERSION, [
		clearance.actionClearanceId,
		occurrenceId,
		clearance.controlledAction.kind,
		clearance.controlledAction.fingerprint,
	]);
	return {
		status: "begun",
		value: Object.freeze({
			effectId,
			workCaseId: clearance.workCaseId,
			actionCandidateId: clearance.actionCandidateId,
			actionClearanceId: clearance.actionClearanceId,
			occurrenceId,
			controlledAction: Object.freeze({ ...clearance.controlledAction }),
			intendedEffects: Object.freeze([...clearance.intendedEffects]),
			occurrenceSource: source,
			status: "pending",
		}),
	};
}
