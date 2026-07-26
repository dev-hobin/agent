import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import { atomicReplaceTextFile } from "./atomic-file.ts";
import { decodeNotebookId, type NotebookId } from "./notebook.ts";

export const OBSERVER_SELECTION_SCHEMA: "observer-selection/v1" =
	"observer-selection/v1";

export interface NotebookSelection {
	readonly observer_selection: typeof OBSERVER_SELECTION_SCHEMA;
	readonly notebook_id: NotebookId;
	readonly root: string;
}

export type NotebookSelectionDecodeCode =
	| "selection.invalid"
	| "selection.unsupported";

export interface NotebookSelectionDecodeIssue {
	readonly code: NotebookSelectionDecodeCode;
	readonly message: string;
}

export type NotebookSelectionDecodeResult =
	| { readonly ok: true; readonly value: NotebookSelection }
	| { readonly ok: false; readonly issue: NotebookSelectionDecodeIssue };

export type NotebookSelectionLoad =
	| { readonly found: false }
	| { readonly found: true; readonly value: unknown };

export interface NotebookSelectionStore {
	readonly location: string;
	load(): Promise<NotebookSelectionLoad>;
	save(selection: NotebookSelection): Promise<void>;
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

export function decodeNotebookSelection(
	value: unknown,
): NotebookSelectionDecodeResult {
	if (!isObject(value)) {
		return {
			ok: false,
			issue: {
				code: "selection.invalid",
				message: "Notebook selection must be an object.",
			},
		};
	}
	if (value.observer_selection !== OBSERVER_SELECTION_SCHEMA) {
		return {
			ok: false,
			issue: {
				code:
					typeof value.observer_selection === "string"
						? "selection.unsupported"
						: "selection.invalid",
				message: "Notebook selection has an unsupported schema.",
			},
		};
	}
	const id = decodeNotebookId(value.notebook_id);
	if (
		!hasExactKeys(value, ["observer_selection", "notebook_id", "root"]) ||
		!id ||
		typeof value.root !== "string" ||
		!isAbsolute(value.root)
	) {
		return {
			ok: false,
			issue: {
				code: "selection.invalid",
				message: "Notebook selection has an invalid v1 shape.",
			},
		};
	}
	return {
		ok: true,
		value: {
			observer_selection: OBSERVER_SELECTION_SCHEMA,
			notebook_id: id,
			root: value.root,
		},
	};
}

function selectionSource(selection: NotebookSelection): string {
	return `${JSON.stringify(selection, null, 2)}\n`;
}

function errorCode(value: unknown): string | undefined {
	if (!isObject(value) || typeof value.code !== "string") return undefined;
	return value.code;
}

export function fileNotebookSelectionStore(
	location: string,
): NotebookSelectionStore {
	if (!isAbsolute(location)) {
		throw new Error("Notebook selection store path must be absolute.");
	}
	return {
		location,
		async load(): Promise<NotebookSelectionLoad> {
			let source: string;
			try {
				source = await readFile(location, "utf8");
			} catch (error) {
				if (errorCode(error) === "ENOENT") return { found: false };
				throw new Error("Failed to read notebook selection.", {
					cause: error,
				});
			}
			try {
				return { found: true, value: JSON.parse(source) };
			} catch {
				return { found: true, value: source };
			}
		},
		async save(selection: NotebookSelection): Promise<void> {
			await mkdir(dirname(location), { recursive: true });
			await atomicReplaceTextFile(location, selectionSource(selection));
		},
	};
}
