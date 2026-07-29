import { isSha256, sha256Text } from "./content-hash.ts";
import {
	applyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	type ObserverEvent,
	type ObserverState,
} from "./lifecycle.ts";
import { decodePreparedSave, type PreparedSave } from "./save-profile.ts";

export const OBSERVER_LIFECYCLE_ENTRY = "observer.lifecycle";
export const OBSERVER_PREPARED_SAVE_ENTRY = "observer.prepared-save";
export const OBSERVER_SAVE_ATTEMPT_ENTRY = "observer.save-attempt";
export const OBSERVER_PREPARED_SAVE_PROTOCOL: "observer.pi-prepared-save/v1" =
	"observer.pi-prepared-save/v1";
export const OBSERVER_SAVE_ATTEMPT_PROTOCOL: "observer.pi-save-attempt/v1" =
	"observer.pi-save-attempt/v1";

const MAX_ID_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 4_000;

export interface PiBranchEntryLike {
	readonly type?: unknown;
	readonly customType?: unknown;
	readonly data?: unknown;
	readonly message?: unknown;
}

export interface PreparedSaveHandoff {
	readonly protocol: typeof OBSERVER_PREPARED_SAVE_PROTOCOL;
	readonly summary: string;
	readonly prepared: PreparedSave;
}

export interface ApprovedSaveAttempt {
	readonly protocol: typeof OBSERVER_SAVE_ATTEMPT_PROTOCOL;
	readonly kind: "approved";
	readonly attemptId: string;
	readonly proposalId: string;
	readonly preparedDigest: string;
}

export type PiSessionDecodeCode =
	| "pi-entry.attempt.shape"
	| "pi-entry.attempt.unsupported"
	| "pi-entry.handoff.shape"
	| "pi-entry.handoff.unsupported";

export interface PiSessionDecodeIssue {
	readonly code: PiSessionDecodeCode;
	readonly path: string;
	readonly message: string;
}

export type PiSessionDecodeResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: PiSessionDecodeIssue };

export type ObserverPiReplayCode =
	| PiSessionDecodeCode
	| "pi-entry.attempt.conflict"
	| "pi-entry.attempt.order"
	| "pi-entry.handoff.conflict"
	| "pi-entry.handoff.order"
	| "pi-entry.lifecycle.decode"
	| "pi-entry.lifecycle.order"
	| "pi-entry.lifecycle.transition";

export interface ObserverPiReplayIssue {
	readonly index: number;
	readonly code: ObserverPiReplayCode;
	readonly message: string;
}

export interface PreparedSaveState {
	readonly handoff: PreparedSaveHandoff;
	readonly digest: string;
}

export interface ObserverPiSnapshot {
	readonly state: ObserverState;
	readonly prepared: PreparedSaveState | null;
	readonly attempt: ApprovedSaveAttempt | null;
	readonly issues: readonly ObserverPiReplayIssue[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
	value: Readonly<Record<string, unknown>>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => expected.includes(key))
	);
}

function isIdentifier(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value === value.trim() &&
		value.length > 0 &&
		value.length <= MAX_ID_LENGTH
	);
}

function isSummary(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value === value.trim() &&
		value.length > 0 &&
		value.length <= MAX_SUMMARY_LENGTH
	);
}

function decodeFailure<Value>(
	code: PiSessionDecodeCode,
	path: string,
	message: string,
): PiSessionDecodeResult<Value> {
	return { ok: false, issue: { code, path, message } };
}

export function decodePreparedSaveHandoff(
	value: unknown,
): PiSessionDecodeResult<PreparedSaveHandoff> {
	if (!isObject(value)) {
		return decodeFailure(
			"pi-entry.handoff.shape",
			"/",
			"Prepared save handoff must be an object.",
		);
	}
	if (value.protocol !== OBSERVER_PREPARED_SAVE_PROTOCOL) {
		return decodeFailure(
			typeof value.protocol === "string"
				? "pi-entry.handoff.unsupported"
				: "pi-entry.handoff.shape",
			"/protocol",
			"Prepared save handoff has an unsupported protocol.",
		);
	}
	if (
		!hasExactKeys(value, ["protocol", "summary", "prepared"]) ||
		!isSummary(value.summary)
	) {
		return decodeFailure(
			"pi-entry.handoff.shape",
			"/",
			"Prepared save handoff requires one bounded summary and prepared value.",
		);
	}
	const prepared = decodePreparedSave(value.prepared);
	if (!prepared.ok) {
		return decodeFailure(
			"pi-entry.handoff.shape",
			`/prepared${prepared.issue.path === "/" ? "" : prepared.issue.path}`,
			prepared.issue.message,
		);
	}
	return {
		ok: true,
		value: {
			protocol: OBSERVER_PREPARED_SAVE_PROTOCOL,
			summary: value.summary,
			prepared: prepared.value,
		},
	};
}

export function decodeApprovedSaveAttempt(
	value: unknown,
): PiSessionDecodeResult<ApprovedSaveAttempt> {
	if (!isObject(value)) {
		return decodeFailure(
			"pi-entry.attempt.shape",
			"/",
			"Approved save attempt must be an object.",
		);
	}
	if (value.protocol !== OBSERVER_SAVE_ATTEMPT_PROTOCOL) {
		return decodeFailure(
			typeof value.protocol === "string"
				? "pi-entry.attempt.unsupported"
				: "pi-entry.attempt.shape",
			"/protocol",
			"Approved save attempt has an unsupported protocol.",
		);
	}
	if (
		!hasExactKeys(value, [
			"protocol",
			"kind",
			"attemptId",
			"proposalId",
			"preparedDigest",
		]) ||
		value.kind !== "approved" ||
		!isIdentifier(value.attemptId) ||
		!isIdentifier(value.proposalId) ||
		!isSha256(value.preparedDigest)
	) {
		return decodeFailure(
			"pi-entry.attempt.shape",
			"/",
			"Approved save attempt requires IDs and a prepared SHA-256 digest.",
		);
	}
	return {
		ok: true,
		value: {
			protocol: OBSERVER_SAVE_ATTEMPT_PROTOCOL,
			kind: "approved",
			attemptId: value.attemptId,
			proposalId: value.proposalId,
			preparedDigest: value.preparedDigest,
		},
	};
}

export function preparedSaveDigest(handoff: PreparedSaveHandoff): string {
	return sha256Text(JSON.stringify(handoff));
}

function replayIssue(
	issues: ObserverPiReplayIssue[],
	index: number,
	code: ObserverPiReplayCode,
	message: string,
): void {
	issues.push({ index, code, message });
}

function sameAttempt(
	left: ApprovedSaveAttempt,
	right: ApprovedSaveAttempt,
): boolean {
	return (
		left.attemptId === right.attemptId &&
		left.proposalId === right.proposalId &&
		left.preparedDigest === right.preparedDigest
	);
}

function matchingLiveEpisode(
	state: ObserverState,
	handoff: PreparedSaveHandoff,
): boolean {
	return (
		state.episode.status === "open" &&
		state.selectedNotebookId === handoff.prepared.notebook_id &&
		state.episode.core.notebookId === handoff.prepared.notebook_id
	);
}

function lifecycleOrderIssue(
	event: ObserverEvent,
	prepared: PreparedSaveState | null,
	attempt: ApprovedSaveAttempt | null,
): string | null {
	if (event.kind === "save-proposed") {
		if (!prepared) return "Review & Save proposal has no prepared handoff.";
		if (
			prepared.handoff.prepared.proposal_id !== event.proposalId ||
			prepared.handoff.summary !== event.summary
		) {
			return "Review & Save proposal does not match the prepared handoff.";
		}
	}
	if (event.kind === "save-cancelled") {
		if (
			!prepared ||
			prepared.handoff.prepared.proposal_id !== event.proposalId
		) {
			return "Review & Save cancellation does not match the prepared handoff.";
		}
	}
	if (event.kind === "save-committed") {
		if (
			!prepared ||
			prepared.handoff.prepared.proposal_id !== event.proposalId
		) {
			return "Review & Save commit does not match the prepared handoff.";
		}
		if (
			!attempt ||
			attempt.proposalId !== event.proposalId ||
			attempt.preparedDigest !== prepared.digest
		) {
			return "Review & Save commit has no matching approved attempt.";
		}
	}
	return null;
}

interface ReplayAccumulator {
	state: ObserverState;
	prepared: PreparedSaveState | null;
	attempt: ApprovedSaveAttempt | null;
	readonly issues: ObserverPiReplayIssue[];
}

function processPreparedEntry(
	accumulator: ReplayAccumulator,
	data: unknown,
	index: number,
): void {
	const decoded = decodePreparedSaveHandoff(data);
	if (!decoded.ok) {
		replayIssue(
			accumulator.issues,
			index,
			decoded.issue.code,
			decoded.issue.message,
		);
		return;
	}
	if (!matchingLiveEpisode(accumulator.state, decoded.value)) {
		replayIssue(
			accumulator.issues,
			index,
			"pi-entry.handoff.order",
			"Prepared save handoff requires its matching open episode.",
		);
		return;
	}
	const candidate = {
		handoff: decoded.value,
		digest: preparedSaveDigest(decoded.value),
	};
	if (!accumulator.prepared) {
		accumulator.prepared = candidate;
		accumulator.attempt = null;
		return;
	}
	if (
		accumulator.prepared.handoff.prepared.proposal_id ===
			candidate.handoff.prepared.proposal_id &&
		accumulator.prepared.digest === candidate.digest
	) {
		return;
	}
	replayIssue(
		accumulator.issues,
		index,
		"pi-entry.handoff.conflict",
		"Another prepared save handoff is already active.",
	);
}

function attemptMatchesReview(
	accumulator: ReplayAccumulator,
	attempt: ApprovedSaveAttempt,
): boolean {
	return (
		accumulator.state.episode.status === "reviewing-save" &&
		accumulator.prepared !== null &&
		attempt.proposalId === accumulator.prepared.handoff.prepared.proposal_id &&
		attempt.preparedDigest === accumulator.prepared.digest
	);
}

function processAttemptEntry(
	accumulator: ReplayAccumulator,
	data: unknown,
	index: number,
): void {
	const decoded = decodeApprovedSaveAttempt(data);
	if (!decoded.ok) {
		replayIssue(
			accumulator.issues,
			index,
			decoded.issue.code,
			decoded.issue.message,
		);
		return;
	}
	if (!attemptMatchesReview(accumulator, decoded.value)) {
		replayIssue(
			accumulator.issues,
			index,
			"pi-entry.attempt.order",
			"Approved save attempt does not match the current review.",
		);
		return;
	}
	if (!accumulator.attempt) {
		accumulator.attempt = decoded.value;
		return;
	}
	if (sameAttempt(accumulator.attempt, decoded.value)) return;
	replayIssue(
		accumulator.issues,
		index,
		"pi-entry.attempt.conflict",
		"Another approved save attempt is already active.",
	);
}

function processLifecycleEntry(
	accumulator: ReplayAccumulator,
	data: unknown,
	index: number,
): void {
	const decoded = normalizeObserverEvent(data);
	if (!decoded.ok) {
		replayIssue(
			accumulator.issues,
			index,
			"pi-entry.lifecycle.decode",
			decoded.issue.message,
		);
		return;
	}
	const orderIssue = lifecycleOrderIssue(
		decoded.event,
		accumulator.prepared,
		accumulator.attempt,
	);
	if (orderIssue) {
		replayIssue(
			accumulator.issues,
			index,
			"pi-entry.lifecycle.order",
			orderIssue,
		);
		return;
	}
	const application = applyObserverEvent(accumulator.state, decoded.event);
	if (!application.applied) {
		replayIssue(
			accumulator.issues,
			index,
			"pi-entry.lifecycle.transition",
			`Observer transition rejected: ${application.reason}.`,
		);
		return;
	}
	accumulator.state = application.state;
	if (
		decoded.event.kind === "save-cancelled" ||
		decoded.event.kind === "save-committed"
	) {
		accumulator.prepared = null;
		accumulator.attempt = null;
	}
}

function processOwnedEntry(
	accumulator: ReplayAccumulator,
	entry: PiBranchEntryLike,
	index: number,
): void {
	if (entry.type !== "custom" || typeof entry.customType !== "string") return;
	switch (entry.customType) {
		case OBSERVER_PREPARED_SAVE_ENTRY:
			processPreparedEntry(accumulator, entry.data, index);
			return;
		case OBSERVER_SAVE_ATTEMPT_ENTRY:
			processAttemptEntry(accumulator, entry.data, index);
			return;
		case OBSERVER_LIFECYCLE_ENTRY:
			processLifecycleEntry(accumulator, entry.data, index);
			return;
		default:
			return;
	}
}

export function reconstructObserverPiState(
	entries: readonly PiBranchEntryLike[],
): ObserverPiSnapshot {
	const accumulator: ReplayAccumulator = {
		state: initialObserverState(),
		prepared: null,
		attempt: null,
		issues: [],
	};
	for (const [index, entry] of entries.entries()) {
		processOwnedEntry(accumulator, entry, index);
	}
	return {
		state: accumulator.state,
		prepared: accumulator.prepared,
		attempt: accumulator.attempt,
		issues: accumulator.issues,
	};
}
