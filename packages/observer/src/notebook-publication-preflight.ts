import { join } from "node:path";

import { sha256Text } from "./content-hash.ts";
import {
	decodeObserverMarkdown,
	type MarkdownInput,
	type ObserverDiagnostic,
	type ObserverRecordId,
} from "./markdown-profile.ts";
import type { NotebookHandle, NotebookInventoryEntry } from "./notebook.ts";
import { validateObserverNotebook } from "./notebook-validation.ts";
import type { PreparedRecord, PreparedSave } from "./save-profile.ts";

export interface InventoryFingerprint {
	readonly path: string;
	readonly relativePath: string;
	readonly recordId: ObserverRecordId;
	readonly sha256: string;
}

export interface NotebookPublicationEntry {
	readonly operation: "create" | "update";
	readonly recordId: ObserverRecordId;
	readonly targetPath: string;
	readonly relativePath: string;
	readonly nextContent: string;
	readonly nextSha256: string;
	readonly beforeContent: string | null;
	readonly beforeSha256: string | null;
}

export interface NotebookPublicationPlan {
	readonly proposalId: string;
	readonly notebook: NotebookHandle;
	readonly snapshot: readonly InventoryFingerprint[];
	readonly entries: readonly NotebookPublicationEntry[];
	readonly finalInputs: readonly MarkdownInput[];
}

export type PublicationPreflightIssueCode =
	| "publication-preflight.create-collision"
	| "publication-preflight.duplicate-id"
	| "publication-preflight.final-invalid"
	| "publication-preflight.record-invalid"
	| "publication-preflight.record-mismatch"
	| "publication-preflight.update-missing"
	| "publication-preflight.update-stale";

export interface PublicationPreflightIssue {
	readonly code: PublicationPreflightIssueCode;
	readonly message: string;
	readonly recordId?: string;
	readonly path?: string;
	readonly diagnostics?: readonly ObserverDiagnostic[];
}

type PublicationPreflightFailure = {
	readonly ok: false;
	readonly issue: PublicationPreflightIssue;
};

export type PublicationPreflightResult =
	| { readonly ok: true; readonly value: NotebookPublicationPlan }
	| PublicationPreflightFailure;

interface ProposedDocument {
	readonly prepared: PreparedRecord;
	readonly recordId: ObserverRecordId;
	readonly content: string;
}

function failure(
	code: PublicationPreflightIssueCode,
	message: string,
	input?: {
		readonly recordId?: string;
		readonly path?: string;
		readonly diagnostics?: readonly ObserverDiagnostic[];
	},
): PublicationPreflightFailure {
	return {
		ok: false,
		issue: {
			code,
			message,
			...(input?.recordId ? { recordId: input.recordId } : {}),
			...(input?.path ? { path: input.path } : {}),
			...(input?.diagnostics ? { diagnostics: input.diagnostics } : {}),
		},
	};
}

function decodeProposedDocuments(
	records: readonly PreparedRecord[],
):
	| { readonly ok: true; readonly value: readonly ProposedDocument[] }
	| { readonly ok: false; readonly issue: PublicationPreflightIssue } {
	const seen = new Set<string>();
	const proposed: ProposedDocument[] = [];
	for (const [index, prepared] of records.entries()) {
		if (seen.has(prepared.record_id)) {
			return {
				ok: false,
				issue: {
					code: "publication-preflight.duplicate-id",
					message: "Prepared save contains a duplicate record ID.",
					recordId: prepared.record_id,
				},
			};
		}
		seen.add(prepared.record_id);
		const path = `<prepared-record-${index}>`;
		const decoded = decodeObserverMarkdown({
			path,
			content: prepared.markdown,
		});
		if (!decoded.ok) {
			return {
				ok: false,
				issue: {
					code: "publication-preflight.record-invalid",
					message: "Prepared record failed Markdown validation.",
					recordId: prepared.record_id,
					path,
					diagnostics: decoded.diagnostics,
				},
			};
		}
		if (decoded.value.record.id !== prepared.record_id) {
			return {
				ok: false,
				issue: {
					code: "publication-preflight.record-mismatch",
					message: "Prepared record ID differs from decoded Markdown ID.",
					recordId: prepared.record_id,
					path,
				},
			};
		}
		proposed.push({
			prepared,
			recordId: decoded.value.record.id,
			content: prepared.markdown,
		});
	}
	return { ok: true, value: proposed };
}

function fingerprint(entry: NotebookInventoryEntry): InventoryFingerprint {
	return {
		path: entry.path,
		relativePath: entry.relativePath,
		recordId: entry.document.record.id,
		sha256: entry.sha256,
	};
}

function createPublicationEntry(
	notebook: NotebookHandle,
	proposed: ProposedDocument,
	existingById: ReadonlyMap<string, NotebookInventoryEntry>,
	existingPaths: ReadonlySet<string>,
): PublicationPreflightFailure | NotebookPublicationEntry {
	if (existingById.has(proposed.recordId)) {
		return failure(
			"publication-preflight.create-collision",
			"Create record ID already exists in the notebook.",
			{ recordId: proposed.recordId },
		);
	}
	const targetPath = join(notebook.recordsDir, `${proposed.recordId}.md`);
	if (existingPaths.has(targetPath)) {
		return failure(
			"publication-preflight.create-collision",
			"Create record target path already exists.",
			{ recordId: proposed.recordId, path: targetPath },
		);
	}
	return {
		operation: "create",
		recordId: proposed.recordId,
		targetPath,
		relativePath: `records/${proposed.recordId}.md`,
		nextContent: proposed.content,
		nextSha256: sha256Text(proposed.content),
		beforeContent: null,
		beforeSha256: null,
	};
}

function updatePublicationEntry(
	proposed: ProposedDocument,
	existingById: ReadonlyMap<string, NotebookInventoryEntry>,
): PublicationPreflightFailure | NotebookPublicationEntry {
	const existing = existingById.get(proposed.recordId);
	if (!existing) {
		return failure(
			"publication-preflight.update-missing",
			"Update record does not exist in the notebook.",
			{ recordId: proposed.recordId },
		);
	}
	if (
		proposed.prepared.operation !== "update" ||
		existing.sha256 !== proposed.prepared.expected_sha256
	) {
		return failure(
			"publication-preflight.update-stale",
			"Update record exact bytes differ from the approved revision.",
			{ recordId: proposed.recordId, path: existing.path },
		);
	}
	return {
		operation: "update",
		recordId: proposed.recordId,
		targetPath: existing.path,
		relativePath: existing.relativePath,
		nextContent: proposed.content,
		nextSha256: sha256Text(proposed.content),
		beforeContent: existing.content,
		beforeSha256: existing.sha256,
	};
}

function isPreflightFailure(
	value: PublicationPreflightFailure | NotebookPublicationEntry,
): value is PublicationPreflightFailure {
	return "ok" in value && !value.ok;
}

export function buildNotebookPublicationPlan(
	notebook: NotebookHandle,
	inventory: readonly NotebookInventoryEntry[],
	prepared: PreparedSave,
): PublicationPreflightResult {
	const decoded = decodeProposedDocuments(prepared.records);
	if (!decoded.ok) return { ok: false, issue: decoded.issue };
	const existingById = new Map(
		inventory.map((entry) => [entry.document.record.id, entry]),
	);
	const existingPaths = new Set(inventory.map((entry) => entry.path));
	const entries: NotebookPublicationEntry[] = [];
	for (const proposed of decoded.value) {
		const entry =
			proposed.prepared.operation === "create"
				? createPublicationEntry(
						notebook,
						proposed,
						existingById,
						existingPaths,
					)
				: updatePublicationEntry(proposed, existingById);
		if (isPreflightFailure(entry)) return entry;
		entries.push(entry);
	}
	entries.sort((left, right) => left.recordId.localeCompare(right.recordId));
	const publicationById = new Map(
		entries.map((entry) => [entry.recordId, entry]),
	);
	const finalInputs: MarkdownInput[] = inventory.map((entry) => {
		const publication = publicationById.get(entry.document.record.id);
		return {
			path: entry.path,
			content: publication?.nextContent ?? entry.content,
		};
	});
	for (const entry of entries) {
		if (entry.operation === "create") {
			finalInputs.push({ path: entry.targetPath, content: entry.nextContent });
		}
	}
	finalInputs.sort((left, right) => left.path.localeCompare(right.path));
	const finalValidation = validateObserverNotebook(finalInputs);
	if (!finalValidation.ok) {
		return failure(
			"publication-preflight.final-invalid",
			"Final notebook graph failed validation.",
			{ diagnostics: finalValidation.diagnostics },
		);
	}
	return {
		ok: true,
		value: {
			proposalId: prepared.proposal_id,
			notebook,
			snapshot: inventory
				.map(fingerprint)
				.sort((left, right) => left.path.localeCompare(right.path)),
			entries,
			finalInputs,
		},
	};
}
