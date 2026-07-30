import type { EpisodeLanguage } from "./lifecycle.ts";
import type { MemoPassReceipt } from "./memo-reconciliation.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import type { NotebookStatus } from "./notebook-service.ts";
import type { ObservationSessionSnapshot } from "./observation-session.ts";
import type { MaterialReviewSession } from "./material-review-trigger.ts";
import type { ObserverPiSnapshot } from "./pi-session.ts";

function assertNever(value: never): never {
	throw new Error(`Unhandled Observer status value: ${String(value)}`);
}

export interface ObserverControlState {
	readonly mode: ObserverPiSnapshot["state"]["mode"];
	readonly episode: ObserverPiSnapshot["state"]["episode"]["status"];
	readonly notebook: NotebookStatus["status"];
	readonly notebookRoot?: string;
	readonly notebookDefaultLanguage?: EpisodeLanguage;
	readonly canChangeNotebook: boolean;
	readonly canMemo: boolean;
	readonly canReview: boolean;
	readonly canSave: boolean;
}

export interface ObserverMemoStatusItem {
	readonly memoId: string;
	readonly title: string;
	readonly disposition: string;
	readonly content: string;
}

export interface ObserverInquiryStatusItem {
	readonly inquiryId: string;
	readonly origin: "user" | "observer";
	readonly current: string;
}

export interface ObserverPendingMaterialReviewStatus {
	readonly requestId: string;
	readonly material: "inline-user-message" | "retrieved-tool-results";
	readonly phase:
		| "Awaiting retrieval"
		| "SourceRead required"
		| "Observation required"
		| "Ready to finish";
	readonly candidateCount: number;
	readonly sourceReadCount: number;
	readonly observationCount: number;
	readonly runState: "Active in current agent run" | "Suspended";
	readonly recovery: string;
}

export interface ObserverPreparedSaveStatus {
	readonly proposalId: string;
	readonly summary: string;
	readonly recordCount: number;
	readonly createCount: number;
	readonly updateCount: number;
}

export interface ObserverStatusView {
	readonly control: ObserverControlState;
	readonly mode: "On" | "Off";
	readonly episode: "Empty" | "Open" | "Ready to save" | "Settled";
	readonly notebook: string;
	readonly outputLanguage: string;
	readonly notebookHealth: string;
	readonly replayHealth: string;
	readonly sessionPersistence: "Persistent session" | "Ephemeral session";
	readonly preparedSave: string;
	readonly preparedSaveDetails?: ObserverPreparedSaveStatus;
	readonly preparedMemo: string;
	readonly pendingMemos: string;
	readonly pendingObservations: number;
	readonly memoItems: readonly ObserverMemoStatusItem[];
	readonly pendingHypothesisReviews: number;
	readonly pendingMaterialReview?: ObserverPendingMaterialReviewStatus;
	readonly openInquiries: string;
	readonly inquiryItems: readonly ObserverInquiryStatusItem[];
	readonly zettelCandidates: string;
	readonly processingMode: "Off" | "Piggyback" | "Local background";
	readonly processingDetail: string;
	readonly processingIssue?: string;
	readonly backgroundWork?: {
		readonly state: "Queued" | "Running" | "Deferred";
		readonly queued: number;
	};
	readonly backgroundIssue?: string;
	readonly automaticProcessingPause?: string;
	readonly operationalIssue?: string;
}

function episodeLabel(
	status: ObserverPiSnapshot["state"]["episode"]["status"],
): ObserverStatusView["episode"] {
	switch (status) {
		case "empty":
			return "Empty";
		case "open":
			return "Open";
		case "reviewing-save":
			return "Ready to save";
		case "settled":
			return "Settled";
		default:
			return assertNever(status);
	}
}

function notebookView(status: NotebookStatus): {
	readonly notebook: string;
	readonly health: string;
} {
	switch (status.status) {
		case "unselected":
			return { notebook: "Not selected", health: "Setup required" };
		case "ready":
			return { notebook: status.notebook.root, health: "Healthy" };
		case "unhealthy":
			return {
				notebook: status.issue.path ?? "Selection needs attention",
				health: `${status.issue.code}: ${status.issue.message}`,
			};
		default:
			return assertNever(status);
	}
}

function observerControlState(
	snapshot: ObserverPiSnapshot,
	observationSnapshot: ObservationSessionSnapshot,
	materialReviewSnapshot: MaterialReviewSession,
	notebookStatus: NotebookStatus,
): ObserverControlState {
	const episode = snapshot.state.episode.status;
	const liveEpisode = episode === "open" || episode === "reviewing-save";
	const readyNotebook =
		notebookStatus.status === "ready" ? notebookStatus.notebook : undefined;
	return {
		mode: snapshot.state.mode,
		episode,
		notebook: notebookStatus.status,
		...(readyNotebook
			? {
					notebookRoot: readyNotebook.root,
					notebookDefaultLanguage: readyNotebook.manifest.default_language,
				}
			: {}),
		canChangeNotebook: !liveEpisode,
		canMemo:
			episode === "open" &&
			observationSnapshot.pendingHypothesisReviews.length === 0,
		canReview:
			episode === "open" &&
			observationSnapshot.pendingHypothesisReviews.length === 0 &&
			materialReviewSnapshot.pendingRequest === null,
		canSave: episode === "reviewing-save",
	};
}

function workingCount(passes: number, count: number): string {
	return passes === 0 ? "Not counted yet" : String(count);
}

function pendingMaterialReviewStatus(input: {
	readonly materialReview: MaterialReviewSession;
	readonly observation: ObservationSessionSnapshot;
}): ObserverPendingMaterialReviewStatus | undefined {
	const pending = input.materialReview.pendingRequest;
	if (!pending) return undefined;
	const candidates = input.observation.candidates.filter(
		(candidate) => candidate.materialReviewRequestId === pending.requestId,
	);
	const candidateIds = new Set(
		candidates.map((candidate) => candidate.candidateId),
	);
	const reads = input.observation.sourceReads.filter(
		(read) => read.materialReviewRequestId === pending.requestId,
	);
	const coveredCandidateIds = new Set(
		reads.flatMap((read) => read.candidateIds),
	);
	const readIds = new Set(reads.map((read) => read.readId));
	const observations = input.observation.observations.filter((observation) =>
		readIds.has(observation.readId),
	);
	let phase: ObserverPendingMaterialReviewStatus["phase"];
	if (candidates.length === 0) phase = "Awaiting retrieval";
	else if (
		[...candidateIds].some(
			(candidateId) => !coveredCandidateIds.has(candidateId),
		)
	)
		phase = "SourceRead required";
	else if (observations.length < reads.length) phase = "Observation required";
	else phase = "Ready to finish";
	return {
		requestId: pending.requestId,
		material: pending.material,
		phase,
		candidateCount: candidates.length,
		sourceReadCount: reads.length,
		observationCount: observations.length,
		runState: "Suspended",
		recovery:
			"Run /observer material retry to resume the exact request, or /observer material cancel to discard it.",
	};
}

export function observerStatusView(input: {
	readonly snapshot: ObserverPiSnapshot;
	readonly memoSnapshot: MemoSessionSnapshot;
	readonly observationSnapshot: ObservationSessionSnapshot;
	readonly materialReviewSnapshot: MaterialReviewSession;
	readonly notebookStatus: NotebookStatus;
	readonly sessionFile: string | undefined;
	readonly operationalIssue?: string;
}): ObserverStatusView {
	const notebook = notebookView(input.notebookStatus);
	const episode = input.snapshot.state.episode;
	const working = input.memoSnapshot.state;
	const control = observerControlState(
		input.snapshot,
		input.observationSnapshot,
		input.materialReviewSnapshot,
		input.notebookStatus,
	);
	const pendingMaterialReview = pendingMaterialReviewStatus({
		materialReview: input.materialReviewSnapshot,
		observation: input.observationSnapshot,
	});
	return {
		control,
		mode: input.snapshot.state.mode === "on" ? "On" : "Off",
		episode: episodeLabel(episode.status),
		notebook: notebook.notebook,
		outputLanguage:
			control.notebookDefaultLanguage ??
			(episode.status === "empty" ? "Not set" : episode.core.lang),
		notebookHealth: notebook.health,
		replayHealth:
			input.snapshot.issues.length === 0 &&
			input.memoSnapshot.issues.length === 0 &&
			input.observationSnapshot.issues.length === 0 &&
			input.materialReviewSnapshot.issues.length === 0
				? "Healthy"
				: `${input.snapshot.issues.length + input.memoSnapshot.issues.length + input.observationSnapshot.issues.length + input.materialReviewSnapshot.issues.length} errors`,
		sessionPersistence: input.sessionFile
			? "Persistent session"
			: "Ephemeral session",
		preparedSave: input.snapshot.prepared
			? input.snapshot.prepared.handoff.prepared.proposal_id
			: "None",
		...(input.snapshot.prepared
			? {
					preparedSaveDetails: {
						proposalId: input.snapshot.prepared.handoff.prepared.proposal_id,
						summary: input.snapshot.prepared.handoff.summary,
						recordCount:
							input.snapshot.prepared.handoff.prepared.records.length,
						createCount:
							input.snapshot.prepared.handoff.prepared.records.filter(
								(record) => record.operation === "create",
							).length,
						updateCount:
							input.snapshot.prepared.handoff.prepared.records.filter(
								(record) => record.operation === "update",
							).length,
					},
				}
			: {}),
		preparedMemo: input.memoSnapshot.prepared?.passId ?? "None",
		pendingMemos: workingCount(
			working.passes,
			working.memos.filter((memo) => memo.disposition !== "superseded").length,
		),
		pendingObservations:
			input.observationSnapshot.unconsumedObservationIds.length,
		memoItems: working.memos.flatMap((memo) =>
			memo.disposition === "superseded"
				? []
				: [
						{
							memoId: memo.memoId,
							title: memo.title,
							disposition: memo.disposition,
							content: memo.content,
						},
					],
		),
		pendingHypothesisReviews:
			input.observationSnapshot.pendingHypothesisReviews.length,
		...(pendingMaterialReview ? { pendingMaterialReview } : {}),
		openInquiries: workingCount(working.passes, working.hypotheses.length),
		inquiryItems: working.hypotheses.map((hypothesis) => ({
			inquiryId: hypothesis.inquiryId,
			origin: hypothesis.origin,
			current: hypothesis.current,
		})),
		zettelCandidates: workingCount(
			working.passes,
			working.memos.filter((memo) => memo.disposition === "promotion-candidate")
				.length,
		),
		processingMode: "Piggyback",
		processingDetail: "No additional model request",
		...(input.operationalIssue
			? { operationalIssue: input.operationalIssue }
			: {}),
	};
}

export function renderObserverStatus(view: ObserverStatusView): string {
	return [
		`Observer mode: ${view.mode}`,
		`Episode: ${view.episode}`,
		`Notebook: ${view.notebook}`,
		`Output language: ${view.outputLanguage}`,
		`Notebook health: ${view.notebookHealth}`,
		`Session replay health: ${view.replayHealth}`,
		`Session persistence: ${view.sessionPersistence}`,
		`Prepared save proposal: ${view.preparedSave}`,
		...(view.preparedSaveDetails
			? [
					`- ${view.preparedSaveDetails.recordCount} records · create ${view.preparedSaveDetails.createCount} · update ${view.preparedSaveDetails.updateCount}`,
					`- ${view.preparedSaveDetails.summary}`,
				]
			: []),
		`Prepared Memo pass: ${view.preparedMemo}`,
		`Pending observations: ${view.pendingObservations}`,
		`Working Memos: ${view.pendingMemos}`,
		...view.memoItems.map(
			(memo) =>
				`- ${memo.title} [${memo.disposition}] (${memo.memoId})\n  ${memo.content}`,
		),
		`Pending hypothesis context reviews: ${view.pendingHypothesisReviews}`,
		...(view.pendingMaterialReview
			? [
					`Pending material review: ${view.pendingMaterialReview.requestId}`,
					`- ${view.pendingMaterialReview.material} · ${view.pendingMaterialReview.phase} · run ${view.pendingMaterialReview.runState}`,
					`- candidates ${view.pendingMaterialReview.candidateCount} · SourceReads ${view.pendingMaterialReview.sourceReadCount} · Observations ${view.pendingMaterialReview.observationCount}`,
					`- ${view.pendingMaterialReview.recovery}`,
				]
			: []),
		`Open Inquiries: ${view.openInquiries}`,
		...view.inquiryItems.map(
			(inquiry) =>
				`- [${inquiry.origin}] ${inquiry.current} (${inquiry.inquiryId})`,
		),
		`Zettel candidates: ${view.zettelCandidates}`,
		`Model processing: ${view.processingMode} · ${view.processingDetail}`,
		...(view.processingIssue
			? [`Processing settings: ${view.processingIssue}`]
			: []),
		...(view.backgroundWork
			? [
					`Background Observer: ${view.backgroundWork.state} · queued ${view.backgroundWork.queued}`,
				]
			: []),
		...(view.backgroundIssue
			? [`Background work deferred: ${view.backgroundIssue}`]
			: []),
		...(view.automaticProcessingPause
			? [`Automatic processing paused: ${view.automaticProcessingPause}`]
			: []),
		...(view.operationalIssue
			? [`Recovery required: ${view.operationalIssue}`]
			: []),
	].join("\n");
}

export function renderMemoPassReceipt(receipt: MemoPassReceipt): string {
	return [
		`Memo reconciliation completed: ${receipt.passId}`,
		`Working revision: ${receipt.revisionId}`,
		`Scope: Episode Memos ${receipt.scope.episodeMemos} · standing Inquiries ${receipt.scope.standingInquiries} · durable Memos ${receipt.scope.durableMemos}`,
		`Changes: ${receipt.summary}`,
	].join("\n");
}

export function renderObserverFooter(view: ObserverStatusView): string {
	const healthy =
		view.replayHealth === "Healthy" && !view.operationalIssue
			? "Healthy"
			: "Needs attention";
	return `Observer · ${view.mode} · ${view.episode} · ${healthy}`;
}
