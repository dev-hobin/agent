import { realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";

import {
	applyObserverEvent,
	normalizeObserverEvent,
	OBSERVER_PROTOCOL,
	type EpisodeLanguage,
	type NotebookSelectedEvent,
	type ObserverState,
} from "./lifecycle.ts";
import {
	initializeNotebook,
	openNotebook,
	replaceNotebookDefaultLanguage,
	type NotebookHandle,
	type NotebookIssue,
	type NotebookIssueCode,
} from "./notebook.ts";
import {
	decodeNotebookSelection,
	OBSERVER_SELECTION_SCHEMA,
	type NotebookSelection,
	type NotebookSelectionDecodeCode,
	type NotebookSelectionLoad,
	type NotebookSelectionStore,
} from "./notebook-selection-store.ts";

export type NotebookServiceIssueCode =
	| NotebookIssueCode
	| NotebookSelectionDecodeCode
	| "lifecycle.rejected"
	| "selection.live-switch"
	| "selection.missing"
	| "selection.stale"
	| "selection.store";

export interface NotebookServiceIssue {
	readonly code: NotebookServiceIssueCode;
	readonly message: string;
	readonly path?: string;
	readonly diagnostics?: NotebookIssue["diagnostics"];
}

export type NotebookServiceResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: NotebookServiceIssue };

export interface NotebookSession {
	readonly notebook: NotebookHandle;
	readonly selection: NotebookSelection;
	readonly state: ObserverState;
}

export type NotebookStatus =
	| { readonly status: "unselected" }
	| { readonly status: "ready"; readonly notebook: NotebookHandle }
	| {
			readonly status: "unhealthy";
			readonly issue: NotebookServiceIssue;
	  };

export interface NotebookSetupInput {
	readonly root: string;
	readonly defaultLanguage: EpisodeLanguage;
	readonly state: ObserverState;
}

export interface NotebookSelectInput {
	readonly root: string;
	readonly state: ObserverState;
}

export interface NotebookEpisodeInput {
	readonly state: ObserverState;
	readonly episodeId: string;
}

export interface NotebookLanguageInput {
	readonly state: ObserverState;
	readonly language: EpisodeLanguage;
}

export interface NotebookService {
	setup(
		input: NotebookSetupInput,
	): Promise<NotebookServiceResult<NotebookSession>>;
	select(
		input: NotebookSelectInput,
	): Promise<NotebookServiceResult<NotebookSession>>;
	recover(
		state: ObserverState,
	): Promise<NotebookServiceResult<NotebookSession>>;
	openEpisode(
		input: NotebookEpisodeInput,
	): Promise<NotebookServiceResult<NotebookSession>>;
	updateDefaultLanguage(
		input: NotebookLanguageInput,
	): Promise<NotebookServiceResult<NotebookSession>>;
	status(): Promise<NotebookStatus>;
}

function failure<Value>(
	issue: NotebookServiceIssue,
): NotebookServiceResult<Value> {
	return { ok: false, issue };
}

function notebookServiceIssue(issue: NotebookIssue): NotebookServiceIssue {
	return issue.diagnostics
		? {
				code: issue.code,
				message: issue.message,
				path: issue.path,
				diagnostics: issue.diagnostics,
			}
		: { code: issue.code, message: issue.message, path: issue.path };
}

function isLiveEpisode(state: ObserverState): boolean {
	return (
		state.episode.status === "open" ||
		state.episode.status === "reviewing-wrap"
	);
}

function selectedEvent(notebookId: string): NotebookSelectedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "notebook-selected",
		notebookId,
	};
}

function episodeEvent(notebook: NotebookHandle, episodeId: string) {
	return normalizeObserverEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId,
		notebookId: notebook.manifest.notebook_id,
		lang: notebook.manifest.default_language,
	});
}

function selectionFor(notebook: NotebookHandle): NotebookSelection {
	return {
		observer_selection: OBSERVER_SELECTION_SCHEMA,
		notebook_id: notebook.manifest.notebook_id,
		root: notebook.root,
	};
}

function sameSelection(
	left: NotebookSelection,
	right: NotebookSelection,
): boolean {
	return left.notebook_id === right.notebook_id && left.root === right.root;
}

async function loadSelection(
	store: NotebookSelectionStore,
): Promise<NotebookServiceResult<NotebookSelection | null>> {
	let loaded: NotebookSelectionLoad;
	try {
		loaded = await store.load();
	} catch (error) {
		return failure({
			code: "selection.store",
			message:
				error instanceof Error
					? error.message
					: "Failed to load notebook selection.",
			path: store.location,
		});
	}
	if (!loaded.found) return { ok: true, value: null };
	const decoded = decodeNotebookSelection(loaded.value);
	if (!decoded.ok) {
		return failure({
			code: decoded.issue.code,
			message: decoded.issue.message,
			path: store.location,
		});
	}
	return { ok: true, value: decoded.value };
}

async function selectionForChoice(
	store: NotebookSelectionStore,
	state: ObserverState,
): Promise<NotebookServiceResult<NotebookSelection | null>> {
	const selected = await loadSelection(store);
	if (selected.ok) return selected;
	if (
		!isLiveEpisode(state) &&
		(selected.issue.code === "selection.invalid" ||
			selected.issue.code === "selection.unsupported")
	) {
		return { ok: true, value: null };
	}
	return selected;
}

async function openSelection(
	selection: NotebookSelection,
): Promise<NotebookServiceResult<NotebookHandle>> {
	const opened = await openNotebook(selection.root);
	if (!opened.ok) {
		if (
			opened.issue.code === "notebook.path-missing" ||
			opened.issue.code === "notebook.manifest-missing"
		) {
			return failure({
				code: "selection.stale",
				message: "Selected notebook target is no longer available.",
				path: selection.root,
			});
		}
		return failure(notebookServiceIssue(opened.issue));
	}
	if (opened.value.manifest.notebook_id !== selection.notebook_id) {
		return failure({
			code: "selection.stale",
			message: "Selected notebook identity no longer matches its manifest.",
			path: selection.root,
		});
	}
	return { ok: true, value: opened.value };
}

async function persistSelection(
	store: NotebookSelectionStore,
	selection: NotebookSelection,
): Promise<NotebookServiceResult<NotebookSelection>> {
	try {
		await store.save(selection);
		return { ok: true, value: selection };
	} catch (error) {
		return failure({
			code: "selection.store",
			message:
				error instanceof Error
					? error.message
					: "Failed to save notebook selection.",
			path: store.location,
		});
	}
}

async function chooseNotebook(
	store: NotebookSelectionStore,
	notebook: NotebookHandle,
	state: ObserverState,
	current: NotebookSelection | null,
): Promise<NotebookServiceResult<NotebookSession>> {
	const candidate = selectionFor(notebook);
	if (isLiveEpisode(state) && (!current || !sameSelection(current, candidate))) {
		return failure({
			code: "selection.live-switch",
			message: "Cannot change notebook target during a live episode.",
			path: candidate.root,
		});
	}
	const application = applyObserverEvent(
		state,
		selectedEvent(candidate.notebook_id),
	);
	if (!application.applied) {
		return failure({
			code: "lifecycle.rejected",
			message: `Notebook selection was rejected: ${application.reason}.`,
			path: candidate.root,
		});
	}
	if (!current || !sameSelection(current, candidate)) {
		const persisted = await persistSelection(store, candidate);
		if (!persisted.ok) return persisted;
	}
	return {
		ok: true,
		value: {
			notebook,
			selection: candidate,
			state: application.state,
		},
	};
}

async function recoverNotebook(
	store: NotebookSelectionStore,
	state: ObserverState,
): Promise<NotebookServiceResult<NotebookSession>> {
	const selected = await loadSelection(store);
	if (!selected.ok) return selected;
	if (!selected.value) {
		return failure({
			code: "selection.missing",
			message: "No Observer notebook is selected.",
			path: store.location,
		});
	}
	const opened = await openSelection(selected.value);
	if (!opened.ok) return opened;
	const application = applyObserverEvent(
		state,
		selectedEvent(selected.value.notebook_id),
	);
	if (!application.applied) {
		return failure({
			code: "lifecycle.rejected",
			message: `Notebook recovery was rejected: ${application.reason}.`,
			path: selected.value.root,
		});
	}
	return {
		ok: true,
		value: {
			notebook: opened.value,
			selection: selected.value,
			state: application.state,
		},
	};
}

async function selectNotebook(
	store: NotebookSelectionStore,
	input: NotebookSelectInput,
): Promise<NotebookServiceResult<NotebookSession>> {
	const opened = await openNotebook(input.root);
	if (!opened.ok) return failure(notebookServiceIssue(opened.issue));
	const current = await selectionForChoice(store, input.state);
	if (!current.ok) return current;
	return chooseNotebook(store, opened.value, input.state, current.value);
}

async function sameLiveSetupTarget(
	current: NotebookSelection | null,
	root: string,
): Promise<boolean> {
	if (!current || !isAbsolute(root)) return false;
	try {
		return (await realpath(root)) === current.root;
	} catch {
		return false;
	}
}

async function setupNotebook(
	store: NotebookSelectionStore,
	input: NotebookSetupInput,
): Promise<NotebookServiceResult<NotebookSession>> {
	const current = await selectionForChoice(store, input.state);
	if (!current.ok) return current;
	if (
		isLiveEpisode(input.state) &&
		!(await sameLiveSetupTarget(current.value, input.root))
	) {
		return failure({
			code: "selection.live-switch",
			message: "Cannot initialize another notebook during a live episode.",
			path: input.root,
		});
	}
	const initialized = await initializeNotebook(
		input.root,
		input.defaultLanguage,
	);
	if (!initialized.ok) {
		return failure(notebookServiceIssue(initialized.issue));
	}
	return chooseNotebook(store, initialized.value, input.state, current.value);
}

async function openNotebookEpisode(
	store: NotebookSelectionStore,
	input: NotebookEpisodeInput,
): Promise<NotebookServiceResult<NotebookSession>> {
	const recovered = await recoverNotebook(store, input.state);
	if (!recovered.ok) return recovered;
	const decoded = episodeEvent(recovered.value.notebook, input.episodeId);
	if (!decoded.ok) {
		return failure({
			code: "lifecycle.rejected",
			message: decoded.issue.message,
			path: recovered.value.notebook.root,
		});
	}
	const application = applyObserverEvent(
		recovered.value.state,
		decoded.event,
	);
	if (!application.applied) {
		return failure({
			code: "lifecycle.rejected",
			message: `Episode open was rejected: ${application.reason}.`,
			path: recovered.value.notebook.root,
		});
	}
	return {
		ok: true,
		value: { ...recovered.value, state: application.state },
	};
}

async function updateNotebookLanguage(
	store: NotebookSelectionStore,
	input: NotebookLanguageInput,
): Promise<NotebookServiceResult<NotebookSession>> {
	const recovered = await recoverNotebook(store, input.state);
	if (!recovered.ok) return recovered;
	if (recovered.value.notebook.manifest.default_language === input.language) {
		return recovered;
	}
	const updated = await replaceNotebookDefaultLanguage(
		recovered.value.notebook,
		input.language,
	);
	if (!updated.ok) return failure(notebookServiceIssue(updated.issue));
	return {
		ok: true,
		value: { ...recovered.value, notebook: updated.value },
	};
}

async function inspectNotebookStatus(
	store: NotebookSelectionStore,
): Promise<NotebookStatus> {
	const selected = await loadSelection(store);
	if (!selected.ok) {
		return { status: "unhealthy", issue: selected.issue };
	}
	if (!selected.value) return { status: "unselected" };
	const opened = await openSelection(selected.value);
	if (!opened.ok) {
		return { status: "unhealthy", issue: opened.issue };
	}
	return { status: "ready", notebook: opened.value };
}

export function createNotebookService(input: {
	readonly selectionStore: NotebookSelectionStore;
}): NotebookService {
	const { selectionStore } = input;
	return {
		setup: (setupInput) => setupNotebook(selectionStore, setupInput),
		select: (selectInput) => selectNotebook(selectionStore, selectInput),
		recover: (state) => recoverNotebook(selectionStore, state),
		openEpisode: (episodeInput) =>
			openNotebookEpisode(selectionStore, episodeInput),
		updateDefaultLanguage: (languageInput) =>
			updateNotebookLanguage(selectionStore, languageInput),
		status: () => inspectNotebookStatus(selectionStore),
	};
}
