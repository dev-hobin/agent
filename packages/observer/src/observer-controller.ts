import { resolve } from "node:path";

import {
	applyObserverEvent,
	OBSERVER_PROTOCOL,
	type ActivationChangedEvent,
	type EpisodeLanguage,
	type EpisodeOpenedEvent,
	type NotebookSelectedEvent,
	type ObserverEvent,
	type OutputLanguageChangedEvent,
	type SaveCancelledEvent,
	type SaveCommittedEvent,
	type SaveProposedEvent,
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
import { reconstructObservationSession } from "./observation-session.ts";
import {
	reconstructMaterialReviewSession,
	type MaterialReviewIntent,
	type MaterialReviewRequestId,
} from "./material-review-trigger.ts";
import {
	observerStatusView,
	renderMemoPassReceipt,
	renderObserverFooter,
	renderObserverStatus,
	type ObserverStatusView,
} from "./observer-status.ts";
import {
	decodePreparedSaveHandoff,
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_SAVE_ENTRY,
	OBSERVER_SAVE_ATTEMPT_ENTRY,
	OBSERVER_SAVE_ATTEMPT_PROTOCOL,
	preparedSaveDigest,
	reconstructObserverPiState,
	type ApprovedSaveAttempt,
	type ObserverPiSnapshot,
	type PiBranchEntryLike,
	type PreparedSaveHandoff,
} from "./pi-session.ts";
import {
	inspectSaveAcknowledgment,
	type SaveAcknowledgmentInspection,
} from "./save-acknowledgment.ts";
import {
	OBSERVER_SAVE_APPROVAL_SCHEMA,
	type SaveReceipt,
} from "./save-profile.ts";
import {
	createSaveService,
	type SaveService,
	type SaveServiceIssue,
} from "./save-service.ts";
import {
	saveProposalReview,
	type SaveProposalReview,
	type SaveProposalReviewDecision,
} from "./save-review.ts";

export interface ObserverCommandPort {
	/** Pi's current working directory. Relative Notebook paths resolve from here. */
	readonly cwd?: string;
	branchEntries(): readonly PiBranchEntryLike[];
	sessionFile(): string | undefined;
	appendEntry(customType: string, data: unknown): void;
	input(title: string, placeholder?: string): Promise<string | undefined>;
	select(title: string, options: string[]): Promise<string | undefined>;
	reviewSaveProposal(
		review: SaveProposalReview,
	): Promise<SaveProposalReviewDecision>;
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

const MATERIAL_REVIEW_EPISODE_CAPABILITY = Symbol(
	"observer.material-review-episode-capability",
);
const USER_HYPOTHESIS_EPISODE_CAPABILITY = Symbol(
	"observer.user-hypothesis-episode-capability",
);

export interface MaterialReviewEpisodeCapability {
	readonly [MATERIAL_REVIEW_EPISODE_CAPABILITY]: true;
	readonly requestId: MaterialReviewRequestId;
	readonly userMessageDigest: string;
	readonly material: "inline-user-message" | "retrieved-tool-results";
	readonly inputSource: "interactive" | "rpc";
	readonly episodeId: string;
	readonly notebookId: string;
	readonly lang: "ko" | "en";
}

export type MaterialReviewEpisodeResult =
	| {
			readonly ok: true;
			readonly status: "opened" | "resumed";
			readonly value: MaterialReviewEpisodeCapability;
	  }
	| { readonly ok: false; readonly message: string };

export interface UserHypothesisEpisodeCapability {
	readonly [USER_HYPOTHESIS_EPISODE_CAPABILITY]: true;
	readonly episodeId: string;
	readonly notebookId: string;
	readonly lang: EpisodeLanguage;
	readonly mode: "on" | "off";
}

export type UserHypothesisEpisodeResult =
	| {
			readonly ok: true;
			readonly status: "opened" | "resumed";
			readonly value: UserHypothesisEpisodeCapability;
	  }
	| { readonly ok: false; readonly message: string };

export interface ObserverController {
	bind(port: ObserverCommandPort): Promise<void>;
	refresh(port: ObserverCommandPort): Promise<void>;
	inspect(port: ObserverCommandPort): Promise<ObserverStatusView>;
	updateDefaultLanguage(
		language: EpisodeLanguage,
		port: ObserverCommandPort,
	): Promise<boolean>;
	command(args: string, port: ObserverCommandPort): Promise<void>;
	installPrepared(value: unknown, port: ObserverCommandPort): Promise<boolean>;
	installPreparedMemo(
		value: unknown,
		port: ObserverCommandPort,
	): Promise<boolean>;
	ensureMaterialReviewEpisode(
		intent: MaterialReviewIntent,
		port: ObserverCommandPort,
	): Promise<MaterialReviewEpisodeResult>;
	ensureUserHypothesisEpisode(
		port: ObserverCommandPort,
	): Promise<UserHypothesisEpisodeResult>;
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

function outputLanguageChanged(
	lang: EpisodeLanguage,
): OutputLanguageChangedEvent {
	return { protocol: OBSERVER_PROTOCOL, kind: "output-language-changed", lang };
}

function saveProposed(handoff: PreparedSaveHandoff): SaveProposedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "save-proposed",
		proposalId: handoff.prepared.proposal_id,
		summary: handoff.summary,
	};
}

function saveCancelled(proposalId: string): SaveCancelledEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "save-cancelled",
		proposalId,
	};
}

function saveCommitted(receipt: SaveReceipt): SaveCommittedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "save-committed",
		proposalId: receipt.proposal_id,
		receipt: {
			receiptId: receipt.receipt_id,
			status: "validated",
			recordIds: receipt.records.map((record) => record.record_id),
		},
	};
}

function approvedAttempt(
	handoff: PreparedSaveHandoff,
	attemptId: string,
): ApprovedSaveAttempt {
	return {
		protocol: OBSERVER_SAVE_ATTEMPT_PROTOCOL,
		kind: "approved",
		attemptId,
		proposalId: handoff.prepared.proposal_id,
		preparedDigest: preparedSaveDigest(handoff),
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
	handoff: PreparedSaveHandoff,
): boolean {
	const episode = snapshot.state.episode;
	return (
		episode.status === "open" &&
		snapshot.state.selectedNotebookId === handoff.prepared.notebook_id &&
		episode.core.notebookId === handoff.prepared.notebook_id
	);
}

async function promptSetup(
	port: ObserverCommandPort,
): Promise<ObserveCommand | null> {
	const root = await port.input(
		"Observer Notebook path",
		"Absolute, or relative to the current Pi working directory",
	);
	if (root === undefined) return null;
	const language = await port.select("Default output language", ["en", "ko"]);
	if (language === undefined) return null;
	if (!root.trim() || (language !== "ko" && language !== "en")) {
		port.notify(
			"A Notebook path and output language (en or ko) are required.",
			"warning",
		);
		return null;
	}
	const resolvedRoot = resolve(port.cwd ?? process.cwd(), root.trim());
	const proceed = `Set up ${resolvedRoot} · default output ${language}`;
	const choice = await port.select(
		[
			"Review Observer Notebook setup",
			`Resolved path: ${resolvedRoot}`,
			`Default Memo/Zettel language: ${language}`,
			"A new Notebook is initialized; an existing folder is adopted without rewriting unrelated files.",
		].join("\n"),
		["Go back · make no changes", proceed],
	);
	if (choice !== proceed) return null;
	return { kind: "setup", root: resolvedRoot, lang: language };
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

function saveIssueSummary(issue: SaveServiceIssue): string {
	const subject = issue.recordId
		? ` Record: ${issue.recordId}.`
		: issue.path
			? ` Path: ${issue.path}.`
			: "";
	const diagnostic = issue.diagnostics?.[0]?.message;
	return `${issue.message}${subject}${diagnostic ? ` ${diagnostic}` : ""}`;
}

function saveReceiptSummary(review: SaveProposalReview): string {
	const counts = new Map<string, number>();
	for (const record of review.records)
		counts.set(record.recordType, (counts.get(record.recordType) ?? 0) + 1);
	const byType = ["source", "inquiry", "memo", "zettel"]
		.flatMap((type) => {
			const count = counts.get(type) ?? 0;
			return count > 0 ? [`${type} ${count}`] : [];
		})
		.join(" · ");
	return byType ? ` · ${byType}` : "";
}

async function inspectStatus(
	port: ObserverCommandPort,
	notebooks: NotebookService,
	operationalIssue?: string,
): Promise<ObserverStatusView> {
	return observerStatusView({
		snapshot: reconstructObserverPiState(port.branchEntries()),
		memoSnapshot: reconstructMemoSession(port.branchEntries()),
		observationSnapshot: reconstructObservationSession(port.branchEntries()),
		materialReviewSnapshot: reconstructMaterialReviewSession(
			port.branchEntries(),
		),
		notebookStatus: await notebooks.status(),
		sessionFile: port.sessionFile(),
		...(operationalIssue ? { operationalIssue } : {}),
	});
}

async function refreshStatus(
	port: ObserverCommandPort,
	notebooks: NotebookService,
	operationalIssue?: string,
): Promise<void> {
	const view = await inspectStatus(port, notebooks, operationalIssue);
	port.setStatus(renderObserverFooter(view));
}

async function showStatus(
	port: ObserverCommandPort,
	notebooks: NotebookService,
	operationalIssue?: string,
): Promise<void> {
	const view = await inspectStatus(port, notebooks, operationalIssue);
	port.setStatus(renderObserverFooter(view));
	port.notify(renderObserverStatus(view), "info");
}

async function updateDefaultLanguageCommand(input: {
	readonly language: EpisodeLanguage;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObserverControllerIds;
	readonly operationalIssue?: string;
}): Promise<boolean> {
	const synchronized = await synchronize(
		input.port,
		input.notebooks,
		input.ids,
	);
	if (
		notifyReplayIssue(synchronized.snapshot, input.port) ||
		notifyMemoReplayIssue(synchronized.memo, input.port) ||
		synchronized.operationalIssue ||
		input.operationalIssue
	) {
		const issue = synchronized.operationalIssue ?? input.operationalIssue;
		if (issue)
			input.port.notify(`Observer recovery is required: ${issue}`, "error");
		return false;
	}
	const episode = synchronized.snapshot.state.episode;
	const active =
		episode.status === "open" || episode.status === "reviewing-save";
	let current = synchronized.snapshot;
	let previousLanguage: EpisodeLanguage | null = null;
	if (active && episode.core.lang !== input.language) {
		previousLanguage = episode.core.lang;
		const changed = appendRequiredLifecycle({
			port: input.port,
			snapshot: current,
			event: outputLanguageChanged(input.language),
			label: "Output language change",
		});
		if (
			!changed.ok ||
			(changed.snapshot.state.episode.status !== "open" &&
				changed.snapshot.state.episode.status !== "reviewing-save") ||
			changed.snapshot.state.episode.core.lang !== input.language
		) {
			input.port.notify(
				changed.ok
					? "Output language change was not visible in the current branch."
					: changed.message,
				"error",
			);
			return false;
		}
		current = changed.snapshot;
	}
	const updated = await input.notebooks.updateDefaultLanguage({
		state: current.state,
		language: input.language,
	});
	if (!updated.ok) {
		if (previousLanguage) {
			const rollback = appendRequiredLifecycle({
				port: input.port,
				snapshot: current,
				event: outputLanguageChanged(previousLanguage),
				label: "Output language rollback",
			});
			if (!rollback.ok)
				input.port.notify(
					`Output language rollback failed: ${rollback.message}`,
					"error",
				);
		}
		input.port.notify(
			`Default output language update failed: ${updated.issue.message}`,
			"error",
		);
		return false;
	}
	input.port.notify(
		`Memo and Zettel output language set to ${input.language}. New work uses it immediately; already prepared work keeps its locked language.`,
		"info",
	);
	await refreshStatus(input.port, input.notebooks);
	return true;
}

async function acknowledgmentInspection(
	snapshot: ObserverPiSnapshot,
	notebooks: NotebookService,
	ids: ObserverControllerIds,
): Promise<SaveAcknowledgmentInspection | null> {
	if (
		!snapshot.attempt ||
		!snapshot.prepared ||
		snapshot.state.episode.status !== "reviewing-save"
	) {
		return null;
	}
	const recovered = await notebooks.recover(snapshot.state);
	if (!recovered.ok) {
		return { status: "invalid", message: recovered.issue.message };
	}
	return inspectSaveAcknowledgment({
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
			saveCommitted(inspection.receipt),
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
	const root = resolve(port.cwd ?? process.cwd(), command.root);
	const setup = await notebooks.setup({
		root,
		defaultLanguage: command.lang,
		state: snapshot.state,
	});
	if (!setup.ok) {
		port.notify(`Notebook setup failed: ${setup.issue.message}`, "error");
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
		`Observer Notebook selected: ${setup.value.notebook.root} (default output: ${command.lang})`,
		"info",
	);
}

type RequiredLifecycleAppendResult =
	| { readonly ok: true; readonly snapshot: ObserverPiSnapshot }
	| { readonly ok: false; readonly message: string };

function appendRequiredLifecycle(input: {
	readonly port: ObserverCommandPort;
	readonly snapshot: ObserverPiSnapshot;
	readonly event: ObserverEvent;
	readonly label: string;
}): RequiredLifecycleAppendResult {
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

function materialReviewSynchronizationIssue(input: {
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
	return input.synchronized.snapshot.state.episode.status === "reviewing-save"
		? "Save proposal이 준비된 동안에는 Material review을 시작할 수 없습니다."
		: null;
}

async function ensureMaterialReviewEpisodeCommand(input: {
	readonly intent: MaterialReviewIntent;
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObserverControllerIds;
	readonly operationalIssue?: string;
}): Promise<MaterialReviewEpisodeResult> {
	const synchronized = await synchronize(
		input.port,
		input.notebooks,
		input.ids,
	);
	const synchronizationIssue = materialReviewSynchronizationIssue({
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
			message: `Material review notebook 복구 실패: ${recovered.issue.message}`,
		};
	let current = synchronized.snapshot;
	let status: "opened" | "resumed" = "resumed";
	const notebookId = recovered.value.notebook.manifest.notebook_id;
	if (current.state.selectedNotebookId !== notebookId) {
		const selected = appendRequiredLifecycle({
			port: input.port,
			snapshot: current,
			event: notebookSelected(notebookId),
			label: "Material review notebook selection",
		});
		if (!selected.ok) return selected;
		current = selected.snapshot;
	}
	if (
		current.state.episode.status === "empty" ||
		current.state.episode.status === "settled"
	) {
		const opened = appendRequiredLifecycle({
			port: input.port,
			snapshot: current,
			event: episodeOpened({
				episodeId: input.ids.episodeId(),
				notebookId,
				lang: recovered.value.notebook.manifest.default_language,
			}),
			label: "Material review Episode open",
		});
		if (!opened.ok) return opened;
		current = opened.snapshot;
		status = "opened";
	}
	if (
		current.state.episode.status !== "open" ||
		current.state.episode.core.notebookId !== notebookId
	)
		return {
			ok: false,
			message:
				"Material review OPEN lifecycle capability를 확립하지 못했습니다.",
		};
	return {
		ok: true,
		status,
		value: {
			[MATERIAL_REVIEW_EPISODE_CAPABILITY]: true,
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

function userHypothesisSynchronizationIssue(input: {
	readonly synchronized: SynchronizationResult;
	readonly port: ObserverCommandPort;
	readonly operationalIssue?: string;
}): string | null {
	if (
		notifyReplayIssue(input.synchronized.snapshot, input.port) ||
		notifyMemoReplayIssue(input.synchronized.memo, input.port)
	)
		return "Observer branch history must be repaired before tracking a hypothesis.";
	const issue = input.operationalIssue ?? input.synchronized.operationalIssue;
	if (issue) return `Observer recovery is required: ${issue}`;
	return input.synchronized.snapshot.state.episode.status === "reviewing-save"
		? "Finish or cancel the current save review before tracking a hypothesis."
		: null;
}

async function ensureUserHypothesisEpisodeCommand(input: {
	readonly port: ObserverCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObserverControllerIds;
	readonly operationalIssue?: string;
}): Promise<UserHypothesisEpisodeResult> {
	const synchronized = await synchronize(
		input.port,
		input.notebooks,
		input.ids,
	);
	const synchronizationIssue = userHypothesisSynchronizationIssue({
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
			message: `Could not open the Notebook for hypothesis tracking: ${recovered.issue.message}`,
		};
	let current = synchronized.snapshot;
	let status: "opened" | "resumed" = "resumed";
	const notebookId = recovered.value.notebook.manifest.notebook_id;
	if (current.state.selectedNotebookId !== notebookId) {
		const selected = appendRequiredLifecycle({
			port: input.port,
			snapshot: current,
			event: notebookSelected(notebookId),
			label: "Hypothesis Notebook selection",
		});
		if (!selected.ok) return selected;
		current = selected.snapshot;
	}
	if (
		current.state.episode.status === "empty" ||
		current.state.episode.status === "settled"
	) {
		const opened = appendRequiredLifecycle({
			port: input.port,
			snapshot: current,
			event: episodeOpened({
				episodeId: input.ids.episodeId(),
				notebookId,
				lang: recovered.value.notebook.manifest.default_language,
			}),
			label: "Hypothesis Episode open",
		});
		if (!opened.ok) return opened;
		current = opened.snapshot;
		status = "opened";
	}
	if (
		current.state.episode.status !== "open" ||
		current.state.episode.core.notebookId !== notebookId
	)
		return {
			ok: false,
			message: "Could not establish an open Episode for hypothesis tracking.",
		};
	return {
		ok: true,
		status,
		value: {
			[USER_HYPOTHESIS_EPISODE_CAPABILITY]: true,
			episodeId: current.state.episode.core.episodeId,
			notebookId,
			lang: current.state.episode.core.lang,
			mode: current.state.mode,
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
		port.notify(
			`Failed to turn Observer on: ${recovered.issue.message}`,
			"error",
		);
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
	port.notify("Observer is on.", "info");
}

function offCommand(
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
): void {
	if (snapshot.state.mode === "off") {
		port.notify("Observer is already off.", "info");
		return;
	}
	if (!appendLifecycle(port, snapshot, activationChanged(false))) return;
	port.notify("Observer is off. The open Episode is preserved.", "info");
}

async function saveCommand(
	snapshot: ObserverPiSnapshot,
	port: ObserverCommandPort,
	saves: SaveService,
	ids: ObserverControllerIds,
): Promise<void> {
	if (
		snapshot.state.episode.status !== "reviewing-save" ||
		!snapshot.prepared
	) {
		port.notify(
			"There is no reviewed proposal to save. Run /observe review first.",
			"warning",
		);
		return;
	}
	port.setStatus("observer · validating save proposal");
	const preflight = await saves.preflight({
		state: snapshot.state,
		prepared: snapshot.prepared.handoff.prepared,
	});
	if (!preflight.ok) {
		const returnToReview =
			"Return to Review · discard invalid proposal, preserve working state";
		const choice = await port.select(
			`The reviewed proposal is no longer ready to save. ${saveIssueSummary(preflight.issue)}`,
			["Keep proposal for diagnosis", returnToReview],
		);
		if (choice === returnToReview) {
			appendLifecycle(
				port,
				snapshot,
				saveCancelled(snapshot.prepared.handoff.prepared.proposal_id),
			);
			port.notify(
				"Returned to Review. The invalid proposal was discarded; the Episode and working state remain open.",
				"info",
			);
		} else {
			port.notify(
				"The invalid proposal was kept for diagnosis. Return to Review before preparing a replacement.",
				"error",
			);
		}
		return;
	}
	const review = saveProposalReview(snapshot.prepared.handoff, preflight.value);
	const decision = await port.reviewSaveProposal(review);
	if (decision === "back") {
		port.notify(
			"Save postponed. The reviewed proposal remains ready to inspect.",
			"info",
		);
		return;
	}
	if (decision === "reject") {
		appendLifecycle(
			port,
			snapshot,
			saveCancelled(snapshot.prepared.handoff.prepared.proposal_id),
		);
		port.notify(
			"Returned to Review. The proposal was discarded; the Episode and working state remain open.",
			"info",
		);
		return;
	}
	let current = snapshot;
	if (!current.attempt) {
		const currentPrepared = current.prepared;
		if (!currentPrepared) {
			port.notify("The prepared save proposal could not be found.", "error");
			return;
		}
		port.appendEntry(
			OBSERVER_SAVE_ATTEMPT_ENTRY,
			approvedAttempt(currentPrepared.handoff, ids.attemptId()),
		);
		current = reconstructObserverPiState(port.branchEntries());
		if (notifyReplayIssue(current, port)) return;
	}
	const prepared = current.prepared?.handoff;
	if (!prepared) {
		port.notify("The approved save proposal could not be recovered.", "error");
		return;
	}
	port.setStatus(
		`observer · saving ${prepared.prepared.records.length} Notebook records`,
	);
	const saved = await saves.commit({
		state: current.state,
		prepared: prepared.prepared,
		approval: {
			observer_approval: OBSERVER_SAVE_APPROVAL_SCHEMA,
			proposal_id: prepared.prepared.proposal_id,
			approved: true,
		},
	});
	if (!saved.ok) {
		port.notify(
			`Notebook save failed. ${saveIssueSummary(saved.issue)} The reviewed proposal remains available for recovery.`,
			"error",
		);
		return;
	}
	if (!appendLifecycle(port, current, saveCommitted(saved.value.receipt)))
		return;
	port.notify(
		`Saved ${saved.value.receipt.records.length} Notebook records${saveReceiptSummary(review)} · Episode settled · Git commit/push not performed`,
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
				? `There is no new prepared reconciliation.\n${renderMemoPassReceipt(input.memo.state.lastReceipt)}`
				: "There is no new prepared reconciliation.",
			"info",
		);
		return undefined;
	}
	if (input.snapshot.state.episode.status !== "open") {
		input.port.notify(
			"Memo reconciliation requires an open Episode.",
			"warning",
		);
		return undefined;
	}
	const recovered = await input.notebooks.recover(input.snapshot.state);
	if (!recovered.ok) {
		input.port.notify(
			`Notebook recovery failed: ${recovered.issue.message}`,
			"error",
		);
		return undefined;
	}
	const inventory = await readNotebookInventory(recovered.value.notebook);
	if (!inventory.ok) {
		input.port.notify(
			`Notebook read failed: ${inventory.issue.message}`,
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
			`Memo reconciliation rejected: ${reconciled.issue.message}`,
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
			`Failed to record the Memo working entry: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
		return undefined;
	}
	const appliedMemo = reconstructMemoSession(input.port.branchEntries());
	if (
		notifyMemoReplayIssue(appliedMemo, input.port) ||
		!appliedMemo.pendingAcknowledgment
	) {
		return "The Memo working entry result needs attention.";
	}
	try {
		const current = reconstructObserverPiState(input.port.branchEntries());
		const acknowledged = appendLifecycle(
			input.port,
			current,
			memoAcknowledgmentEvent(appliedMemo.pendingAcknowledgment),
		);
		if (!acknowledged) return "The Memo acknowledgment could not be recorded.";
	} catch (error) {
		input.port.notify(
			"Memo working state was recorded, but lifecycle acknowledgment remains. The next bind or command will recover it.",
			"warning",
		);
		return `Failed to record the Memo acknowledgment: ${error instanceof Error ? error.message : String(error)}`;
	}
	const completed = reconstructMemoSession(input.port.branchEntries());
	if (completed.issues.length > 0 || completed.pendingAcknowledgment) {
		return "The Memo acknowledgment result needs attention.";
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
	readonly saves: SaveService;
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
		case "review":
			input.port.notify(
				"Review preparation must start through the Observer extension.",
				"warning",
			);
			break;
		case "save":
			await saveCommand(
				synchronized.snapshot,
				input.port,
				input.saves,
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
	readonly saves: SaveService;
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
	const decoded = decodePreparedSaveHandoff(input.value);
	if (!decoded.ok) {
		input.port.notify(`Prepared save 거부: ${decoded.issue.message}`, "error");
		return false;
	}
	const digest = preparedSaveDigest(decoded.value);
	if (snapshot.prepared) {
		if (snapshot.prepared.digest === digest) {
			input.port.notify("같은 prepared save이 이미 준비되어 있습니다.", "info");
			return true;
		}
		input.port.notify("다른 prepared save이 이미 활성 상태입니다.", "error");
		return false;
	}
	if (!matchingOpenEpisode(snapshot, decoded.value)) {
		input.port.notify(
			"Prepared save target이 현재 open episode와 다릅니다.",
			"error",
		);
		return false;
	}
	const preflight = await input.saves.preflight({
		state: snapshot.state,
		prepared: decoded.value.prepared,
	});
	if (!preflight.ok) {
		input.port.notify(
			`Review could not prepare a valid proposal. ${saveIssueSummary(preflight.issue)} The Episode and working state were preserved.`,
			"error",
		);
		return false;
	}
	const proposal = saveProposed(decoded.value);
	const projected = applyObserverEvent(snapshot.state, proposal);
	if (!projected.applied) {
		input.port.notify(`Save proposal rejected: ${projected.reason}.`, "error");
		return false;
	}
	input.port.appendEntry(OBSERVER_PREPARED_SAVE_ENTRY, decoded.value);
	const withPrepared = reconstructObserverPiState(input.port.branchEntries());
	if (notifyReplayIssue(withPrepared, input.port)) return false;
	if (!appendLifecycle(input.port, withPrepared, proposal)) return false;
	input.port.notify(
		"Review completed. The proposal is ready; run /observe save to inspect and approve it.",
		"info",
	);
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
	const saves = createSaveService({
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
		inspect(port) {
			return inspectStatus(port, notebooks, operationalIssue);
		},
		updateDefaultLanguage(language, port) {
			return updateDefaultLanguageCommand({
				language,
				port,
				notebooks,
				ids: dependencies.ids,
				...(operationalIssue ? { operationalIssue } : {}),
			});
		},
		async command(args, port) {
			operationalIssue = await executeObserverCommand({
				args,
				port,
				notebooks,
				saves,
				ids: dependencies.ids,
				...(operationalIssue ? { operationalIssue } : {}),
			});
		},
		installPrepared(value, port) {
			return installPreparedCommand({
				value,
				port,
				notebooks,
				saves,
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
		ensureMaterialReviewEpisode(intent, port) {
			return ensureMaterialReviewEpisodeCommand({
				intent,
				port,
				notebooks,
				ids: dependencies.ids,
				...(operationalIssue ? { operationalIssue } : {}),
			});
		},
		ensureUserHypothesisEpisode(port) {
			return ensureUserHypothesisEpisodeCommand({
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
