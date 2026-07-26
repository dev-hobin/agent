import { randomUUID } from "node:crypto";

import { sha256Text } from "./content-hash.ts";
import {
	applyObserverEvent,
	OBSERVER_PROTOCOL,
	type ObserverState,
	type WrapCommittedEvent,
} from "./lifecycle.ts";
import {
	openNotebook,
	readNotebookInventory,
	type NotebookHandle,
} from "./notebook.ts";
import {
	createNotebookService,
	type NotebookServiceIssue,
	type NotebookServiceIssueCode,
} from "./notebook-service.ts";
import type { NotebookSelectionStore } from "./notebook-selection-store.ts";
import {
	buildWrapPublicationPlan,
	type WrapPreflightIssue,
	type WrapPreflightIssueCode,
	type WrapPublicationPlan,
} from "./wrap-preflight.ts";
import {
	decodePreparedWrap,
	decodeWrapApproval,
	OBSERVER_WRAP_RECEIPT_SCHEMA,
	type PreparedWrap,
	type WrapProfileIssueCode,
	type WrapReceipt,
} from "./wrap-profile.ts";
import {
	executeWrapTransaction,
	type WrapFaultInjector,
	type WrapTransactionIssue,
	type WrapTransactionIssueCode,
	type WrapTransactionVerification,
} from "./wrap-transaction.ts";

export type WrapServiceIssueCode =
	| NotebookServiceIssueCode
	| WrapPreflightIssueCode
	| WrapProfileIssueCode
	| WrapTransactionIssueCode
	| "wrap.declined"
	| "wrap.lifecycle"
	| "wrap.target-mismatch";

export interface WrapServiceIssue {
	readonly code: WrapServiceIssueCode;
	readonly message: string;
	readonly recoveryRequired: boolean;
	readonly path?: string;
	readonly recordId?: string;
	readonly diagnostics?: WrapPreflightIssue["diagnostics"];
}

export type WrapServiceResult =
	| {
			readonly ok: true;
			readonly value: {
				readonly state: ObserverState;
				readonly receipt: WrapReceipt;
				readonly notebook: NotebookHandle;
			};
	  }
	| { readonly ok: false; readonly issue: WrapServiceIssue };

export interface WrapService {
	commit(input: {
		readonly state: ObserverState;
		readonly prepared: unknown;
		readonly approval: unknown;
	}): Promise<WrapServiceResult>;
}

interface ReadbackValue {
	readonly receipt: WrapReceipt;
	readonly notebook: NotebookHandle;
}

function failure(
	code: WrapServiceIssueCode,
	message: string,
	input?: {
		readonly recoveryRequired?: boolean;
		readonly path?: string;
		readonly recordId?: string;
		readonly diagnostics?: WrapPreflightIssue["diagnostics"];
	},
): WrapServiceResult {
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

function notebookFailure(issue: NotebookServiceIssue): WrapServiceResult {
	return failure(issue.code, issue.message, {
		path: issue.path,
		diagnostics: issue.diagnostics,
	});
}

function preflightFailure(issue: WrapPreflightIssue): WrapServiceResult {
	return failure(issue.code, issue.message, {
		path: issue.path,
		recordId: issue.recordId,
		diagnostics: issue.diagnostics,
	});
}

function transactionFailure(issue: WrapTransactionIssue): WrapServiceResult {
	return failure(issue.code, issue.message, {
		recoveryRequired: issue.recoveryRequired,
		recordId: issue.recordId,
	});
}

function lifecycleTargetCheck(
	state: ObserverState,
	prepared: PreparedWrap,
): WrapServiceResult | null {
	if (state.episode.status !== "reviewing-wrap") {
		return failure(
			"wrap.lifecycle",
			"Wrap commit requires an episode reviewing the current proposal.",
		);
	}
	if (state.episode.proposal.proposalId !== prepared.proposal_id) {
		return failure("wrap.lifecycle", "Prepared wrap proposal is stale.");
	}
	if (
		state.selectedNotebookId !== prepared.notebook_id ||
		state.episode.core.notebookId !== prepared.notebook_id ||
		state.episode.core.lang !== prepared.episode_language
	) {
		return failure(
			"wrap.target-mismatch",
			"Prepared wrap notebook or episode language does not match lifecycle state.",
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
): WrapCommittedEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-committed",
		proposalId,
		receipt: {
			receiptId,
			status: "validated",
			recordIds,
		},
	};
}

function finalInventoryMatches(
	plan: WrapPublicationPlan,
	actual: Awaited<ReturnType<typeof readNotebookInventory>>,
): boolean {
	if (!actual.ok || actual.value.length !== plan.finalInputs.length) return false;
	const actualByPath = new Map(
		actual.value.map((entry) => [entry.path, entry]),
	);
	return plan.finalInputs.every((expected) => {
		const found = actualByPath.get(expected.path);
		return found !== undefined && found.sha256 === sha256Text(expected.content);
	});
}

export async function verifyWrapReadback(
	plan: WrapPublicationPlan,
	receiptId: `receipt-${string}`,
): Promise<WrapTransactionVerification<ReadbackValue>> {
	const opened = await openNotebook(plan.notebook.root);
	if (!opened.ok) {
		return {
			ok: false,
			message: `Fresh notebook open failed: ${opened.issue.message}`,
		};
	}
	const inventory = await readNotebookInventory(opened.value);
	if (!finalInventoryMatches(plan, inventory)) {
		return {
			ok: false,
			message: "Fresh notebook inventory differs from the publication plan.",
		};
	}
	if (!inventory.ok) {
		return { ok: false, message: inventory.issue.message };
	}
	const byPath = new Map(inventory.value.map((entry) => [entry.path, entry]));
	const records = plan.entries.map((entry) => {
		const saved = byPath.get(entry.targetPath);
		if (
			!saved ||
			saved.document.record.id !== entry.recordId ||
			saved.sha256 !== entry.nextSha256
		) {
			return null;
		}
		return {
			operation: entry.operation,
			record_id: entry.recordId,
			path: entry.relativePath,
			sha256: entry.nextSha256,
		};
	});
	if (records.some((record) => record === null)) {
		return {
			ok: false,
			message: "Saved record receipt does not match fresh record bytes.",
		};
	}
	const complete = records.filter((record) => record !== null);
	return {
		ok: true,
		value: {
			notebook: opened.value,
			receipt: {
				observer_receipt: OBSERVER_WRAP_RECEIPT_SCHEMA,
				receipt_id: receiptId,
				proposal_id: plan.proposalId,
				notebook_id: opened.value.manifest.notebook_id,
				records: complete,
			},
		},
	};
}

async function commitWrap(
	selectionStore: NotebookSelectionStore,
	faultInjector: WrapFaultInjector | undefined,
	input: {
		readonly state: ObserverState;
		readonly prepared: unknown;
		readonly approval: unknown;
	},
): Promise<WrapServiceResult> {
	const preparedResult = decodePreparedWrap(input.prepared);
	if (!preparedResult.ok) {
		return failure(
			preparedResult.issue.code,
			preparedResult.issue.message,
			{ path: preparedResult.issue.path },
		);
	}
	const approvalResult = decodeWrapApproval(input.approval);
	if (!approvalResult.ok) {
		return failure(
			approvalResult.issue.code,
			approvalResult.issue.message,
			{ path: approvalResult.issue.path },
		);
	}
	if (approvalResult.value.proposal_id !== preparedResult.value.proposal_id) {
		return failure("wrap.lifecycle", "Approval proposal does not match prepared wrap.");
	}
	if (!approvalResult.value.approved) {
		return failure("wrap.declined", "Wrap approval was declined.");
	}
	const targetIssue = lifecycleTargetCheck(input.state, preparedResult.value);
	if (targetIssue) return targetIssue;
	const notebooks = createNotebookService({ selectionStore });
	const recovered = await notebooks.recover(input.state);
	if (!recovered.ok) return notebookFailure(recovered.issue);
	if (
		recovered.value.notebook.root !== preparedResult.value.root ||
		recovered.value.notebook.manifest.notebook_id !==
			preparedResult.value.notebook_id
	) {
		return failure(
			"wrap.target-mismatch",
			"Prepared wrap target differs from the recovered notebook.",
		);
	}
	const inventory = await readNotebookInventory(recovered.value.notebook);
	if (!inventory.ok) {
		return failure(inventory.issue.code, inventory.issue.message, {
			path: inventory.issue.path,
			diagnostics: inventory.issue.diagnostics,
		});
	}
	const plan = buildWrapPublicationPlan(
		recovered.value.notebook,
		inventory.value,
		preparedResult.value,
	);
	if (!plan.ok) return preflightFailure(plan.issue);
	const receiptId = createReceiptId();
	const recordIds = plan.value.entries.map((entry) => entry.recordId);
	const event = commitEvent(plan.value.proposalId, receiptId, recordIds);
	const projected = applyObserverEvent(input.state, event);
	if (!projected.applied) {
		return failure(
			"wrap.lifecycle",
			`Wrap lifecycle preflight failed: ${projected.reason}.`,
		);
	}
	const transaction = await executeWrapTransaction({
		plan: plan.value,
		faultInjector,
		verifyReadback: () => verifyWrapReadback(plan.value, receiptId),
	});
	if (!transaction.ok) return transactionFailure(transaction.issue);
	const committed = applyObserverEvent(input.state, event);
	if (!committed.applied) {
		return failure(
			"wrap.lifecycle",
			"Durable wrap succeeded but lifecycle acknowledgment was rejected.",
			{ recoveryRequired: true },
		);
	}
	return {
		ok: true,
		value: {
			state: committed.state,
			receipt: transaction.value.receipt,
			notebook: transaction.value.notebook,
		},
	};
}

export function createWrapService(input: {
	readonly selectionStore: NotebookSelectionStore;
	readonly faultInjector?: WrapFaultInjector;
}): WrapService {
	return {
		commit: (commitInput) =>
			commitWrap(input.selectionStore, input.faultInjector, commitInput),
	};
}
