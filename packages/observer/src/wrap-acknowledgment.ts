import { sha256Text } from "./content-hash.ts";
import {
	readNotebookInventory,
	type NotebookHandle,
	type NotebookInventoryEntry,
} from "./notebook.ts";
import {
	OBSERVER_WRAP_RECEIPT_SCHEMA,
	type PreparedRecord,
	type PreparedWrap,
	type WrapReceipt,
} from "./wrap-profile.ts";
import {
	inspectWrapTransactionActivity,
	type WrapTransactionActivity,
} from "./wrap-transaction.ts";

export type WrapAcknowledgmentInspection =
	| { readonly status: "before" }
	| { readonly status: "final"; readonly receipt: WrapReceipt }
	| { readonly status: "active"; readonly message: string }
	| { readonly status: "mixed"; readonly message: string }
	| { readonly status: "invalid"; readonly message: string };

export interface WrapAcknowledgmentDependencies {
	readonly inspectActivity?: (
		root: string,
	) => Promise<WrapTransactionActivity>;
	readonly receiptId: () => `receipt-${string}`;
}

function beforeMatches(
	record: PreparedRecord,
	existing: NotebookInventoryEntry | undefined,
): boolean {
	if (record.operation === "create") return existing === undefined;
	return existing?.sha256 === record.expected_sha256;
}

function finalMatches(
	record: PreparedRecord,
	existing: NotebookInventoryEntry | undefined,
): boolean {
	if (!existing || existing.sha256 !== sha256Text(record.markdown)) return false;
	if (record.operation === "update") return true;
	return existing.relativePath === `records/${record.record_id}.md`;
}

function duplicateRecordId(records: readonly PreparedRecord[]): string | null {
	const seen = new Set<string>();
	for (const record of records) {
		if (seen.has(record.record_id)) return record.record_id;
		seen.add(record.record_id);
	}
	return null;
}

function finalReceipt(
	notebook: NotebookHandle,
	prepared: PreparedWrap,
	inventory: readonly NotebookInventoryEntry[],
	receiptId: `receipt-${string}`,
): WrapReceipt | null {
	const byId = new Map<string, NotebookInventoryEntry>(
		inventory.map((entry) => [entry.document.record.id, entry]),
	);
	const records = prepared.records
		.map((record) => {
			const existing = byId.get(record.record_id);
			if (!finalMatches(record, existing) || !existing) return null;
			return {
				operation: record.operation,
				record_id: record.record_id,
				path: existing.relativePath,
				sha256: existing.sha256,
			};
		})
		.sort((left, right) => {
			if (!left) return 1;
			if (!right) return -1;
			return left.record_id.localeCompare(right.record_id);
		});
	if (records.some((record) => record === null)) return null;
	const complete = records.filter((record) => record !== null);
	return {
		observer_receipt: OBSERVER_WRAP_RECEIPT_SCHEMA,
		receipt_id: receiptId,
		proposal_id: prepared.proposal_id,
		notebook_id: notebook.manifest.notebook_id,
		records: complete,
	};
}

export async function inspectWrapAcknowledgment(input: {
	readonly notebook: NotebookHandle;
	readonly prepared: PreparedWrap;
	readonly dependencies: WrapAcknowledgmentDependencies;
}): Promise<WrapAcknowledgmentInspection> {
	const inspectActivity =
		input.dependencies.inspectActivity ?? inspectWrapTransactionActivity;
	const activity = await inspectActivity(input.notebook.root);
	if (activity.status === "active") {
		return {
			status: "active",
			message: "An interrupted wrap transaction is still active.",
		};
	}
	if (activity.status === "unknown") {
		return { status: "invalid", message: activity.message };
	}
	const duplicate = duplicateRecordId(input.prepared.records);
	if (duplicate) {
		return {
			status: "invalid",
			message: `Prepared wrap repeats record ID: ${duplicate}.`,
		};
	}
	const inventory = await readNotebookInventory(input.notebook);
	if (!inventory.ok) {
		return { status: "invalid", message: inventory.issue.message };
	}
	const receipt = finalReceipt(
		input.notebook,
		input.prepared,
		inventory.value,
		input.dependencies.receiptId(),
	);
	if (receipt) return { status: "final", receipt };
	const byId = new Map<string, NotebookInventoryEntry>(
		inventory.value.map((entry) => [entry.document.record.id, entry]),
	);
	if (
		input.prepared.records.every((record) =>
			beforeMatches(record, byId.get(record.record_id)),
		)
	) {
		return { status: "before" };
	}
	return {
		status: "mixed",
		message: "Notebook bytes are neither the approved before nor final state.",
	};
}
