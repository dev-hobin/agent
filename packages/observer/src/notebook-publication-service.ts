import { sha256Text } from "./content-hash.ts";
import {
	openNotebook,
	readNotebookInventory,
	type NotebookHandle,
	type NotebookInventoryEntry,
} from "./notebook.ts";
import type { PreparedSave } from "./save-profile.ts";
import {
	buildNotebookPublicationPlan,
	type PublicationPreflightIssue,
	type PublicationPreflightIssueCode,
	type NotebookPublicationPlan,
} from "./notebook-publication-preflight.ts";
import {
	executePublicationTransaction,
	inspectPublicationTransactionActivity,
	type PublicationFaultInjector,
	type PublicationTransactionActivity,
	type PublicationTransactionIssue,
	type PublicationTransactionIssueCode,
	type PublicationTransactionVerification,
} from "./notebook-publication-transaction.ts";

export interface PreparedPublication {
	readonly plan: NotebookPublicationPlan;
	readonly recordIds: readonly string[];
}

export interface PublishedRecord {
	readonly operation: "create" | "update";
	readonly recordId: string;
	readonly relativePath: string;
	readonly sha256: string;
}

export interface PublicationCommit {
	readonly receiptId: `receipt-${string}`;
	readonly proposalId: string;
	readonly notebook: NotebookHandle;
	readonly records: readonly PublishedRecord[];
}

export type NotebookPublicationIssueCode =
	| PublicationPreflightIssueCode
	| PublicationTransactionIssueCode;

export interface NotebookPublicationIssue {
	readonly code: NotebookPublicationIssueCode;
	readonly message: string;
	readonly recoveryRequired: boolean;
	readonly path?: string;
	readonly recordId?: string;
	readonly diagnostics?: PublicationPreflightIssue["diagnostics"];
}

export type PublicationPreparationResult =
	| { readonly ok: true; readonly value: PreparedPublication }
	| { readonly ok: false; readonly issue: NotebookPublicationIssue };

export type PublicationCommitResult =
	| { readonly ok: true; readonly value: PublicationCommit }
	| { readonly ok: false; readonly issue: NotebookPublicationIssue };

export type PublicationActivity = PublicationTransactionActivity;

export interface NotebookPublicationService {
	prepare(input: {
		readonly notebook: NotebookHandle;
		readonly inventory: readonly NotebookInventoryEntry[];
		readonly save: PreparedSave;
	}): PublicationPreparationResult;
	commit(input: {
		readonly prepared: PreparedPublication;
		readonly receiptId: `receipt-${string}`;
	}): Promise<PublicationCommitResult>;
}

export function inspectPublicationActivity(
	notebookRoot: string,
): Promise<PublicationActivity> {
	return inspectPublicationTransactionActivity(notebookRoot);
}

function publicationPreflightFailure(
	issue: PublicationPreflightIssue,
): PublicationPreparationResult {
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

function publicationTransactionFailure(
	issue: PublicationTransactionIssue,
): PublicationCommitResult {
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
	plan: NotebookPublicationPlan,
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

async function verifyPublicationReadback(
	plan: NotebookPublicationPlan,
	receiptId: `receipt-${string}`,
): Promise<PublicationTransactionVerification<PublicationCommit>> {
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
		} satisfies PublishedRecord;
	});
	if (records.some((record) => record === null)) {
		return {
			ok: false,
			message: "Published record receipt does not match fresh record bytes.",
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

function preparePublication(input: {
	readonly notebook: NotebookHandle;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly save: PreparedSave;
}): PublicationPreparationResult {
	const plan = buildNotebookPublicationPlan(
		input.notebook,
		input.inventory,
		input.save,
	);
	if (!plan.ok) return publicationPreflightFailure(plan.issue);
	return {
		ok: true,
		value: {
			plan: plan.value,
			recordIds: plan.value.entries.map((entry) => entry.recordId),
		},
	};
}

async function commitPublication(
	faultInjector: PublicationFaultInjector | undefined,
	input: {
		readonly prepared: PreparedPublication;
		readonly receiptId: `receipt-${string}`;
	},
): Promise<PublicationCommitResult> {
	const transaction = await executePublicationTransaction({
		plan: input.prepared.plan,
		faultInjector,
		verifyReadback: () =>
			verifyPublicationReadback(input.prepared.plan, input.receiptId),
	});
	return transaction.ok
		? transaction
		: publicationTransactionFailure(transaction.issue);
}

export function createNotebookPublicationService(input?: {
	readonly faultInjector?: PublicationFaultInjector;
}): NotebookPublicationService {
	return {
		prepare: preparePublication,
		commit: (commitInput) =>
			commitPublication(input?.faultInjector, commitInput),
	};
}
