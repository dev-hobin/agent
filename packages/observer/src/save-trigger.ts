import { isAbsolute } from "node:path";

import { sha256Text, isSha256 } from "./content-hash.ts";
import { normalizeObserverEvent } from "./lifecycle.ts";
import type { MemoWorkingState } from "./memo-reconciliation.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import type { NotebookHandle, NotebookInventoryEntry } from "./notebook.ts";
import type { ObservationSessionSnapshot } from "./observation-session.ts";
import {
	decodePreparedSaveHandoff,
	OBSERVER_PREPARED_SAVE_PROTOCOL,
	type PiBranchEntryLike,
	type PreparedSaveHandoff,
} from "./pi-session.ts";
import { OBSERVER_SAVE_SCHEMA } from "./save-profile.ts";

export const OBSERVER_SAVE_REQUEST_ENTRY = "observer.save-request";
export const OBSERVER_SAVE_REQUEST_PROTOCOL = "observer.save-request/v1";
export const OBSERVER_SAVE_PREPARATION_PROTOCOL =
	"observer.save-preparation/v1";

export type SaveRequestId = `save-request-${string}`;
export type SaveProposalId = `proposal-${string}`;

export interface SaveRequestEvent {
	readonly protocol: typeof OBSERVER_SAVE_REQUEST_PROTOCOL;
	readonly kind: "save-requested";
	readonly requestId: SaveRequestId;
	readonly proposalId: SaveProposalId;
	readonly requestDigest: string;
	readonly episodeId: string;
	readonly notebookId: string;
	readonly root: string;
	readonly episodeLanguage: "ko" | "en";
	readonly memoRevisionId: string | null;
	readonly sourceReadIds: readonly string[];
}

export interface SaveRequestIssue {
	readonly code:
		| "save-request.shape"
		| "save-request.history"
		| "save-request.conflict"
		| "save-request.state"
		| "save-request.pending"
		| "save-request.stale"
		| "save-request.submission";
	readonly message: string;
	readonly relatedId?: string;
}

export interface SaveRequestSession {
	readonly requests: readonly SaveRequestEvent[];
	readonly consumedRequestIds: readonly SaveRequestId[];
	readonly pendingRequest: SaveRequestEvent | null;
	readonly issues: readonly SaveRequestIssue[];
}

export type SaveRequestPlan =
	| { readonly kind: "new"; readonly request: SaveRequestEvent }
	| { readonly kind: "resume"; readonly request: SaveRequestEvent };

export type SaveRequestPlanResult =
	| { readonly ok: true; readonly value: SaveRequestPlan }
	| { readonly ok: false; readonly issue: SaveRequestIssue };

export interface SaveSourceProjection {
	readonly read_id: string;
	readonly digest: string;
	readonly source: unknown;
	readonly faithful_summary: string;
	readonly claims: readonly unknown[];
}

export interface SaveInventoryProjection {
	readonly record_id: string;
	readonly path: string;
	readonly sha256: string;
	readonly markdown: string;
}

export interface SaveRequiredRecord {
	readonly record_id: string;
	readonly observer_type: "source" | "inquiry" | "memo";
	readonly operation: "create" | "update";
	readonly expected_sha256: string | null;
}

export interface SavePreparationContext {
	readonly request: SaveRequestEvent;
	readonly lockedTarget: {
		readonly proposal_id: SaveProposalId;
		readonly notebook_id: string;
		readonly root: string;
		readonly episode_language: "ko" | "en";
	};
	readonly observedSources: readonly SaveSourceProjection[];
	readonly working: MemoWorkingState;
	readonly inventory: readonly SaveInventoryProjection[];
	readonly requiredRecords: readonly SaveRequiredRecord[];
}

export interface SavePreparationGuide {
	readonly protocol: typeof OBSERVER_SAVE_PREPARATION_PROTOCOL;
	readonly request: {
		readonly request_id: SaveRequestId;
		readonly request_digest: string;
		readonly memo_revision_id: string | null;
	};
	readonly locked_target: SavePreparationContext["lockedTarget"];
	readonly observed_sources: readonly SaveSourceProjection[];
	readonly working: MemoWorkingState;
	readonly inventory: readonly SaveInventoryProjection[];
	readonly required_records: readonly SaveRequiredRecord[];
	readonly submission_contract: {
		readonly action: "save-prepare";
		readonly submit_only: readonly ["request_id", "summary", "records"];
		readonly create_record_fields: readonly [
			"operation",
			"record_id",
			"markdown",
		];
		readonly update_record_fields: readonly [
			"operation",
			"record_id",
			"expected_sha256",
			"markdown",
		];
		readonly locked_fields: readonly [
			"proposal_id",
			"notebook_id",
			"root",
			"episode_language",
		];
	};
	readonly record_authoring_rules: readonly string[];
	readonly markdown_profile: "observer-record/v1";
}

export type SavePreparationContextResult =
	| { readonly ok: true; readonly value: SavePreparationContext }
	| { readonly ok: false; readonly issue: SaveRequestIssue };

export type PreparedSaveHandoffResult =
	| { readonly ok: true; readonly value: PreparedSaveHandoff }
	| { readonly ok: false; readonly issue: SaveRequestIssue };

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
	code: SaveRequestIssue["code"],
	message: string,
	relatedId?: string,
): { readonly ok: false; readonly issue: SaveRequestIssue } {
	return {
		ok: false,
		issue: relatedId ? { code, message, relatedId } : { code, message },
	};
}

function decodeUuidV4(value: unknown): string | null {
	return typeof value === "string" && UUID_V4.test(value) ? value : null;
}

export function decodeSaveRequestId(value: unknown): SaveRequestId | null {
	if (typeof value !== "string" || !value.startsWith("save-request-")) {
		return null;
	}
	return decodeUuidV4(value.slice("save-request-".length))
		? (value as SaveRequestId)
		: null;
}

function decodeProposalId(value: unknown): SaveProposalId | null {
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

function decodeSaveRequestValues(
	value: Readonly<Record<string, unknown>>,
): SaveRequestEvent | null {
	const requestId = decodeSaveRequestId(value.request_id);
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
		protocol: OBSERVER_SAVE_REQUEST_PROTOCOL,
		kind: "save-requested",
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

export function decodeSaveRequestEvent(
	value: unknown,
):
	| { readonly ok: true; readonly value: SaveRequestEvent }
	| { readonly ok: false; readonly issue: SaveRequestIssue } {
	if (!isObject(value))
		return failure(
			"save-request.shape",
			"Review & Save request must be an object.",
		);
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
		value.protocol !== OBSERVER_SAVE_REQUEST_PROTOCOL ||
		value.kind !== "save-requested"
	) {
		return failure(
			"save-request.shape",
			"Review & Save request has invalid fields or protocol.",
		);
	}
	const decoded = decodeSaveRequestValues(value);
	return decoded
		? { ok: true, value: decoded }
		: failure(
				"save-request.shape",
				"Review & Save request has invalid values.",
			);
}

export function encodeSaveRequestEvent(
	event: SaveRequestEvent,
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
	readonly requests: Map<SaveRequestId, SaveRequestEvent>;
	readonly signatures: Map<SaveRequestId, string>;
}): SaveRequestIssue | null {
	if (
		input.entry.type !== "custom" ||
		input.entry.customType !== OBSERVER_SAVE_REQUEST_ENTRY
	)
		return null;
	const decoded = decodeSaveRequestEvent(input.entry.data);
	if (!decoded.ok) return decoded.issue;
	const signature = JSON.stringify(encodeSaveRequestEvent(decoded.value));
	const prior = input.signatures.get(decoded.value.requestId);
	if (prior && prior !== signature)
		return {
			code: "save-request.conflict",
			message: "Review & Save request identity conflicts.",
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
	return decoded.event.kind === "save-proposed" ||
		decoded.event.kind === "save-cancelled" ||
		decoded.event.kind === "save-committed"
		? decoded.event.proposalId
		: null;
}

export function reconstructSaveRequestSession(
	entries: readonly PiBranchEntryLike[],
): SaveRequestSession {
	const requests = new Map<SaveRequestId, SaveRequestEvent>();
	const signatures = new Map<SaveRequestId, string>();
	const consumedProposalIds = new Set<string>();
	const issues: SaveRequestIssue[] = [];
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
			code: "save-request.conflict",
			message: "Only one pending Review & Save request may exist.",
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
): readonly SaveInventoryProjection[] {
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
): readonly SaveSourceProjection[] {
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

function requiredRecord(input: {
	readonly recordId: string;
	readonly observerType: SaveRequiredRecord["observer_type"];
	readonly inventory: ReadonlyMap<string, SaveInventoryProjection>;
}): SaveRequiredRecord {
	const existing = input.inventory.get(input.recordId);
	return existing
		? {
				record_id: input.recordId,
				observer_type: input.observerType,
				operation: "update",
				expected_sha256: existing.sha256,
			}
		: {
				record_id: input.recordId,
				observer_type: input.observerType,
				operation: "create",
				expected_sha256: null,
			};
}

function requiredRecords(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly working: MemoWorkingState;
	readonly inventory: readonly SaveInventoryProjection[];
}): readonly SaveRequiredRecord[] {
	const inventory = new Map(
		input.inventory.map((entry) => [entry.record_id, entry]),
	);
	const required = new Map<string, SaveRequiredRecord>();
	for (const read of input.observation.sourceReads) {
		required.set(
			read.source.sourceId,
			requiredRecord({
				recordId: read.source.sourceId,
				observerType: "source",
				inventory,
			}),
		);
	}
	for (const hypothesis of input.working.hypotheses) {
		required.set(
			hypothesis.inquiryId,
			requiredRecord({
				recordId: hypothesis.inquiryId,
				observerType: "inquiry",
				inventory,
			}),
		);
	}
	for (const memo of input.working.memos) {
		required.set(
			memo.memoId,
			requiredRecord({
				recordId: memo.memoId,
				observerType: "memo",
				inventory,
			}),
		);
	}
	return [...required.values()].toSorted((left, right) =>
		left.record_id.localeCompare(right.record_id),
	);
}

function requestDigest(
	input: {
		readonly observation: ObservationSessionSnapshot;
		readonly memo: MemoSessionSnapshot;
		readonly inventory: readonly NotebookInventoryEntry[];
		readonly notebook: NotebookHandle;
	},
	lockedLanguage?: "ko" | "en",
): string {
	const episode = input.observation.lifecycle.episode;
	return sha256Text(
		JSON.stringify({
			episode:
				episode.status === "empty"
					? null
					: {
							episode_id: episode.core.episodeId,
							notebook_id: episode.core.notebookId,
							episode_language: lockedLanguage ?? episode.core.lang,
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
	readonly requestSession: SaveRequestSession;
}): SaveRequestIssue | null {
	if (input.observation.issues.length > 0 || input.memo.issues.length > 0)
		return {
			code: "save-request.history",
			message:
				"Review & Save request requires clean Observation and Memo replay.",
		};
	if (input.requestSession.issues.length > 0)
		return input.requestSession.issues[0] ?? null;
	if (input.observation.lifecycle.episode.status !== "open")
		return {
			code: "save-request.state",
			message: "Review & Save request requires an open Episode.",
		};
	if (
		input.observation.pendingMemoRequest ||
		input.observation.unconsumedObservationIds.length > 0 ||
		input.memo.prepared ||
		input.memo.pendingAcknowledgment
	)
		return {
			code: "save-request.pending",
			message: "Review & Save request requires completed Memo reconciliation.",
		};
	return null;
}

export function planSaveRequest(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly requestSession: SaveRequestSession;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly notebook: NotebookHandle;
	readonly requestId: SaveRequestId;
	readonly proposalId: SaveProposalId;
}): SaveRequestPlanResult {
	const invalid = currentFailure(input);
	if (invalid) return { ok: false, issue: invalid };
	const episode = input.observation.lifecycle.episode;
	if (episode.status !== "open")
		return failure(
			"save-request.state",
			"Review & Save request requires an open Episode.",
		);
	const pending = input.requestSession.pendingRequest;
	const digest = requestDigest(input, pending?.episodeLanguage);
	const sourceReadIds = input.observation.sourceReads
		.map((read) => read.readId)
		.toSorted((left, right) => left.localeCompare(right));
	if (pending) {
		if (
			pending.requestDigest !== digest ||
			pending.episodeId !== episode.core.episodeId ||
			pending.notebookId !== episode.core.notebookId ||
			pending.root !== input.notebook.root ||
			pending.memoRevisionId !== input.memo.state.revisionId ||
			JSON.stringify(pending.sourceReadIds) !== JSON.stringify(sourceReadIds)
		) {
			return failure(
				"save-request.stale",
				"Pending Review & Save request no longer matches current state.",
				pending.requestId,
			);
		}
		return { ok: true, value: { kind: "resume", request: pending } };
	}
	const decoded = decodeSaveRequestEvent({
		protocol: OBSERVER_SAVE_REQUEST_PROTOCOL,
		kind: "save-requested",
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

export function hydrateSavePreparationContext(input: {
	readonly request: SaveRequestEvent;
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly requestSession: SaveRequestSession;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly notebook: NotebookHandle;
}): SavePreparationContextResult {
	const invalid = currentFailure(input);
	if (invalid) return { ok: false, issue: invalid };
	if (
		input.requestSession.pendingRequest?.requestId !== input.request.requestId
	)
		return failure(
			"save-request.state",
			"Review & Save context requires the exact pending request.",
			input.request.requestId,
		);
	const planned = planSaveRequest({
		...input,
		requestId: input.request.requestId,
		proposalId: input.request.proposalId,
	});
	if (!planned.ok) return planned;
	if (planned.value.request.requestDigest !== input.request.requestDigest)
		return failure(
			"save-request.stale",
			"Review & Save request digest is stale.",
			input.request.requestId,
		);
	const inventory = inventoryProjection(input.inventory);
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
			inventory,
			requiredRecords: requiredRecords({
				observation: input.observation,
				working: input.memo.state,
				inventory,
			}),
		},
	};
}

export function buildSavePreparationGuide(
	context: SavePreparationContext,
): SavePreparationGuide {
	return {
		protocol: OBSERVER_SAVE_PREPARATION_PROTOCOL,
		request: {
			request_id: context.request.requestId,
			request_digest: context.request.requestDigest,
			memo_revision_id: context.request.memoRevisionId,
		},
		locked_target: context.lockedTarget,
		required_records: context.requiredRecords,
		submission_contract: {
			action: "save-prepare",
			submit_only: ["request_id", "summary", "records"],
			create_record_fields: ["operation", "record_id", "markdown"],
			update_record_fields: [
				"operation",
				"record_id",
				"expected_sha256",
				"markdown",
			],
			locked_fields: ["proposal_id", "notebook_id", "root", "episode_language"],
		},
		record_authoring_rules: [
			"Submit each record as one complete Observer Markdown document, not a patch or excerpt.",
			"Frontmatter id and observer_type must match required_records; use inventory Markdown as the update base and preserve created.",
			"Set modified to an RFC 3339 timestamp that is not earlier than created; quote YAML strings when punctuation could change YAML meaning.",
			"If inquiry.current differs from inquiry.original, include a non-empty inquiry.revision_reason in the inquiry mapping.",
			"An incubating Memo remains observer_status=incubating and retains its derived_from Inquiry lineage unless the proposal explicitly changes disposition consistently.",
			"Every Zettel must contain at least one direct one-hop sources entry whose target is a Source record.",
		],
		observed_sources: context.observedSources,
		working: context.working,
		inventory: context.inventory,
		markdown_profile: "observer-record/v1",
	};
}

export function prepareSaveHandoff(input: {
	readonly context: SavePreparationContext;
	readonly summary: unknown;
	readonly records: unknown;
}): PreparedSaveHandoffResult {
	const decoded = decodePreparedSaveHandoff({
		protocol: OBSERVER_PREPARED_SAVE_PROTOCOL,
		summary: input.summary,
		prepared: {
			observer_save: OBSERVER_SAVE_SCHEMA,
			proposal_id: input.context.lockedTarget.proposal_id,
			notebook_id: input.context.lockedTarget.notebook_id,
			root: input.context.lockedTarget.root,
			episode_language: input.context.lockedTarget.episode_language,
			records: input.records,
		},
	});
	if (!decoded.ok)
		return failure(
			"save-request.submission",
			`Review & Save submission is invalid: ${decoded.issue.message}`,
		);
	const records = new Map<
		string,
		PreparedSaveHandoff["prepared"]["records"][number]
	>();
	for (const record of decoded.value.prepared.records) {
		if (records.has(record.record_id))
			return failure(
				"save-request.submission",
				`Review & Save submission repeats record ${record.record_id}.`,
				record.record_id,
			);
		records.set(record.record_id, record);
	}
	for (const required of input.context.requiredRecords) {
		const record = records.get(required.record_id);
		if (!record)
			return failure(
				"save-request.submission",
				`Review & Save submission is missing required ${required.observer_type} record ${required.record_id}.`,
				required.record_id,
			);
		if (record.operation !== required.operation)
			return failure(
				"save-request.submission",
				`Review & Save submission operation does not match required record ${required.record_id}.`,
				required.record_id,
			);
		if (
			record.operation === "update" &&
			required.expected_sha256 !== record.expected_sha256
		)
			return failure(
				"save-request.submission",
				`Review & Save submission expected digest does not match required record ${required.record_id}.`,
				required.record_id,
			);
	}
	return { ok: true, value: decoded.value };
}
