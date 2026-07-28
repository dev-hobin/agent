export const OBSERVER_PROTOCOL: "observer/v1" = "observer/v1";

const MAX_ID_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_RECEIPT_RECORDS = 1_000;

export type ObserverMode = "off" | "on";
export type EpisodeLanguage = "ko" | "en";

export interface EpisodeCore {
	readonly episodeId: string;
	readonly notebookId: string;
	readonly lang: EpisodeLanguage;
}

export interface MemoReceipt {
	readonly receiptId: string;
	readonly summary: string;
}

export interface MemoRevision {
	readonly revisionId: string;
	readonly receipt: MemoReceipt;
}

export interface SaveProposal {
	readonly proposalId: string;
	readonly summary: string;
}

export interface LocalSaveReceipt {
	readonly receiptId: string;
	readonly status: "unvalidated" | "validated";
	readonly recordIds: readonly string[];
}

export interface CommittedSave {
	readonly proposalId: string;
	readonly receipt: LocalSaveReceipt & { readonly status: "validated" };
}

export interface EmptyEpisode {
	readonly status: "empty";
}

export interface OpenEpisode {
	readonly status: "open";
	readonly core: EpisodeCore;
	readonly lastMemo: MemoRevision | null;
}

export interface ReviewingSaveEpisode {
	readonly status: "reviewing-save";
	readonly core: EpisodeCore;
	readonly lastMemo: MemoRevision | null;
	readonly proposal: SaveProposal;
}

export interface SettledEpisode {
	readonly status: "settled";
	readonly core: EpisodeCore;
	readonly lastMemo: MemoRevision | null;
	readonly committedSave: CommittedSave;
}

export type ActiveEpisode = OpenEpisode | ReviewingSaveEpisode;
export type ObserverEpisode = ActiveEpisode | EmptyEpisode | SettledEpisode;

type ObserverState =
	| {
			readonly mode: "off";
			readonly selectedNotebookId: string | null;
			readonly episode: ObserverEpisode;
	  }
	| {
			readonly mode: "on";
			readonly selectedNotebookId: string;
			readonly episode: ActiveEpisode;
	  };

export type { ObserverState };

interface ObserverEventBase<Kind extends string> {
	readonly protocol: typeof OBSERVER_PROTOCOL;
	readonly kind: Kind;
}

export interface EpisodeOpenedEvent
	extends ObserverEventBase<"episode-opened"> {
	readonly episodeId: string;
	readonly notebookId: string;
	readonly lang: EpisodeLanguage;
}

export interface ActivationChangedEvent
	extends ObserverEventBase<"activation-changed"> {
	readonly enabled: boolean;
}

export interface NotebookSelectedEvent
	extends ObserverEventBase<"notebook-selected"> {
	readonly notebookId: string;
}

export interface MemoReconciledEvent
	extends ObserverEventBase<"memo-reconciled"> {
	readonly revisionId: string;
	readonly receipt: MemoReceipt;
}

export interface SaveProposedEvent extends ObserverEventBase<"save-proposed"> {
	readonly proposalId: string;
	readonly summary: string;
}

export interface SaveCancelledEvent
	extends ObserverEventBase<"save-cancelled"> {
	readonly proposalId: string;
}

export interface SaveCommittedEvent
	extends ObserverEventBase<"save-committed"> {
	readonly proposalId: string;
	readonly receipt: LocalSaveReceipt;
}

export type ObserverEvent =
	| ActivationChangedEvent
	| EpisodeOpenedEvent
	| MemoReconciledEvent
	| NotebookSelectedEvent
	| SaveCancelledEvent
	| SaveCommittedEvent
	| SaveProposedEvent;

export type ObserverEventDecodeCode =
	| "event.kind"
	| "event.object"
	| "event.protocol"
	| "event.shape";

export interface ObserverEventDecodeIssue {
	readonly code: ObserverEventDecodeCode;
	readonly message: string;
	readonly path: string;
}

export type ObserverEventDecodeResult =
	| { readonly ok: true; readonly event: ObserverEvent }
	| { readonly ok: false; readonly issue: ObserverEventDecodeIssue };

export type ObserverTransitionRejection =
	| "activation.episode-required"
	| "episode.already-open"
	| "episode.id-reused"
	| "memo.episode-open-required"
	| "memo.revision-duplicate"
	| "notebook.live-switch"
	| "notebook.mismatch"
	| "save.episode-open-required"
	| "save.proposal-mismatch"
	| "save.receipt-unvalidated"
	| "save.review-required";

export type ObserverEventApplication =
	| {
			readonly applied: true;
			readonly changed: boolean;
			readonly state: ObserverState;
	  }
	| {
			readonly applied: false;
			readonly reason: ObserverTransitionRejection;
			readonly state: ObserverState;
	  };

export interface ObserverReplayIssue {
	readonly index: number;
	readonly stage: "decode" | "transition";
	readonly code: ObserverEventDecodeCode | ObserverTransitionRejection;
	readonly message: string;
}

export interface ObserverReplayResult {
	readonly state: ObserverState;
	readonly appliedEvents: number;
	readonly issues: readonly ObserverReplayIssue[];
}

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

function isBoundedText(value: unknown, maximum: number): value is string {
	return (
		typeof value === "string" &&
		value === value.trim() &&
		value.length > 0 &&
		value.length <= maximum
	);
}

function isIdentifier(value: unknown): value is string {
	return isBoundedText(value, MAX_ID_LENGTH);
}

function isSummary(value: unknown): value is string {
	return isBoundedText(value, MAX_SUMMARY_LENGTH);
}

function decodeFailure(
	code: ObserverEventDecodeCode,
	path: string,
	message: string,
): ObserverEventDecodeResult {
	return { ok: false, issue: { code, path, message } };
}

function parseMemoReceipt(value: unknown): MemoReceipt | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, ["receiptId", "summary"]) ||
		!isIdentifier(value.receiptId) ||
		!isSummary(value.summary)
	) {
		return null;
	}
	return { receiptId: value.receiptId, summary: value.summary };
}

function isReceiptStatus(value: unknown): value is LocalSaveReceipt["status"] {
	return value === "unvalidated" || value === "validated";
}

function parseRecordIds(value: unknown): readonly string[] | null {
	if (
		!Array.isArray(value) ||
		value.length > MAX_RECEIPT_RECORDS ||
		!value.every(isIdentifier)
	) {
		return null;
	}
	return [...value];
}

function parseLocalSaveReceipt(value: unknown): LocalSaveReceipt | null {
	if (
		!isObject(value) ||
		!hasExactKeys(value, ["receiptId", "status", "recordIds"]) ||
		!isIdentifier(value.receiptId) ||
		!isReceiptStatus(value.status)
	) {
		return null;
	}
	const recordIds = parseRecordIds(value.recordIds);
	if (!recordIds) return null;
	return {
		receiptId: value.receiptId,
		status: value.status,
		recordIds,
	};
}

function normalizeEpisodeOpened(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, [
			"protocol",
			"kind",
			"episodeId",
			"notebookId",
			"lang",
		]) ||
		!isIdentifier(value.episodeId) ||
		!isIdentifier(value.notebookId) ||
		(value.lang !== "ko" && value.lang !== "en")
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"episode-opened requires bounded episode/notebook IDs and ko or en.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "episode-opened",
			episodeId: value.episodeId,
			notebookId: value.notebookId,
			lang: value.lang,
		},
	};
}

function normalizeActivationChanged(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, ["protocol", "kind", "enabled"]) ||
		typeof value.enabled !== "boolean"
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"activation-changed requires one boolean enabled field.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "activation-changed",
			enabled: value.enabled,
		},
	};
}

function normalizeNotebookSelected(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, ["protocol", "kind", "notebookId"]) ||
		!isIdentifier(value.notebookId)
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"notebook-selected requires one bounded notebook ID.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "notebook-selected",
			notebookId: value.notebookId,
		},
	};
}

function normalizeMemoReconciled(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, ["protocol", "kind", "revisionId", "receipt"]) ||
		!isIdentifier(value.revisionId)
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"memo-reconciled requires a bounded revision ID and compact receipt.",
		);
	}
	const receipt = parseMemoReceipt(value.receipt);
	if (!receipt) {
		return decodeFailure(
			"event.shape",
			"/receipt",
			"Memo receipt requires receiptId and summary.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "memo-reconciled",
			revisionId: value.revisionId,
			receipt,
		},
	};
}

function normalizeSaveProposed(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, ["protocol", "kind", "proposalId", "summary"]) ||
		!isIdentifier(value.proposalId) ||
		!isSummary(value.summary)
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"save-proposed requires a bounded proposal ID and summary.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "save-proposed",
			proposalId: value.proposalId,
			summary: value.summary,
		},
	};
}

function normalizeSaveCancelled(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, ["protocol", "kind", "proposalId"]) ||
		!isIdentifier(value.proposalId)
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"save-cancelled requires one bounded proposal ID.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "save-cancelled",
			proposalId: value.proposalId,
		},
	};
}

function normalizeSaveCommitted(
	value: Readonly<Record<string, unknown>>,
): ObserverEventDecodeResult {
	if (
		!hasExactKeys(value, ["protocol", "kind", "proposalId", "receipt"]) ||
		!isIdentifier(value.proposalId)
	) {
		return decodeFailure(
			"event.shape",
			"/",
			"save-committed requires a bounded proposal ID and local-save receipt.",
		);
	}
	const receipt = parseLocalSaveReceipt(value.receipt);
	if (!receipt) {
		return decodeFailure(
			"event.shape",
			"/receipt",
			"Local-save receipt has an invalid shape.",
		);
	}
	return {
		ok: true,
		event: {
			protocol: OBSERVER_PROTOCOL,
			kind: "save-committed",
			proposalId: value.proposalId,
			receipt,
		},
	};
}

export function normalizeObserverEvent(
	value: unknown,
): ObserverEventDecodeResult {
	if (!isObject(value)) {
		return decodeFailure(
			"event.object",
			"/",
			"Observer event must be an object.",
		);
	}
	if (value.protocol !== OBSERVER_PROTOCOL) {
		return decodeFailure(
			"event.protocol",
			"/protocol",
			`Observer event protocol must be ${OBSERVER_PROTOCOL}.`,
		);
	}
	if (typeof value.kind !== "string") {
		return decodeFailure(
			"event.kind",
			"/kind",
			"Observer event kind is required.",
		);
	}
	switch (value.kind) {
		case "episode-opened":
			return normalizeEpisodeOpened(value);
		case "activation-changed":
			return normalizeActivationChanged(value);
		case "notebook-selected":
			return normalizeNotebookSelected(value);
		case "memo-reconciled":
			return normalizeMemoReconciled(value);
		case "save-proposed":
			return normalizeSaveProposed(value);
		case "save-cancelled":
			return normalizeSaveCancelled(value);
		case "save-committed":
			return normalizeSaveCommitted(value);
		default:
			return decodeFailure(
				"event.kind",
				"/kind",
				`Unsupported Observer event kind: ${value.kind}.`,
			);
	}
}

export function initialObserverState(): ObserverState {
	return {
		mode: "off",
		selectedNotebookId: null,
		episode: { status: "empty" },
	};
}

function rejected(
	state: ObserverState,
	reason: ObserverTransitionRejection,
): ObserverEventApplication {
	return { applied: false, reason, state };
}

function accepted(
	previous: ObserverState,
	state: ObserverState,
): ObserverEventApplication {
	return { applied: true, changed: state !== previous, state };
}

function applyEpisodeOpened(
	state: ObserverState,
	event: EpisodeOpenedEvent,
): ObserverEventApplication {
	if (
		state.episode.status === "open" ||
		state.episode.status === "reviewing-save"
	) {
		return rejected(state, "episode.already-open");
	}
	if (
		state.selectedNotebookId !== null &&
		state.selectedNotebookId !== event.notebookId
	) {
		return rejected(state, "notebook.mismatch");
	}
	if (
		state.episode.status === "settled" &&
		state.episode.core.episodeId === event.episodeId
	) {
		return rejected(state, "episode.id-reused");
	}
	return accepted(state, {
		mode: "off",
		selectedNotebookId: event.notebookId,
		episode: {
			status: "open",
			core: {
				episodeId: event.episodeId,
				notebookId: event.notebookId,
				lang: event.lang,
			},
			lastMemo: null,
		},
	});
}

function applyActivationChanged(
	state: ObserverState,
	event: ActivationChangedEvent,
): ObserverEventApplication {
	if (!event.enabled) {
		if (state.mode === "off") return accepted(state, state);
		return accepted(state, { ...state, mode: "off" });
	}
	if (
		state.episode.status !== "open" &&
		state.episode.status !== "reviewing-save"
	) {
		return rejected(state, "activation.episode-required");
	}
	if (state.mode === "on") return accepted(state, state);
	return accepted(state, {
		...state,
		mode: "on",
		selectedNotebookId: state.episode.core.notebookId,
		episode: state.episode,
	});
}

function applyNotebookSelected(
	state: ObserverState,
	event: NotebookSelectedEvent,
): ObserverEventApplication {
	if (
		state.episode.status === "open" ||
		state.episode.status === "reviewing-save"
	) {
		const liveNotebookId =
			state.selectedNotebookId ?? state.episode.core.notebookId;
		if (liveNotebookId !== event.notebookId) {
			return rejected(state, "notebook.live-switch");
		}
	}
	if (state.selectedNotebookId === event.notebookId) {
		return accepted(state, state);
	}
	return accepted(state, { ...state, selectedNotebookId: event.notebookId });
}

function applyMemoReconciled(
	state: ObserverState,
	event: MemoReconciledEvent,
): ObserverEventApplication {
	if (state.episode.status !== "open") {
		return rejected(state, "memo.episode-open-required");
	}
	if (state.episode.lastMemo?.revisionId === event.revisionId) {
		return rejected(state, "memo.revision-duplicate");
	}
	return accepted(state, {
		...state,
		episode: {
			...state.episode,
			lastMemo: {
				revisionId: event.revisionId,
				receipt: event.receipt,
			},
		},
	});
}

function applySaveProposed(
	state: ObserverState,
	event: SaveProposedEvent,
): ObserverEventApplication {
	if (state.episode.status !== "open") {
		return rejected(state, "save.episode-open-required");
	}
	return accepted(state, {
		...state,
		episode: {
			status: "reviewing-save",
			core: state.episode.core,
			lastMemo: state.episode.lastMemo,
			proposal: {
				proposalId: event.proposalId,
				summary: event.summary,
			},
		},
	});
}

function matchingProposal(
	state: ObserverState,
	proposalId: string,
): ObserverEventApplication | ReviewingSaveEpisode {
	if (state.episode.status !== "reviewing-save") {
		return rejected(state, "save.review-required");
	}
	if (state.episode.proposal.proposalId !== proposalId) {
		return rejected(state, "save.proposal-mismatch");
	}
	return state.episode;
}

function isRejectedApplication(
	value: ObserverEventApplication | ReviewingSaveEpisode,
): value is ObserverEventApplication {
	return "applied" in value;
}

function applySaveCancelled(
	state: ObserverState,
	event: SaveCancelledEvent,
): ObserverEventApplication {
	const episode = matchingProposal(state, event.proposalId);
	if (isRejectedApplication(episode)) return episode;
	return accepted(state, {
		...state,
		episode: {
			status: "open",
			core: episode.core,
			lastMemo: episode.lastMemo,
		},
	});
}

function applySaveCommitted(
	state: ObserverState,
	event: SaveCommittedEvent,
): ObserverEventApplication {
	const episode = matchingProposal(state, event.proposalId);
	if (isRejectedApplication(episode)) return episode;
	if (event.receipt.status !== "validated") {
		return rejected(state, "save.receipt-unvalidated");
	}
	return accepted(state, {
		mode: "off",
		selectedNotebookId: state.selectedNotebookId,
		episode: {
			status: "settled",
			core: episode.core,
			lastMemo: episode.lastMemo,
			committedSave: {
				proposalId: event.proposalId,
				receipt: {
					receiptId: event.receipt.receiptId,
					status: event.receipt.status,
					recordIds: event.receipt.recordIds,
				},
			},
		},
	});
}

function assertNever(value: never): never {
	throw new Error(`Unhandled Observer event: ${String(value)}`);
}

export function applyObserverEvent(
	state: ObserverState,
	event: ObserverEvent,
): ObserverEventApplication {
	switch (event.kind) {
		case "episode-opened":
			return applyEpisodeOpened(state, event);
		case "activation-changed":
			return applyActivationChanged(state, event);
		case "notebook-selected":
			return applyNotebookSelected(state, event);
		case "memo-reconciled":
			return applyMemoReconciled(state, event);
		case "save-proposed":
			return applySaveProposed(state, event);
		case "save-cancelled":
			return applySaveCancelled(state, event);
		case "save-committed":
			return applySaveCommitted(state, event);
		default:
			return assertNever(event);
	}
}

export function canApplyObserverEvent(
	state: ObserverState,
	event: ObserverEvent,
): boolean {
	return applyObserverEvent(state, event).applied;
}

function transitionMessage(reason: ObserverTransitionRejection): string {
	return `Observer transition rejected: ${reason}.`;
}

export function reconstructObserverState(
	values: readonly unknown[],
): ObserverReplayResult {
	let state = initialObserverState();
	let appliedEvents = 0;
	const issues: ObserverReplayIssue[] = [];
	for (const [index, value] of values.entries()) {
		const decoded = normalizeObserverEvent(value);
		if (!decoded.ok) {
			issues.push({
				index,
				stage: "decode",
				code: decoded.issue.code,
				message: decoded.issue.message,
			});
			continue;
		}
		const application = applyObserverEvent(state, decoded.event);
		if (!application.applied) {
			issues.push({
				index,
				stage: "transition",
				code: application.reason,
				message: transitionMessage(application.reason),
			});
			continue;
		}
		state = application.state;
		appliedEvents += 1;
	}
	return { state, appliedEvents, issues };
}
