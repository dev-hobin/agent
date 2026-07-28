import { sha256Text } from "./content-hash.ts";
import {
	openNotebook,
	readNotebookInventory,
	type NotebookHandle,
	type NotebookInventoryEntry,
} from "./notebook.ts";
import type { PreparedSave } from "./save-profile.ts";
import {
	buildWrapPublicationPlan,
	type WrapPreflightIssue,
	type WrapPreflightIssueCode,
	type WrapPublicationPlan,
} from "./wrap-preflight.ts";
import {
	executeWrapTransaction,
	inspectWrapTransactionActivity,
	type WrapFaultInjector,
	type WrapTransactionActivity,
	type WrapTransactionIssue,
	type WrapTransactionIssueCode,
	type WrapTransactionVerification,
} from "./wrap-transaction.ts";

export interface PreparedWrap {
	readonly plan: WrapPublicationPlan;
	readonly recordIds: readonly string[];
}

export interface WrappedRecord {
	readonly operation: "create" | "update";
	readonly recordId: string;
	readonly relativePath: string;
	readonly sha256: string;
}

export interface WrapCommit {
	readonly receiptId: `receipt-${string}`;
	readonly proposalId: string;
	readonly notebook: NotebookHandle;
	readonly records: readonly WrappedRecord[];
}

export type WrapServiceIssueCode =
	| WrapPreflightIssueCode
	| WrapTransactionIssueCode;

export interface WrapServiceIssue {
	readonly code: WrapServiceIssueCode;
	readonly message: string;
	readonly recoveryRequired: boolean;
	readonly path?: string;
	readonly recordId?: string;
	readonly diagnostics?: WrapPreflightIssue["diagnostics"];
}

export type WrapPreparationResult =
	| { readonly ok: true; readonly value: PreparedWrap }
	| { readonly ok: false; readonly issue: WrapServiceIssue };

export type WrapCommitResult =
	| { readonly ok: true; readonly value: WrapCommit }
	| { readonly ok: false; readonly issue: WrapServiceIssue };

export type WrapActivity = WrapTransactionActivity;

export interface WrapService {
	prepare(input: {
		readonly notebook: NotebookHandle;
		readonly inventory: readonly NotebookInventoryEntry[];
		readonly save: PreparedSave;
	}): WrapPreparationResult;
	commit(input: {
		readonly prepared: PreparedWrap;
		readonly receiptId: `receipt-${string}`;
	}): Promise<WrapCommitResult>;
}

export function inspectWrapActivity(
	notebookRoot: string,
): Promise<WrapActivity> {
	return inspectWrapTransactionActivity(notebookRoot);
}

function preflightFailure(issue: WrapPreflightIssue): WrapPreparationResult {
	return {
		ok: false,
		issue: {
			code: issue.code,
			message: issue.message,
			recoveryRequired: false,
			...(issue.path ? { path: issue.path } : {}),
			...(issue.recordId ? { recordId: issue.recordId } : {}),
			...(issue.diagnostics ? { diagnostics: issue.diagnostics } : {}),
		},
	};
}

function transactionFailure(issue: WrapTransactionIssue): WrapCommitResult {
	return {
		ok: false,
		issue: {
			code: issue.code,
			message: issue.message,
			recoveryRequired: issue.recoveryRequired,
			...(issue.recordId ? { recordId: issue.recordId } : {}),
		},
	};
}

function finalInventoryMatches(
	plan: WrapPublicationPlan,
	actual: Awaited<ReturnType<typeof readNotebookInventory>>,
): boolean {
	if (!actual.ok || actual.value.length !== plan.finalInputs.length)
		return false;
	const actualByPath = new Map(
		actual.value.map((entry) => [entry.path, entry]),
	);
	return plan.finalInputs.every((expected) => {
		const found = actualByPath.get(expected.path);
		return found !== undefined && found.sha256 === sha256Text(expected.content);
	});
}

async function verifyWrapReadback(
	plan: WrapPublicationPlan,
	receiptId: `receipt-${string}`,
): Promise<WrapTransactionVerification<WrapCommit>> {
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
			message: "Fresh notebook inventory differs from the wrap plan.",
		};
	}
	if (!inventory.ok) return { ok: false, message: inventory.issue.message };
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
			recordId: entry.recordId,
			relativePath: entry.relativePath,
			sha256: entry.nextSha256,
		} satisfies WrappedRecord;
	});
	if (records.some((record) => record === null)) {
		return {
			ok: false,
			message: "Wrapped record receipt does not match fresh record bytes.",
		};
	}
	return {
		ok: true,
		value: {
			receiptId,
			proposalId: plan.proposalId,
			notebook: opened.value,
			records: records.filter((record) => record !== null),
		},
	};
}

function prepareWrap(input: {
	readonly notebook: NotebookHandle;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly save: PreparedSave;
}): WrapPreparationResult {
	const plan = buildWrapPublicationPlan(
		input.notebook,
		input.inventory,
		input.save,
	);
	if (!plan.ok) return preflightFailure(plan.issue);
	return {
		ok: true,
		value: {
			plan: plan.value,
			recordIds: plan.value.entries.map((entry) => entry.recordId),
		},
	};
}

async function commitWrap(
	faultInjector: WrapFaultInjector | undefined,
	input: {
		readonly prepared: PreparedWrap;
		readonly receiptId: `receipt-${string}`;
	},
): Promise<WrapCommitResult> {
	const transaction = await executeWrapTransaction({
		plan: input.prepared.plan,
		faultInjector,
		verifyReadback: () =>
			verifyWrapReadback(input.prepared.plan, input.receiptId),
	});
	return transaction.ok ? transaction : transactionFailure(transaction.issue);
}

export function createWrapService(input?: {
	readonly faultInjector?: WrapFaultInjector;
}): WrapService {
	return {
		prepare: prepareWrap,
		commit: (commitInput) => commitWrap(input?.faultInjector, commitInput),
	};
}
