import { isAbsolute } from "node:path";

import {
	applyObserverEvent,
	OBSERVER_PROTOCOL,
	type ActivationChangedEvent,
	type EpisodeOpenedEvent,
	type NotebookSelectedEvent,
	type ObserverEvent,
	type WrapCancelledEvent,
	type WrapCommittedEvent,
	type WrapProposedEvent,
} from "./lifecycle.ts";
import {
	decodePreparedMemoPass,
	encodePreparedMemoPass,
	type PreparedMemoPass,
} from "./memo-profile.ts";
import {
	hydrateMemoScope,
	reconcileMemoPass,
	type MemoScopeSnapshot,
} from "./memo-reconciliation.ts";
import { hydratePreparedObservationMemoContext } from "./memo-trigger.ts";
import {
	encodeAppliedMemoPass,
	memoAcknowledgmentEvent,
	OBSERVER_APPLIED_MEMO_ENTRY,
	OBSERVER_PREPARED_MEMO_ENTRY,
	reconstructMemoSession,
	type MemoSessionSnapshot,
} from "./memo-session.ts";
import {
	completeObserveArgs,
	parseObserveCommand,
	type ObserveCommand,
} from "./observer-command.ts";
import {
	createNotebookService,
	type NotebookService,
} from "./notebook-service.ts";
import {
	readNotebookInventory,
	type NotebookInventoryEntry,
} from "./notebook.ts";
import type { NotebookSelectionStore } from "./notebook-selection-store.ts";
import type { OneShotIntent, OneShotRequestId } from "./one-shot-trigger.ts";
import {
	observerStatusView,
	renderMemoPassReceipt,
	renderObserverFooter,
	renderObserverStatus,
} from "./observer-status.ts";
import {
	decodePreparedWrapHandoff,
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_WRAP_ENTRY,
	OBSERVER_WRAP_ATTEMPT_ENTRY,
	OBSERVER_WRAP_ATTEMPT_PROTOCOL,
	preparedWrapDigest,
	reconstructObserverPiState,
	type ApprovedWrapAttempt,
	type ObserverPiSnapshot,
	type PiBranchEntryLike,
	type PreparedWrapHandoff,
} from "./pi-session.ts";
import {
	inspectWrapAcknowledgment,
	type WrapAcknowledgmentInspection,
} from "./wrap-acknowledgment.ts";
import {
	OBSERVER_WRAP_APPROVAL_SCHEMA,
	type WrapReceipt,
} from "./wrap-profile.ts";
import { createWrapService, type WrapService } from "./wrap-service.ts";

export interface ObserverCommandPort {
	branchEntries(): readonly PiBranchEntryLike[];
	sessionFile(): string | undefined;
	appendEntry(customType: string, data: unknown): void;
	input(title: string, placeholder?: string): Promise<string | undefined>;
	select(title: string, options: string[]): Promise<string | undefined>;
	confirm(title: string, message: string): Promise<boolean>;
	notify(message: string, type?: "info" | "warning" | "error"): void;
	setStatus(text: string | undefined): void;
}

export interface ObserverControllerIds {
	episodeId(): string;
	attemptId(): string;
	receiptId(): `receipt-${string}`;
	memoRevisionId(): string;
	memoReceiptId(): `memo-receipt-${string}`;
}

const ONE_SHOT_EPISODE_CAPABILITY = Symbol(
	"observer.one-shot-episode-capability",
);

export interface OneShotEpisodeCapability {
	readonly [ONE_SHOT_EPISODE_CAPABILITY]: true;
	readonly requestId: OneShotRequestId;
	readonly userMessageDigest: string;
	readonly material: "inline-user-message" | "retrieved-tool-results";
	readonly inputSource: "interactive" | "rpc";
	readonly episodeId: string;
	readonly notebookId: string;
	readonly lang: "ko" | "en";
}

export type OneShotEpisodeResult =
	| {
			readonly ok: true;
			readonly status: "opened" | "resumed";
			readonly value: OneShotEpisodeCapability;
	  }
	| { readonly ok: false; readonly message: string };

export interface ObserverController {
	bind(port: ObserverCommandPort): Promise<void>;
	refresh(port: ObserverCommandPort): Promise<void>;
	command(args: string, port: ObserverCommandPort): Promise<void>;
	installPrepared(value: unknown, port: ObserverCommandPort): Promise<boolean>;
	installPreparedMemo(
		value: unknown,
		port: ObserverCommandPort,
	): Promise<boolean>;
	ensureOneShotEpisode(
		intent: OneShotIntent,
		port: ObserverCommandPort,
	): Promise<OneShotEpisodeResult>;
	unbind(): void;
}

export { completeObserveArgs };

interface ControllerDependencies {
	readonly selectionStore: NotebookSelectionStore;
	readonly ids: ObserverControllerIds;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled Observer command: ${String(value)}`);
}

interface SynchronizationResult {
	readonly snapshot: ObserverPiSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly operationalIssue?: string;
}

function notebookSelected(notebookId: string): NotebookSelectedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "notebook-selected",
		notebookId,
	};
}

function episodeOpened(input: {
	readonly episodeId: string;
	readonly notebookId: string;
	readonly lang: "ko" | "en";
}): EpisodeOpenedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId: input.episodeId,
		notebookId: input.notebookId,
		lang: input.lang,
	};
}

function activationChanged(enabled: boolean): ActivationChangedEvent {
	return { protocol: OBSERVER_PROTOCOL, kind: "activation-changed", enabled };
}

function wrapProposed(handoff: PreparedWrapHandoff): WrapProposedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-proposed",
		proposalId: handoff.prepared.proposal_id,
		summary: handoff.summary,
	};
}

function wrapCancelled(proposalId: string): WrapCancelledEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-cancelled",
		proposalId,
	};
}

function wrapCommitted(receipt: WrapReceipt): WrapCommittedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-committed",
		proposalId: receipt.proposal_id,
		receipt: {
			receiptId: receipt.receipt_id,
			status: "validated",
			recordIds: receipt.records.map((record) => record.record_id),
		},
	};
}

function approvedAttempt(
	handoff: PreparedWrapHandoff,
	attemptId: string,
): ApprovedWrapAttempt {
	return {
		protocol: OBSERVER_WRAP_ATTEMPT_PROTOCOL,
		kind: "approved",
		attemptId,
		proposalId: handoff.prepared.proposal_id,
		preparedDigest: preparedWrapDigest(handoff),
	};
}

function notifyReplayIssue(
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
): boolean {
	if (snapshot.issues.length === 0) return false;
	const first = snapshot.issues[0];
	port.notify(
		`Observer session history를 확인해야 합니다: ${first?.code ?? "unknown"}.`,
		"error",
	);
	return true;
}

function notifyMemoReplayIssue(
	snapshot: MemoSessionSnapshot,
	port: ObserverCommandPort,
): boolean {
	if (snapshot.issues.length === 0) return false;
	const first = snapshot.issues[0];
	port.notify(
		`Observer Memo history를 확인해야 합니다: ${first?.code ?? "unknown"}.`,
		"error",
	);
	return true;
}

function appendLifecycle(
	port: ObserverCommandPort,
	snapshot: ObserverPiSnapshot,
	event: ObserverEvent,
): ObserverPiSnapshot | null {
	const projection = applyObserverEvent(snapshot.state, event);
	if (!projection.applied) {
		port.notify(
			`Observer 상태 전이가 거부되었습니다: ${projection.reason}.`,
			"error",
		);
		return null;
	}
	port.appendEntry(OBSERVER_LIFECYCLE_ENTRY, event);
	const replayed = reconstructObserverPiState(port.branchEntries());
	if (replayed.issues.length > snapshot.issues.length) {
		port.notify("Observer session entry를 적용하지 못했습니다.", "error");
		return null;
	}
	return replayed;
}

function matchingOpenEpisode(
	snapshot: ObserverPiSnapshot,
	handoff: PreparedWrapHandoff,
): boolean {
	const episode = snapshot.state.episode;
	return (
		episode.status === "open" &&
		snapshot.state.selectedNotebookId === handoff.prepared.notebook_id &&
		episode.core.notebookId === handoff.prepared.notebook_id &&
		episode.core.lang === handoff.prepared.episode_language
	);
}

async function promptSetup(
	port: ObserverCommandPort,
): Promise<ObserveCommand | null> {
	const root = await port.input(
		"Observer notebook 위치",
		"사용자가 소유한 folder의 절대 경로",
	);
	if (root === undefined) return null;
	const language = await port.select("기본 Markdown 언어", ["ko", "en"]);
	if (language === undefined) return null;
	if (!isAbsolute(root) || (language !== "ko" && language !== "en")) {
		port.notify("Notebook 절대 경로와 ko 또는 en이 필요합니다.", "warning");
		return null;
	}
	return { kind: "setup", root, lang: language };
}

function resolveCommand(
	args: string,
	port: ObserverCommandPort,
): Promise<ObserveCommand | null> {
	const parsed = parseObserveCommand(args);
	if (!parsed.ok) {
		port.notify(parsed.message, "warning");
		return Promise.resolve(null);
	}
	if (parsed.command.kind === "setup-prompt") return promptSetup(port);
	return Promise.resolve(parsed.command);
}

function renderPreparedPlan(handoff: PreparedWrapHandoff): string {
	const operations = handoff.prepared.records.map(
		(record) => `- ${record.operation}: ${record.record_id}`,
	);
	return [
		handoff.summary,
		"",
		`Notebook: ${handoff.prepared.root}`,
		`언어: ${handoff.prepared.episode_language}`,
		`기록 수: ${handoff.prepared.records.length}`,
		...operations,
	].join("\n");
}

async function refreshStatus(
	port: ObserverCommandPort,
	notebooks: NotebookService,
	operationalIssue?: string,
): Promise<void> {
	const snapshot = reconstructObserverPiState(port.branchEntries());
	const memoSnapshot = reconstructMemoSession(port.branchEntries());
	const notebookStatus = await notebooks.status();
	const view = observerStatusView({
		snapshot,
		memoSnapshot,
		notebookStatus,
		sessionFile: port.sessionFile(),
		...(operationalIssue ? { operationalIssue } : {}),
	});
	port.setStatus(renderObserverFooter(view));
}

async function showStatus(
	port: ObserverCommandPort,
	notebooks: NotebookService,
	operationalIssue?: string,
): Promise<void> {
	const snapshot = reconstructObserverPiState(port.branchEntries());
	const memoSnapshot = reconstructMemoSession(port.branchEntries());
	const notebookStatus = await notebooks.status();
	const view = observerStatusView({
		snapshot,
		memoSnapshot,
		notebookStatus,
		sessionFile: port.sessionFile(),
		...(operationalIssue ? { operationalIssue } : {}),
	});
	port.setStatus(renderObserverFooter(view));
	port.notify(renderObserverStatus(view), "info");
}

async function acknowledgmentInspection(
	snapshot: ObserverPiSnapshot,
	notebooks: NotebookService,
	ids: ObserverControllerIds,
): Promise<WrapAcknowledgmentInspection | null> {
	if (
		!snapshot.attempt ||
		!snapshot.prepared ||
		snapshot.state.episode.status !== "reviewing-wrap"
	) {
		return null;
	}
	const recovered = await notebooks.recover(snapshot.state);
	if (!recovered.ok) {
		return { status: "invalid", message: recovered.issue.message };
	}
	return inspectWrapAcknowledgment({
		notebook: recovered.value.notebook,
		prepared: snapshot.prepared.handoff.prepared,
		dependencies: { receiptId: ids.receiptId },
	});
}

async function synchronize(
	port: ObserverCommandPort,
	notebooks: NotebookService,
	ids: ObserverControllerIds,
): Promise<SynchronizationResult> {
	let snapshot = reconstructObserverPiState(port.branchEntries());
	let memo = reconstructMemoSession(port.branchEntries());
	if (snapshot.issues.length > 0 || memo.issues.length > 0) {
		return { snapshot, memo };
	}
	const inspection = await acknowledgmentInspection(snapshot, notebooks, ids);
	if (inspection?.status === "final") {
		const committed = appendLifecycle(
			port,
			snapshot,
			wrapCommitted(inspection.receipt),
		);
		if (!committed) {
			return {
				snapshot,
				memo,
				operationalIssue: "저장 완료 acknowledgment를 복구하지 못했습니다.",
			};
		}
		snapshot = committed;
		memo = reconstructMemoSession(port.branchEntries());
	} else if (inspection && inspection.status !== "before") {
		return { snapshot, memo, operationalIssue: inspection.message };
	}
	if (memo.issues.length > 0 || !memo.pendingAcknowledgment) {
		return { snapshot, memo };
	}
	try {
		const acknowledged = appendLifecycle(
			port,
			snapshot,
			memoAcknowledgmentEvent(memo.pendingAcknowledgment),
		);
		if (!acknowledged) {
			return {
				snapshot,
				memo,
				operationalIssue: "Memo acknowledgment를 복구하지 못했습니다.",
			};
		}
		snapshot = acknowledged;
		memo = reconstructMemoSession(port.branchEntries());
		return memo.issues.length === 0 && !memo.pendingAcknowledgment
			? { snapshot, memo }
			: {
					snapshot,
					memo,
					operationalIssue: "Memo acknowledgment 복구 결과를 확인해야 합니다.",
				};
	} catch (error) {
		return {
			snapshot,
			memo,
			operationalIssue: `Memo acknowledgment 기록 실패: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

async function setupCommand(
	command: Extract<ObserveCommand, { readonly kind: "setup" }>,
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
	notebooks: NotebookService,
): Promise<void> {
	const setup = await notebooks.setup({
		root: command.root,
		defaultLanguage: command.lang,
		state: snapshot.state,
	});
	if (!setup.ok) {
		port.notify(`Notebook setup 실패: ${setup.issue.message}`, "error");
		return;
	}
	if (
		snapshot.state.selectedNotebookId !==
		setup.value.notebook.manifest.notebook_id
	) {
		appendLifecycle(
			port,
			snapshot,
			notebookSelected(setup.value.notebook.manifest.notebook_id),
		);
	}
	port.notify(
		`Observer notebook을 선택했습니다: ${setup.value.notebook.root} (${command.lang})`,
		"info",
	);
}

type OneShotLifecycleAppendResult =
	| { readonly ok: true; readonly snapshot: ObserverPiSnapshot }
	| { readonly ok: false; readonly message: string };

function appendOneShotLifecycle(input: {
	readonly port: ObserverCommandPort;
	readonly snapshot: ObserverPiSnapshot;
	readonly event: ObserverEvent;
	readonly label: string;
}): OneShotLifecycleAppendResult {
	try {
		const snapshot = appendLifecycle(input.port, input.snapshot, input.event);
		return snapshot
			? { ok: true, snapshot }
			: {
					ok: false,
					message: `${input.label}을 replay에서 확인하지 못했습니다.`,
				};
	} catch (error) {
		return {
			ok: false,
			message: `${input.label} 기록 실패: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

function oneShotSynchronizationIssue(input: {
	readonly synchronized: SynchronizationResult;
	readonly port: ObserverCommandPort;
	readonly operationalIssue?: string;
}): string | null {
	if (
		notifyReplayIssue(input.synchronized.snapshot, input.port) ||
		notifyMemoReplayIssue(input.synchronized.memo, input.port)
	)
		return "Observer branch history를 확인해야 합니다.";
	const issue = input.operationalIssue ?? input.synchronized.operationalIssue;
	if (issue) return `Observer 복구가 필요합니다: ${issue}`;
	if (input.synchronized.snapshot.state.mode !== "off")
		return "One-shot은 Observer Mode가 OFF일 때만 시작할 수 있습니다.";
	return input.synchronized.snapshot.state.episode.status === "reviewing-wrap"
		? "Wrap proposal 검토 중에는 One-shot을 시작할 수 없습니다."
		: null;
}

async function ensureOneShotEpisodeCommand(input: {
	readonly intent: OneShotIntent;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObserverControllerIds;
	readonly operationalIssue?: string;
}): Promise<OneShotEpisodeResult> {
	const synchronized = await synchronize(
		input.port,
		input.notebooks,
		input.ids,
	);
	const synchronizationIssue = oneShotSynchronizationIssue({
		synchronized,
		port: input.port,
		...(input.operationalIssue
			? { operationalIssue: input.operationalIssue }
			: {}),
	});
	if (synchronizationIssue) return { ok: false, message: synchronizationIssue };
	const recovered = await input.notebooks.recover(synchronized.snapshot.state);
	if (!recovered.ok)
		return {
			ok: false,
			message: `One-shot notebook 복구 실패: ${recovered.issue.message}`,
		};
	let current = synchronized.snapshot;
	let status: "opened" | "resumed" = "resumed";
	const notebookId = recovered.value.notebook.manifest.notebook_id;
	if (current.state.selectedNotebookId !== notebookId) {
		const selected = appendOneShotLifecycle({
			port: input.port,
			snapshot: current,
			event: notebookSelected(notebookId),
			label: "One-shot notebook selection",
		});
		if (!selected.ok) return selected;
		current = selected.snapshot;
	}
	if (
		current.state.episode.status === "empty" ||
		current.state.episode.status === "settled"
	) {
		const opened = appendOneShotLifecycle({
			port: input.port,
			snapshot: current,
			event: episodeOpened({
				episodeId: input.ids.episodeId(),
				notebookId,
				lang: recovered.value.notebook.manifest.default_language,
			}),
			label: "One-shot Episode open",
		});
		if (!opened.ok) return opened;
		current = opened.snapshot;
		status = "opened";
	}
	if (
		current.state.mode !== "off" ||
		current.state.episode.status !== "open" ||
		current.state.episode.core.notebookId !== notebookId
	)
		return {
			ok: false,
			message: "One-shot OPEN/OFF lifecycle capability를 확립하지 못했습니다.",
		};
	return {
		ok: true,
		status,
		value: {
			[ONE_SHOT_EPISODE_CAPABILITY]: true,
			requestId: input.intent.requestId,
			userMessageDigest: input.intent.userMessageDigest,
			material: input.intent.material,
			inputSource: input.intent.inputSource,
			episodeId: current.state.episode.core.episodeId,
			notebookId,
			lang: current.state.episode.core.lang,
		},
	};
}

async function onCommand(
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
	notebooks: NotebookService,
	ids: ObserverControllerIds,
): Promise<void> {
	const recovered = await notebooks.recover(snapshot.state);
	if (!recovered.ok) {
		port.notify(`Observer on 실패: ${recovered.issue.message}`, "error");
		return;
	}
	let current = snapshot;
	const notebookId = recovered.value.notebook.manifest.notebook_id;
	if (current.state.selectedNotebookId !== notebookId) {
		const selected = appendLifecycle(
			port,
			current,
			notebookSelected(notebookId),
		);
		if (!selected) return;
		current = selected;
	}
	if (
		current.state.episode.status === "empty" ||
		current.state.episode.status === "settled"
	) {
		const opened = appendLifecycle(
			port,
			current,
			episodeOpened({
				episodeId: ids.episodeId(),
				notebookId,
				lang: recovered.value.notebook.manifest.default_language,
			}),
		);
		if (!opened) return;
		current = opened;
	}
	if (current.state.mode === "off") {
		const activated = appendLifecycle(port, current, activationChanged(true));
		if (!activated) return;
	}
	port.notify("Observer를 켰습니다.", "info");
}

function offCommand(
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
): void {
	if (snapshot.state.mode === "off") {
		port.notify("Observer는 이미 꺼져 있습니다.", "info");
		return;
	}
	if (!appendLifecycle(port, snapshot, activationChanged(false))) return;
	port.notify("Observer를 껐습니다. 열린 episode는 유지됩니다.", "info");
}

async function wrapCommand(
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
	wraps: WrapService,
	ids: ObserverControllerIds,
): Promise<void> {
	if (
		snapshot.state.episode.status !== "reviewing-wrap" ||
		!snapshot.prepared
	) {
		port.notify("검토할 prepared wrap proposal이 없습니다.", "warning");
		return;
	}
	const approved = await port.confirm(
		"Observer wrap 승인",
		renderPreparedPlan(snapshot.prepared.handoff),
	);
	if (!approved) {
		appendLifecycle(
			port,
			snapshot,
			wrapCancelled(snapshot.prepared.handoff.prepared.proposal_id),
		);
		port.notify("Wrap을 취소했습니다. Episode와 Mode를 유지합니다.", "info");
		return;
	}
	let current = snapshot;
	if (!current.attempt) {
		const currentPrepared = current.prepared;
		if (!currentPrepared) {
			port.notify("승인할 prepared wrap을 찾지 못했습니다.", "error");
			return;
		}
		port.appendEntry(
			OBSERVER_WRAP_ATTEMPT_ENTRY,
			approvedAttempt(currentPrepared.handoff, ids.attemptId()),
		);
		current = reconstructObserverPiState(port.branchEntries());
		if (notifyReplayIssue(current, port)) return;
	}
	const prepared = current.prepared?.handoff;
	if (!prepared) {
		port.notify("승인된 prepared wrap을 복구하지 못했습니다.", "error");
		return;
	}
	const saved = await wraps.commit({
		state: current.state,
		prepared: prepared.prepared,
		approval: {
			observer_approval: OBSERVER_WRAP_APPROVAL_SCHEMA,
			proposal_id: prepared.prepared.proposal_id,
			approved: true,
		},
	});
	if (!saved.ok) {
		port.notify(`Wrap 저장 실패: ${saved.issue.message}`, "error");
		return;
	}
	if (!appendLifecycle(port, current, wrapCommitted(saved.value.receipt)))
		return;
	port.notify(
		`Wrap 저장 완료: ${saved.value.receipt.records.length}개 record`,
		"info",
	);
}

async function memoCommand(input: {
	readonly snapshot: ObserverPiSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObserverControllerIds;
}): Promise<string | undefined> {
	if (!input.memo.prepared) {
		input.port.notify(
			input.memo.state.lastReceipt
				? `새 prepared reconciliation이 없습니다.\n${renderMemoPassReceipt(input.memo.state.lastReceipt)}`
				: "새 prepared reconciliation이 없습니다.",
			"info",
		);
		return undefined;
	}
	if (input.snapshot.state.episode.status !== "open") {
		input.port.notify(
			"Memo reconciliation에는 열린 Episode가 필요합니다.",
			"warning",
		);
		return undefined;
	}
	const recovered = await input.notebooks.recover(input.snapshot.state);
	if (!recovered.ok) {
		input.port.notify(
			`Notebook 복구 실패: ${recovered.issue.message}`,
			"error",
		);
		return undefined;
	}
	const inventory = await readNotebookInventory(recovered.value.notebook);
	if (!inventory.ok) {
		input.port.notify(
			`Notebook 읽기 실패: ${inventory.issue.message}`,
			"error",
		);
		return undefined;
	}
	const scope = preparedMemoScope({
		pass: input.memo.prepared,
		lifecycle: input.snapshot.state,
		memo: input.memo,
		entries: input.port.branchEntries(),
		inventory: inventory.value,
	});
	if (!scope.ok) {
		input.port.notify(scope.message, "error");
		return undefined;
	}
	const reconciled = reconcileMemoPass({
		state: input.memo.state,
		scope: scope.value,
		pass: input.memo.prepared,
		ids: {
			revisionId: input.ids.memoRevisionId,
			receiptId: input.ids.memoReceiptId,
		},
	});
	if (!reconciled.ok) {
		input.port.notify(
			`Memo reconciliation 거부: ${reconciled.issue.message}`,
			"error",
		);
		return undefined;
	}
	try {
		input.port.appendEntry(
			OBSERVER_APPLIED_MEMO_ENTRY,
			encodeAppliedMemoPass({
				pass: input.memo.prepared,
				scope: scope.value,
				receipt: reconciled.value.receipt,
			}),
		);
	} catch (error) {
		input.port.notify(
			`Memo working entry 기록 실패: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
		return undefined;
	}
	const appliedMemo = reconstructMemoSession(input.port.branchEntries());
	if (
		notifyMemoReplayIssue(appliedMemo, input.port) ||
		!appliedMemo.pendingAcknowledgment
	) {
		return "Memo working entry 결과를 확인해야 합니다.";
	}
	try {
		const current = reconstructObserverPiState(input.port.branchEntries());
		const acknowledged = appendLifecycle(
			input.port,
			current,
			memoAcknowledgmentEvent(appliedMemo.pendingAcknowledgment),
		);
		if (!acknowledged) return "Memo acknowledgment를 기록하지 못했습니다.";
	} catch (error) {
		input.port.notify(
			"Memo working state는 기록되었지만 lifecycle acknowledgment가 남았습니다. 다음 bind/명령에서 복구합니다.",
			"warning",
		);
		return `Memo acknowledgment 기록 실패: ${error instanceof Error ? error.message : String(error)}`;
	}
	const completed = reconstructMemoSession(input.port.branchEntries());
	if (completed.issues.length > 0 || completed.pendingAcknowledgment) {
		return "Memo acknowledgment 결과를 확인해야 합니다.";
	}
	input.port.notify(renderMemoPassReceipt(reconciled.value.receipt), "info");
	return undefined;
}

type PreparedMemoScopeResult =
	| { readonly ok: true; readonly value: MemoScopeSnapshot }
	| { readonly ok: false; readonly message: string };

function preparedMemoScope(input: {
	readonly pass: PreparedMemoPass;
	readonly lifecycle: ObserverPiSnapshot["state"];
	readonly memo: MemoSessionSnapshot;
	readonly entries: readonly PiBranchEntryLike[];
	readonly inventory: readonly NotebookInventoryEntry[];
}): PreparedMemoScopeResult {
	if (input.pass.instructionId) {
		const context = hydratePreparedObservationMemoContext({
			entries: input.entries,
			memo: input.memo,
			inventory: input.inventory,
			instructionId: input.pass.instructionId,
		});
		return context.ok
			? { ok: true, value: context.value.memoScope }
			: {
					ok: false,
					message: `Memo request scope 구성 실패: ${context.issue.message}`,
				};
	}
	const hydrated = hydrateMemoScope({
		lifecycle: input.lifecycle,
		working: input.memo.state,
		inventory: input.inventory,
		relatedInquiryIds: input.pass.relatedInquiryIds,
		workingSourceBases: [],
	});
	return hydrated.ok
		? { ok: true, value: hydrated.value }
		: {
				ok: false,
				message: `Memo scope 구성 실패: ${hydrated.issue.message}`,
			};
}

async function validatePreparedMemo(input: {
	readonly pass: PreparedMemoPass;
	readonly snapshot: ObserverPiSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly entries: readonly PiBranchEntryLike[];
	readonly notebooks: NotebookService;
}): Promise<string | null> {
	if (
		input.snapshot.state.episode.status !== "open" ||
		input.pass.episodeId !== input.snapshot.state.episode.core.episodeId ||
		input.pass.baseRevisionId !== input.memo.state.revisionId
	) {
		return "Prepared Memo pass가 현재 열린 Episode/revision과 일치하지 않습니다.";
	}
	const recovered = await input.notebooks.recover(input.snapshot.state);
	if (!recovered.ok) return `Notebook 복구 실패: ${recovered.issue.message}`;
	const inventory = await readNotebookInventory(recovered.value.notebook);
	if (!inventory.ok) return `Notebook 읽기 실패: ${inventory.issue.message}`;
	const scope = preparedMemoScope({
		pass: input.pass,
		lifecycle: input.snapshot.state,
		memo: input.memo,
		entries: input.entries,
		inventory: inventory.value,
	});
	if (!scope.ok) return scope.message;
	const validated = reconcileMemoPass({
		state: input.memo.state,
		scope: scope.value,
		pass: input.pass,
		ids: {
			revisionId() {
				return "memo-working-revision-00000000-0000-4000-8000-000000000000";
			},
			receiptId(): `memo-receipt-${string}` {
				return "memo-receipt-00000000-0000-4000-8000-000000000000";
			},
		},
	});
	return validated.ok
		? null
		: `Memo pass 검증 실패: ${validated.issue.message}`;
}

async function executeObserverCommand(input: {
	readonly args: string;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly wraps: WrapService;
	readonly ids: ObserverControllerIds;
	readonly operationalIssue?: string;
}): Promise<string | undefined> {
	const parsed = await resolveCommand(input.args, input.port);
	if (!parsed) return input.operationalIssue;
	if (parsed.kind === "status") {
		await showStatus(input.port, input.notebooks, input.operationalIssue);
		return input.operationalIssue;
	}
	const synchronized = await synchronize(
		input.port,
		input.notebooks,
		input.ids,
	);
	let operationalIssue = synchronized.operationalIssue;
	if (
		notifyReplayIssue(synchronized.snapshot, input.port) ||
		notifyMemoReplayIssue(synchronized.memo, input.port) ||
		operationalIssue
	) {
		if (operationalIssue) {
			input.port.notify(
				`Observer 복구가 필요합니다: ${operationalIssue}`,
				"error",
			);
		}
		await refreshStatus(input.port, input.notebooks, operationalIssue);
		return operationalIssue;
	}
	switch (parsed.kind) {
		case "setup":
			await setupCommand(
				parsed,
				synchronized.snapshot,
				input.port,
				input.notebooks,
			);
			break;
		case "on":
			await onCommand(
				synchronized.snapshot,
				input.port,
				input.notebooks,
				input.ids,
			);
			break;
		case "off":
			offCommand(synchronized.snapshot, input.port);
			break;
		case "wrap":
			await wrapCommand(
				synchronized.snapshot,
				input.port,
				input.wraps,
				input.ids,
			);
			break;
		case "memo":
			operationalIssue = await memoCommand({
				snapshot: synchronized.snapshot,
				memo: synchronized.memo,
				port: input.port,
				notebooks: input.notebooks,
				ids: input.ids,
			});
			break;
		case "settings-unavailable":
			input.port.notify(
				"설정 변경은 아직 제공되지 않습니다. setup을 사용하세요.",
				"info",
			);
			break;
		case "setup-prompt":
			break;
		default:
			assertNever(parsed);
	}
	await refreshStatus(input.port, input.notebooks, operationalIssue);
	return operationalIssue;
}

async function installPreparedCommand(input: {
	readonly value: unknown;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly operationalIssue?: string;
}): Promise<boolean> {
	const snapshot = reconstructObserverPiState(input.port.branchEntries());
	if (notifyReplayIssue(snapshot, input.port)) return false;
	if (input.operationalIssue) {
		input.port.notify(
			`Observer 복구가 필요합니다: ${input.operationalIssue}`,
			"error",
		);
		return false;
	}
	const decoded = decodePreparedWrapHandoff(input.value);
	if (!decoded.ok) {
		input.port.notify(`Prepared wrap 거부: ${decoded.issue.message}`, "error");
		return false;
	}
	const digest = preparedWrapDigest(decoded.value);
	if (snapshot.prepared) {
		if (snapshot.prepared.digest === digest) {
			input.port.notify("같은 prepared wrap이 이미 준비되어 있습니다.", "info");
			return true;
		}
		input.port.notify("다른 prepared wrap이 이미 활성 상태입니다.", "error");
		return false;
	}
	if (!matchingOpenEpisode(snapshot, decoded.value)) {
		input.port.notify(
			"Prepared wrap target이 현재 open episode와 다릅니다.",
			"error",
		);
		return false;
	}
	const proposal = wrapProposed(decoded.value);
	const projected = applyObserverEvent(snapshot.state, proposal);
	if (!projected.applied) {
		input.port.notify(`Wrap proposal 거부: ${projected.reason}.`, "error");
		return false;
	}
	input.port.appendEntry(OBSERVER_PREPARED_WRAP_ENTRY, decoded.value);
	const withPrepared = reconstructObserverPiState(input.port.branchEntries());
	if (notifyReplayIssue(withPrepared, input.port)) return false;
	if (!appendLifecycle(input.port, withPrepared, proposal)) return false;
	input.port.notify("Wrap proposal을 검토할 준비가 되었습니다.", "info");
	await refreshStatus(input.port, input.notebooks, input.operationalIssue);
	return true;
}

async function installPreparedMemoCommand(input: {
	readonly value: unknown;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObserverControllerIds;
}): Promise<boolean> {
	const synchronized = await synchronize(
		input.port,
		input.notebooks,
		input.ids,
	);
	if (
		notifyReplayIssue(synchronized.snapshot, input.port) ||
		notifyMemoReplayIssue(synchronized.memo, input.port)
	) {
		return false;
	}
	if (synchronized.operationalIssue) {
		input.port.notify(
			`Observer 복구가 필요합니다: ${synchronized.operationalIssue}`,
			"error",
		);
		return false;
	}
	const decoded = decodePreparedMemoPass(input.value);
	if (!decoded.ok) {
		input.port.notify(
			`Prepared Memo pass 거부: ${decoded.issue.message}`,
			"error",
		);
		return false;
	}
	if (synchronized.memo.prepared) {
		if (
			synchronized.memo.prepared.passId === decoded.value.passId &&
			synchronized.memo.prepared.digest === decoded.value.digest
		) {
			input.port.notify(
				"같은 prepared Memo pass가 이미 준비되어 있습니다.",
				"info",
			);
			return true;
		}
		input.port.notify(
			"다른 prepared Memo pass가 이미 활성 상태입니다.",
			"error",
		);
		return false;
	}
	const invalid = await validatePreparedMemo({
		pass: decoded.value,
		snapshot: synchronized.snapshot,
		memo: synchronized.memo,
		entries: input.port.branchEntries(),
		notebooks: input.notebooks,
	});
	if (invalid) {
		input.port.notify(invalid, "error");
		return false;
	}
	try {
		input.port.appendEntry(
			OBSERVER_PREPARED_MEMO_ENTRY,
			encodePreparedMemoPass(decoded.value),
		);
	} catch (error) {
		input.port.notify(
			`Prepared Memo pass 기록 실패: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
		return false;
	}
	const installed = reconstructMemoSession(input.port.branchEntries());
	if (
		notifyMemoReplayIssue(installed, input.port) ||
		installed.prepared?.passId !== decoded.value.passId
	) {
		return false;
	}
	input.port.notify(
		`Memo reconciliation 준비 완료: ${decoded.value.passId}`,
		"info",
	);
	await refreshStatus(input.port, input.notebooks);
	return true;
}

export function createObserverController(
	dependencies: ControllerDependencies,
): ObserverController {
	const notebooks = createNotebookService({
		selectionStore: dependencies.selectionStore,
	});
	const wraps = createWrapService({
		selectionStore: dependencies.selectionStore,
	});
	let operationalIssue: string | undefined;
	return {
		async bind(port) {
			const synchronized = await synchronize(port, notebooks, dependencies.ids);
			operationalIssue = synchronized.operationalIssue;
			await refreshStatus(port, notebooks, operationalIssue);
		},
		async refresh(port) {
			await refreshStatus(port, notebooks, operationalIssue);
		},
		async command(args, port) {
			operationalIssue = await executeObserverCommand({
				args,
				port,
				notebooks,
				wraps,
				ids: dependencies.ids,
				...(operationalIssue ? { operationalIssue } : {}),
			});
		},
		installPrepared(value, port) {
			return installPreparedCommand({
				value,
				port,
				notebooks,
				...(operationalIssue ? { operationalIssue } : {}),
			});
		},
		installPreparedMemo(value, port) {
			return installPreparedMemoCommand({
				value,
				port,
				notebooks,
				ids: dependencies.ids,
			});
		},
		ensureOneShotEpisode(intent, port) {
			return ensureOneShotEpisodeCommand({
				intent,
				port,
				notebooks,
				ids: dependencies.ids,
				...(operationalIssue ? { operationalIssue } : {}),
			});
		},
		unbind() {
			operationalIssue = undefined;
		},
	};
}
