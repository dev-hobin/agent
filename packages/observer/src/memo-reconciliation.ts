import { isSha256, sha256Text } from "./content-hash.ts";
import type { ObserverState } from "./lifecycle.ts";
import type { NotebookInventoryEntry } from "./notebook.ts";
import { decodeInquiryId, isPreparedMemoPass } from "./memo-profile.ts";
import type {
	EvidenceId,
	EvidenceItem,
	InquiryId,
	MemoDisposition,
	MemoId,
	MemoOutcome,
	PreparedMemoPass,
	SourceId,
	WorkingMemoDraft,
} from "./memo-profile.ts";

export interface DurableMemoBase {
	readonly path: string;
	readonly sha256: string;
}

export interface WorkingMemo {
	readonly memoId: MemoId;
	readonly episodeId: string;
	readonly title: string;
	readonly lang: string;
	readonly content: string;
	readonly inquiryIds: readonly InquiryId[];
	readonly hypothesisId: InquiryId | null;
	readonly evidenceIds: readonly EvidenceId[];
	readonly currentRevisionId: string;
	readonly disposition: MemoDisposition | "superseded";
	readonly supersededBy: MemoId | null;
	readonly durableBase: DurableMemoBase | null;
}

export interface WorkingHypothesis {
	readonly inquiryId: InquiryId;
	readonly episodeId: string;
	readonly origin: "user" | "observer";
	readonly original: string;
	readonly current: string;
	readonly revisionReason: string | null;
	readonly evidenceIds: readonly EvidenceId[];
}

export interface MemoReceiptScope {
	readonly episodeMemos: number;
	readonly standingInquiries: number;
	readonly durableMemos: number;
}

export interface MemoReceiptChanges {
	readonly created: number;
	readonly revised: number;
	readonly merged: number;
	readonly keptIncubating: number;
	readonly promotionCandidates: number;
	readonly hypothesisRevisions: number;
}

export interface MemoPassReceipt {
	readonly receiptId: `memo-receipt-${string}`;
	readonly passId: string;
	readonly revisionId: string;
	readonly scope: MemoReceiptScope;
	readonly changes: MemoReceiptChanges;
	readonly summary: string;
}

export interface MemoWorkingState {
	readonly revisionId: string | null;
	readonly passes: number;
	readonly memos: readonly WorkingMemo[];
	readonly hypotheses: readonly WorkingHypothesis[];
	readonly evidence: readonly EvidenceItem[];
	readonly lastPassId: string | null;
	readonly lastPassDigest: string | null;
	readonly lastReceipt: MemoPassReceipt | null;
}

export interface MemoScopeRecordBasis {
	readonly recordId: string;
	readonly path: string;
	readonly sha256: string;
}

export interface WorkingSourceBasis {
	readonly sourceId: SourceId;
	readonly path: string;
	readonly sha256: string;
}

export interface MemoScopeSnapshot {
	readonly episodeId: string;
	readonly episodeLanguage: "ko" | "en";
	readonly relatedInquiryIds: readonly InquiryId[];
	readonly durableMemos: readonly WorkingMemo[];
	readonly durableHypotheses: readonly WorkingHypothesis[];
	readonly existingRecordIds: readonly string[];
	readonly sourceIds: readonly SourceId[];
	readonly basisRecords: readonly MemoScopeRecordBasis[];
	readonly basisDigest: string;
}

export type MemoReconciliationIssueCode =
	| "memo-reconcile.base"
	| "memo-reconcile.coverage"
	| "memo-reconcile.duplicate"
	| "memo-reconcile.evidence"
	| "memo-reconcile.hypothesis"
	| "memo-reconcile.identity"
	| "memo-reconcile.merge"
	| "memo-reconcile.scope"
	| "memo-reconcile.state";

export interface MemoReconciliationIssue {
	readonly code: MemoReconciliationIssueCode;
	readonly message: string;
	readonly relatedId?: string;
}

export type MemoScopeResult =
	| { readonly ok: true; readonly value: MemoScopeSnapshot }
	| { readonly ok: false; readonly issue: MemoReconciliationIssue };

export type MemoReconciliationResult =
	| {
			readonly ok: true;
			readonly value: {
				readonly state: MemoWorkingState;
				readonly receipt: MemoPassReceipt;
			};
	  }
	| { readonly ok: false; readonly issue: MemoReconciliationIssue };

export interface MemoReconciliationIds {
	revisionId(): string;
	receiptId(): `memo-receipt-${string}`;
}

type ReconciliationFailure = Extract<
	MemoReconciliationResult,
	{ readonly ok: false }
>;

interface MutableChanges {
	created: number;
	revised: number;
	merged: number;
	keptIncubating: number;
	promotionCandidates: number;
	hypothesisRevisions: number;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled reconciliation outcome: ${String(value)}`);
}

function failure(
	code: MemoReconciliationIssueCode,
	message: string,
	relatedId?: string,
): { readonly ok: false; readonly issue: MemoReconciliationIssue } {
	return {
		ok: false,
		issue: relatedId ? { code, message, relatedId } : { code, message },
	};
}

function uniqueSorted<Value extends string>(
	values: readonly Value[],
): readonly Value[] {
	return [...new Set(values)].toSorted((left, right) =>
		left.localeCompare(right),
	);
}

function sameStrings(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function includesAll(
	container: readonly string[],
	required: readonly string[],
): boolean {
	const available = new Set(container);
	return required.every((value) => available.has(value));
}

function semanticKey(input: {
	readonly title: string;
	readonly content: string;
	readonly inquiryIds: readonly InquiryId[];
	readonly hypothesisId: InquiryId | null;
}): string {
	return JSON.stringify({
		title: input.title.replace(/\s+/gu, " ").trim(),
		content: input.content.replace(/\s+/gu, " ").trim(),
		inquiryIds: uniqueSorted(input.inquiryIds),
		hypothesisId: input.hypothesisId,
	});
}

export function initialMemoWorkingState(): MemoWorkingState {
	return {
		revisionId: null,
		passes: 0,
		memos: [],
		hypotheses: [],
		evidence: [],
		lastPassId: null,
		lastPassDigest: null,
		lastReceipt: null,
	};
}

function inquiryIdsFromMemo(
	entry: NotebookInventoryEntry,
): readonly InquiryId[] {
	if (entry.document.record.observer_type !== "memo") return [];
	const ids: InquiryId[] = [];
	for (const lineage of entry.document.record.lineage) {
		if (lineage.type === "derived_from") {
			const id = decodeInquiryId(lineage.target);
			if (id) ids.push(id);
		}
	}
	return uniqueSorted(ids);
}

function durableHypothesis(
	entry: NotebookInventoryEntry,
	episodeId: string,
): WorkingHypothesis | null {
	const record = entry.document.record;
	if (
		record.observer_type !== "inquiry" ||
		(record.observer_status !== "open" && record.observer_status !== "dormant")
	) {
		return null;
	}
	return {
		inquiryId: record.id,
		episodeId,
		origin: record.inquiry.origin,
		original: record.inquiry.original,
		current: record.inquiry.current,
		revisionReason: record.inquiry.revision_reason ?? null,
		evidenceIds: [],
	};
}

function durableMemo(
	entry: NotebookInventoryEntry,
	episodeId: string,
	relatedInquiryIds: readonly InquiryId[],
): WorkingMemo | null {
	const record = entry.document.record;
	if (
		record.observer_type !== "memo" ||
		record.observer_status !== "incubating"
	) {
		return null;
	}
	const inquiryIds = inquiryIdsFromMemo(entry);
	if (!inquiryIds.some((id) => relatedInquiryIds.includes(id))) return null;
	return {
		memoId: record.id,
		episodeId,
		title: record.title,
		lang: record.lang,
		content: entry.document.body,
		inquiryIds,
		hypothesisId: inquiryIds[0] ?? null,
		evidenceIds: [],
		currentRevisionId: `durable-${entry.sha256}`,
		disposition: "incubating",
		supersededBy: null,
		durableBase: { path: entry.path, sha256: entry.sha256 },
	};
}

function scopeBasis(input: {
	readonly state: MemoWorkingState;
	readonly episodeId: string;
	readonly relatedInquiryIds: readonly InquiryId[];
	readonly durableMemos: readonly WorkingMemo[];
	readonly durableHypotheses: readonly WorkingHypothesis[];
	readonly existingRecordIds: readonly string[];
	readonly sourceIds: readonly SourceId[];
	readonly basisRecords: readonly MemoScopeRecordBasis[];
}): string {
	return sha256Text(
		JSON.stringify({
			revisionId: input.state.revisionId,
			episodeId: input.episodeId,
			relatedInquiryIds: input.relatedInquiryIds,
			workingMemos: input.state.memos
				.flatMap((memo) =>
					memo.episodeId === input.episodeId &&
					memo.disposition !== "superseded"
						? [[memo.memoId, memo.currentRevisionId]]
						: [],
				)
				.toSorted((left, right) => left[0].localeCompare(right[0])),
			durableMemos: input.durableMemos.map((memo) => [
				memo.memoId,
				memo.durableBase?.sha256 ?? "",
			]),
			existingRecordIds: input.existingRecordIds,
			sourceIds: input.sourceIds,
			basisRecords: input.basisRecords,
			hypotheses: [
				...input.state.hypotheses.filter(
					(hypothesis) => hypothesis.episodeId === input.episodeId,
				),
				...input.durableHypotheses,
			]
				.map((hypothesis) => [hypothesis.inquiryId, hypothesis.current])
				.toSorted((left, right) => left[0].localeCompare(right[0])),
		}),
	);
}

export function memoScopeBasisMatches(
	state: MemoWorkingState,
	scope: MemoScopeSnapshot,
): boolean {
	if (
		!sameStrings(
			scope.relatedInquiryIds,
			uniqueSorted(scope.relatedInquiryIds),
		) ||
		!sameStrings(
			scope.existingRecordIds,
			uniqueSorted(scope.existingRecordIds),
		) ||
		!sameStrings(scope.sourceIds, uniqueSorted(scope.sourceIds)) ||
		scope.durableMemos.some(
			(memo, index) =>
				index > 0 &&
				(scope.durableMemos[index - 1]?.memoId ?? "").localeCompare(
					memo.memoId,
				) >= 0,
		) ||
		scope.durableHypotheses.some(
			(hypothesis, index) =>
				index > 0 &&
				(scope.durableHypotheses[index - 1]?.inquiryId ?? "").localeCompare(
					hypothesis.inquiryId,
				) >= 0,
		) ||
		scope.basisRecords.some(
			(record, index) =>
				index > 0 &&
				(scope.basisRecords[index - 1]?.recordId ?? "").localeCompare(
					record.recordId,
				) >= 0,
		)
	) {
		return false;
	}
	return (
		scope.basisDigest ===
		scopeBasis({
			state,
			episodeId: scope.episodeId,
			relatedInquiryIds: scope.relatedInquiryIds,
			durableMemos: scope.durableMemos,
			durableHypotheses: scope.durableHypotheses,
			existingRecordIds: scope.existingRecordIds,
			sourceIds: scope.sourceIds,
			basisRecords: scope.basisRecords,
		})
	);
}

export function hydrateMemoScope(input: {
	readonly lifecycle: ObserverState;
	readonly working: MemoWorkingState;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly relatedInquiryIds: readonly InquiryId[];
	readonly workingSourceBases: readonly WorkingSourceBasis[];
}): MemoScopeResult {
	if (input.lifecycle.episode.status !== "open") {
		return failure(
			"memo-reconcile.state",
			"Memo reconciliation requires an open episode.",
		);
	}
	const relatedInquiryIds = uniqueSorted(input.relatedInquiryIds);
	if (relatedInquiryIds.length !== input.relatedInquiryIds.length) {
		return failure(
			"memo-reconcile.duplicate",
			"Related Inquiry IDs must be unique.",
		);
	}
	const workingSourceIds = input.workingSourceBases.map(
		(basis) => basis.sourceId,
	);
	if (
		new Set(workingSourceIds).size !== workingSourceIds.length ||
		input.workingSourceBases.some(
			(basis) =>
				basis.path.length === 0 ||
				basis.path !== basis.path.trim() ||
				!isSha256(basis.sha256),
		)
	) {
		return failure(
			"memo-reconcile.scope",
			"Working Source bases must be unique and valid.",
		);
	}
	const episodeId = input.lifecycle.episode.core.episodeId;
	const inquiryEntries = new Map<InquiryId, NotebookInventoryEntry>();
	const existingRecordIds: string[] = [];
	const sourceIds: SourceId[] = [];
	for (const entry of input.inventory) {
		const record = entry.document.record;
		existingRecordIds.push(record.id);
		if (record.observer_type === "source") sourceIds.push(record.id);
		if (record.observer_type === "inquiry")
			inquiryEntries.set(record.id, entry);
	}
	const workingInquiryIds = new Set(
		input.working.hypotheses.flatMap((hypothesis) =>
			hypothesis.episodeId === episodeId ? [hypothesis.inquiryId] : [],
		),
	);
	const durableHypotheses: WorkingHypothesis[] = [];
	for (const id of relatedInquiryIds) {
		const entry = inquiryEntries.get(id);
		if (!entry) {
			if (!workingInquiryIds.has(id)) {
				return failure(
					"memo-reconcile.scope",
					"Related Inquiry does not exist.",
					id,
				);
			}
			continue;
		}
		const hypothesis = durableHypothesis(entry, episodeId);
		if (!hypothesis) {
			return failure(
				"memo-reconcile.scope",
				"Related Inquiry is not standing.",
				id,
			);
		}
		durableHypotheses.push(hypothesis);
	}
	const durableMemos = input.inventory
		.flatMap((entry) => {
			const memo = durableMemo(entry, episodeId, relatedInquiryIds);
			return memo ? [memo] : [];
		})
		.toSorted((left, right) => left.memoId.localeCompare(right.memoId));
	const normalizedHypotheses = durableHypotheses.toSorted((left, right) =>
		left.inquiryId.localeCompare(right.inquiryId),
	);
	const durableRecordIds = new Set(existingRecordIds);
	const allSourceIds = uniqueSorted([...sourceIds, ...workingSourceIds]);
	const allRecordIds = uniqueSorted([
		...existingRecordIds,
		...workingSourceIds,
	]);
	const basisRecordIds = new Set<string>([
		...allSourceIds,
		...relatedInquiryIds,
		...durableMemos.map((memo) => memo.memoId),
	]);
	const basisRecords = [
		...input.inventory.flatMap((entry) =>
			basisRecordIds.has(entry.document.record.id)
				? [
						{
							recordId: entry.document.record.id,
							path: entry.path,
							sha256: entry.sha256,
						},
					]
				: [],
		),
		...input.workingSourceBases.flatMap((basis) =>
			durableRecordIds.has(basis.sourceId)
				? []
				: [
						{
							recordId: basis.sourceId,
							path: basis.path,
							sha256: basis.sha256,
						},
					],
		),
	].toSorted((left, right) => left.recordId.localeCompare(right.recordId));
	return {
		ok: true,
		value: {
			episodeId,
			episodeLanguage: input.lifecycle.episode.core.lang,
			relatedInquiryIds,
			durableMemos,
			durableHypotheses: normalizedHypotheses,
			existingRecordIds: allRecordIds,
			sourceIds: allSourceIds,
			basisRecords,
			basisDigest: scopeBasis({
				state: input.working,
				episodeId,
				relatedInquiryIds,
				durableMemos,
				durableHypotheses: normalizedHypotheses,
				existingRecordIds: allRecordIds,
				sourceIds: allSourceIds,
				basisRecords,
			}),
		},
	};
}

function overlayById<Value>(
	current: readonly Value[],
	durable: readonly Value[],
	id: (value: Value) => string,
): Value[] {
	const values = new Map(current.map((value) => [id(value), value]));
	for (const value of durable) {
		if (!values.has(id(value))) values.set(id(value), value);
	}
	return [...values.values()];
}

function knownEvidence(
	state: MemoWorkingState,
	pass: PreparedMemoPass,
	scope: MemoScopeSnapshot,
): ReadonlySet<string> | ReconciliationFailure {
	const byId = new Map(state.evidence.map((item) => [item.evidenceId, item]));
	for (const evidence of pass.evidence) {
		const current = byId.get(evidence.evidenceId);
		if (current && JSON.stringify(current) !== JSON.stringify(evidence)) {
			return failure(
				"memo-reconcile.evidence",
				"Evidence ID conflicts with prior evidence.",
				evidence.evidenceId,
			);
		}
		if (evidence.kind === "source-claim" && evidence.sourceId === null) {
			return failure(
				"memo-reconcile.evidence",
				"Source claim evidence requires a Source ID.",
				evidence.evidenceId,
			);
		}
		if (evidence.sourceId && !scope.sourceIds.includes(evidence.sourceId)) {
			return failure(
				"memo-reconcile.evidence",
				"Evidence references an unavailable Source.",
				evidence.sourceId,
			);
		}
		byId.set(evidence.evidenceId, evidence);
	}
	return new Set(byId.keys());
}

function isFailure(
	value: ReadonlySet<string> | ReconciliationFailure,
): value is ReconciliationFailure {
	return "ok" in value;
}

function knownEvidenceOnly(
	ids: readonly EvidenceId[],
	known: ReadonlySet<string>,
	relatedId: string,
): ReconciliationFailure | null {
	return ids.some((id) => !known.has(id))
		? failure(
				"memo-reconcile.evidence",
				"An outcome references unknown evidence.",
				relatedId,
			)
		: null;
}

function requireEvidence(
	ids: readonly EvidenceId[],
	known: ReadonlySet<string>,
	relatedId: string,
): ReconciliationFailure | null {
	return ids.length === 0
		? failure(
				"memo-reconcile.evidence",
				"A changing outcome requires known evidence.",
				relatedId,
			)
		: knownEvidenceOnly(ids, known, relatedId);
}

function projectHypotheses(input: {
	readonly state: MemoWorkingState;
	readonly scope: MemoScopeSnapshot;
	readonly pass: PreparedMemoPass;
	readonly knownEvidence: ReadonlySet<string>;
	readonly changes: MutableChanges;
}): readonly WorkingHypothesis[] | ReconciliationFailure {
	const hypotheses = overlayById(
		input.state.hypotheses,
		input.scope.durableHypotheses,
		(value) => value.inquiryId,
	);
	const byId = new Map(hypotheses.map((value) => [value.inquiryId, value]));
	const scoped = hypotheses.filter(
		(value) =>
			value.episodeId === input.scope.episodeId &&
			(input.scope.relatedInquiryIds.includes(value.inquiryId) ||
				!input.scope.existingRecordIds.includes(value.inquiryId)),
	);
	const coverage = new Map(scoped.map((value) => [value.inquiryId, 0]));
	for (const outcome of input.pass.hypothesisOutcomes) {
		if (outcome.kind === "create") {
			const hypothesis = outcome.hypothesis;
			if (
				byId.has(hypothesis.inquiryId) ||
				input.scope.existingRecordIds.includes(hypothesis.inquiryId) ||
				hypothesis.episodeId !== input.scope.episodeId
			) {
				return failure(
					"memo-reconcile.identity",
					"Created hypothesis identity is unavailable.",
					hypothesis.inquiryId,
				);
			}
			const evidenceIssue =
				hypothesis.origin === "observer"
					? requireEvidence(
							hypothesis.evidenceIds,
							input.knownEvidence,
							hypothesis.inquiryId,
						)
					: knownEvidenceOnly(
							hypothesis.evidenceIds,
							input.knownEvidence,
							hypothesis.inquiryId,
						);
			if (evidenceIssue) return evidenceIssue;
			byId.set(hypothesis.inquiryId, hypothesis);
			continue;
		}
		const current = byId.get(outcome.inquiryId);
		if (!current || !coverage.has(outcome.inquiryId)) {
			return failure(
				"memo-reconcile.scope",
				"Hypothesis outcome targets an out-of-scope Inquiry.",
				outcome.inquiryId,
			);
		}
		coverage.set(outcome.inquiryId, (coverage.get(outcome.inquiryId) ?? 0) + 1);
		if (outcome.kind === "keep") continue;
		const evidenceIssue = requireEvidence(
			outcome.evidenceIds,
			input.knownEvidence,
			outcome.inquiryId,
		);
		if (evidenceIssue) return evidenceIssue;
		if (outcome.current === current.current) {
			return failure(
				"memo-reconcile.hypothesis",
				"Hypothesis revision must change current text.",
				outcome.inquiryId,
			);
		}
		byId.set(outcome.inquiryId, {
			...current,
			current: outcome.current,
			revisionReason: outcome.revisionReason,
			evidenceIds: uniqueSorted([
				...current.evidenceIds,
				...outcome.evidenceIds,
			]),
		});
		input.changes.hypothesisRevisions += 1;
	}
	if ([...coverage.values()].some((count) => count !== 1)) {
		return failure(
			"memo-reconcile.coverage",
			"Every scoped hypothesis requires exactly one outcome.",
		);
	}
	return [...byId.values()].toSorted((left, right) =>
		left.inquiryId.localeCompare(right.inquiryId),
	);
}

function memoFromDraft(
	draft: WorkingMemoDraft,
	revisionId: string,
	disposition: MemoDisposition,
): WorkingMemo {
	return {
		memoId: draft.memoId,
		episodeId: draft.episodeId,
		title: draft.title,
		lang: draft.lang,
		content: draft.content,
		inquiryIds: draft.inquiryIds,
		hypothesisId: draft.hypothesisId,
		evidenceIds: draft.evidenceIds,
		currentRevisionId: revisionId,
		disposition,
		supersededBy: null,
		durableBase: null,
	};
}

function outcomeTargetIds(outcome: MemoOutcome): readonly MemoId[] {
	switch (outcome.kind) {
		case "keep-incubating":
		case "revise":
		case "mark-promotion-candidate":
			return [outcome.memoId];
		case "merge":
			return outcome.sourceIds;
		case "create":
			return [];
		default:
			return assertNever(outcome);
	}
}

function verifyDraftLinks(
	draft: WorkingMemoDraft,
	availableInquiries: ReadonlySet<string>,
	knownEvidenceIds: ReadonlySet<string>,
	scope: MemoScopeSnapshot,
): ReconciliationFailure | null {
	if (
		draft.episodeId !== scope.episodeId ||
		draft.lang !== scope.episodeLanguage ||
		draft.inquiryIds.some((id) => !availableInquiries.has(id)) ||
		(draft.hypothesisId !== null &&
			(!availableInquiries.has(draft.hypothesisId) ||
				!draft.inquiryIds.includes(draft.hypothesisId)))
	) {
		return failure(
			"memo-reconcile.scope",
			"Memo draft does not match episode language or Inquiry scope.",
			draft.memoId,
		);
	}
	return requireEvidence(draft.evidenceIds, knownEvidenceIds, draft.memoId);
}

function projectMemos(input: {
	readonly state: MemoWorkingState;
	readonly scope: MemoScopeSnapshot;
	readonly pass: PreparedMemoPass;
	readonly hypotheses: readonly WorkingHypothesis[];
	readonly knownEvidence: ReadonlySet<string>;
	readonly revisionId: string;
	readonly changes: MutableChanges;
}): readonly WorkingMemo[] | ReconciliationFailure {
	const memos = overlayById(
		input.state.memos,
		input.scope.durableMemos,
		(value) => value.memoId,
	);
	const byId = new Map(memos.map((value) => [value.memoId, value]));
	const liveScope = memos.filter(
		(value) =>
			value.episodeId === input.scope.episodeId &&
			value.disposition !== "superseded",
	);
	const coverage = new Map(liveScope.map((value) => [value.memoId, 0]));
	for (const outcome of input.pass.memoOutcomes) {
		for (const id of outcomeTargetIds(outcome)) {
			if (!coverage.has(id)) {
				return failure(
					"memo-reconcile.scope",
					"Memo outcome targets an out-of-scope Memo.",
					id,
				);
			}
			coverage.set(id, (coverage.get(id) ?? 0) + 1);
		}
	}
	if ([...coverage.values()].some((count) => count !== 1)) {
		return failure(
			"memo-reconcile.coverage",
			"Every scoped Memo requires exactly one outcome.",
		);
	}
	const availableInquiries = new Set(
		input.hypotheses.map((item) => item.inquiryId),
	);
	for (const outcome of input.pass.memoOutcomes) {
		switch (outcome.kind) {
			case "keep-incubating": {
				const current = byId.get(outcome.memoId);
				if (!current)
					return failure("memo-reconcile.scope", "Memo is missing.");
				byId.set(outcome.memoId, { ...current, disposition: "incubating" });
				input.changes.keptIncubating += 1;
				break;
			}
			case "revise": {
				const current = byId.get(outcome.memoId);
				if (!current)
					return failure("memo-reconcile.scope", "Memo is missing.");
				if (
					outcome.revision.title === current.title &&
					outcome.revision.content === current.content
				) {
					return failure(
						"memo-reconcile.duplicate",
						"Memo revision must change title or content.",
						outcome.memoId,
					);
				}
				const evidenceIssue = requireEvidence(
					outcome.revision.evidenceIds,
					input.knownEvidence,
					outcome.memoId,
				);
				if (evidenceIssue) return evidenceIssue;
				byId.set(outcome.memoId, {
					...current,
					title: outcome.revision.title,
					content: outcome.revision.content,
					evidenceIds: uniqueSorted([
						...current.evidenceIds,
						...outcome.revision.evidenceIds,
					]),
					currentRevisionId: outcome.revision.revisionId,
					disposition: outcome.disposition,
				});
				input.changes.revised += 1;
				if (outcome.disposition === "promotion-candidate") {
					input.changes.promotionCandidates += 1;
				}
				break;
			}
			case "mark-promotion-candidate": {
				const current = byId.get(outcome.memoId);
				if (!current)
					return failure("memo-reconcile.scope", "Memo is missing.");
				const evidenceIssue = requireEvidence(
					outcome.evidenceIds,
					input.knownEvidence,
					outcome.memoId,
				);
				if (evidenceIssue) return evidenceIssue;
				byId.set(outcome.memoId, {
					...current,
					evidenceIds: uniqueSorted([
						...current.evidenceIds,
						...outcome.evidenceIds,
					]),
					currentRevisionId: input.revisionId,
					disposition: "promotion-candidate",
				});
				input.changes.promotionCandidates += 1;
				break;
			}
			case "create": {
				const issue = verifyDraftLinks(
					outcome.memo,
					availableInquiries,
					input.knownEvidence,
					input.scope,
				);
				if (issue) return issue;
				if (
					byId.has(outcome.memo.memoId) ||
					input.scope.existingRecordIds.includes(outcome.memo.memoId)
				) {
					return failure(
						"memo-reconcile.identity",
						"Created Memo identity is unavailable.",
						outcome.memo.memoId,
					);
				}
				byId.set(
					outcome.memo.memoId,
					memoFromDraft(outcome.memo, input.revisionId, "incubating"),
				);
				input.changes.created += 1;
				break;
			}
			case "merge": {
				const issue = verifyDraftLinks(
					outcome.target,
					availableInquiries,
					input.knownEvidence,
					input.scope,
				);
				if (issue) return issue;
				if (
					byId.has(outcome.target.memoId) ||
					input.scope.existingRecordIds.includes(outcome.target.memoId)
				) {
					return failure(
						"memo-reconcile.identity",
						"Merge target identity is unavailable.",
						outcome.target.memoId,
					);
				}
				const sources = outcome.sourceIds.map((id) => byId.get(id));
				if (sources.some((source) => source === undefined)) {
					return failure("memo-reconcile.merge", "Merge source is missing.");
				}
				const completeSources = sources.filter(
					(source) => source !== undefined,
				);
				const inquiryUnion = uniqueSorted(
					completeSources.flatMap((source) => source.inquiryIds),
				);
				const evidenceUnion = uniqueSorted(
					completeSources.flatMap((source) => source.evidenceIds),
				);
				if (
					!includesAll(outcome.target.inquiryIds, inquiryUnion) ||
					!includesAll(outcome.target.evidenceIds, evidenceUnion)
				) {
					return failure(
						"memo-reconcile.merge",
						"Merge target must retain source Inquiry and evidence links.",
						outcome.target.memoId,
					);
				}
				for (const source of completeSources) {
					byId.set(source.memoId, {
						...source,
						currentRevisionId: input.revisionId,
						disposition: "superseded",
						supersededBy: outcome.target.memoId,
					});
				}
				byId.set(
					outcome.target.memoId,
					memoFromDraft(outcome.target, input.revisionId, "incubating"),
				);
				input.changes.merged += 1;
				break;
			}
			default:
				assertNever(outcome);
		}
	}
	const projected = [...byId.values()].toSorted((left, right) =>
		left.memoId.localeCompare(right.memoId),
	);
	const keys = projected.flatMap((memo) =>
		memo.disposition === "superseded" ? [] : [semanticKey(memo)],
	);
	if (new Set(keys).size !== keys.length) {
		return failure(
			"memo-reconcile.duplicate",
			"Live Memo semantic keys must be unique.",
		);
	}
	return projected;
}

function receiptSummary(changes: MemoReceiptChanges): string {
	return [
		`신규 ${changes.created}`,
		`수정 ${changes.revised}`,
		`병합 ${changes.merged}`,
		`incubating ${changes.keptIncubating}`,
		`승격 후보 ${changes.promotionCandidates}`,
		`가설 수정 ${changes.hypothesisRevisions}`,
	].join(" · ");
}

export function reconcileMemoPass(input: {
	readonly state: MemoWorkingState;
	readonly scope: MemoScopeSnapshot;
	readonly pass: PreparedMemoPass;
	readonly ids: MemoReconciliationIds;
}): MemoReconciliationResult {
	if (!isPreparedMemoPass(input.pass)) {
		return failure(
			"memo-reconcile.state",
			"Memo reconciliation requires a parser-refined pass.",
		);
	}
	if (
		input.pass.episodeId !== input.scope.episodeId ||
		input.pass.baseRevisionId !== input.state.revisionId ||
		input.pass.basisDigest !== input.scope.basisDigest ||
		!sameStrings(input.pass.relatedInquiryIds, input.scope.relatedInquiryIds)
	) {
		return failure(
			"memo-reconcile.base",
			"Prepared Memo pass has a stale or mismatched basis.",
		);
	}
	const known = knownEvidence(input.state, input.pass, input.scope);
	if (isFailure(known)) return known;
	const changes: MutableChanges = {
		created: 0,
		revised: 0,
		merged: 0,
		keptIncubating: 0,
		promotionCandidates: 0,
		hypothesisRevisions: 0,
	};
	const revisionId = input.ids.revisionId();
	const hypotheses = projectHypotheses({
		state: input.state,
		scope: input.scope,
		pass: input.pass,
		knownEvidence: known,
		changes,
	});
	if ("ok" in hypotheses) return hypotheses;
	const memos = projectMemos({
		state: input.state,
		scope: input.scope,
		pass: input.pass,
		hypotheses,
		knownEvidence: known,
		revisionId,
		changes,
	});
	if ("ok" in memos) return memos;
	const evidence = overlayById(
		input.state.evidence,
		input.pass.evidence,
		(value) => value.evidenceId,
	).toSorted((left, right) => left.evidenceId.localeCompare(right.evidenceId));
	const receipt: MemoPassReceipt = {
		receiptId: input.ids.receiptId(),
		passId: input.pass.passId,
		revisionId,
		scope: {
			episodeMemos: memos.filter(
				(memo) =>
					memo.episodeId === input.scope.episodeId && memo.durableBase === null,
			).length,
			standingInquiries: input.scope.relatedInquiryIds.length,
			durableMemos: input.scope.durableMemos.length,
		},
		changes,
		summary: receiptSummary(changes),
	};
	return {
		ok: true,
		value: {
			state: {
				revisionId,
				passes: input.state.passes + 1,
				memos,
				hypotheses,
				evidence,
				lastPassId: input.pass.passId,
				lastPassDigest: input.pass.digest,
				lastReceipt: receipt,
			},
			receipt,
		},
	};
}
