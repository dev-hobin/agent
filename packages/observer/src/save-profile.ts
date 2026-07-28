import { isAbsolute } from "node:path";

import { isSha256 } from "./content-hash.ts";
import type { EpisodeLanguage } from "./lifecycle.ts";
import { decodeNotebookId, type NotebookId } from "./notebook.ts";

export const OBSERVER_SAVE_SCHEMA: "observer-save/v1" = "observer-save/v1";
export const OBSERVER_SAVE_APPROVAL_SCHEMA: "observer-save-approval/v1" =
	"observer-save-approval/v1";
export const OBSERVER_SAVE_RECEIPT_SCHEMA: "observer-save-receipt/v1" =
	"observer-save-receipt/v1";

const MAX_ID_LENGTH = 200;

export interface PreparedCreateRecord {
	readonly operation: "create";
	readonly record_id: string;
	readonly markdown: string;
}

export interface PreparedUpdateRecord {
	readonly operation: "update";
	readonly record_id: string;
	readonly expected_sha256: string;
	readonly markdown: string;
}

export type PreparedRecord = PreparedCreateRecord | PreparedUpdateRecord;

export interface PreparedSave {
	readonly observer_save: typeof OBSERVER_SAVE_SCHEMA;
	readonly proposal_id: string;
	readonly notebook_id: NotebookId;
	readonly root: string;
	readonly episode_language: EpisodeLanguage;
	readonly records: readonly PreparedRecord[];
}

export interface SaveApproval {
	readonly observer_approval: typeof OBSERVER_SAVE_APPROVAL_SCHEMA;
	readonly proposal_id: string;
	readonly approved: boolean;
}

export interface SavedRecordReceipt {
	readonly operation: "create" | "update";
	readonly record_id: string;
	readonly path: string;
	readonly sha256: string;
}

export interface SaveReceipt {
	readonly observer_receipt: typeof OBSERVER_SAVE_RECEIPT_SCHEMA;
	readonly receipt_id: `receipt-${string}`;
	readonly proposal_id: string;
	readonly notebook_id: NotebookId;
	readonly records: readonly SavedRecordReceipt[];
}

export type SaveProfileIssueCode =
	| "save-profile.object"
	| "save-profile.shape"
	| "save-profile.unsupported";

export interface SaveProfileIssue {
	readonly code: SaveProfileIssueCode;
	readonly path: string;
	readonly message: string;
}

export type SaveProfileResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: SaveProfileIssue };

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

function isBoundedId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value === value.trim() &&
		value.length > 0 &&
		value.length <= MAX_ID_LENGTH
	);
}

function profileFailure<Value>(
	code: SaveProfileIssueCode,
	path: string,
	message: string,
): SaveProfileResult<Value> {
	return { ok: false, issue: { code, path, message } };
}

function decodePreparedRecord(
	value: unknown,
	index: number,
): SaveProfileResult<PreparedRecord> {
	const path = `/records/${index}`;
	if (!isObject(value)) {
		return profileFailure(
			"save-profile.object",
			path,
			"Prepared record must be an object.",
		);
	}
	if (value.operation === "create") {
		if (
			!hasExactKeys(value, ["operation", "record_id", "markdown"]) ||
			!isBoundedId(value.record_id) ||
			typeof value.markdown !== "string" ||
			value.markdown.length === 0
		) {
			return profileFailure(
				"save-profile.shape",
				path,
				"Create record requires record_id and non-empty Markdown.",
			);
		}
		return {
			ok: true,
			value: {
				operation: "create",
				record_id: value.record_id,
				markdown: value.markdown,
			},
		};
	}
	if (value.operation === "update") {
		if (
			!hasExactKeys(value, [
				"operation",
				"record_id",
				"expected_sha256",
				"markdown",
			]) ||
			!isBoundedId(value.record_id) ||
			!isSha256(value.expected_sha256) ||
			typeof value.markdown !== "string" ||
			value.markdown.length === 0
		) {
			return profileFailure(
				"save-profile.shape",
				path,
				"Update record requires ID, exact SHA-256, and non-empty Markdown.",
			);
		}
		return {
			ok: true,
			value: {
				operation: "update",
				record_id: value.record_id,
				expected_sha256: value.expected_sha256,
				markdown: value.markdown,
			},
		};
	}
	return profileFailure(
		"save-profile.shape",
		`${path}/operation`,
		"Prepared record operation must be create or update.",
	);
}

export function decodePreparedSave(
	value: unknown,
): SaveProfileResult<PreparedSave> {
	if (!isObject(value)) {
		return profileFailure(
			"save-profile.object",
			"/",
			"Prepared save must be an object.",
		);
	}
	if (value.observer_save !== OBSERVER_SAVE_SCHEMA) {
		return profileFailure(
			typeof value.observer_save === "string"
				? "save-profile.unsupported"
				: "save-profile.shape",
			"/observer_save",
			"Prepared save has an unsupported schema.",
		);
	}
	const notebookId = decodeNotebookId(value.notebook_id);
	if (
		!hasExactKeys(value, [
			"observer_save",
			"proposal_id",
			"notebook_id",
			"root",
			"episode_language",
			"records",
		]) ||
		!isBoundedId(value.proposal_id) ||
		!notebookId ||
		typeof value.root !== "string" ||
		!isAbsolute(value.root) ||
		(value.episode_language !== "ko" && value.episode_language !== "en") ||
		!Array.isArray(value.records)
	) {
		return profileFailure(
			"save-profile.shape",
			"/",
			"Prepared save has an invalid v1 shape.",
		);
	}
	const records: PreparedRecord[] = [];
	for (const [index, candidate] of value.records.entries()) {
		const decoded = decodePreparedRecord(candidate, index);
		if (!decoded.ok) return decoded;
		records.push(decoded.value);
	}
	return {
		ok: true,
		value: {
			observer_save: OBSERVER_SAVE_SCHEMA,
			proposal_id: value.proposal_id,
			notebook_id: notebookId,
			root: value.root,
			episode_language: value.episode_language,
			records,
		},
	};
}

export function decodeSaveApproval(
	value: unknown,
): SaveProfileResult<SaveApproval> {
	if (!isObject(value)) {
		return profileFailure(
			"save-profile.object",
			"/",
			"Review & Save approval must be an object.",
		);
	}
	if (value.observer_approval !== OBSERVER_SAVE_APPROVAL_SCHEMA) {
		return profileFailure(
			typeof value.observer_approval === "string"
				? "save-profile.unsupported"
				: "save-profile.shape",
			"/observer_approval",
			"Review & Save approval has an unsupported schema.",
		);
	}
	if (
		!hasExactKeys(value, [
			"observer_approval",
			"proposal_id",
			"approved",
		]) ||
		!isBoundedId(value.proposal_id) ||
		typeof value.approved !== "boolean"
	) {
		return profileFailure(
			"save-profile.shape",
			"/",
			"Review & Save approval has an invalid v1 shape.",
		);
	}
	return {
		ok: true,
		value: {
			observer_approval: OBSERVER_SAVE_APPROVAL_SCHEMA,
			proposal_id: value.proposal_id,
			approved: value.approved,
		},
	};
}
