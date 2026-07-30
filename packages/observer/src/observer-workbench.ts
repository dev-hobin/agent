import type { MaterialReviewSession } from "./material-review-trigger.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import type { NotebookInventoryEntry } from "./notebook.ts";
import type { WorkingSource } from "./observation-profile.ts";
import type { ObservationSessionSnapshot } from "./observation-session.ts";
import type { ObserverStatusView } from "./observer-status.ts";
import type { SaveProposalReview } from "./save-review.ts";
import type { SaveRequestSession } from "./save-trigger.ts";
import { diffLines } from "./line-diff.ts";

export type ObserverWorkbenchSectionId =
	| "overview"
	| "activity"
	| "inquiries"
	| "memos"
	| "proposal"
	| "notebook"
	| "settings";

export type ObserverWorkbenchItemKind =
	| "source-read"
	| "observation"
	| "hypothesis"
	| "context-review"
	| "inquiry"
	| "memo"
	| "proposal-record"
	| "notebook-record";

export interface ObserverWorkbenchDetailBlock {
	readonly heading: string;
	readonly lines: readonly string[];
}

export interface ObserverWorkbenchItem {
	readonly id: string;
	readonly kind: ObserverWorkbenchItemKind;
	readonly label: string;
	readonly title: string;
	readonly summary: string;
	readonly state?: string;
	readonly blocks: readonly ObserverWorkbenchDetailBlock[];
}

export type ObserverWorkbenchProposal =
	| {
			readonly kind: "not-requested";
			readonly reviewAvailable: boolean;
	  }
	| {
			readonly kind: "needs-reconciliation";
			readonly observationCount: number;
			readonly memoCount: number;
	  }
	| {
			readonly kind: "preparing";
			readonly stage: "memo-reconciliation" | "proposal";
			readonly requestId: string;
			readonly proposalId: string | null;
			readonly observationCount: number;
			readonly sourceReadCount: number;
			readonly hasMemoRevision: boolean;
	  }
	| {
			readonly kind: "ready";
			readonly proposalId: string;
			readonly summary: string;
			readonly createCount: number;
			readonly updateCount: number;
			readonly records: readonly ObserverWorkbenchItem[];
	  }
	| {
			readonly kind: "invalid";
			readonly proposalId: string;
			readonly reason: string;
	  };

export interface ObserverWorkbenchView {
	readonly status: ObserverStatusView;
	readonly activity: readonly ObserverWorkbenchItem[];
	readonly inquiries: readonly ObserverWorkbenchItem[];
	readonly memos: readonly ObserverWorkbenchItem[];
	readonly proposal: ObserverWorkbenchProposal;
	readonly notebook: readonly ObserverWorkbenchItem[];
	readonly notebookInventoryIssue?: string;
	readonly materialReviewPending: boolean;
}

export type ObserverWorkbenchProposalInspection =
	| { readonly kind: "none" }
	| { readonly kind: "ready"; readonly review: SaveProposalReview }
	| {
			readonly kind: "invalid";
			readonly proposalId: string;
			readonly reason: string;
	  };

function assertNever(value: never): never {
	throw new Error(`Unexpected Observer workbench value: ${String(value)}`);
}

function nonemptyLines(
	values: readonly (string | null | undefined)[],
): string[] {
	return values.flatMap((value) => (value ? [value] : []));
}

function listLines(values: readonly string[]): readonly string[] {
	return values.length > 0 ? values : ["None"];
}

function sourceDetailLines(source: WorkingSource): readonly string[] {
	switch (source.kind) {
		case "external-material":
			return nonemptyLines([
				`Kind: ${source.kind}`,
				`Language: ${source.lang}`,
				source.uri ? `URI: ${source.uri}` : null,
				source.revision ? `Revision: ${source.revision}` : null,
				source.contentHash ? `Content hash: ${source.contentHash}` : null,
				source.retrievalContext
					? `Retrieval context: ${source.retrievalContext}`
					: null,
			]);
		case "direct-observation":
			return [
				`Kind: ${source.kind}`,
				`Language: ${source.lang}`,
				`Observed at: ${source.observedAt}`,
				`Observed by: ${source.observedBy}`,
				`Fact: ${source.fact}`,
				`Conditions: ${source.conditions}`,
				`Interpretation boundary: ${source.interpretationBoundary}`,
			];
		default:
			return assertNever(source);
	}
}

function sourceReadItems(
	snapshot: ObservationSessionSnapshot,
): readonly ObserverWorkbenchItem[] {
	return snapshot.sourceReads.map((read) => {
		const source = read.source;
		return {
			id: read.readId,
			kind: "source-read",
			label: "SourceRead",
			title: source.title,
			summary: read.faithfulSummary,
			state:
				read.materialReviewRequestId === undefined
					? "Sidecar"
					: "Material review",
			blocks: [
				{ heading: "Faithful summary", lines: [read.faithfulSummary] },
				{
					heading: "Claims",
					lines: listLines(
						read.claims.map((claim) =>
							claim.locator ? `${claim.text} — ${claim.locator}` : claim.text,
						),
					),
				},
				{ heading: "Source", lines: sourceDetailLines(source) },
				{
					heading: "Ancestry",
					lines: [
						`Read ID: ${read.readId}`,
						`Candidates: ${read.candidateIds.join(", ") || "None"}`,
						`Standing inquiries: ${read.indexInquiryIds.join(", ") || "None"}`,
					],
				},
			],
		};
	});
}

function observationItems(
	snapshot: ObservationSessionSnapshot,
): readonly ObserverWorkbenchItem[] {
	const readTitles = new Map(
		snapshot.sourceReads.map((read) => [read.readId, read.source.title]),
	);
	const unconsumed = new Set(snapshot.unconsumedObservationIds);
	return snapshot.observations.map((observation) => ({
		id: observation.observationId,
		kind: "observation",
		label: "Observation",
		title: `${observation.stance} · ${observation.movement}`,
		summary: observation.rationale,
		state: unconsumed.has(observation.observationId) ? "Working" : "Reconciled",
		blocks: [
			{ heading: "Rationale", lines: [observation.rationale] },
			{
				heading: "Meaning",
				lines: [
					`Stance: ${observation.stance}`,
					`Movement: ${observation.movement}`,
					`Visibility: ${observation.visibility}`,
				],
			},
			{
				heading: "Relations",
				lines: [
					`SourceRead: ${readTitles.get(observation.readId) ?? observation.readId}`,
					`Read ID: ${observation.readId}`,
					`Inquiries: ${observation.relatedInquiryIds.join(", ") || "None"}`,
				],
			},
			...(observation.observerHypothesis
				? [
						{
							heading: "Observer hypothesis",
							lines: [
								`Inquiry: ${observation.observerHypothesis.inquiryId}`,
								`Original: ${observation.observerHypothesis.original}`,
							],
						},
					]
				: []),
		],
	}));
}

function hypothesisItems(
	snapshot: ObservationSessionSnapshot,
): readonly ObserverWorkbenchItem[] {
	const reviews = new Map(
		snapshot.hypothesisReviews.map((review) => [
			review.hypothesisObservationId,
			review,
		]),
	);
	return snapshot.userHypotheses.flatMap((hypothesis) => {
		const review = reviews.get(hypothesis.observationId);
		const hypothesisItem: ObserverWorkbenchItem = {
			id: `hypothesis:${hypothesis.observationId}`,
			kind: "hypothesis",
			label: "Hypothesis",
			title: hypothesis.original,
			summary: hypothesis.context || "No user context supplied",
			state: review ? "Context reviewed" : "Review pending",
			blocks: [
				{
					heading: "Hypothesis",
					lines: [
						`Inquiry: ${hypothesis.inquiryId}`,
						`Original: ${hypothesis.original}`,
						`Context: ${hypothesis.context || "None"}`,
					],
				},
			],
		};
		if (!review) return [hypothesisItem];
		return [
			hypothesisItem,
			{
				id: `review:${hypothesis.observationId}`,
				kind: "context-review",
				label: "Context review",
				title: `${review.assessment} · ${hypothesis.original}`,
				summary: review.interpretationBoundary,
				state: review.assessment,
				blocks: [
					{
						heading: "Assessment",
						lines: [
							`Result: ${review.assessment}`,
							`Interpretation boundary: ${review.interpretationBoundary}`,
						],
					},
					{
						heading: "Supporting clues",
						lines: listLines(review.supportingClues),
					},
					{
						heading: "Challenging clues",
						lines: listLines(review.challengingClues),
					},
					{
						heading: "Missing information",
						lines: listLines(review.missingInformation),
					},
					{
						heading: "Sources",
						lines: listLines(review.sourceIds),
					},
				],
			},
		];
	});
}

function inquiryItems(
	snapshot: MemoSessionSnapshot,
): readonly ObserverWorkbenchItem[] {
	return snapshot.state.hypotheses.map((inquiry) => ({
		id: inquiry.inquiryId,
		kind: "inquiry",
		label: "Inquiry",
		title: inquiry.current,
		summary:
			inquiry.revisionReason ??
			(inquiry.original === inquiry.current
				? "Original hypothesis"
				: "Current working hypothesis"),
		state: inquiry.origin,
		blocks: [
			{
				heading: "Inquiry",
				lines: [
					`Origin: ${inquiry.origin}`,
					`Original: ${inquiry.original}`,
					`Current: ${inquiry.current}`,
					`Revision reason: ${inquiry.revisionReason ?? "None"}`,
				],
			},
			{
				heading: "Evidence",
				lines: listLines(inquiry.evidenceIds),
			},
			{
				heading: "Identity",
				lines: [
					`Inquiry ID: ${inquiry.inquiryId}`,
					`Episode ID: ${inquiry.episodeId}`,
				],
			},
		],
	}));
}

function memoItems(
	snapshot: MemoSessionSnapshot,
): readonly ObserverWorkbenchItem[] {
	return snapshot.state.memos.flatMap((memo) =>
		memo.disposition === "superseded"
			? []
			: [
					{
						id: memo.memoId,
						kind: "memo" as const,
						label: "Memo",
						title: memo.title,
						summary: memo.content,
						state: memo.disposition,
						blocks: [
							{ heading: "Content", lines: [memo.content] },
							{
								heading: "Relations",
								lines: [
									`Inquiries: ${memo.inquiryIds.join(", ") || "None"}`,
									`Primary hypothesis: ${memo.hypothesisId ?? "None"}`,
									`Evidence: ${memo.evidenceIds.join(", ") || "None"}`,
								],
							},
							{
								heading: "Identity",
								lines: [
									`Memo ID: ${memo.memoId}`,
									`Revision: ${memo.currentRevisionId}`,
									`Durable base: ${memo.durableBase?.sha256 ?? "None"}`,
								],
							},
						],
					},
				],
	);
}

function proposalDiff(before: string | null, after: string): readonly string[] {
	return diffLines(before ?? "", after).map((entry) => {
		switch (entry.kind) {
			case "added":
				return `+ ${entry.text}`;
			case "removed":
				return `- ${entry.text}`;
			case "context":
				return `  ${entry.text}`;
			default:
				return assertNever(entry.kind);
		}
	});
}

function proposalRecordItems(
	review: SaveProposalReview,
): readonly ObserverWorkbenchItem[] {
	return review.records.map((record) => ({
		id: `proposal:${record.recordId}`,
		kind: "proposal-record",
		label: `${record.operation} ${record.recordType}`,
		title: record.title,
		summary: record.relativePath,
		state: record.operation,
		blocks: [
			{
				heading: "Target",
				lines: [
					`Operation: ${record.operation}`,
					`Type: ${record.recordType}`,
					`Path: ${record.relativePath}`,
					`Record ID: ${record.recordId}`,
				],
			},
			{
				heading: "Diff",
				lines: proposalDiff(record.beforeMarkdown, record.proposedMarkdown),
			},
			{
				heading: "Proposed Markdown",
				lines: record.proposedMarkdown.split("\n"),
			},
			...(record.beforeMarkdown === null
				? []
				: [
						{
							heading: "Existing Markdown",
							lines: record.beforeMarkdown.split("\n"),
						},
					]),
		],
	}));
}

function notebookItems(
	inventory: readonly NotebookInventoryEntry[],
): readonly ObserverWorkbenchItem[] {
	return inventory.map((entry) => ({
		id: `notebook:${entry.document.record.id}`,
		kind: "notebook-record",
		label: entry.document.record.observer_type,
		title: entry.document.h1,
		summary: entry.relativePath,
		state: entry.document.record.observer_status,
		blocks: [
			{
				heading: "Record",
				lines: [
					`Type: ${entry.document.record.observer_type}`,
					`Status: ${entry.document.record.observer_status}`,
					`Path: ${entry.relativePath}`,
					`SHA-256: ${entry.sha256}`,
				],
			},
			{
				heading: "Saved Markdown",
				lines: entry.content.split("\n"),
			},
		],
	}));
}

function proposalState(input: {
	readonly status: ObserverStatusView;
	readonly observationSnapshot: ObservationSessionSnapshot;
	readonly memoSnapshot: MemoSessionSnapshot;
	readonly saveRequestSession: SaveRequestSession;
	readonly inspection: ObserverWorkbenchProposalInspection;
}): ObserverWorkbenchProposal {
	if (input.inspection.kind === "ready") {
		const { review } = input.inspection;
		return {
			kind: "ready",
			proposalId: review.proposalId,
			summary: review.summary,
			createCount: review.records.filter(
				(record) => record.operation === "create",
			).length,
			updateCount: review.records.filter(
				(record) => record.operation === "update",
			).length,
			records: proposalRecordItems(review),
		};
	}
	if (input.inspection.kind === "invalid") return input.inspection;
	const pending = input.saveRequestSession.pendingRequest;
	if (pending) {
		return {
			kind: "preparing",
			stage: "proposal",
			requestId: pending.requestId,
			proposalId: pending.proposalId,
			observationCount: 0,
			sourceReadCount: pending.sourceReadIds.length,
			hasMemoRevision: pending.memoRevisionId !== null,
		};
	}
	const pendingMemo = input.observationSnapshot.pendingMemoRequest;
	const continuingReview =
		pendingMemo !== null &&
		input.observationSnapshot.reviewSaveContinuations.some(
			(continuation) => continuation.memoRequestId === pendingMemo.requestId,
		);
	if (pendingMemo && continuingReview) {
		return {
			kind: "preparing",
			stage: "memo-reconciliation",
			requestId: pendingMemo.requestId,
			proposalId: null,
			observationCount: pendingMemo.observationIds.length,
			sourceReadCount: 0,
			hasMemoRevision: pendingMemo.baseMemoRevisionId !== null,
		};
	}
	const activeMemos = input.memoSnapshot.state.memos.filter(
		(memo) => memo.disposition !== "superseded",
	).length;
	if (input.status.pendingObservations > 0 || activeMemos > 0) {
		return {
			kind: "needs-reconciliation",
			observationCount: input.status.pendingObservations,
			memoCount: activeMemos,
		};
	}
	return {
		kind: "not-requested",
		reviewAvailable: input.status.control.canReview,
	};
}

/** Projects replayed Observer state into one read-only inquiry workbench. */
export function observerWorkbenchView(input: {
	readonly status: ObserverStatusView;
	readonly observationSnapshot: ObservationSessionSnapshot;
	readonly memoSnapshot: MemoSessionSnapshot;
	readonly materialReviewSnapshot: MaterialReviewSession;
	readonly saveRequestSession: SaveRequestSession;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly proposalInspection: ObserverWorkbenchProposalInspection;
	readonly notebookInventoryIssue?: string;
}): ObserverWorkbenchView {
	return {
		status: input.status,
		activity: [
			...sourceReadItems(input.observationSnapshot),
			...observationItems(input.observationSnapshot),
			...hypothesisItems(input.observationSnapshot),
		],
		inquiries: inquiryItems(input.memoSnapshot),
		memos: memoItems(input.memoSnapshot),
		proposal: proposalState({
			status: input.status,
			observationSnapshot: input.observationSnapshot,
			memoSnapshot: input.memoSnapshot,
			saveRequestSession: input.saveRequestSession,
			inspection: input.proposalInspection,
		}),
		notebook: notebookItems(input.inventory),
		...(input.notebookInventoryIssue
			? { notebookInventoryIssue: input.notebookInventoryIssue }
			: {}),
		materialReviewPending: input.materialReviewSnapshot.pendingRequest !== null,
	};
}
