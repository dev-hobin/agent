import { sha256Text } from "./content-hash.ts";
import type {
	MemoWorkingState,
	WorkingHypothesis,
	WorkingMemo,
} from "./memo-reconciliation.ts";
import { decodeInquiryId, type InquiryId } from "./memo-profile.ts";
import type { NotebookInventoryEntry } from "./notebook.ts";
import type {
	ObservationSessionSnapshot,
	PendingObservationHypothesis,
} from "./observation-session.ts";

const STANDING_INDEX_MARKER = Symbol("observer.standing-index");
const STANDING_CONTEXT_MARKER = Symbol("observer.standing-context");

export type StandingInquiryStatus = "open" | "dormant" | "working";
export type StandingInquirySource = "durable" | "memo" | "pending";

export interface CompactStandingInquiry {
	readonly inquiryId: InquiryId;
	readonly title: string;
	readonly origin: "user" | "observer";
	readonly current: string;
	readonly status: StandingInquiryStatus;
	readonly source: StandingInquirySource;
	readonly relatedMemoIds: readonly string[];
}

export interface StandingIndex {
	readonly [STANDING_INDEX_MARKER]: true;
	readonly digest: string;
	readonly inquiries: readonly CompactStandingInquiry[];
}

export interface StandingInquiryContext {
	readonly inquiryId: InquiryId;
	readonly title: string;
	readonly lang: string;
	readonly status: StandingInquiryStatus;
	readonly source: StandingInquirySource;
	readonly origin: "user" | "observer";
	readonly original: string;
	readonly current: string;
	readonly revisionReason: string | null;
	readonly body: string;
}

export interface StandingMemoContext {
	readonly memoId: string;
	readonly title: string;
	readonly lang: string;
	readonly content: string;
	readonly status: "incubating" | "promotion-candidate";
	readonly source: "durable" | "working";
	readonly inquiryIds: readonly InquiryId[];
}

export interface StandingContext {
	readonly [STANDING_CONTEXT_MARKER]: true;
	readonly indexDigest: string;
	readonly digest: string;
	readonly inquiries: readonly StandingInquiryContext[];
	readonly memos: readonly StandingMemoContext[];
}

export type StandingIndexIssueCode =
	| "standing-index.empty"
	| "standing-index.invalid"
	| "standing-index.missing";

export interface StandingIndexIssue {
	readonly code: StandingIndexIssueCode;
	readonly message: string;
	readonly relatedId?: string;
}

export type StandingContextResult =
	| { readonly ok: true; readonly value: StandingContext }
	| { readonly ok: false; readonly issue: StandingIndexIssue };

function uniqueSorted<Value extends string>(
	values: readonly Value[],
): readonly Value[] {
	return [...new Set(values)].toSorted((left, right) =>
		left.localeCompare(right),
	);
}

function durableMemoInquiryIds(
	entry: NotebookInventoryEntry,
): readonly InquiryId[] {
	if (entry.document.record.observer_type !== "memo") return [];
	return uniqueSorted(
		entry.document.record.lineage.flatMap((lineage) => {
			if (lineage.type !== "derived_from") return [];
			const inquiryId = decodeInquiryId(lineage.target);
			return inquiryId ? [inquiryId] : [];
		}),
	);
}

function durableRelatedMemoIds(
	inventory: readonly NotebookInventoryEntry[],
	inquiryId: InquiryId,
): readonly string[] {
	return inventory
		.flatMap((entry) => {
			const record = entry.document.record;
			return record.observer_type === "memo" &&
				record.observer_status === "incubating" &&
				durableMemoInquiryIds(entry).includes(inquiryId)
				? [record.id]
				: [];
		})
		.toSorted((left, right) => left.localeCompare(right));
}

function workingRelatedMemoIds(
	memos: readonly WorkingMemo[],
	inquiryId: InquiryId,
): readonly string[] {
	return memos
		.flatMap((memo) =>
			memo.disposition !== "superseded" && memo.inquiryIds.includes(inquiryId)
				? [memo.memoId]
				: [],
		)
		.toSorted((left, right) => left.localeCompare(right));
}

function relatedMemoIds(input: {
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly memos: readonly WorkingMemo[];
	readonly inquiryId: InquiryId;
}): readonly string[] {
	return uniqueSorted([
		...durableRelatedMemoIds(input.inventory, input.inquiryId),
		...workingRelatedMemoIds(input.memos, input.inquiryId),
	]);
}

function compactFromWorking(
	hypothesis: WorkingHypothesis,
	source: "memo",
	input: {
		readonly inventory: readonly NotebookInventoryEntry[];
		readonly memos: readonly WorkingMemo[];
	},
): CompactStandingInquiry {
	return {
		inquiryId: hypothesis.inquiryId,
		title: hypothesis.original,
		origin: hypothesis.origin,
		current: hypothesis.current,
		status: "working",
		source,
		relatedMemoIds: relatedMemoIds({
			inventory: input.inventory,
			memos: input.memos,
			inquiryId: hypothesis.inquiryId,
		}),
	};
}

function compactFromPending(
	hypothesis: PendingObservationHypothesis,
	input: {
		readonly inventory: readonly NotebookInventoryEntry[];
		readonly memos: readonly WorkingMemo[];
	},
): CompactStandingInquiry {
	return {
		inquiryId: hypothesis.inquiryId,
		title: hypothesis.original,
		origin: hypothesis.origin,
		current: hypothesis.current,
		status: "working",
		source: "pending",
		relatedMemoIds: relatedMemoIds({
			inventory: input.inventory,
			memos: input.memos,
			inquiryId: hypothesis.inquiryId,
		}),
	};
}

function indexPayload(inquiries: readonly CompactStandingInquiry[]): unknown {
	return inquiries.map((inquiry) => ({
		inquiryId: inquiry.inquiryId,
		title: inquiry.title,
		origin: inquiry.origin,
		current: inquiry.current,
		status: inquiry.status,
		source: inquiry.source,
		relatedMemoIds: inquiry.relatedMemoIds,
	}));
}

export function buildStandingIndex(input: {
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly memo: MemoWorkingState;
	readonly observation: ObservationSessionSnapshot;
}): StandingIndex {
	const byId = new Map<InquiryId, CompactStandingInquiry>();
	for (const entry of input.inventory) {
		const record = entry.document.record;
		if (
			record.observer_type !== "inquiry" ||
			(record.observer_status !== "open" &&
				record.observer_status !== "dormant")
		) {
			continue;
		}
		byId.set(record.id, {
			inquiryId: record.id,
			title: record.title,
			origin: record.inquiry.origin,
			current: record.inquiry.current,
			status: record.observer_status,
			source: "durable",
			relatedMemoIds: relatedMemoIds({
				inventory: input.inventory,
				memos: input.memo.memos,
				inquiryId: record.id,
			}),
		});
	}
	for (const hypothesis of input.memo.hypotheses) {
		byId.set(
			hypothesis.inquiryId,
			compactFromWorking(hypothesis, "memo", {
				inventory: input.inventory,
				memos: input.memo.memos,
			}),
		);
	}
	for (const hypothesis of input.observation.pendingHypotheses) {
		byId.set(
			hypothesis.inquiryId,
			compactFromPending(hypothesis, {
				inventory: input.inventory,
				memos: input.memo.memos,
			}),
		);
	}
	const inquiries = [...byId.values()].toSorted((left, right) =>
		left.inquiryId.localeCompare(right.inquiryId),
	);
	return {
		[STANDING_INDEX_MARKER]: true,
		digest: sha256Text(JSON.stringify(indexPayload(inquiries))),
		inquiries,
	};
}

export function isStandingIndex(value: unknown): value is StandingIndex {
	return (
		typeof value === "object" &&
		value !== null &&
		Reflect.get(value, STANDING_INDEX_MARKER) === true
	);
}

function durableInquiryContext(
	entry: NotebookInventoryEntry,
): StandingInquiryContext | null {
	const record = entry.document.record;
	if (
		record.observer_type !== "inquiry" ||
		(record.observer_status !== "open" && record.observer_status !== "dormant")
	) {
		return null;
	}
	return {
		inquiryId: record.id,
		title: record.title,
		lang: record.lang,
		status: record.observer_status,
		source: "durable",
		origin: record.inquiry.origin,
		original: record.inquiry.original,
		current: record.inquiry.current,
		revisionReason: record.inquiry.revision_reason ?? null,
		body: entry.document.body,
	};
}

function workingInquiryContext(input: {
	readonly compact: CompactStandingInquiry;
	readonly hypothesis: WorkingHypothesis;
	readonly episodeLanguage: "ko" | "en";
}): StandingInquiryContext {
	return {
		inquiryId: input.hypothesis.inquiryId,
		title: input.compact.title,
		lang: input.episodeLanguage,
		status: "working",
		source: input.compact.source,
		origin: input.hypothesis.origin,
		original: input.hypothesis.original,
		current: input.hypothesis.current,
		revisionReason: input.hypothesis.revisionReason,
		body: input.hypothesis.current,
	};
}

function pendingInquiryContext(input: {
	readonly compact: CompactStandingInquiry;
	readonly hypothesis: PendingObservationHypothesis;
	readonly episodeLanguage: "ko" | "en";
}): StandingInquiryContext {
	return {
		inquiryId: input.hypothesis.inquiryId,
		title: input.compact.title,
		lang: input.episodeLanguage,
		status: "working",
		source: "pending",
		origin: input.hypothesis.origin,
		original: input.hypothesis.original,
		current: input.hypothesis.current,
		revisionReason: null,
		body: input.hypothesis.context,
	};
}

function contextForInquiry(input: {
	readonly inquiryId: InquiryId;
	readonly compact: CompactStandingInquiry;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly memo: MemoWorkingState;
	readonly observation: ObservationSessionSnapshot;
	readonly episodeLanguage: "ko" | "en";
}): StandingInquiryContext | null {
	const pending = input.observation.pendingHypotheses.find(
		(hypothesis) => hypothesis.inquiryId === input.inquiryId,
	);
	if (pending) {
		return pendingInquiryContext({
			compact: input.compact,
			hypothesis: pending,
			episodeLanguage: input.episodeLanguage,
		});
	}
	const working = input.memo.hypotheses.find(
		(hypothesis) => hypothesis.inquiryId === input.inquiryId,
	);
	if (working) {
		return workingInquiryContext({
			compact: input.compact,
			hypothesis: working,
			episodeLanguage: input.episodeLanguage,
		});
	}
	for (const entry of input.inventory) {
		if (entry.document.record.id !== input.inquiryId) continue;
		return durableInquiryContext(entry);
	}
	return null;
}

function durableMemoContexts(
	inventory: readonly NotebookInventoryEntry[],
	requested: ReadonlySet<InquiryId>,
): readonly StandingMemoContext[] {
	return inventory.flatMap((entry): StandingMemoContext[] => {
		const record = entry.document.record;
		const inquiryIds = durableMemoInquiryIds(entry);
		return record.observer_type === "memo" &&
			record.observer_status === "incubating" &&
			inquiryIds.some((id) => requested.has(id))
			? [
					{
						memoId: record.id,
						title: record.title,
						lang: record.lang,
						content: entry.document.body,
						status: "incubating",
						source: "durable",
						inquiryIds,
					},
				]
			: [];
	});
}

function workingMemoContexts(
	memos: readonly WorkingMemo[],
	requested: ReadonlySet<InquiryId>,
): readonly StandingMemoContext[] {
	return memos.flatMap((memo): StandingMemoContext[] =>
		memo.disposition !== "superseded" &&
		memo.inquiryIds.some((id) => requested.has(id))
			? [
					{
						memoId: memo.memoId,
						title: memo.title,
						lang: memo.lang,
						content: memo.content,
						status: memo.disposition,
						source: "working",
						inquiryIds: memo.inquiryIds,
					},
				]
			: [],
	);
}

export function hydrateStandingContext(input: {
	readonly index: StandingIndex;
	readonly requestedInquiryIds: readonly InquiryId[];
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly memo: MemoWorkingState;
	readonly observation: ObservationSessionSnapshot;
	readonly episodeLanguage: "ko" | "en";
}): StandingContextResult {
	if (!isStandingIndex(input.index)) {
		return {
			ok: false,
			issue: {
				code: "standing-index.invalid",
				message: "Standing index must come from its builder.",
			},
		};
	}
	const requestedInquiryIds = uniqueSorted(input.requestedInquiryIds);
	if (
		requestedInquiryIds.length === 0 ||
		requestedInquiryIds.length !== input.requestedInquiryIds.length
	) {
		return {
			ok: false,
			issue: {
				code: "standing-index.empty",
				message: "Hydration requires unique Inquiry IDs.",
			},
		};
	}
	const compactById = new Map(
		input.index.inquiries.map((inquiry) => [inquiry.inquiryId, inquiry]),
	);
	const inquiries: StandingInquiryContext[] = [];
	for (const inquiryId of requestedInquiryIds) {
		const compact = compactById.get(inquiryId);
		if (!compact) {
			return {
				ok: false,
				issue: {
					code: "standing-index.missing",
					message: "Requested Inquiry is not in the standing index.",
					relatedId: inquiryId,
				},
			};
		}
		const context = contextForInquiry({
			inquiryId,
			compact,
			inventory: input.inventory,
			memo: input.memo,
			observation: input.observation,
			episodeLanguage: input.episodeLanguage,
		});
		if (!context) {
			return {
				ok: false,
				issue: {
					code: "standing-index.missing",
					message: "Requested Inquiry context is unavailable.",
					relatedId: inquiryId,
				},
			};
		}
		inquiries.push(context);
	}
	const requested = new Set(requestedInquiryIds);
	const byMemoId = new Map<string, StandingMemoContext>();
	for (const memo of durableMemoContexts(input.inventory, requested)) {
		byMemoId.set(memo.memoId, memo);
	}
	for (const memo of workingMemoContexts(input.memo.memos, requested)) {
		byMemoId.set(memo.memoId, memo);
	}
	const memos = [...byMemoId.values()].toSorted((left, right) =>
		left.memoId.localeCompare(right.memoId),
	);
	const payload = {
		indexDigest: input.index.digest,
		inquiries,
		memos,
	};
	return {
		ok: true,
		value: {
			[STANDING_CONTEXT_MARKER]: true,
			...payload,
			digest: sha256Text(JSON.stringify(payload)),
		},
	};
}
