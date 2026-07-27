import { randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	readFile,
	rm,
	unlink,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { atomicCreateTextFile, atomicReplaceTextFile } from "./atomic-file.ts";
import { sha256Text } from "./content-hash.ts";
import {
	OBSERVER_MANIFEST_DIRECTORY,
	readNotebookInventory,
} from "./notebook.ts";
import type {
	InventoryFingerprint,
	WrapPublicationEntry,
	WrapPublicationPlan,
} from "./wrap-preflight.ts";

export type WrapFaultPoint =
	| "after-stage"
	| "before-drift-check"
	| "before-publish"
	| "after-publish"
	| "before-readback";

export interface WrapFaultInjector {
	hit(point: WrapFaultPoint, recordId?: string): Promise<void>;
}

export type WrapTransactionIssueCode =
	| "wrap-transaction.active"
	| "wrap-transaction.cleanup"
	| "wrap-transaction.drift"
	| "wrap-transaction.publish"
	| "wrap-transaction.readback"
	| "wrap-transaction.rollback"
	| "wrap-transaction.stage";

export interface WrapTransactionIssue {
	readonly code: WrapTransactionIssueCode;
	readonly message: string;
	readonly recoveryRequired: boolean;
	readonly recordId?: string;
}

export type WrapTransactionActivity =
	| { readonly status: "inactive" }
	| { readonly status: "active" }
	| { readonly status: "unknown"; readonly message: string };

export type WrapTransactionVerification<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly message: string };

export type WrapTransactionResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: WrapTransactionIssue };

interface StagedEntry {
	readonly entry: WrapPublicationEntry;
	readonly stagedPath: string;
	readonly beforePath: string | null;
}

interface FailureContext {
	code: WrapTransactionIssueCode;
	recordId?: string;
}

export function wrapTransactionActivePath(notebookRoot: string): string {
	return join(
		notebookRoot,
		OBSERVER_MANIFEST_DIRECTORY,
		"transactions",
		"active",
	);
}

export async function inspectWrapTransactionActivity(
	notebookRoot: string,
): Promise<WrapTransactionActivity> {
	const activePath = wrapTransactionActivePath(notebookRoot);
	try {
		await lstat(activePath);
		return { status: "active" };
	} catch (error) {
		if (errorCode(error) === "ENOENT") return { status: "inactive" };
		return {
			status: "unknown",
			message:
				error instanceof Error
					? error.message
					: "Failed to inspect wrap transaction activity.",
		};
	}
}

function errorCode(value: unknown): string | undefined {
	if (
		typeof value !== "object" ||
		value === null ||
		!("code" in value) ||
		typeof value.code !== "string"
	) {
		return undefined;
	}
	return value.code;
}

function message(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

async function hit(
	injector: WrapFaultInjector | undefined,
	point: WrapFaultPoint,
	recordId?: string,
): Promise<void> {
	if (injector) await injector.hit(point, recordId);
}

async function runSequentially<Value>(
	values: readonly Value[],
	action: (value: Value, index: number) => Promise<void>,
): Promise<void> {
	let sequence = Promise.resolve();
	for (const [index, value] of values.entries()) {
		sequence = sequence.then(() => action(value, index));
	}
	await sequence;
}

function fingerprintMatches(
	left: readonly InventoryFingerprint[],
	right: readonly InventoryFingerprint[],
): boolean {
	return (
		left.length === right.length &&
		left.every((item, index) => {
			const candidate = right[index];
			return (
				candidate !== undefined &&
				item.path === candidate.path &&
				item.relativePath === candidate.relativePath &&
				item.recordId === candidate.recordId &&
				item.sha256 === candidate.sha256
			);
		})
	);
}

function inventoryFingerprint(
	entries: Awaited<ReturnType<typeof readNotebookInventory>>,
): readonly InventoryFingerprint[] | null {
	if (!entries.ok) return null;
	return entries.value
		.map((entry) => ({
			path: entry.path,
			relativePath: entry.relativePath,
			recordId: entry.document.record.id,
			sha256: entry.sha256,
		}))
		.sort((left, right) => left.path.localeCompare(right.path));
}

async function writeTransactionFiles(
	activePath: string,
	transactionId: string,
	plan: WrapPublicationPlan,
): Promise<readonly StagedEntry[]> {
	const stagedRoot = join(activePath, "staged");
	const beforeRoot = join(activePath, "before");
	await mkdir(stagedRoot);
	await mkdir(beforeRoot);
	const staged: StagedEntry[] = [];
	await runSequentially(plan.entries, async (entry, index) => {
		const name = String(index).padStart(6, "0");
		const stagedPath = join(stagedRoot, `${name}.next`);
		await writeFile(stagedPath, entry.nextContent, {
			encoding: "utf8",
			flag: "wx",
		});
		let beforePath: string | null = null;
		if (entry.operation === "update" && entry.beforeContent !== null) {
			beforePath = join(beforeRoot, `${name}.before`);
			await writeFile(beforePath, entry.beforeContent, {
				encoding: "utf8",
				flag: "wx",
			});
		}
		staged.push({ entry, stagedPath, beforePath });
	});
	const journal = {
		observer_transaction: "observer-wrap-transaction/v1",
		transaction_id: transactionId,
		proposal_id: plan.proposalId,
		records: plan.entries.map((entry) => ({
			operation: entry.operation,
			record_id: entry.recordId,
			path: entry.relativePath,
			before_sha256: entry.beforeSha256,
			next_sha256: entry.nextSha256,
		})),
	};
	await writeFile(
		join(activePath, "transaction.json"),
		`${JSON.stringify(journal, null, 2)}\n`,
		{ encoding: "utf8", flag: "wx" },
	);
	return staged;
}

async function verifySnapshot(plan: WrapPublicationPlan): Promise<boolean> {
	const current = inventoryFingerprint(
		await readNotebookInventory(plan.notebook),
	);
	return current !== null && fingerprintMatches(plan.snapshot, current);
}

async function publishEntry(staged: StagedEntry): Promise<void> {
	const content = await readFile(staged.stagedPath, "utf8");
	if (sha256Text(content) !== staged.entry.nextSha256) {
		throw new Error("Staged record hash changed before publication.");
	}
	if (staged.entry.operation === "create") {
		await atomicCreateTextFile(staged.entry.targetPath, content);
		return;
	}
	await atomicReplaceTextFile(staged.entry.targetPath, content);
}

async function rollbackEntry(entry: WrapPublicationEntry): Promise<void> {
	const current = await readFile(entry.targetPath, "utf8");
	if (sha256Text(current) !== entry.nextSha256) {
		throw new Error(
			`Refusing rollback for unrecognized bytes: ${entry.recordId}`,
		);
	}
	if (entry.operation === "create") {
		await unlink(entry.targetPath);
		return;
	}
	if (entry.beforeContent === null || entry.beforeSha256 === null) {
		throw new Error(`Update before-image is missing: ${entry.recordId}`);
	}
	if (sha256Text(entry.beforeContent) !== entry.beforeSha256) {
		throw new Error(`Update before-image hash mismatch: ${entry.recordId}`);
	}
	await atomicReplaceTextFile(entry.targetPath, entry.beforeContent);
}

async function rollbackPublished(
	plan: WrapPublicationPlan,
	published: readonly WrapPublicationEntry[],
): Promise<void> {
	await runSequentially(published.toReversed(), async (entry) => {
		await rollbackEntry(entry);
	});
	if (!(await verifySnapshot(plan))) {
		throw new Error(
			"Rollback did not restore the original notebook inventory.",
		);
	}
}

async function removeActive(activePath: string): Promise<void> {
	await rm(activePath, { recursive: true, force: true });
}

function transactionFailure(
	context: FailureContext,
	error: unknown,
	recoveryRequired: boolean,
): WrapTransactionResult<never> {
	return {
		ok: false,
		issue: {
			code: context.code,
			message: message(error, "Observer wrap transaction failed."),
			recoveryRequired,
			...(context.recordId ? { recordId: context.recordId } : {}),
		},
	};
}

export async function executeWrapTransaction<Value>(input: {
	readonly plan: WrapPublicationPlan;
	readonly verifyReadback: () => Promise<WrapTransactionVerification<Value>>;
	readonly faultInjector?: WrapFaultInjector;
}): Promise<WrapTransactionResult<Value>> {
	const transactionRoot = join(
		input.plan.notebook.root,
		OBSERVER_MANIFEST_DIRECTORY,
		"transactions",
	);
	const activePath = wrapTransactionActivePath(input.plan.notebook.root);
	const transactionId = `transaction-${randomUUID()}`;
	let acquired = false;
	let published: WrapPublicationEntry[] = [];
	let context: FailureContext = { code: "wrap-transaction.active" };
	try {
		await mkdir(transactionRoot, { recursive: true });
		try {
			await mkdir(activePath);
			acquired = true;
		} catch (error) {
			if (errorCode(error) === "EEXIST") {
				return transactionFailure(
					context,
					new Error("Another or interrupted wrap transaction is active."),
					true,
				);
			}
			throw error;
		}
		context = { code: "wrap-transaction.stage" };
		const staged = await writeTransactionFiles(
			activePath,
			transactionId,
			input.plan,
		);
		await hit(input.faultInjector, "after-stage");
		context = { code: "wrap-transaction.drift" };
		await hit(input.faultInjector, "before-drift-check");
		if (!(await verifySnapshot(input.plan))) {
			throw new Error("Notebook inventory changed after wrap preflight.");
		}
		await runSequentially(staged, async (stagedEntry) => {
			context = {
				code: "wrap-transaction.publish",
				recordId: stagedEntry.entry.recordId,
			};
			await hit(
				input.faultInjector,
				"before-publish",
				stagedEntry.entry.recordId,
			);
			await publishEntry(stagedEntry);
			published.push(stagedEntry.entry);
			await hit(
				input.faultInjector,
				"after-publish",
				stagedEntry.entry.recordId,
			);
		});
		context = { code: "wrap-transaction.readback" };
		await hit(input.faultInjector, "before-readback");
		const verified = await input.verifyReadback();
		if (!verified.ok) throw new Error(verified.message);
		context = { code: "wrap-transaction.cleanup" };
		await removeActive(activePath);
		acquired = false;
		return { ok: true, value: verified.value };
	} catch (error) {
		if (published.length > 0) {
			try {
				await rollbackPublished(input.plan, published);
				published = [];
			} catch (rollbackError) {
				return transactionFailure(
					{ code: "wrap-transaction.rollback", recordId: context.recordId },
					rollbackError,
					true,
				);
			}
		}
		if (acquired) {
			try {
				await removeActive(activePath);
				acquired = false;
			} catch (cleanupError) {
				return transactionFailure(
					{ code: "wrap-transaction.cleanup" },
					cleanupError,
					true,
				);
			}
		}
		return transactionFailure(context, error, false);
	}
}
