import { randomUUID } from "node:crypto";

import {
	applyObserverEvent,
	OBSERVER_PROTOCOL,
	type ObserverState,
	type SaveCommittedEvent,
} from "./lifecycle.ts";
import type { ObserverDiagnostic } from "./markdown-profile.ts";
import { readNotebookInventory, type NotebookHandle } from "./notebook.ts";
import {
	createNotebookService,
	type NotebookServiceIssue,
	type NotebookServiceIssueCode,
} from "./notebook-service.ts";
import type { NotebookSelectionStore } from "./notebook-selection-store.ts";
import {
	decodePreparedSave,
	decodeSaveApproval,
	OBSERVER_SAVE_RECEIPT_SCHEMA,
	type PreparedSave,
	type SaveProfileIssueCode,
	type SaveReceipt,
} from "./save-profile.ts";
import type { NotebookPublicationPlan } from "./notebook-publication-preflight.ts";
import {
	createNotebookPublicationService,
	type NotebookPublicationIssue,
	type NotebookPublicationService,
	type PreparedPublication,
} from "./notebook-publication-service.ts";

export type SaveServiceIssueCode =
	| NotebookServiceIssueCode
	| SaveProfileIssueCode
	| "save.busy"
	| "save.concurrent-change"
	| "save.declined"
	| "save.invalid-plan"
	| "save.lifecycle"
	| "save.persistence"
	| "save.target-mismatch";

export interface SaveServiceIssue {
	readonly code: SaveServiceIssueCode;
	readonly message: string;
	readonly recoveryRequired: boolean;
	readonly path?: string;
	readonly recordId?: string;
	readonly diagnostics?: readonly ObserverDiagnostic[];
}

export type SaveServiceFailure = {
	readonly ok: false;
	readonly issue: SaveServiceIssue;
};

export type SavePreflightResult =
	| {
			readonly ok: true;
			readonly value: NotebookPublicationPlan;
	  }
	| SaveServiceFailure;

export type SaveServiceResult =
	| {
			readonly ok: true;
			readonly value: {
				readonly state: ObserverState;
				readonly receipt: SaveReceipt;
				readonly notebook: NotebookHandle;
			};
	  }
	| SaveServiceFailure;

export interface SaveService {
	preflight(input: {
		readonly state: ObserverState;
		readonly prepared: unknown;
	}): Promise<SavePreflightResult>;
	commit(input: {
		readonly state: ObserverState;
		readonly prepared: unknown;
		readonly approval: unknown;
	}): Promise<SaveServiceResult>;
}

function failure(
	code: SaveServiceIssueCode,
	message: string,
	input?: {
		readonly recoveryRequired?: boolean;
		readonly path?: string;
		readonly recordId?: string;
		readonly diagnostics?: readonly ObserverDiagnostic[];
	},
): SaveServiceFailure {
	return {
		ok: false,
		issue: {
			code,
			message,
			recoveryRequired: input?.recoveryRequired ?? false,
			...(input?.path ? { path: input.path } : {}),
			...(input?.recordId ? { recordId: input.recordId } : {}),
			...(input?.diagnostics ? { diagnostics: input.diagnostics } : {}),
		},
	};
}

function notebookFailure(issue: NotebookServiceIssue): SaveServiceFailure {
	return failure(issue.code, issue.message, {
		path: issue.path,
		diagnostics: issue.diagnostics,
	});
}

function saveCodeForPublication(
	issue: NotebookPublicationIssue,
): SaveServiceIssueCode {
	if (issue.code.startsWith("publication-preflight."))
		return "save.invalid-plan";
	if (issue.code === "publication-transaction.active") return "save.busy";
	if (issue.code === "publication-transaction.drift") {
		return "save.concurrent-change";
	}
	return "save.persistence";
}

function publicationFailure(
	issue: NotebookPublicationIssue,
): SaveServiceFailure {
	return failure(saveCodeForPublication(issue), issue.message, {
		recoveryRequired: issue.recoveryRequired,
		path: issue.path,
		recordId: issue.recordId,
		diagnostics: issue.diagnostics,
	});
}

function lifecycleTargetCheck(
	state: ObserverState,
	prepared: PreparedSave,
	requireReviewing: boolean,
): SaveServiceFailure | null {
	if (
		state.episode.status !== "open" &&
		state.episode.status !== "reviewing-save"
	) {
		return failure(
			"save.lifecycle",
			"Save preflight requires an open Episode or its current reviewed proposal.",
		);
	}
	if (requireReviewing && state.episode.status !== "reviewing-save") {
		return failure(
			"save.lifecycle",
			"Save commit requires an Episode reviewing the current proposal.",
		);
	}
	if (
		state.episode.status === "reviewing-save" &&
		state.episode.proposal.proposalId !== prepared.proposal_id
	) {
		return failure("save.lifecycle", "Prepared save proposal is stale.");
	}
	if (
		state.selectedNotebookId !== prepared.notebook_id ||
		state.episode.core.notebookId !== prepared.notebook_id
	) {
		return failure(
			"save.target-mismatch",
			"Prepared save notebook does not match lifecycle state.",
		);
	}
	return null;
}

function createReceiptId(): `receipt-${string}` {
	return `receipt-${randomUUID()}`;
}

function commitEvent(
	proposalId: string,
	receiptId: string,
	recordIds: readonly string[],
): SaveCommittedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "save-committed",
		proposalId,
		receipt: {
			receiptId,
			status: "validated",
			recordIds,
		},
	};
}

interface PreparedSavePublication {
	readonly publication: PreparedPublication;
}

type PreparedSavePublicationResult =
	| { readonly ok: true; readonly value: PreparedSavePublication }
	| SaveServiceFailure;

async function prepareSavePublication(
	selectionStore: NotebookSelectionStore,
	publicationService: NotebookPublicationService,
	input: {
		readonly state: ObserverState;
		readonly prepared: PreparedSave;
		readonly requireReviewing: boolean;
	},
): Promise<PreparedSavePublicationResult> {
	const targetIssue = lifecycleTargetCheck(
		input.state,
		input.prepared,
		input.requireReviewing,
	);
	if (targetIssue) return targetIssue;
	const notebooks = createNotebookService({ selectionStore });
	const recovered = await notebooks.recover(input.state);
	if (!recovered.ok) return notebookFailure(recovered.issue);
	if (
		recovered.value.notebook.root !== input.prepared.root ||
		recovered.value.notebook.manifest.notebook_id !== input.prepared.notebook_id
	) {
		return failure(
			"save.target-mismatch",
			"Prepared save target differs from the recovered notebook.",
		);
	}
	const inventory = await readNotebookInventory(recovered.value.notebook);
	if (!inventory.ok) {
		return failure(inventory.issue.code, inventory.issue.message, {
			path: inventory.issue.path,
			diagnostics: inventory.issue.diagnostics,
		});
	}
	const publication = publicationService.prepare({
		notebook: recovered.value.notebook,
		inventory: inventory.value,
		save: input.prepared,
	});
	if (!publication.ok) return publicationFailure(publication.issue);
	return {
		ok: true,
		value: { publication: publication.value },
	};
}

async function preflightSave(
	selectionStore: NotebookSelectionStore,
	publicationService: NotebookPublicationService,
	input: { readonly state: ObserverState; readonly prepared: unknown },
): Promise<SavePreflightResult> {
	const preparedResult = decodePreparedSave(input.prepared);
	if (!preparedResult.ok) {
		return failure(preparedResult.issue.code, preparedResult.issue.message, {
			path: preparedResult.issue.path,
		});
	}
	const prepared = await prepareSavePublication(
		selectionStore,
		publicationService,
		{
			state: input.state,
			prepared: preparedResult.value,
			requireReviewing: false,
		},
	);
	if (!prepared.ok) return prepared;
	return { ok: true, value: prepared.value.publication.plan };
}

async function commitSave(
	selectionStore: NotebookSelectionStore,
	publicationService: NotebookPublicationService,
	input: {
		readonly state: ObserverState;
		readonly prepared: unknown;
		readonly approval: unknown;
	},
): Promise<SaveServiceResult> {
	const preparedResult = decodePreparedSave(input.prepared);
	if (!preparedResult.ok) {
		return failure(preparedResult.issue.code, preparedResult.issue.message, {
			path: preparedResult.issue.path,
		});
	}
	const approvalResult = decodeSaveApproval(input.approval);
	if (!approvalResult.ok) {
		return failure(approvalResult.issue.code, approvalResult.issue.message, {
			path: approvalResult.issue.path,
		});
	}
	if (approvalResult.value.proposal_id !== preparedResult.value.proposal_id) {
		return failure(
			"save.lifecycle",
			"Approval proposal does not match prepared save.",
		);
	}
	if (!approvalResult.value.approved)
		return failure("save.declined", "Save approval was declined.");

	const prepared = await prepareSavePublication(
		selectionStore,
		publicationService,
		{
			state: input.state,
			prepared: preparedResult.value,
			requireReviewing: true,
		},
	);
	if (!prepared.ok) return prepared;
	const receiptId = createReceiptId();
	const event = commitEvent(
		preparedResult.value.proposal_id,
		receiptId,
		prepared.value.publication.recordIds,
	);
	const projected = applyObserverEvent(input.state, event);
	if (!projected.applied) {
		return failure(
			"save.lifecycle",
			`Save lifecycle preflight failed: ${projected.reason}.`,
		);
	}
	const published = await publicationService.commit({
		prepared: prepared.value.publication,
		receiptId,
	});
	if (!published.ok) return publicationFailure(published.issue);
	const committed = applyObserverEvent(input.state, event);
	if (!committed.applied) {
		return failure(
			"save.lifecycle",
			"Durable save succeeded but lifecycle acknowledgment was rejected.",
			{ recoveryRequired: true },
		);
	}
	return {
		ok: true,
		value: {
			state: committed.state,
			notebook: published.value.notebook,
			receipt: {
				observer_receipt: OBSERVER_SAVE_RECEIPT_SCHEMA,
				receipt_id: published.value.receiptId,
				proposal_id: published.value.proposalId,
				notebook_id: published.value.notebook.manifest.notebook_id,
				records: published.value.records.map((record) => ({
					operation: record.operation,
					record_id: record.recordId,
					path: record.relativePath,
					sha256: record.sha256,
				})),
			},
		},
	};
}

export function createSaveService(input: {
	readonly selectionStore: NotebookSelectionStore;
	readonly publicationService?: NotebookPublicationService;
}): SaveService {
	const publicationService =
		input.publicationService ?? createNotebookPublicationService();
	return {
		preflight: (preflightInput) =>
			preflightSave(input.selectionStore, publicationService, preflightInput),
		commit: (commitInput) =>
			commitSave(input.selectionStore, publicationService, commitInput),
	};
}
