import { isSha256 } from "./content-hash.ts";
import {
	applyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	OBSERVER_PROTOCOL,
	type MemoReconciledEvent,
	type ObserverState,
} from "./lifecycle.ts";
import {
	decodeEvidenceId,
	decodeInquiryId,
	decodeMemoId,
	decodePreparedMemoPass,
	decodeSourceId,
	encodePreparedMemoPass,
	type PreparedMemoPass,
} from "./memo-profile.ts";
import {
	initialMemoWorkingState,
	memoScopeBasisMatches,
	reconcileMemoPass,
	type MemoPassReceipt,
	type MemoReceiptChanges,
	type MemoReceiptScope,
	type MemoScopeRecordBasis,
	type MemoScopeSnapshot,
	type MemoWorkingState,
	type WorkingHypothesis,
	type WorkingMemo,
} from "./memo-reconciliation.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "./pi-session.ts";

export const OBSERVER_PREPARED_MEMO_ENTRY = "observer.prepared-memo-pass";
export const OBSERVER_APPLIED_MEMO_ENTRY = "observer.memo-pass";
export const OBSERVER_APPLIED_MEMO_PROTOCOL: "observer.memo-pass/v1" =
	"observer.memo-pass/v1";
export const OBSERVER_MEMO_SCOPE_PROTOCOL: "observer.memo-scope/v1" =
	"observer.memo-scope/v1";

const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_TEXT = 20_000;
const MAX_ITEMS = 1_000;

export type MemoSessionIssueCode =
	| "memo-session.applied"
	| "memo-session.conflict"
	| "memo-session.lifecycle"
	| "memo-session.malformed"
	| "memo-session.order"
	| "memo-session.prepared";

export interface MemoSessionIssue {
	readonly index: number;
	readonly code: MemoSessionIssueCode;
	readonly message: string;
}

export interface PendingMemoAcknowledgment {
	readonly revisionId: string;
	readonly receipt: MemoPassReceipt;
}

export interface MemoSessionSnapshot {
	readonly state: MemoWorkingState;
	readonly lifecycle: ObserverState;
	readonly prepared: PreparedMemoPass | null;
	readonly pendingAcknowledgment: PendingMemoAcknowledgment | null;
	readonly issues: readonly MemoSessionIssue[];
}

export interface AppliedMemoPass {
	readonly pass: PreparedMemoPass;
	readonly scope: MemoScopeSnapshot;
	readonly state: MemoWorkingState;
	readonly receipt: MemoPassReceipt;
}

export type AppliedMemoPassDecodeResult =
	| { readonly ok: true; readonly value: AppliedMemoPass }
	| { readonly ok: false; readonly message: string };

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
	value: Readonly<Record<string, unknown>>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function boundedText(value: unknown, maximum = MAX_TEXT): string | null {
	if (
		typeof value !== "string" ||
		value !== value.trim() ||
		value.length === 0 ||
		value.length > maximum
	) {
		return null;
	}
	return value;
}

function typedUuid<Prefix extends string>(
	value: unknown,
	prefix: Prefix,
): `${Prefix}${string}` | null {
	if (typeof value !== "string" || !value.startsWith(prefix)) return null;
	const suffix = value.slice(prefix.length);
	return UUID_V4.test(suffix) ? `${prefix}${suffix}` : null;
}

function revisionId(value: unknown): string | null {
	return typedUuid(value, "memo-working-revision-");
}

function receiptId(value: unknown): `memo-receipt-${string}` | null {
	return typedUuid(value, "memo-receipt-");
}

function decodeIdArray<Id extends string>(
	value: unknown,
	decoder: (candidate: unknown) => Id | null,
): readonly Id[] | null {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
	const decoded: Id[] = [];
	for (const candidate of value) {
		const id = decoder(candidate);
		if (!id || decoded.includes(id)) return null;
		decoded.push(id);
	}
	return decoded.toSorted((left, right) => left.localeCompare(right));
}

function decodeStringArray(value: unknown): readonly string[] | null {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
	const decoded: string[] = [];
	for (const candidate of value) {
		const item = boundedText(candidate, 300);
		if (!item || decoded.includes(item)) return null;
		decoded.push(item);
	}
	return decoded.toSorted((left, right) => left.localeCompare(right));
}

function decodeRecordId(value: unknown): string | null {
	return (
		decodeMemoId(value) ??
		decodeInquiryId(value) ??
		decodeSourceId(value) ??
		typedUuid(value, "zettel-")
	);
}

function decodeDurableBase(value: unknown): WorkingMemo["durableBase"] | undefined {
	if (value === null) return null;
	if (!isObject(value) || !hasExactKeys(value, ["path", "sha256"])) return undefined;
	const path = boundedText(value.path);
	if (!path || !isSha256(value.sha256)) return undefined;
	return { path, sha256: value.sha256 };
}

function decodeWorkingMemo(value: unknown): WorkingMemo | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"memo_id",
			"episode_id",
			"title",
			"lang",
			"content",
			"inquiry_ids",
			"hypothesis_id",
			"evidence_ids",
			"current_revision_id",
			"disposition",
			"superseded_by",
			"durable_base",
		])
	) {
		return null;
	}
	const id = decodeMemoId(value.memo_id);
	const episodeId = boundedText(value.episode_id, 300);
	const title = boundedText(value.title, 4_000);
	const lang = boundedText(value.lang, 100);
	const content = boundedText(value.content);
	const inquiryIds = decodeIdArray(value.inquiry_ids, decodeInquiryId);
	const hypothesisId =
		value.hypothesis_id === null ? null : decodeInquiryId(value.hypothesis_id);
	const evidenceIds = decodeIdArray(value.evidence_ids, decodeEvidenceId);
	const currentRevisionId = boundedText(value.current_revision_id, 300);
	const supersededBy =
		value.superseded_by === null ? null : decodeMemoId(value.superseded_by);
	const durableBase = decodeDurableBase(value.durable_base);
	if (
		!id ||
		!episodeId ||
		!title ||
		!lang ||
		!content ||
		!inquiryIds ||
		(value.hypothesis_id !== null && !hypothesisId) ||
		!evidenceIds ||
		!currentRevisionId ||
		(value.disposition !== "incubating" &&
			value.disposition !== "promotion-candidate" &&
			value.disposition !== "superseded") ||
		(value.superseded_by !== null && !supersededBy) ||
		durableBase === undefined ||
		(value.disposition === "superseded") !== (supersededBy !== null)
	) {
		return null;
	}
	return {
		memoId: id,
		episodeId,
		title,
		lang,
		content,
		inquiryIds,
		hypothesisId,
		evidenceIds,
		currentRevisionId,
		disposition: value.disposition,
		supersededBy,
		durableBase,
	};
}

function decodeWorkingHypothesis(value: unknown): WorkingHypothesis | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"inquiry_id",
			"episode_id",
			"origin",
			"original",
			"current",
			"revision_reason",
			"evidence_ids",
		])
	) {
		return null;
	}
	const inquiryId = decodeInquiryId(value.inquiry_id);
	const episodeId = boundedText(value.episode_id, 300);
	const original = boundedText(value.original);
	const current = boundedText(value.current);
	const revisionReason =
		value.revision_reason === null ? null : boundedText(value.revision_reason, 4_000);
	const evidenceIds = decodeIdArray(value.evidence_ids, decodeEvidenceId);
	if (
		!inquiryId ||
		!episodeId ||
		(value.origin !== "user" && value.origin !== "observer") ||
		!original ||
		!current ||
		(value.revision_reason !== null && !revisionReason) ||
		!evidenceIds ||
		(current !== original && revisionReason === null)
	) {
		return null;
	}
	return {
		inquiryId,
		episodeId,
		origin: value.origin,
		original,
		current,
		revisionReason,
		evidenceIds,
	};
}

function decodeArray<Value>(
	value: unknown,
	decoder: (candidate: unknown) => Value | null,
): readonly Value[] | null {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
	const decoded: Value[] = [];
	for (const candidate of value) {
		const item = decoder(candidate);
		if (item === null) return null;
		decoded.push(item);
	}
	return decoded;
}

function decodeBasisRecord(value: unknown): MemoScopeRecordBasis | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, ["record_id", "path", "sha256"])
	) {
		return null;
	}
	const recordId = decodeRecordId(value.record_id);
	const path = boundedText(value.path);
	if (!recordId || !path || !isSha256(value.sha256)) return null;
	return { recordId, path, sha256: value.sha256 };
}

function decodeMemoScope(value: unknown): MemoScopeSnapshot | null {
	if (
		!isObject(value) ||
		value.observer_memo_scope !== OBSERVER_MEMO_SCOPE_PROTOCOL ||
		!hasExactKeys(value, [
			"observer_memo_scope",
			"episode_id",
			"episode_language",
			"related_inquiry_ids",
			"durable_memos",
			"durable_hypotheses",
			"existing_record_ids",
			"source_ids",
			"basis_records",
			"basis_digest",
		])
	) {
		return null;
	}
	const episodeId = boundedText(value.episode_id, 300);
	const relatedInquiryIds = decodeIdArray(value.related_inquiry_ids, decodeInquiryId);
	const durableMemos = decodeArray(value.durable_memos, decodeWorkingMemo);
	const durableHypotheses = decodeArray(
		value.durable_hypotheses,
		decodeWorkingHypothesis,
	);
	const existingRecordIds = decodeStringArray(value.existing_record_ids);
	const sourceIds = decodeIdArray(value.source_ids, decodeSourceId);
	const basisRecords = decodeArray(value.basis_records, decodeBasisRecord);
	if (
		!episodeId ||
		(value.episode_language !== "ko" && value.episode_language !== "en") ||
		!relatedInquiryIds ||
		!durableMemos ||
		!durableHypotheses ||
		!existingRecordIds ||
		existingRecordIds.some((id) => !decodeRecordId(id)) ||
		!sourceIds ||
		!basisRecords ||
		!isSha256(value.basis_digest) ||
		durableMemos.some(
			(memo) =>
				memo.durableBase === null ||
				memo.disposition !== "incubating" ||
				memo.episodeId !== episodeId,
		) ||
		durableHypotheses.some((hypothesis) => hypothesis.episodeId !== episodeId)
	) {
		return null;
	}
	return {
		episodeId,
		episodeLanguage: value.episode_language,
		relatedInquiryIds,
		durableMemos,
		durableHypotheses,
		existingRecordIds,
		sourceIds,
		basisRecords,
		basisDigest: value.basis_digest,
	};
}

function encodeWorkingMemo(memo: WorkingMemo): unknown {
	return {
		memo_id: memo.memoId,
		episode_id: memo.episodeId,
		title: memo.title,
		lang: memo.lang,
		content: memo.content,
		inquiry_ids: memo.inquiryIds,
		hypothesis_id: memo.hypothesisId,
		evidence_ids: memo.evidenceIds,
		current_revision_id: memo.currentRevisionId,
		disposition: memo.disposition,
		superseded_by: memo.supersededBy,
		durable_base: memo.durableBase
			? { path: memo.durableBase.path, sha256: memo.durableBase.sha256 }
			: null,
	};
}

function encodeWorkingHypothesis(hypothesis: WorkingHypothesis): unknown {
	return {
		inquiry_id: hypothesis.inquiryId,
		episode_id: hypothesis.episodeId,
		origin: hypothesis.origin,
		original: hypothesis.original,
		current: hypothesis.current,
		revision_reason: hypothesis.revisionReason,
		evidence_ids: hypothesis.evidenceIds,
	};
}

function encodeMemoScope(scope: MemoScopeSnapshot): unknown {
	return {
		observer_memo_scope: OBSERVER_MEMO_SCOPE_PROTOCOL,
		episode_id: scope.episodeId,
		episode_language: scope.episodeLanguage,
		related_inquiry_ids: scope.relatedInquiryIds,
		durable_memos: scope.durableMemos.map(encodeWorkingMemo),
		durable_hypotheses: scope.durableHypotheses.map(encodeWorkingHypothesis),
		existing_record_ids: scope.existingRecordIds,
		source_ids: scope.sourceIds,
		basis_records: scope.basisRecords.map((record) => ({
			record_id: record.recordId,
			path: record.path,
			sha256: record.sha256,
		})),
		basis_digest: scope.basisDigest,
	};
}

function nonnegativeInteger(value: unknown): number | null {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
		? value
		: null;
}

function decodeReceiptScope(value: unknown): MemoReceiptScope | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, ["episode_memos", "standing_inquiries", "durable_memos"])
	) {
		return null;
	}
	const episodeMemos = nonnegativeInteger(value.episode_memos);
	const standingInquiries = nonnegativeInteger(value.standing_inquiries);
	const durableMemos = nonnegativeInteger(value.durable_memos);
	return episodeMemos === null || standingInquiries === null || durableMemos === null
		? null
		: { episodeMemos, standingInquiries, durableMemos };
}

function decodeReceiptChanges(value: unknown): MemoReceiptChanges | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"created",
			"revised",
			"merged",
			"kept_incubating",
			"promotion_candidates",
			"hypothesis_revisions",
		])
	) {
		return null;
	}
	const created = nonnegativeInteger(value.created);
	const revised = nonnegativeInteger(value.revised);
	const merged = nonnegativeInteger(value.merged);
	const keptIncubating = nonnegativeInteger(value.kept_incubating);
	const promotionCandidates = nonnegativeInteger(value.promotion_candidates);
	const hypothesisRevisions = nonnegativeInteger(value.hypothesis_revisions);
	if (
		created === null ||
		revised === null ||
		merged === null ||
		keptIncubating === null ||
		promotionCandidates === null ||
		hypothesisRevisions === null
	) {
		return null;
	}
	return {
		created,
		revised,
		merged,
		keptIncubating,
		promotionCandidates,
		hypothesisRevisions,
	};
}

function decodeReceipt(value: unknown): MemoPassReceipt | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"receipt_id",
			"pass_id",
			"revision_id",
			"scope",
			"changes",
			"summary",
		])
	) {
		return null;
	}
	const decodedReceiptId = receiptId(value.receipt_id);
	const passId = typedUuid(value.pass_id, "memo-pass-");
	const decodedRevisionId = revisionId(value.revision_id);
	const scope = decodeReceiptScope(value.scope);
	const changes = decodeReceiptChanges(value.changes);
	const summary = boundedText(value.summary, 4_000);
	if (!decodedReceiptId || !passId || !decodedRevisionId || !scope || !changes || !summary) {
		return null;
	}
	return {
		receiptId: decodedReceiptId,
		passId,
		revisionId: decodedRevisionId,
		scope,
		changes,
		summary,
	};
}

function encodeReceipt(receipt: MemoPassReceipt): unknown {
	return {
		receipt_id: receipt.receiptId,
		pass_id: receipt.passId,
		revision_id: receipt.revisionId,
		scope: {
			episode_memos: receipt.scope.episodeMemos,
			standing_inquiries: receipt.scope.standingInquiries,
			durable_memos: receipt.scope.durableMemos,
		},
		changes: {
			created: receipt.changes.created,
			revised: receipt.changes.revised,
			merged: receipt.changes.merged,
			kept_incubating: receipt.changes.keptIncubating,
			promotion_candidates: receipt.changes.promotionCandidates,
			hypothesis_revisions: receipt.changes.hypothesisRevisions,
		},
		summary: receipt.summary,
	};
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function encodePreparedMemoEntry(pass: PreparedMemoPass): unknown {
	return encodePreparedMemoPass(pass);
}

export function encodeAppliedMemoPass(input: {
	readonly pass: PreparedMemoPass;
	readonly scope: MemoScopeSnapshot;
	readonly receipt: MemoPassReceipt;
}): unknown {
	return {
		observer_memo_event: OBSERVER_APPLIED_MEMO_PROTOCOL,
		kind: "applied",
		pass: encodePreparedMemoPass(input.pass),
		scope: encodeMemoScope(input.scope),
		next_revision_id: input.receipt.revisionId,
		receipt: encodeReceipt(input.receipt),
	};
}

export function decodeAppliedMemoPass(
	value: unknown,
	state: MemoWorkingState,
): AppliedMemoPassDecodeResult {
	if (
		!isObject(value) ||
		value.observer_memo_event !== OBSERVER_APPLIED_MEMO_PROTOCOL ||
		value.kind !== "applied" ||
		!hasExactKeys(value, [
			"observer_memo_event",
			"kind",
			"pass",
			"scope",
			"next_revision_id",
			"receipt",
		])
	) {
		return { ok: false, message: "Applied Memo entry has an invalid shape." };
	}
	const pass = decodePreparedMemoPass(value.pass);
	const scope = decodeMemoScope(value.scope);
	const nextRevisionId = revisionId(value.next_revision_id);
	const receipt = decodeReceipt(value.receipt);
	if (!pass.ok || !scope || !nextRevisionId || !receipt) {
		return { ok: false, message: "Applied Memo entry has invalid values." };
	}
	if (!memoScopeBasisMatches(state, scope)) {
		return { ok: false, message: "Applied Memo scope basis is invalid." };
	}
	const reconciled = reconcileMemoPass({
		state,
		scope,
		pass: pass.value,
		ids: {
			revisionId() {
				return nextRevisionId;
			},
			receiptId() {
				return receipt.receiptId;
			},
		},
	});
	if (!reconciled.ok) {
		return { ok: false, message: `Applied Memo entry cannot replay: ${reconciled.issue.code}.` };
	}
	if (
		nextRevisionId !== receipt.revisionId ||
		pass.value.passId !== receipt.passId ||
		!sameJson(reconciled.value.receipt, receipt)
	) {
		return { ok: false, message: "Applied Memo receipt does not match replayed state." };
	}
	return {
		ok: true,
		value: {
			pass: pass.value,
			scope,
			state: reconciled.value.state,
			receipt,
		},
	};
}

function canonicalValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalValue);
	if (!isObject(value)) return value;
	return Object.fromEntries(
		Object.keys(value)
			.toSorted((left, right) => left.localeCompare(right))
			.map((key) => [key, canonicalValue(value[key])]),
	);
}

function signature(value: unknown): string {
	return JSON.stringify(canonicalValue(value));
}

function issue(
	issues: MemoSessionIssue[],
	index: number,
	code: MemoSessionIssueCode,
	message: string,
): void {
	issues.push({ index, code, message });
}

function matchingPrepared(left: PreparedMemoPass, right: PreparedMemoPass): boolean {
	return left.passId === right.passId && left.digest === right.digest;
}

function memoAcknowledgment(receipt: MemoPassReceipt): MemoReconciledEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "memo-reconciled",
		revisionId: receipt.revisionId,
		receipt: { receiptId: receipt.receiptId, summary: receipt.summary },
	};
}

export function memoAcknowledgmentEvent(
	pending: PendingMemoAcknowledgment,
): MemoReconciledEvent {
	return memoAcknowledgment(pending.receipt);
}

function acknowledgmentMatches(
	event: MemoReconciledEvent,
	pending: PendingMemoAcknowledgment,
): boolean {
	return (
		event.revisionId === pending.revisionId &&
		event.receipt.receiptId === pending.receipt.receiptId &&
		event.receipt.summary === pending.receipt.summary
	);
}

export function reconstructMemoSession(
	entries: readonly PiBranchEntryLike[],
): MemoSessionSnapshot {
	let state = initialMemoWorkingState();
	let lifecycle = initialObserverState();
	let prepared: PreparedMemoPass | null = null;
	let pendingAcknowledgment: PendingMemoAcknowledgment | null = null;
	const issues: MemoSessionIssue[] = [];
	const appliedSignatures = new Map<string, string>();
	for (const [index, entry] of entries.entries()) {
		if (entry.type !== "custom") continue;
		if (entry.customType === OBSERVER_LIFECYCLE_ENTRY) {
			const decoded = normalizeObserverEvent(entry.data);
			if (!decoded.ok) {
				issue(issues, index, "memo-session.lifecycle", "Lifecycle entry is malformed.");
				continue;
			}
			if (decoded.event.kind === "memo-reconciled") {
				if (
					!pendingAcknowledgment ||
					!acknowledgmentMatches(decoded.event, pendingAcknowledgment)
				) {
					issue(
						issues,
						index,
						"memo-session.order",
						"Memo acknowledgment has no matching applied pass.",
					);
					continue;
				}
			}
			const applied = applyObserverEvent(lifecycle, decoded.event);
			if (!applied.applied) {
				issue(
					issues,
					index,
					"memo-session.lifecycle",
					`Lifecycle entry was rejected: ${applied.reason}.`,
				);
				continue;
			}
			lifecycle = applied.state;
			if (decoded.event.kind === "memo-reconciled") pendingAcknowledgment = null;
			continue;
		}
		if (entry.customType === OBSERVER_PREPARED_MEMO_ENTRY) {
			const decoded = decodePreparedMemoPass(entry.data);
			if (!decoded.ok) {
				issue(issues, index, "memo-session.malformed", "Prepared Memo entry is malformed.");
				continue;
			}
			if (
				state.lastPassId === decoded.value.passId &&
				state.lastPassDigest === decoded.value.digest
			) {
				continue;
			}
			if (
				pendingAcknowledgment ||
				lifecycle.episode.status !== "open" ||
				decoded.value.episodeId !== lifecycle.episode.core.episodeId ||
				decoded.value.baseRevisionId !== state.revisionId
			) {
				issue(
					issues,
					index,
					"memo-session.order",
					"Prepared Memo entry is not valid in the current history position.",
				);
				continue;
			}
			if (prepared) {
				if (!matchingPrepared(prepared, decoded.value)) {
					issue(issues, index, "memo-session.conflict", "Prepared Memo entries conflict.");
				}
				continue;
			}
			prepared = decoded.value;
			continue;
		}
		if (entry.customType === OBSERVER_APPLIED_MEMO_ENTRY) {
			const currentSignature = signature(entry.data);
			let passIdentity: PreparedMemoPass | null = null;
			if (isObject(entry.data)) {
				const pass = decodePreparedMemoPass(entry.data.pass);
				if (pass.ok) passIdentity = pass.value;
			}
			if (!passIdentity) {
				issue(issues, index, "memo-session.malformed", "Applied Memo entry is malformed.");
				continue;
			}
			const priorSignature = appliedSignatures.get(passIdentity.passId);
			if (priorSignature) {
				if (priorSignature !== currentSignature) {
					issue(issues, index, "memo-session.conflict", "Applied Memo entries conflict.");
				}
				continue;
			}
			if (!prepared || !matchingPrepared(prepared, passIdentity)) {
				issue(
					issues,
					index,
					"memo-session.order",
					"Applied Memo entry has no matching prepared pass.",
				);
				continue;
			}
			const decoded = decodeAppliedMemoPass(entry.data, state);
			if (!decoded.ok) {
				issue(issues, index, "memo-session.applied", decoded.message);
				continue;
			}
			state = decoded.value.state;
			prepared = null;
			pendingAcknowledgment = {
				revisionId: decoded.value.receipt.revisionId,
				receipt: decoded.value.receipt,
			};
			appliedSignatures.set(passIdentity.passId, currentSignature);
		}
	}
	return { state, lifecycle, prepared, pendingAcknowledgment, issues };
}
