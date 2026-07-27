import { isAbsolute } from "node:path";

import { sha256Text, isSha256 } from "./content-hash.ts";
import { normalizeObserverEvent } from "./lifecycle.ts";
import type { MemoWorkingState } from "./memo-reconciliation.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import type { NotebookHandle, NotebookInventoryEntry } from "./notebook.ts";
import type { ObservationSessionSnapshot } from "./observation-session.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";

export const OBSERVER_WRAP_REQUEST_ENTRY = "observer.wrap-request";
export const OBSERVER_WRAP_REQUEST_PROTOCOL = "observer.wrap-request/v1";
export const OBSERVER_WRAP_PREPARATION_PROTOCOL =
	"observer.wrap-preparation/v1";

export type WrapRequestId = `wrap-request-${string}`;
export type WrapProposalId = `proposal-${string}`;

export interface WrapRequestEvent {
	readonly protocol: typeof OBSERVER_WRAP_REQUEST_PROTOCOL;
	readonly kind: "wrap-requested";
	readonly requestId: WrapRequestId;
	readonly proposalId: WrapProposalId;
	readonly requestDigest: string;
	readonly episodeId: string;
	readonly notebookId: string;
	readonly root: string;
	readonly episodeLanguage: "ko" | "en";
	readonly memoRevisionId: string | null;
	readonly sourceReadIds: readonly string[];
}

export interface WrapRequestIssue {
	readonly code:
		| "wrap-request.shape"
		| "wrap-request.history"
		| "wrap-request.conflict"
		| "wrap-request.state"
		| "wrap-request.pending"
		| "wrap-request.stale";
	readonly message: string;
	readonly relatedId?: string;
}

export interface WrapRequestSession {
	readonly requests: readonly WrapRequestEvent[];
	readonly consumedRequestIds: readonly WrapRequestId[];
	readonly pendingRequest: WrapRequestEvent | null;
	readonly issues: readonly WrapRequestIssue[];
}

export type WrapRequestPlan =
	| { readonly kind: "new"; readonly request: WrapRequestEvent }
	| { readonly kind: "resume"; readonly request: WrapRequestEvent };

export type WrapRequestPlanResult =
	| { readonly ok: true; readonly value: WrapRequestPlan }
	| { readonly ok: false; readonly issue: WrapRequestIssue };

export interface WrapSourceProjection {
	readonly read_id: string;
	readonly digest: string;
	readonly source: unknown;
	readonly faithful_summary: string;
	readonly claims: readonly unknown[];
}

export interface WrapInventoryProjection {
	readonly record_id: string;
	readonly path: string;
	readonly sha256: string;
	readonly markdown: string;
}

export interface WrapPreparationContext {
	readonly request: WrapRequestEvent;
	readonly lockedTarget: {
		readonly proposal_id: WrapProposalId;
		readonly notebook_id: string;
		readonly root: string;
		readonly episode_language: "ko" | "en";
	};
	readonly observedSources: readonly WrapSourceProjection[];
	readonly working: MemoWorkingState;
	readonly inventory: readonly WrapInventoryProjection[];
}

export interface WrapPreparationGuide {
	readonly protocol: typeof OBSERVER_WRAP_PREPARATION_PROTOCOL;
	readonly request: {
		readonly request_id: WrapRequestId;
		readonly request_digest: string;
		readonly memo_revision_id: string | null;
	};
	readonly locked_target: WrapPreparationContext["lockedTarget"];
	readonly observed_sources: readonly WrapSourceProjection[];
	readonly working: MemoWorkingState;
	readonly inventory: readonly WrapInventoryProjection[];
	readonly markdown_profile: "observer-record/v1";
}

export type WrapPreparationContextResult =
	| { readonly ok: true; readonly value: WrapPreparationContext }
	| { readonly ok: false; readonly issue: WrapRequestIssue };

const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

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

function failure(
	code: WrapRequestIssue["code"],
	message: string,
	relatedId?: string,
): { readonly ok: false; readonly issue: WrapRequestIssue } {
	return {
		ok: false,
		issue: relatedId ? { code, message, relatedId } : { code, message },
	};
}

function decodeUuidV4(value: unknown): string | null {
	return typeof value === "string" && UUID_V4.test(value) ? value : null;
}

function decodeWrapRequestId(value: unknown): WrapRequestId | null {
	if (typeof value !== "string" || !value.startsWith("wrap-request-"))
		return null;
	const uuid = decodeUuidV4(value.slice("wrap-request-".length));
	return uuid ? `wrap-request-${uuid}` : null;
}

function decodeProposalId(value: unknown): WrapProposalId | null {
	if (typeof value !== "string" || !value.startsWith("proposal-")) return null;
	const uuid = decodeUuidV4(value.slice("proposal-".length));
	return uuid ? `proposal-${uuid}` : null;
}

function parseStrings(value: unknown): readonly string[] | null {
	if (
		!Array.isArray(value) ||
		value.some(
			(item) =>
				typeof item !== "string" || item.length === 0 || item !== item.trim(),
		)
	)
		return null;
	const sorted = [...value].toSorted((left, right) =>
		left.localeCompare(right),
	);
	return new Set(sorted).size === sorted.length ? sorted : null;
}

function nonemptyString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function absoluteRoot(value: unknown): string | null {
	return typeof value === "string" && isAbsolute(value) ? value : null;
}

function episodeLanguage(value: unknown): "ko" | "en" | null {
	return value === "ko" || value === "en" ? value : null;
}

function nullableRevision(value: unknown): string | null | undefined {
	if (value === null) return null;
	return nonemptyString(value) ?? undefined;
}

function decodeWrapRequestValues(
	value: Readonly<Record<string, unknown>>,
): WrapRequestEvent | null {
	const requestId = decodeWrapRequestId(value.request_id);
	const proposalId = decodeProposalId(value.proposal_id);
	const requestDigest = isSha256(value.request_digest)
		? value.request_digest
		: null;
	const episodeId = nonemptyString(value.episode_id);
	const notebookId = nonemptyString(value.notebook_id);
	const root = absoluteRoot(value.root);
	const language = episodeLanguage(value.episode_language);
	const memoRevisionId = nullableRevision(value.memo_revision_id);
	const sourceReadIds = parseStrings(value.source_read_ids);
	if (
		!requestId ||
		!proposalId ||
		!requestDigest ||
		!episodeId ||
		!notebookId ||
		!root ||
		!language ||
		memoRevisionId === undefined ||
		!sourceReadIds
	)
		return null;
	return {
		protocol: OBSERVER_WRAP_REQUEST_PROTOCOL,
		kind: "wrap-requested",
		requestId,
		proposalId,
		requestDigest,
		episodeId,
		notebookId,
		root,
		episodeLanguage: language,
		memoRevisionId,
		sourceReadIds,
	};
}

export function decodeWrapRequestEvent(
	value: unknown,
):
	| { readonly ok: true; readonly value: WrapRequestEvent }
	| { readonly ok: false; readonly issue: WrapRequestIssue } {
	if (!isObject(value))
		return failure("wrap-request.shape", "Wrap request must be an object.");
	if (
		!hasExactKeys(value, [
			"protocol",
			"kind",
			"request_id",
			"proposal_id",
			"request_digest",
			"episode_id",
			"notebook_id",
			"root",
			"episode_language",
			"memo_revision_id",
			"source_read_ids",
		]) ||
		value.protocol !== OBSERVER_WRAP_REQUEST_PROTOCOL ||
		value.kind !== "wrap-requested"
	) {
		return failure(
			"wrap-request.shape",
			"Wrap request has invalid fields or protocol.",
		);
	}
	const decoded = decodeWrapRequestValues(value);
	return decoded
		? { ok: true, value: decoded }
		: failure("wrap-request.shape", "Wrap request has invalid values.");
}

export function encodeWrapRequestEvent(
	event: WrapRequestEvent,
): Record<string, unknown> {
	return {
		protocol: event.protocol,
		kind: event.kind,
		request_id: event.requestId,
		proposal_id: event.proposalId,
		request_digest: event.requestDigest,
		episode_id: event.episodeId,
		notebook_id: event.notebookId,
		root: event.root,
		episode_language: event.episodeLanguage,
		memo_revision_id: event.memoRevisionId,
		source_read_ids: event.sourceReadIds,
	};
}

function replayRequestEntry(input: {
	readonly entry: PiBranchEntryLike;
	readonly requests: Map<WrapRequestId, WrapRequestEvent>;
	readonly signatures: Map<WrapRequestId, string>;
}): WrapRequestIssue | null {
	if (
		input.entry.type !== "custom" ||
		input.entry.customType !== OBSERVER_WRAP_REQUEST_ENTRY
	)
		return null;
	const decoded = decodeWrapRequestEvent(input.entry.data);
	if (!decoded.ok) return decoded.issue;
	const signature = JSON.stringify(encodeWrapRequestEvent(decoded.value));
	const prior = input.signatures.get(decoded.value.requestId);
	if (prior && prior !== signature)
		return {
			code: "wrap-request.conflict",
			message: "Wrap request identity conflicts.",
			relatedId: decoded.value.requestId,
		};
	if (!prior) {
		input.signatures.set(decoded.value.requestId, signature);
		input.requests.set(decoded.value.requestId, decoded.value);
	}
	return null;
}

function lifecycleProposalId(entry: PiBranchEntryLike): string | null {
	if (entry.type !== "custom" || entry.customType !== "observer.lifecycle")
		return null;
	const decoded = normalizeObserverEvent(entry.data);
	if (!decoded.ok) return null;
	return decoded.event.kind === "wrap-proposed" ||
		decoded.event.kind === "wrap-cancelled" ||
		decoded.event.kind === "wrap-committed"
		? decoded.event.proposalId
		: null;
}

export function reconstructWrapRequestSession(
	entries: readonly PiBranchEntryLike[],
): WrapRequestSession {
	const requests = new Map<WrapRequestId, WrapRequestEvent>();
	const signatures = new Map<WrapRequestId, string>();
	const consumedProposalIds = new Set<string>();
	const issues: WrapRequestIssue[] = [];
	for (const entry of entries) {
		const proposalId = lifecycleProposalId(entry);
		if (proposalId) consumedProposalIds.add(proposalId);
		const replayIssue = replayRequestEntry({ entry, requests, signatures });
		if (replayIssue) issues.push(replayIssue);
	}
	const values = [...requests.values()].toSorted((left, right) =>
		left.requestId.localeCompare(right.requestId),
	);
	const consumed = values.filter((request) =>
		consumedProposalIds.has(request.proposalId),
	);
	const pending = values.filter(
		(request) => !consumedProposalIds.has(request.proposalId),
	);
	if (pending.length > 1) {
		issues.push({
			code: "wrap-request.conflict",
			message: "Only one pending Wrap request may exist.",
			relatedId: pending[1]?.requestId,
		});
	}
	return {
		requests: values,
		consumedRequestIds: consumed.map((request) => request.requestId),
		pendingRequest: pending[0] ?? null,
		issues,
	};
}

function inventoryProjection(
	inventory: readonly NotebookInventoryEntry[],
): readonly WrapInventoryProjection[] {
	return inventory
		.map((entry) => ({
			record_id: entry.document.record.id,
			path: entry.path,
			sha256: entry.sha256,
			markdown: entry.content,
		}))
		.toSorted((left, right) => left.record_id.localeCompare(right.record_id));
}

function sourceProjection(
	observation: ObservationSessionSnapshot,
): readonly WrapSourceProjection[] {
	return observation.sourceReads
		.map((read) => ({
			read_id: read.readId,
			digest: read.digest,
			source: read.source,
			faithful_summary: read.faithfulSummary,
			claims: read.claims,
		}))
		.toSorted((left, right) => left.read_id.localeCompare(right.read_id));
}

function requestDigest(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly notebook: NotebookHandle;
}): string {
	const episode = input.observation.lifecycle.episode;
	return sha256Text(
		JSON.stringify({
			episode:
				episode.status === "empty"
					? null
					: {
							episode_id: episode.core.episodeId,
							notebook_id: episode.core.notebookId,
							episode_language: episode.core.lang,
						},
			root: input.notebook.root,
			memo: input.memo.state,
			consumed_observation_ids: input.observation.consumedObservationIds,
			sources: sourceProjection(input.observation).map((source) => ({
				read_id: source.read_id,
				digest: source.digest,
			})),
			inventory: inventoryProjection(input.inventory).map((entry) => ({
				record_id: entry.record_id,
				path: entry.path,
				sha256: entry.sha256,
			})),
		}),
	);
}

function currentFailure(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly requestSession: WrapRequestSession;
}): WrapRequestIssue | null {
	if (input.observation.issues.length > 0 || input.memo.issues.length > 0)
		return {
			code: "wrap-request.history",
			message: "Wrap request requires clean Observation and Memo replay.",
		};
	if (input.requestSession.issues.length > 0)
		return input.requestSession.issues[0] ?? null;
	if (input.observation.lifecycle.episode.status !== "open")
		return {
			code: "wrap-request.state",
			message: "Wrap request requires an open Episode.",
		};
	if (
		input.observation.pendingMemoRequest ||
		input.observation.unconsumedObservationIds.length > 0 ||
		input.memo.prepared ||
		input.memo.pendingAcknowledgment
	)
		return {
			code: "wrap-request.pending",
			message: "Wrap request requires completed Memo reconciliation.",
		};
	return null;
}

export function planWrapRequest(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly requestSession: WrapRequestSession;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly notebook: NotebookHandle;
	readonly requestId: WrapRequestId;
	readonly proposalId: WrapProposalId;
}): WrapRequestPlanResult {
	const invalid = currentFailure(input);
	if (invalid) return { ok: false, issue: invalid };
	const episode = input.observation.lifecycle.episode;
	if (episode.status !== "open")
		return failure(
			"wrap-request.state",
			"Wrap request requires an open Episode.",
		);
	const digest = requestDigest(input);
	const sourceReadIds = input.observation.sourceReads
		.map((read) => read.readId)
		.toSorted((left, right) => left.localeCompare(right));
	const pending = input.requestSession.pendingRequest;
	if (pending) {
		if (
			pending.requestDigest !== digest ||
			pending.episodeId !== episode.core.episodeId ||
			pending.notebookId !== episode.core.notebookId ||
			pending.root !== input.notebook.root ||
			pending.episodeLanguage !== episode.core.lang ||
			pending.memoRevisionId !== input.memo.state.revisionId ||
			JSON.stringify(pending.sourceReadIds) !== JSON.stringify(sourceReadIds)
		) {
			return failure(
				"wrap-request.stale",
				"Pending Wrap request no longer matches current state.",
				pending.requestId,
			);
		}
		return { ok: true, value: { kind: "resume", request: pending } };
	}
	const decoded = decodeWrapRequestEvent({
		protocol: OBSERVER_WRAP_REQUEST_PROTOCOL,
		kind: "wrap-requested",
		request_id: input.requestId,
		proposal_id: input.proposalId,
		request_digest: digest,
		episode_id: episode.core.episodeId,
		notebook_id: episode.core.notebookId,
		root: input.notebook.root,
		episode_language: episode.core.lang,
		memo_revision_id: input.memo.state.revisionId,
		source_read_ids: sourceReadIds,
	});
	return decoded.ok
		? { ok: true, value: { kind: "new", request: decoded.value } }
		: decoded;
}

export function hydrateWrapPreparationContext(input: {
	readonly request: WrapRequestEvent;
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly requestSession: WrapRequestSession;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly notebook: NotebookHandle;
}): WrapPreparationContextResult {
	const invalid = currentFailure(input);
	if (invalid) return { ok: false, issue: invalid };
	if (
		input.requestSession.pendingRequest?.requestId !== input.request.requestId
	)
		return failure(
			"wrap-request.state",
			"Wrap context requires the exact pending request.",
			input.request.requestId,
		);
	const planned = planWrapRequest({
		...input,
		requestId: input.request.requestId,
		proposalId: input.request.proposalId,
	});
	if (!planned.ok) return planned;
	if (planned.value.request.requestDigest !== input.request.requestDigest)
		return failure(
			"wrap-request.stale",
			"Wrap request digest is stale.",
			input.request.requestId,
		);
	return {
		ok: true,
		value: {
			request: input.request,
			lockedTarget: {
				proposal_id: input.request.proposalId,
				notebook_id: input.request.notebookId,
				root: input.request.root,
				episode_language: input.request.episodeLanguage,
			},
			observedSources: sourceProjection(input.observation),
			working: input.memo.state,
			inventory: inventoryProjection(input.inventory),
		},
	};
}

export function buildWrapPreparationGuide(
	context: WrapPreparationContext,
): WrapPreparationGuide {
	return {
		protocol: OBSERVER_WRAP_PREPARATION_PROTOCOL,
		request: {
			request_id: context.request.requestId,
			request_digest: context.request.requestDigest,
			memo_revision_id: context.request.memoRevisionId,
		},
		locked_target: context.lockedTarget,
		observed_sources: context.observedSources,
		working: context.working,
		inventory: context.inventory,
		markdown_profile: "observer-record/v1",
	};
}
