import type { EpisodeLanguage } from "./lifecycle.ts";
import type { MemoPassReceipt } from "./memo-reconciliation.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import type { NotebookStatus } from "./notebook-service.ts";
import type { ObservationSessionSnapshot } from "./observation-session.ts";
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
	readonly canSave: boolean;
}

export interface ObserverStatusView {
	readonly control: ObserverControlState;
	readonly mode: "On" | "Off";
	readonly episode: "Empty" | "Open" | "Save review" | "Settled";
	readonly notebook: string;
	readonly outputLanguage: string;
	readonly notebookHealth: string;
	readonly replayHealth: string;
	readonly sessionPersistence: "Persistent session" | "Ephemeral session";
	readonly preparedSave: string;
	readonly preparedMemo: string;
	readonly pendingMemos: string;
	readonly pendingHypothesisReviews: number;
	readonly openInquiries: string;
	readonly zettelCandidates: string;
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
			return "Save review";
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
		canSave: liveEpisode,
	};
}

function workingCount(passes: number, count: number): string {
	return passes === 0 ? "Not counted yet" : String(count);
}

export function observerStatusView(input: {
	readonly snapshot: ObserverPiSnapshot;
	readonly memoSnapshot: MemoSessionSnapshot;
	readonly observationSnapshot: ObservationSessionSnapshot;
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
		input.notebookStatus,
	);
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
			input.observationSnapshot.issues.length === 0
				? "Healthy"
				: `${input.snapshot.issues.length + input.memoSnapshot.issues.length + input.observationSnapshot.issues.length} errors`,
		sessionPersistence: input.sessionFile
			? "Persistent session"
			: "Ephemeral session",
		preparedSave: input.snapshot.prepared
			? input.snapshot.prepared.handoff.prepared.proposal_id
			: "None",
		preparedMemo: input.memoSnapshot.prepared?.passId ?? "None",
		pendingMemos: workingCount(
			working.passes,
			working.memos.filter((memo) => memo.disposition !== "superseded").length,
		),
		pendingHypothesisReviews:
			input.observationSnapshot.pendingHypothesisReviews.length,
		openInquiries: workingCount(working.passes, working.hypotheses.length),
		zettelCandidates: workingCount(
			working.passes,
			working.memos.filter((memo) => memo.disposition === "promotion-candidate")
				.length,
		),
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
		`Prepared Review & Save proposal: ${view.preparedSave}`,
		`Prepared Memo pass: ${view.preparedMemo}`,
		`Pending Memos: ${view.pendingMemos}`,
		`Pending hypothesis context reviews: ${view.pendingHypothesisReviews}`,
		`Open Inquiries: ${view.openInquiries}`,
		`Zettel candidates: ${view.zettelCandidates}`,
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
