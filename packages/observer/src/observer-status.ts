import type { MemoPassReceipt } from "./memo-reconciliation.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import type { NotebookStatus } from "./notebook-service.ts";
import type { ObserverPiSnapshot } from "./pi-session.ts";

function assertNever(value: never): never {
	throw new Error(`Unhandled Observer status value: ${String(value)}`);
}

export interface ObserverStatusView {
	readonly mode: "켜짐" | "꺼짐";
	readonly episode: "비어 있음" | "열림" | "wrap 검토" | "정리됨";
	readonly notebook: string;
	readonly episodeLanguage: string;
	readonly notebookHealth: string;
	readonly replayHealth: string;
	readonly sessionPersistence: "지속 세션" | "임시 세션";
	readonly preparedWrap: string;
	readonly preparedMemo: string;
	readonly pendingMemos: string;
	readonly openInquiries: string;
	readonly zettelCandidates: string;
	readonly operationalIssue?: string;
}

function episodeLabel(
	status: ObserverPiSnapshot["state"]["episode"]["status"],
): ObserverStatusView["episode"] {
	switch (status) {
		case "empty":
			return "비어 있음";
		case "open":
			return "열림";
		case "reviewing-wrap":
			return "wrap 검토";
		case "settled":
			return "정리됨";
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
			return { notebook: "선택되지 않음", health: "설정 필요" };
		case "ready":
			return { notebook: status.notebook.root, health: "정상" };
		case "unhealthy":
			return {
				notebook: status.issue.path ?? "선택 정보 확인 필요",
				health: `${status.issue.code}: ${status.issue.message}`,
			};
		default:
			return assertNever(status);
	}
}

export function observerStatusView(input: {
	readonly snapshot: ObserverPiSnapshot;
	readonly memoSnapshot: MemoSessionSnapshot;
	readonly notebookStatus: NotebookStatus;
	readonly sessionFile: string | undefined;
	readonly operationalIssue?: string;
}): ObserverStatusView {
	const notebook = notebookView(input.notebookStatus);
	const episode = input.snapshot.state.episode;
	return {
		mode: input.snapshot.state.mode === "on" ? "켜짐" : "꺼짐",
		episode: episodeLabel(episode.status),
		notebook: notebook.notebook,
		episodeLanguage:
			episode.status === "empty" ? "아직 고정되지 않음" : episode.core.lang,
		notebookHealth: notebook.health,
		replayHealth:
			input.snapshot.issues.length === 0 && input.memoSnapshot.issues.length === 0
				? "정상"
				: `오류 ${input.snapshot.issues.length + input.memoSnapshot.issues.length}개`,
		sessionPersistence: input.sessionFile ? "지속 세션" : "임시 세션",
		preparedWrap: input.snapshot.prepared
			? input.snapshot.prepared.handoff.prepared.proposal_id
			: "없음",
		preparedMemo: input.memoSnapshot.prepared?.passId ?? "없음",
		pendingMemos:
			input.memoSnapshot.state.passes === 0
				? "아직 집계되지 않음"
				: String(
						input.memoSnapshot.state.memos.filter(
							(memo) => memo.disposition !== "superseded",
						).length,
					),
		openInquiries:
			input.memoSnapshot.state.passes === 0
				? "아직 집계되지 않음"
				: String(input.memoSnapshot.state.hypotheses.length),
		zettelCandidates:
			input.memoSnapshot.state.passes === 0
				? "아직 집계되지 않음"
				: String(
						input.memoSnapshot.state.memos.filter(
							(memo) => memo.disposition === "promotion-candidate",
						).length,
					),
		...(input.operationalIssue
			? { operationalIssue: input.operationalIssue }
			: {}),
	};
}

export function renderObserverStatus(view: ObserverStatusView): string {
	return [
		`Observer 모드: ${view.mode}`,
		`에피소드: ${view.episode}`,
		`노트북: ${view.notebook}`,
		`에피소드 출력 언어: ${view.episodeLanguage}`,
		`노트북 상태: ${view.notebookHealth}`,
		`세션 replay 상태: ${view.replayHealth}`,
		`세션 저장: ${view.sessionPersistence}`,
		`준비된 wrap: ${view.preparedWrap}`,
		`준비된 Memo pass: ${view.preparedMemo}`,
		`Pending Memo 수: ${view.pendingMemos}`,
		`Open Inquiry 수: ${view.openInquiries}`,
		`Zettel 후보 수: ${view.zettelCandidates}`,
		...(view.operationalIssue ? [`복구 필요: ${view.operationalIssue}`] : []),
	].join("\n");
}

export function renderMemoPassReceipt(receipt: MemoPassReceipt): string {
	return [
		`Memo reconciliation 완료: ${receipt.passId}`,
		`작업 revision: ${receipt.revisionId}`,
		`범위: episode Memo ${receipt.scope.episodeMemos} · standing Inquiry ${receipt.scope.standingInquiries} · durable Memo ${receipt.scope.durableMemos}`,
		`변경: ${receipt.summary}`,
	].join("\n");
}

export function renderObserverFooter(view: ObserverStatusView): string {
	const healthy =
		view.replayHealth === "정상" && !view.operationalIssue
			? "정상"
			: "확인 필요";
	return `Observer · ${view.mode} · ${view.episode} · ${healthy}`;
}
