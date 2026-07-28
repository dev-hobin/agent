import { isSha256, sha256Text } from "./content-hash.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";

export const OBSERVER_MATERIAL_REVIEW_ENTRY = "observer.material-review";
export const OBSERVER_MATERIAL_REVIEW_PROTOCOL = "observer.material-review/v1";
export const OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL = "observer-sidecar/v1";

export type MaterialReviewRequestId = `material-review-${string}`;
export type MaterialReviewMaterial =
	| "inline-user-message"
	| "retrieved-tool-results";

const MATERIAL_REVIEW_INTENT = Symbol("observer.material-review-intent");
const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OBSERVATION_ID =
	/^observation-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_USER_TEXT = 120_000;

export interface MaterialReviewStartAction {
	readonly observerAction: typeof OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL;
	readonly action: "material-review-start";
	readonly userMessageDigest: string;
	readonly material: MaterialReviewMaterial;
}

export interface MaterialReviewFinishAction {
	readonly observerAction: typeof OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL;
	readonly action: "material-review-finish";
	readonly requestId: MaterialReviewRequestId;
}

export interface LatestUserMessage {
	readonly text: string;
	readonly inputSource: "interactive" | "rpc";
}

interface MaterialReviewIntentBase {
	readonly [MATERIAL_REVIEW_INTENT]: true;
	readonly requestId: MaterialReviewRequestId;
	readonly userMessageDigest: string;
	readonly exactUserText: string;
	readonly inputSource: "interactive" | "rpc";
}

export type MaterialReviewIntent =
	| (MaterialReviewIntentBase & { readonly material: "inline-user-message" })
	| (MaterialReviewIntentBase & {
			readonly material: "retrieved-tool-results";
	  });

export interface MaterialReviewRequestedEvent {
	readonly protocol: typeof OBSERVER_MATERIAL_REVIEW_PROTOCOL;
	readonly kind: "material-review-requested";
	readonly requestId: MaterialReviewRequestId;
	readonly episodeId: string;
	readonly userMessageDigest: string;
	readonly material: MaterialReviewMaterial;
}

export interface MaterialReviewCompletedEvent {
	readonly protocol: typeof OBSERVER_MATERIAL_REVIEW_PROTOCOL;
	readonly kind: "material-review-completed";
	readonly requestId: MaterialReviewRequestId;
	readonly episodeId: string;
	readonly observationIds: readonly string[];
	readonly digest: string;
}

export type MaterialReviewEvent =
	| MaterialReviewRequestedEvent
	| MaterialReviewCompletedEvent;

export interface MaterialReviewIssue {
	readonly code:
		| "material-review.action"
		| "material-review.intent"
		| "material-review.shape"
		| "material-review.history"
		| "material-review.conflict"
		| "material-review.pending"
		| "material-review.coverage";
	readonly message: string;
	readonly relatedId?: string;
}

export type MaterialReviewResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: MaterialReviewIssue };

export interface MaterialReviewSession {
	readonly requests: readonly MaterialReviewRequestedEvent[];
	readonly completions: readonly MaterialReviewCompletedEvent[];
	readonly pendingRequest: MaterialReviewRequestedEvent | null;
	readonly completedRequestIds: readonly MaterialReviewRequestId[];
	readonly issues: readonly MaterialReviewIssue[];
}

export type MaterialReviewRequestPlan =
	| { readonly kind: "new"; readonly request: MaterialReviewRequestedEvent }
	| { readonly kind: "resume"; readonly request: MaterialReviewRequestedEvent };

export interface MaterialReviewCoverageCandidate {
	readonly candidateId: string;
}

export interface MaterialReviewCoverageRead {
	readonly readId: string;
	readonly candidateIds: readonly string[];
}

export interface MaterialReviewCoverageObservation {
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
	code: MaterialReviewIssue["code"],
	message: string,
	relatedId?: string,
): MaterialReviewResult<Value> {
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

function material(value: unknown): MaterialReviewMaterial | null {
	return value === "inline-user-message" || value === "retrieved-tool-results"
		? value
		: null;
}

export function decodeMaterialReviewRequestId(
	value: unknown,
): MaterialReviewRequestId | null {
	if (typeof value !== "string" || !value.startsWith("material-review-")) {
		return null;
	}
	return UUID_V4.test(value.slice("material-review-".length))
		? (value as MaterialReviewRequestId)
		: null;
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

export function decodeMaterialReviewStartAction(
	value: unknown,
): MaterialReviewResult<MaterialReviewStartAction> {
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"user_message_digest",
			"material",
		]) ||
		value.observer_action !== OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL ||
		value.action !== "material-review-start" ||
		!isObject(value.material) ||
		!hasExactKeys(value.material, ["kind"])
	)
		return failure(
			"material-review.action",
			"Material-review start has invalid fields.",
		);
	const parsedMaterial = material(value.material.kind);
	if (!isSha256(value.user_message_digest) || !parsedMaterial)
		return failure(
			"material-review.action",
			"Material-review start has invalid values.",
		);
	return {
		ok: true,
		value: {
			observerAction: OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL,
			action: "material-review-start",
			userMessageDigest: value.user_message_digest,
			material: parsedMaterial,
		},
	};
}

export function decodeMaterialReviewFinishAction(
	value: unknown,
): MaterialReviewResult<MaterialReviewFinishAction> {
	if (
		!isObject(value) ||
		!hasExactKeys(value, ["observer_action", "action", "request_id"]) ||
		value.observer_action !== OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL ||
		value.action !== "material-review-finish"
	)
		return failure(
			"material-review.action",
			"Material-review finish has invalid fields.",
		);
	const requestId = decodeMaterialReviewRequestId(value.request_id);
	return requestId
		? {
				ok: true,
				value: {
					observerAction: OBSERVER_MATERIAL_REVIEW_ACTION_PROTOCOL,
					action: "material-review-finish",
					requestId,
				},
			}
		: failure(
				"material-review.action",
				"Material-review finish has an invalid request ID.",
			);
}

export function refineMaterialReviewIntent(input: {
	readonly value: unknown;
	readonly latestUser: LatestUserMessage | null;
	readonly requestId: unknown;
}): MaterialReviewResult<MaterialReviewIntent> {
	const action = decodeMaterialReviewStartAction(input.value);
	if (!action.ok) return action;
	const requestId = decodeMaterialReviewRequestId(input.requestId);
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
			"material-review.intent",
			"Material review start does not match the exact latest user message.",
		);
	const base: MaterialReviewIntentBase = {
		[MATERIAL_REVIEW_INTENT]: true,
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
	readonly requestId: MaterialReviewRequestId;
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

export function encodeMaterialReviewEvent(
	event: MaterialReviewEvent,
): Readonly<Record<string, unknown>> {
	return event.kind === "material-review-requested"
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
): MaterialReviewResult<MaterialReviewRequestedEvent> {
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
		return failure(
			"material-review.shape",
			"Material review request has invalid fields.",
		);
	const requestId = decodeMaterialReviewRequestId(value.request_id);
	const episodeId = nonempty(value.episode_id);
	const parsedMaterial = material(value.material);
	if (
		!requestId ||
		!episodeId ||
		!isSha256(value.user_message_digest) ||
		!parsedMaterial
	)
		return failure(
			"material-review.shape",
			"Material review request has invalid values.",
		);
	return {
		ok: true,
		value: {
			protocol: OBSERVER_MATERIAL_REVIEW_PROTOCOL,
			kind: "material-review-requested",
			requestId,
			episodeId,
			userMessageDigest: value.user_message_digest,
			material: parsedMaterial,
		},
	};
}

function decodeCompleted(
	value: Readonly<Record<string, unknown>>,
): MaterialReviewResult<MaterialReviewCompletedEvent> {
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
		return failure(
			"material-review.shape",
			"Material review completion has invalid fields.",
		);
	const requestId = decodeMaterialReviewRequestId(value.request_id);
	const episodeId = nonempty(value.episode_id);
	const observationIds = parseObservationIds(value.observation_ids);
	if (!requestId || !episodeId || !observationIds || !isSha256(value.digest))
		return failure(
			"material-review.shape",
			"Material review completion has invalid values.",
		);
	const expected = completionDigest({ requestId, episodeId, observationIds });
	if (expected !== value.digest)
		return failure(
			"material-review.shape",
			"Material review completion digest is invalid.",
			requestId,
		);
	return {
		ok: true,
		value: {
			protocol: OBSERVER_MATERIAL_REVIEW_PROTOCOL,
			kind: "material-review-completed",
			requestId,
			episodeId,
			observationIds,
			digest: expected,
		},
	};
}

export function decodeMaterialReviewEvent(
	value: unknown,
): MaterialReviewResult<MaterialReviewEvent> {
	if (!isObject(value))
		return failure(
			"material-review.shape",
			"Material review event has invalid protocol or shape.",
		);
	if (value.protocol !== OBSERVER_MATERIAL_REVIEW_PROTOCOL)
		return failure(
			"material-review.shape",
			"Material review event has invalid protocol or shape.",
		);
	if (value.kind === "material-review-requested") return decodeRequested(value);
	if (value.kind === "material-review-completed") return decodeCompleted(value);
	return failure(
		"material-review.shape",
		"Material review event kind is unknown.",
	);
}

function sameEvent(
	left: MaterialReviewEvent,
	right: MaterialReviewEvent,
): boolean {
	return (
		JSON.stringify(encodeMaterialReviewEvent(left)) ===
		JSON.stringify(encodeMaterialReviewEvent(right))
	);
}

interface MutableMaterialReviewReplay {
	readonly requests: MaterialReviewRequestedEvent[];
	readonly completions: MaterialReviewCompletedEvent[];
	readonly issues: MaterialReviewIssue[];
	pending: MaterialReviewRequestedEvent | null;
}

function replayRequested(
	event: MaterialReviewRequestedEvent,
	state: MutableMaterialReviewReplay,
): void {
	const existing = state.requests.find(
		(item) => item.requestId === event.requestId,
	);
	if (existing && sameEvent(existing, event)) return;
	if (existing) {
		state.issues.push({
			code: "material-review.conflict",
			message: "Material review request identity conflicts with history.",
			relatedId: event.requestId,
		});
		return;
	}
	if (state.pending) {
		state.issues.push({
			code: "material-review.pending",
			message: "Another Material review request is already pending.",
			relatedId: event.requestId,
		});
		return;
	}
	state.requests.push(event);
	state.pending = event;
}

function replayCompleted(
	event: MaterialReviewCompletedEvent,
	state: MutableMaterialReviewReplay,
): void {
	const existing = state.completions.find(
		(item) => item.requestId === event.requestId,
	);
	if (existing && sameEvent(existing, event)) return;
	if (existing) {
		state.issues.push({
			code: "material-review.conflict",
			message: "Material review completion identity conflicts with history.",
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
			code: "material-review.history",
			message: "Material review completion has no matching pending request.",
			relatedId: event.requestId,
		});
		return;
	}
	state.completions.push(event);
	state.pending = null;
}

export function reconstructMaterialReviewSession(
	entries: readonly PiBranchEntryLike[],
): MaterialReviewSession {
	const state: MutableMaterialReviewReplay = {
		requests: [],
		completions: [],
		issues: [],
		pending: null,
	};
	for (const entry of entries) {
		if (
			entry.type !== "custom" ||
			entry.customType !== OBSERVER_MATERIAL_REVIEW_ENTRY
		)
			continue;
		const decoded = decodeMaterialReviewEvent(entry.data);
		if (!decoded.ok) {
			state.issues.push(decoded.issue);
			continue;
		}
		if (decoded.value.kind === "material-review-requested")
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

export function pendingMaterialReviewRequestBefore(input: {
	readonly entries: readonly PiBranchEntryLike[];
	readonly index: number;
	readonly requestId: MaterialReviewRequestId;
	readonly episodeId: string;
}): MaterialReviewRequestedEvent | null {
	if (!Number.isSafeInteger(input.index) || input.index < 0) return null;
	const session = reconstructMaterialReviewSession(
		input.entries.slice(0, input.index),
	);
	if (session.issues.length > 0) return null;
	const pending = session.pendingRequest;
	return pending?.requestId === input.requestId &&
		pending.episodeId === input.episodeId
		? pending
		: null;
}

export function planMaterialReviewRequest(input: {
	readonly intent: MaterialReviewIntent;
	readonly episodeId: string;
	readonly session: MaterialReviewSession;
}): MaterialReviewResult<MaterialReviewRequestPlan> {
	if (input.session.issues.length > 0)
		return failure(
			"material-review.history",
			"Material review history must be repaired before a request.",
		);
	const episodeId = nonempty(input.episodeId);
	if (!episodeId)
		return failure(
			"material-review.intent",
			"Material review requires an open Episode ID.",
		);
	if (input.session.pendingRequest) {
		const pending = input.session.pendingRequest;
		return pending.episodeId === episodeId &&
			pending.userMessageDigest === input.intent.userMessageDigest &&
			pending.material === input.intent.material
			? { ok: true, value: { kind: "resume", request: pending } }
			: failure(
					"material-review.pending",
					"Another Material review request is already pending.",
					pending.requestId,
				);
	}
	return {
		ok: true,
		value: {
			kind: "new",
			request: {
				protocol: OBSERVER_MATERIAL_REVIEW_PROTOCOL,
				kind: "material-review-requested",
				requestId: input.intent.requestId,
				episodeId,
				userMessageDigest: input.intent.userMessageDigest,
				material: input.intent.material,
			},
		},
	};
}

interface MaterialReviewCoverageInput {
	readonly candidates: readonly MaterialReviewCoverageCandidate[];
	readonly sourceReads: readonly MaterialReviewCoverageRead[];
	readonly observations: readonly MaterialReviewCoverageObservation[];
}

function uniqueCandidateIds(
	candidates: readonly MaterialReviewCoverageCandidate[],
): MaterialReviewResult<readonly string[]> {
	const ids = candidates.map((item) => item.candidateId);
	return ids.length > 0 && new Set(ids).size === ids.length
		? { ok: true, value: ids }
		: failure(
				"material-review.coverage",
				"Material review completion requires unique request-linked candidates.",
			);
}

function coveredReads(
	candidateIds: readonly string[],
	sourceReads: readonly MaterialReviewCoverageRead[],
): MaterialReviewResult<readonly MaterialReviewCoverageRead[]> {
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
			"material-review.coverage",
			"Material review SourceReads must contain only request-linked candidates.",
		);
	const consumed = new Set(reads.flatMap((read) => read.candidateIds));
	if (candidateIds.some((candidateId) => !consumed.has(candidateId)))
		return failure(
			"material-review.coverage",
			"Every Material review candidate requires SourceRead coverage.",
		);
	const readIds = reads.map((read) => read.readId);
	return new Set(readIds).size === readIds.length
		? { ok: true, value: reads }
		: failure(
				"material-review.coverage",
				"Material review SourceRead identities must be unique.",
			);
}

function coveredObservationIds(
	reads: readonly MaterialReviewCoverageRead[],
	observations: readonly MaterialReviewCoverageObservation[],
): MaterialReviewResult<readonly string[]> {
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
			"material-review.coverage",
			"Every Material review SourceRead requires exactly one semantic Observation.",
		);
	const ids = covered
		.map((item) => item.observationId)
		.toSorted((left, right) => left.localeCompare(right));
	return ids.length > 0 &&
		new Set(ids).size === ids.length &&
		ids.every((id) => OBSERVATION_ID.test(id))
		? { ok: true, value: ids }
		: failure(
				"material-review.coverage",
				"Material review Observation identities are invalid.",
			);
}

interface MaterialReviewCompletionContext {
	readonly requestId: MaterialReviewRequestId;
	readonly completed: MaterialReviewCompletedEvent | undefined;
}

function materialReviewCompletionContext(input: {
	readonly requestId: unknown;
	readonly episodeId: string;
	readonly session: MaterialReviewSession;
}): MaterialReviewCompletionContext | null {
	const requestId = decodeMaterialReviewRequestId(input.requestId);
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

export function planMaterialReviewCompletion(
	input: {
		readonly requestId: unknown;
		readonly episodeId: string;
		readonly session: MaterialReviewSession;
	} & MaterialReviewCoverageInput,
): MaterialReviewResult<MaterialReviewCompletedEvent> {
	if (input.session.issues.length > 0)
		return failure(
			"material-review.history",
			"Material review history must be repaired before completion.",
		);
	const context = materialReviewCompletionContext(input);
	if (!context)
		return failure(
			"material-review.pending",
			"Material review completion requires the exact current request.",
		);
	const { requestId, completed } = context;
	const candidates = uniqueCandidateIds(input.candidates);
	if (!candidates.ok) return candidates;
	const reads = coveredReads(candidates.value, input.sourceReads);
	if (!reads.ok) return reads;
	const observations = coveredObservationIds(reads.value, input.observations);
	if (!observations.ok) return observations;
	const planned: MaterialReviewCompletedEvent = {
		protocol: OBSERVER_MATERIAL_REVIEW_PROTOCOL,
		kind: "material-review-completed",
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
			"material-review.conflict",
			"Persisted Material review completion does not match current coverage.",
			requestId,
		);
	return { ok: true, value: completed ?? planned };
}
