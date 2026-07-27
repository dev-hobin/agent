import { isSha256, sha256Text } from "./content-hash.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";

export const OBSERVER_ONE_SHOT_ENTRY = "observer.one-shot";
export const OBSERVER_ONE_SHOT_PROTOCOL = "observer.one-shot/v1";
export const OBSERVER_ONE_SHOT_ACTION_PROTOCOL = "observer-sidecar/v1";

export type OneShotRequestId = `one-shot-${string}`;
export type OneShotMaterial = "inline-user-message" | "retrieved-tool-results";

const ONE_SHOT_INTENT = Symbol("observer.one-shot-intent");
const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OBSERVATION_ID =
	/^observation-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_USER_TEXT = 120_000;

export interface OneShotStartAction {
	readonly observerAction: typeof OBSERVER_ONE_SHOT_ACTION_PROTOCOL;
	readonly action: "one-shot-start";
	readonly userMessageDigest: string;
	readonly material: OneShotMaterial;
}

export interface OneShotFinishAction {
	readonly observerAction: typeof OBSERVER_ONE_SHOT_ACTION_PROTOCOL;
	readonly action: "one-shot-finish";
	readonly requestId: OneShotRequestId;
}

export interface LatestUserMessage {
	readonly text: string;
	readonly inputSource: "interactive" | "rpc";
}

interface OneShotIntentBase {
	readonly [ONE_SHOT_INTENT]: true;
	readonly requestId: OneShotRequestId;
	readonly userMessageDigest: string;
	readonly exactUserText: string;
	readonly inputSource: "interactive" | "rpc";
}

export type OneShotIntent =
	| (OneShotIntentBase & { readonly material: "inline-user-message" })
	| (OneShotIntentBase & { readonly material: "retrieved-tool-results" });

export interface OneShotRequestedEvent {
	readonly protocol: typeof OBSERVER_ONE_SHOT_PROTOCOL;
	readonly kind: "one-shot-requested";
	readonly requestId: OneShotRequestId;
	readonly episodeId: string;
	readonly userMessageDigest: string;
	readonly material: OneShotMaterial;
}

export interface OneShotCompletedEvent {
	readonly protocol: typeof OBSERVER_ONE_SHOT_PROTOCOL;
	readonly kind: "one-shot-completed";
	readonly requestId: OneShotRequestId;
	readonly episodeId: string;
	readonly observationIds: readonly string[];
	readonly digest: string;
}

export type OneShotEvent = OneShotRequestedEvent | OneShotCompletedEvent;

export interface OneShotIssue {
	readonly code:
		| "one-shot.action"
		| "one-shot.intent"
		| "one-shot.shape"
		| "one-shot.history"
		| "one-shot.conflict"
		| "one-shot.pending"
		| "one-shot.coverage";
	readonly message: string;
	readonly relatedId?: string;
}

export type OneShotResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: OneShotIssue };

export interface OneShotSession {
	readonly requests: readonly OneShotRequestedEvent[];
	readonly completions: readonly OneShotCompletedEvent[];
	readonly pendingRequest: OneShotRequestedEvent | null;
	readonly completedRequestIds: readonly OneShotRequestId[];
	readonly issues: readonly OneShotIssue[];
}

export type OneShotRequestPlan =
	| { readonly kind: "new"; readonly request: OneShotRequestedEvent }
	| { readonly kind: "resume"; readonly request: OneShotRequestedEvent };

export interface OneShotCoverageCandidate {
	readonly candidateId: string;
}

export interface OneShotCoverageRead {
	readonly readId: string;
	readonly candidateIds: readonly string[];
}

export interface OneShotCoverageObservation {
	readonly observationId: string;
	readonly readId: string;
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

function failure<Value>(
	code: OneShotIssue["code"],
	message: string,
	relatedId?: string,
): OneShotResult<Value> {
	return {
		ok: false,
		issue: relatedId ? { code, message, relatedId } : { code, message },
	};
}

function nonempty(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 && value === value.trim()
		? value
		: null;
}

function material(value: unknown): OneShotMaterial | null {
	return value === "inline-user-message" || value === "retrieved-tool-results"
		? value
		: null;
}

export function decodeOneShotRequestId(
	value: unknown,
): OneShotRequestId | null {
	if (typeof value !== "string" || !value.startsWith("one-shot-")) return null;
	const uuid = value.slice("one-shot-".length);
	return UUID_V4.test(uuid) ? `one-shot-${uuid}` : null;
}

function parseObservationIds(value: unknown): readonly string[] | null {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((item) => typeof item !== "string" || !OBSERVATION_ID.test(item))
	)
		return null;
	const sorted = [...value].toSorted((left, right) =>
		left.localeCompare(right),
	);
	return new Set(sorted).size === sorted.length ? sorted : null;
}

export function decodeOneShotStartAction(
	value: unknown,
): OneShotResult<OneShotStartAction> {
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"user_message_digest",
			"material",
		]) ||
		value.observer_action !== OBSERVER_ONE_SHOT_ACTION_PROTOCOL ||
		value.action !== "one-shot-start" ||
		!isObject(value.material) ||
		!hasExactKeys(value.material, ["kind"])
	)
		return failure("one-shot.action", "One-shot start has invalid fields.");
	const parsedMaterial = material(value.material.kind);
	if (!isSha256(value.user_message_digest) || !parsedMaterial)
		return failure("one-shot.action", "One-shot start has invalid values.");
	return {
		ok: true,
		value: {
			observerAction: OBSERVER_ONE_SHOT_ACTION_PROTOCOL,
			action: "one-shot-start",
			userMessageDigest: value.user_message_digest,
			material: parsedMaterial,
		},
	};
}

export function decodeOneShotFinishAction(
	value: unknown,
): OneShotResult<OneShotFinishAction> {
	if (
		!isObject(value) ||
		!hasExactKeys(value, ["observer_action", "action", "request_id"]) ||
		value.observer_action !== OBSERVER_ONE_SHOT_ACTION_PROTOCOL ||
		value.action !== "one-shot-finish"
	)
		return failure("one-shot.action", "One-shot finish has invalid fields.");
	const requestId = decodeOneShotRequestId(value.request_id);
	return requestId
		? {
				ok: true,
				value: {
					observerAction: OBSERVER_ONE_SHOT_ACTION_PROTOCOL,
					action: "one-shot-finish",
					requestId,
				},
			}
		: failure("one-shot.action", "One-shot finish has an invalid request ID.");
}

export function refineOneShotIntent(input: {
	readonly value: unknown;
	readonly latestUser: LatestUserMessage | null;
	readonly requestId: unknown;
}): OneShotResult<OneShotIntent> {
	const action = decodeOneShotStartAction(input.value);
	if (!action.ok) return action;
	const requestId = decodeOneShotRequestId(input.requestId);
	const text = input.latestUser?.text;
	if (
		!requestId ||
		!input.latestUser ||
		typeof text !== "string" ||
		text.length === 0 ||
		text.length > MAX_USER_TEXT ||
		text !== text.trim() ||
		sha256Text(text) !== action.value.userMessageDigest
	)
		return failure(
			"one-shot.intent",
			"One-shot start does not match the exact latest user message.",
		);
	const base: OneShotIntentBase = {
		[ONE_SHOT_INTENT]: true,
		requestId,
		userMessageDigest: action.value.userMessageDigest,
		exactUserText: text,
		inputSource: input.latestUser.inputSource,
	};
	return action.value.material === "inline-user-message"
		? {
				ok: true,
				value: { ...base, material: "inline-user-message" },
			}
		: {
				ok: true,
				value: { ...base, material: "retrieved-tool-results" },
			};
}

function completionDigest(input: {
	readonly requestId: OneShotRequestId;
	readonly episodeId: string;
	readonly observationIds: readonly string[];
}): string {
	return sha256Text(
		JSON.stringify({
			request_id: input.requestId,
			episode_id: input.episodeId,
			observation_ids: input.observationIds,
		}),
	);
}

export function encodeOneShotEvent(
	event: OneShotEvent,
): Readonly<Record<string, unknown>> {
	return event.kind === "one-shot-requested"
		? {
				protocol: event.protocol,
				kind: event.kind,
				request_id: event.requestId,
				episode_id: event.episodeId,
				user_message_digest: event.userMessageDigest,
				material: event.material,
			}
		: {
				protocol: event.protocol,
				kind: event.kind,
				request_id: event.requestId,
				episode_id: event.episodeId,
				observation_ids: event.observationIds,
				digest: event.digest,
			};
}

function decodeRequested(
	value: Readonly<Record<string, unknown>>,
): OneShotResult<OneShotRequestedEvent> {
	if (
		!hasExactKeys(value, [
			"protocol",
			"kind",
			"request_id",
			"episode_id",
			"user_message_digest",
			"material",
		])
	)
		return failure("one-shot.shape", "One-shot request has invalid fields.");
	const requestId = decodeOneShotRequestId(value.request_id);
	const episodeId = nonempty(value.episode_id);
	const parsedMaterial = material(value.material);
	if (
		!requestId ||
		!episodeId ||
		!isSha256(value.user_message_digest) ||
		!parsedMaterial
	)
		return failure("one-shot.shape", "One-shot request has invalid values.");
	return {
		ok: true,
		value: {
			protocol: OBSERVER_ONE_SHOT_PROTOCOL,
			kind: "one-shot-requested",
			requestId,
			episodeId,
			userMessageDigest: value.user_message_digest,
			material: parsedMaterial,
		},
	};
}

function decodeCompleted(
	value: Readonly<Record<string, unknown>>,
): OneShotResult<OneShotCompletedEvent> {
	if (
		!hasExactKeys(value, [
			"protocol",
			"kind",
			"request_id",
			"episode_id",
			"observation_ids",
			"digest",
		])
	)
		return failure("one-shot.shape", "One-shot completion has invalid fields.");
	const requestId = decodeOneShotRequestId(value.request_id);
	const episodeId = nonempty(value.episode_id);
	const observationIds = parseObservationIds(value.observation_ids);
	if (!requestId || !episodeId || !observationIds || !isSha256(value.digest))
		return failure("one-shot.shape", "One-shot completion has invalid values.");
	const expected = completionDigest({ requestId, episodeId, observationIds });
	if (expected !== value.digest)
		return failure(
			"one-shot.shape",
			"One-shot completion digest is invalid.",
			requestId,
		);
	return {
		ok: true,
		value: {
			protocol: OBSERVER_ONE_SHOT_PROTOCOL,
			kind: "one-shot-completed",
			requestId,
			episodeId,
			observationIds,
			digest: expected,
		},
	};
}

export function decodeOneShotEvent(
	value: unknown,
): OneShotResult<OneShotEvent> {
	if (!isObject(value) || value.protocol !== OBSERVER_ONE_SHOT_PROTOCOL)
		return failure(
			"one-shot.shape",
			"One-shot event has invalid protocol or shape.",
		);
	if (value.kind === "one-shot-requested") return decodeRequested(value);
	if (value.kind === "one-shot-completed") return decodeCompleted(value);
	return failure("one-shot.shape", "One-shot event kind is unknown.");
}

function sameEvent(left: OneShotEvent, right: OneShotEvent): boolean {
	return (
		JSON.stringify(encodeOneShotEvent(left)) ===
		JSON.stringify(encodeOneShotEvent(right))
	);
}

interface MutableOneShotReplay {
	readonly requests: OneShotRequestedEvent[];
	readonly completions: OneShotCompletedEvent[];
	readonly issues: OneShotIssue[];
	pending: OneShotRequestedEvent | null;
}

function replayRequested(
	event: OneShotRequestedEvent,
	state: MutableOneShotReplay,
): void {
	const existing = state.requests.find(
		(item) => item.requestId === event.requestId,
	);
	if (existing && sameEvent(existing, event)) return;
	if (existing) {
		state.issues.push({
			code: "one-shot.conflict",
			message: "One-shot request identity conflicts with history.",
			relatedId: event.requestId,
		});
		return;
	}
	if (state.pending) {
		state.issues.push({
			code: "one-shot.pending",
			message: "Another One-shot request is already pending.",
			relatedId: event.requestId,
		});
		return;
	}
	state.requests.push(event);
	state.pending = event;
}

function replayCompleted(
	event: OneShotCompletedEvent,
	state: MutableOneShotReplay,
): void {
	const existing = state.completions.find(
		(item) => item.requestId === event.requestId,
	);
	if (existing && sameEvent(existing, event)) return;
	if (existing) {
		state.issues.push({
			code: "one-shot.conflict",
			message: "One-shot completion identity conflicts with history.",
			relatedId: event.requestId,
		});
		return;
	}
	if (
		!state.pending ||
		state.pending.requestId !== event.requestId ||
		state.pending.episodeId !== event.episodeId
	) {
		state.issues.push({
			code: "one-shot.history",
			message: "One-shot completion has no matching pending request.",
			relatedId: event.requestId,
		});
		return;
	}
	state.completions.push(event);
	state.pending = null;
}

export function reconstructOneShotSession(
	entries: readonly PiBranchEntryLike[],
): OneShotSession {
	const state: MutableOneShotReplay = {
		requests: [],
		completions: [],
		issues: [],
		pending: null,
	};
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== OBSERVER_ONE_SHOT_ENTRY)
			continue;
		const decoded = decodeOneShotEvent(entry.data);
		if (!decoded.ok) {
			state.issues.push(decoded.issue);
			continue;
		}
		if (decoded.value.kind === "one-shot-requested")
			replayRequested(decoded.value, state);
		else replayCompleted(decoded.value, state);
	}
	return {
		requests: state.requests,
		completions: state.completions,
		pendingRequest: state.pending,
		completedRequestIds: state.completions.map((event) => event.requestId),
		issues: state.issues,
	};
}

export function pendingOneShotRequestBefore(input: {
	readonly entries: readonly PiBranchEntryLike[];
	readonly index: number;
	readonly requestId: OneShotRequestId;
	readonly episodeId: string;
}): OneShotRequestedEvent | null {
	if (!Number.isSafeInteger(input.index) || input.index < 0) return null;
	const session = reconstructOneShotSession(
		input.entries.slice(0, input.index),
	);
	if (session.issues.length > 0) return null;
	const pending = session.pendingRequest;
	return pending?.requestId === input.requestId &&
		pending.episodeId === input.episodeId
		? pending
		: null;
}

export function planOneShotRequest(input: {
	readonly intent: OneShotIntent;
	readonly episodeId: string;
	readonly session: OneShotSession;
}): OneShotResult<OneShotRequestPlan> {
	if (input.session.issues.length > 0)
		return failure(
			"one-shot.history",
			"One-shot history must be repaired before a request.",
		);
	const episodeId = nonempty(input.episodeId);
	if (!episodeId)
		return failure("one-shot.intent", "One-shot requires an open Episode ID.");
	if (input.session.pendingRequest) {
		const pending = input.session.pendingRequest;
		return pending.episodeId === episodeId &&
			pending.userMessageDigest === input.intent.userMessageDigest &&
			pending.material === input.intent.material
			? { ok: true, value: { kind: "resume", request: pending } }
			: failure(
					"one-shot.pending",
					"Another One-shot request is already pending.",
					pending.requestId,
				);
	}
	return {
		ok: true,
		value: {
			kind: "new",
			request: {
				protocol: OBSERVER_ONE_SHOT_PROTOCOL,
				kind: "one-shot-requested",
				requestId: input.intent.requestId,
				episodeId,
				userMessageDigest: input.intent.userMessageDigest,
				material: input.intent.material,
			},
		},
	};
}

interface OneShotCoverageInput {
	readonly candidates: readonly OneShotCoverageCandidate[];
	readonly sourceReads: readonly OneShotCoverageRead[];
	readonly observations: readonly OneShotCoverageObservation[];
}

function uniqueCandidateIds(
	candidates: readonly OneShotCoverageCandidate[],
): OneShotResult<readonly string[]> {
	const ids = candidates.map((item) => item.candidateId);
	return ids.length > 0 && new Set(ids).size === ids.length
		? { ok: true, value: ids }
		: failure(
				"one-shot.coverage",
				"One-shot completion requires unique request-linked candidates.",
			);
}

function coveredReads(
	candidateIds: readonly string[],
	sourceReads: readonly OneShotCoverageRead[],
): OneShotResult<readonly OneShotCoverageRead[]> {
	const candidateSet = new Set(candidateIds);
	const reads = sourceReads.filter((read) =>
		read.candidateIds.some((candidateId) => candidateSet.has(candidateId)),
	);
	const hasForeignCandidate = reads.some(
		(read) =>
			read.candidateIds.length === 0 ||
			read.candidateIds.some((candidateId) => !candidateSet.has(candidateId)),
	);
	if (reads.length === 0 || hasForeignCandidate)
		return failure(
			"one-shot.coverage",
			"One-shot SourceReads must contain only request-linked candidates.",
		);
	const consumed = new Set(reads.flatMap((read) => read.candidateIds));
	if (candidateIds.some((candidateId) => !consumed.has(candidateId)))
		return failure(
			"one-shot.coverage",
			"Every One-shot candidate requires SourceRead coverage.",
		);
	const readIds = reads.map((read) => read.readId);
	return new Set(readIds).size === readIds.length
		? { ok: true, value: reads }
		: failure(
				"one-shot.coverage",
				"One-shot SourceRead identities must be unique.",
			);
}

function coveredObservationIds(
	reads: readonly OneShotCoverageRead[],
	observations: readonly OneShotCoverageObservation[],
): OneShotResult<readonly string[]> {
	const readIds = reads.map((read) => read.readId);
	const readSet = new Set(readIds);
	const covered = observations.filter((observation) =>
		readSet.has(observation.readId),
	);
	if (
		covered.length !== readIds.length ||
		new Set(covered.map((item) => item.readId)).size !== readIds.length
	)
		return failure(
			"one-shot.coverage",
			"Every One-shot SourceRead requires exactly one semantic Observation.",
		);
	const ids = covered
		.map((item) => item.observationId)
		.toSorted((left, right) => left.localeCompare(right));
	return ids.length > 0 &&
		new Set(ids).size === ids.length &&
		ids.every((id) => OBSERVATION_ID.test(id))
		? { ok: true, value: ids }
		: failure(
				"one-shot.coverage",
				"One-shot Observation identities are invalid.",
			);
}

interface OneShotCompletionContext {
	readonly requestId: OneShotRequestId;
	readonly completed: OneShotCompletedEvent | undefined;
}

function oneShotCompletionContext(input: {
	readonly requestId: unknown;
	readonly episodeId: string;
	readonly session: OneShotSession;
}): OneShotCompletionContext | null {
	const requestId = decodeOneShotRequestId(input.requestId);
	if (!requestId) return null;
	const pending = input.session.pendingRequest;
	if (pending)
		return pending.requestId === requestId &&
			pending.episodeId === input.episodeId
			? { requestId, completed: undefined }
			: null;
	const completed = input.session.completions.find(
		(event) => event.requestId === requestId,
	);
	return completed?.episodeId === input.episodeId
		? { requestId, completed }
		: null;
}

export function planOneShotCompletion(
	input: {
		readonly requestId: unknown;
		readonly episodeId: string;
		readonly session: OneShotSession;
	} & OneShotCoverageInput,
): OneShotResult<OneShotCompletedEvent> {
	if (input.session.issues.length > 0)
		return failure(
			"one-shot.history",
			"One-shot history must be repaired before completion.",
		);
	const context = oneShotCompletionContext(input);
	if (!context)
		return failure(
			"one-shot.pending",
			"One-shot completion requires the exact current request.",
		);
	const { requestId, completed } = context;
	const candidates = uniqueCandidateIds(input.candidates);
	if (!candidates.ok) return candidates;
	const reads = coveredReads(candidates.value, input.sourceReads);
	if (!reads.ok) return reads;
	const observations = coveredObservationIds(reads.value, input.observations);
	if (!observations.ok) return observations;
	const planned: OneShotCompletedEvent = {
		protocol: OBSERVER_ONE_SHOT_PROTOCOL,
		kind: "one-shot-completed",
		requestId,
		episodeId: input.episodeId,
		observationIds: observations.value,
		digest: completionDigest({
			requestId,
			episodeId: input.episodeId,
			observationIds: observations.value,
		}),
	};
	if (completed && !sameEvent(completed, planned))
		return failure(
			"one-shot.conflict",
			"Persisted One-shot completion does not match current coverage.",
			requestId,
		);
	return { ok: true, value: completed ?? planned };
}
