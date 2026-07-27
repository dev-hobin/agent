import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import {
	applyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	OBSERVER_PROTOCOL,
	type ObserverState,
} from "../src/lifecycle.ts";
import { decodeObserverMarkdown } from "../src/markdown-profile.ts";
import {
	decodePreparedMemoPass,
	type InquiryId,
	type PreparedMemoPass,
} from "../src/memo-profile.ts";
import {
	hydrateMemoScope,
	initialMemoWorkingState,
	reconcileMemoPass,
	type MemoPassReceipt,
	type MemoReconciliationIds,
	type MemoScopeSnapshot,
	type MemoWorkingState,
} from "../src/memo-reconciliation.ts";
import type { NotebookInventoryEntry } from "../src/notebook.ts";

const FIXTURES = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);
const EPISODE_ID = "episode-memo-1";
const INQUIRY_ID: InquiryId = "inquiry-00000000-0000-4000-8000-000000000003";
const NEW_INQUIRY: InquiryId = "inquiry-00000000-0000-4000-8000-000000000031";
const DURABLE_MEMO = "memo-00000000-0000-4000-8000-000000000004";
const MEMO_A = "memo-00000000-0000-4000-8000-000000000032";
const MEMO_B = "memo-00000000-0000-4000-8000-000000000033";
const MEMO_MERGED = "memo-00000000-0000-4000-8000-000000000034";
const EVIDENCE_A = "evidence-00000000-0000-4000-8000-000000000041";
const EVIDENCE_B = "evidence-00000000-0000-4000-8000-000000000042";

function openLifecycle(): ObserverState {
	const normalized = normalizeObserverEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId: EPISODE_ID,
		notebookId: "notebook-main",
		lang: "en",
	});
	if (!normalized.ok) assert.fail(JSON.stringify(normalized.issue));
	const applied = applyObserverEvent(initialObserverState(), normalized.event);
	if (!applied.applied) assert.fail(applied.reason);
	return applied.state;
}

async function fixtureEntry(name: string): Promise<NotebookInventoryEntry> {
	const path = join(FIXTURES, name);
	const content = await readFile(path, "utf8");
	const decoded = decodeObserverMarkdown({ path, content });
	if (!decoded.ok) assert.fail(JSON.stringify(decoded.diagnostics));
	return {
		path,
		relativePath: name,
		content,
		sha256: sha256Text(content),
		document: decoded.value,
	};
}

async function baselineInventory(): Promise<readonly NotebookInventoryEntry[]> {
	return Promise.all([
		fixtureEntry("source-external.md"),
		fixtureEntry("inquiry.md"),
		fixtureEntry("memo-incubating.md"),
	]);
}

function requireScope(
	working: MemoWorkingState,
	inventory: readonly NotebookInventoryEntry[],
	relatedInquiryIds: readonly InquiryId[],
): MemoScopeSnapshot {
	const result = hydrateMemoScope({
		lifecycle: openLifecycle(),
		working,
		inventory,
		relatedInquiryIds,
		workingSourceBases: [],
	});
	if (!result.ok) assert.fail(JSON.stringify(result.issue));
	return result.value;
}

function preparedRaw(input: {
	readonly scope: MemoScopeSnapshot;
	readonly state: MemoWorkingState;
	readonly passId: string;
	readonly evidence?: readonly unknown[];
	readonly hypothesisOutcomes?: readonly unknown[];
	readonly memoOutcomes?: readonly unknown[];
}): Record<string, unknown> {
	return {
		observer_memo_pass: "observer.prepared-memo-pass/v1",
		pass_id: input.passId,
		episode_id: input.scope.episodeId,
		base_revision_id: input.state.revisionId,
		basis_digest: input.scope.basisDigest,
		related_inquiry_ids: input.scope.relatedInquiryIds,
		instruction_id: null,
		evidence: input.evidence ?? [],
		hypothesis_outcomes: input.hypothesisOutcomes ?? [],
		memo_outcomes: input.memoOutcomes ?? [],
	};
}

function requirePass(raw: unknown): PreparedMemoPass {
	const result = decodePreparedMemoPass(raw);
	if (!result.ok) assert.fail(JSON.stringify(result.issue));
	return result.value;
}

function ids(seed: string): MemoReconciliationIds {
	return {
		revisionId() {
			return `memo-working-revision-${seed}`;
		},
		receiptId(): `memo-receipt-${string}` {
			return `memo-receipt-${seed}`;
		},
	};
}

function requireReconciled(input: {
	readonly state: MemoWorkingState;
	readonly scope: MemoScopeSnapshot;
	readonly pass: PreparedMemoPass;
	readonly seed: string;
}): { readonly state: MemoWorkingState; readonly receipt: MemoPassReceipt } {
	const result = reconcileMemoPass({
		state: input.state,
		scope: input.scope,
		pass: input.pass,
		ids: ids(input.seed),
	});
	if (!result.ok) assert.fail(JSON.stringify(result.issue));
	return result.value;
}

function evidence(id: string, summary: string): Record<string, unknown> {
	return {
		evidence_id: id,
		kind: "direct-observation",
		source_id: null,
		summary,
	};
}

function hypothesisDraft(id: string): Record<string, unknown> {
	return {
		inquiry_id: id,
		episode_id: EPISODE_ID,
		origin: "user",
		original: "Frequent durable writing may disrupt learning.",
		current: "Frequent durable writing may disrupt learning.",
		revision_reason: null,
		evidence_ids: [EVIDENCE_A],
	};
}

function memoDraft(input: {
	readonly memoId: string;
	readonly title: string;
	readonly content: string;
	readonly evidenceIds?: readonly string[];
}): Record<string, unknown> {
	return {
		memo_id: input.memoId,
		episode_id: EPISODE_ID,
		title: input.title,
		lang: "en",
		content: input.content,
		inquiry_ids: [NEW_INQUIRY],
		hypothesis_id: NEW_INQUIRY,
		evidence_ids: input.evidenceIds ?? [EVIDENCE_A],
		reason: "The observation introduced a distinct working contribution.",
	};
}

function initialCreationPass(
	state: MemoWorkingState,
	scope: MemoScopeSnapshot,
): PreparedMemoPass {
	return requirePass(
		preparedRaw({
			scope,
			state,
			passId: "memo-pass-00000000-0000-4000-8000-000000000051",
			evidence: [
				evidence(EVIDENCE_A, "Observed interruption and re-entry costs."),
			],
			hypothesisOutcomes: [
				{ kind: "create", hypothesis: hypothesisDraft(NEW_INQUIRY) },
			],
			memoOutcomes: [
				{
					kind: "create",
					memo: memoDraft({
						memoId: MEMO_A,
						title: "Re-entry cost",
						content: "Interruption creates a measurable re-entry cost.",
					}),
				},
				{
					kind: "create",
					memo: memoDraft({
						memoId: MEMO_B,
						title: "Capture cadence",
						content: "Capture cadence changes the interruption cost.",
					}),
				},
			],
		}),
	);
}

describe("prepared Memo pass profile", () => {
	test("strictly rejects extra fields and normalizes set order into one digest", () => {
		const state = initialMemoWorkingState();
		const scope = requireScope(state, [], []);
		const first = preparedRaw({
			scope,
			state,
			passId: "memo-pass-00000000-0000-4000-8000-000000000061",
			evidence: [
				evidence(EVIDENCE_B, "Second observation."),
				evidence(EVIDENCE_A, "First observation."),
			],
		});
		const second = preparedRaw({
			scope,
			state,
			passId: "memo-pass-00000000-0000-4000-8000-000000000062",
			evidence: [
				evidence(EVIDENCE_A, "First observation."),
				evidence(EVIDENCE_B, "Second observation."),
			],
		});
		const decodedFirst = requirePass(first);
		const decodedSecond = requirePass(second);
		assert.equal(decodedFirst.digest, decodedSecond.digest);
		first.unexpected = true;
		const rejected = decodePreparedMemoPass(first);
		assert.equal(rejected.ok, false);
		if (rejected.ok) assert.fail("Expected strict shape rejection");
		assert.equal(rejected.issue.code, "memo-profile.shape");
	});
});

describe("pure Memo reconciliation", () => {
	test("accepts an explicit empty pass without touching durable files", () => {
		const state = initialMemoWorkingState();
		const scope = requireScope(state, [], []);
		const pass = requirePass(
			preparedRaw({
				scope,
				state,
				passId: "memo-pass-00000000-0000-4000-8000-000000000063",
			}),
		);
		const result = requireReconciled({ state, scope, pass, seed: "empty" });
		assert.equal(result.state.passes, 1);
		assert.deepEqual(result.state.memos, []);
		assert.equal(
			result.receipt.summary,
			"신규 0 · 수정 0 · 병합 0 · incubating 0 · 승격 후보 0 · 가설 수정 0",
		);
	});

	test("creates two working Memos and preserves a user hypothesis origin/original", () => {
		const state = initialMemoWorkingState();
		const scope = requireScope(state, [], []);
		const result = requireReconciled({
			state,
			scope,
			pass: initialCreationPass(state, scope),
			seed: "create",
		});
		assert.equal(result.state.memos.length, 2);
		assert.equal(result.state.hypotheses[0]?.origin, "user");
		assert.equal(
			result.state.hypotheses[0]?.original,
			"Frequent durable writing may disrupt learning.",
		);
		assert.equal(result.receipt.changes.created, 2);
	});

	test("allows evidence-empty user registration but requires WorkingSource evidence for Observer hypotheses", () => {
		const state = initialMemoWorkingState();
		const sourceId = "source-00000000-0000-4000-8000-000000000081";
		const evidenceId = "evidence-00000000-0000-4000-8000-000000000082";
		const observerInquiry = "inquiry-00000000-0000-4000-8000-000000000083";
		const scopeResult = hydrateMemoScope({
			lifecycle: openLifecycle(),
			working: state,
			inventory: [],
			relatedInquiryIds: [],
			workingSourceBases: [
				{
					sourceId,
					path: "session:observer/source-read-81",
					sha256: sha256Text("working source 81"),
				},
			],
		});
		if (!scopeResult.ok) assert.fail(JSON.stringify(scopeResult.issue));
		const observerPass = requirePass(
			preparedRaw({
				scope: scopeResult.value,
				state,
				passId: "memo-pass-00000000-0000-4000-8000-000000000084",
				evidence: [
					{
						evidence_id: evidenceId,
						kind: "source-claim",
						source_id: sourceId,
						summary: "The source supports a new Observer hypothesis.",
					},
				],
				hypothesisOutcomes: [
					{
						kind: "create",
						hypothesis: {
							inquiry_id: observerInquiry,
							episode_id: EPISODE_ID,
							origin: "observer",
							original: "Capture timing changes re-entry cost.",
							current: "Capture timing changes re-entry cost.",
							revision_reason: null,
							evidence_ids: [evidenceId],
						},
					},
				],
			}),
		);
		const accepted = requireReconciled({
			state,
			scope: scopeResult.value,
			pass: observerPass,
			seed: "working-source",
		});
		assert.equal(accepted.state.hypotheses[0]?.origin, "observer");

		const noEvidence = requirePass(
			preparedRaw({
				scope: scopeResult.value,
				state,
				passId: "memo-pass-00000000-0000-4000-8000-000000000085",
				hypothesisOutcomes: [
					{
						kind: "create",
						hypothesis: {
							inquiry_id: observerInquiry,
							episode_id: EPISODE_ID,
							origin: "observer",
							original: "Unsupported Observer hypothesis.",
							current: "Unsupported Observer hypothesis.",
							revision_reason: null,
							evidence_ids: [],
						},
					},
				],
			}),
		);
		const rejected = reconcileMemoPass({
			state,
			scope: scopeResult.value,
			pass: noEvidence,
			ids: ids("observer-no-evidence"),
		});
		assert.equal(rejected.ok, false);
		if (rejected.ok) assert.fail("Expected Observer evidence rejection");
		assert.equal(rejected.issue.code, "memo-reconcile.evidence");
	});

	test("hydrates only explicitly related standing Inquiry/Memo records and marks a candidate", async () => {
		const inventory = await baselineInventory();
		const state = initialMemoWorkingState();
		const unrelated = requireScope(state, inventory, []);
		assert.equal(unrelated.durableMemos.length, 0);
		const scope = requireScope(state, inventory, [INQUIRY_ID]);
		const reversedScope = requireScope(state, inventory.toReversed(), [
			INQUIRY_ID,
		]);
		assert.equal(scope.durableMemos.length, 1);
		assert.equal(scope.basisDigest, reversedScope.basisDigest);
		const pass = requirePass(
			preparedRaw({
				scope,
				state,
				passId: "memo-pass-00000000-0000-4000-8000-000000000064",
				evidence: [
					evidence(EVIDENCE_A, "A counterexample changed confidence."),
				],
				hypothesisOutcomes: [
					{
						kind: "revise",
						inquiry_id: INQUIRY_ID,
						current:
							"Frequent durable writing disrupts learning only at poorly chosen boundaries.",
						revision_reason: "The observed counterexample narrowed the claim.",
						evidence_ids: [EVIDENCE_A],
					},
				],
				memoOutcomes: [
					{
						kind: "mark-promotion-candidate",
						memo_id: DURABLE_MEMO,
						reason: "The contribution now survives the counterexample.",
						evidence_ids: [EVIDENCE_A],
					},
				],
			}),
		);
		const result = requireReconciled({ state, scope, pass, seed: "candidate" });
		assert.equal(result.state.memos[0]?.disposition, "promotion-candidate");
		assert.equal(result.state.hypotheses[0]?.origin, "user");
		assert.equal(
			result.state.hypotheses[0]?.original,
			"Frequent durable writing may disrupt learning.",
		);
		assert.equal(result.receipt.changes.hypothesisRevisions, 1);
	});

	test("revises one Memo, keeps the other, and normalizes outcome order", () => {
		const initial = initialMemoWorkingState();
		const firstScope = requireScope(initial, [], []);
		const first = requireReconciled({
			state: initial,
			scope: firstScope,
			pass: initialCreationPass(initial, firstScope),
			seed: "first-revision",
		});
		const scope = requireScope(first.state, [], [NEW_INQUIRY]);
		const revise = {
			kind: "revise",
			memo_id: MEMO_A,
			disposition: "incubating",
			revision: {
				revision_id: "memo-revision-00000000-0000-4000-8000-000000000072",
				title: "Measured re-entry cost",
				content:
					"Interruption creates a measurable and recoverable re-entry cost.",
				evidence_ids: [EVIDENCE_B],
				reason: "New evidence bounded the original contribution.",
			},
		};
		const keep = { kind: "keep-incubating", memo_id: MEMO_B };
		const common = {
			scope,
			state: first.state,
			evidence: [evidence(EVIDENCE_B, "The re-entry cost was recoverable.")],
			hypothesisOutcomes: [{ kind: "keep", inquiry_id: NEW_INQUIRY }],
		};
		const forward = requirePass(
			preparedRaw({
				...common,
				passId: "memo-pass-00000000-0000-4000-8000-000000000073",
				memoOutcomes: [revise, keep],
			}),
		);
		const reversed = requirePass(
			preparedRaw({
				...common,
				passId: "memo-pass-00000000-0000-4000-8000-000000000074",
				memoOutcomes: [keep, revise],
			}),
		);
		assert.equal(forward.digest, reversed.digest);
		const result = requireReconciled({
			state: first.state,
			scope,
			pass: forward,
			seed: "revise",
		});
		assert.equal(
			result.state.memos.find((memo) => memo.memoId === MEMO_A)?.title,
			"Measured re-entry cost",
		);
		assert.equal(
			result.state.memos.find((memo) => memo.memoId === MEMO_B)?.disposition,
			"incubating",
		);
		assert.equal(result.receipt.changes.revised, 1);
		assert.equal(result.receipt.changes.keptIncubating, 1);
	});

	test("merges two Memos into a new target while retaining superseded history", () => {
		const initial = initialMemoWorkingState();
		const firstScope = requireScope(initial, [], []);
		const first = requireReconciled({
			state: initial,
			scope: firstScope,
			pass: initialCreationPass(initial, firstScope),
			seed: "first",
		});
		const scope = requireScope(first.state, [], [NEW_INQUIRY]);
		const pass = requirePass(
			preparedRaw({
				scope,
				state: first.state,
				passId: "memo-pass-00000000-0000-4000-8000-000000000065",
				evidence: [
					evidence(EVIDENCE_B, "The two contributions share one mechanism."),
				],
				hypothesisOutcomes: [{ kind: "keep", inquiry_id: NEW_INQUIRY }],
				memoOutcomes: [
					{
						kind: "merge",
						source_ids: [MEMO_B, MEMO_A],
						target: memoDraft({
							memoId: MEMO_MERGED,
							title: "Re-entry-aware capture cadence",
							content: "Capture cadence should be chosen by its re-entry cost.",
							evidenceIds: [EVIDENCE_B, EVIDENCE_A],
						}),
					},
				],
			}),
		);
		const result = requireReconciled({
			state: first.state,
			scope,
			pass,
			seed: "merge",
		});
		const target = result.state.memos.find(
			(memo) => memo.memoId === MEMO_MERGED,
		);
		const sources = result.state.memos.filter(
			(memo) => memo.memoId === MEMO_A || memo.memoId === MEMO_B,
		);
		assert.equal(target?.disposition, "incubating");
		assert.deepEqual(
			sources.map((memo) => [memo.disposition, memo.supersededBy]),
			[
				["superseded", MEMO_MERGED],
				["superseded", MEMO_MERGED],
			],
		);
		assert.equal(result.receipt.changes.merged, 1);
	});

	test("fails closed for incomplete coverage, stale bases, and duplicate live semantic keys", () => {
		const initial = initialMemoWorkingState();
		const firstScope = requireScope(initial, [], []);
		const first = requireReconciled({
			state: initial,
			scope: firstScope,
			pass: initialCreationPass(initial, firstScope),
			seed: "baseline",
		});
		const scope = requireScope(first.state, [], [NEW_INQUIRY]);
		const incomplete = requirePass(
			preparedRaw({
				scope,
				state: first.state,
				passId: "memo-pass-00000000-0000-4000-8000-000000000066",
				hypothesisOutcomes: [{ kind: "keep", inquiry_id: NEW_INQUIRY }],
				memoOutcomes: [{ kind: "keep-incubating", memo_id: MEMO_A }],
			}),
		);
		const before = structuredClone(first.state);
		const incompleteResult = reconcileMemoPass({
			state: first.state,
			scope,
			pass: incomplete,
			ids: ids("incomplete"),
		});
		assert.equal(incompleteResult.ok, false);
		assert.deepEqual(first.state, before);

		const staleRaw = preparedRaw({
			scope,
			state: first.state,
			passId: "memo-pass-00000000-0000-4000-8000-000000000067",
			hypothesisOutcomes: [{ kind: "keep", inquiry_id: NEW_INQUIRY }],
			memoOutcomes: [
				{ kind: "keep-incubating", memo_id: MEMO_A },
				{ kind: "keep-incubating", memo_id: MEMO_B },
			],
		});
		staleRaw.basis_digest = "0".repeat(64);
		const stale = requirePass(staleRaw);
		const staleResult = reconcileMemoPass({
			state: first.state,
			scope,
			pass: stale,
			ids: ids("stale"),
		});
		assert.equal(staleResult.ok, false);
		if (staleResult.ok) assert.fail("Expected stale basis rejection");
		assert.equal(staleResult.issue.code, "memo-reconcile.base");

		const duplicateRaw = preparedRaw({
			scope,
			state: first.state,
			passId: "memo-pass-00000000-0000-4000-8000-000000000068",
			evidence: [evidence(EVIDENCE_B, "A duplicate formulation was proposed.")],
			hypothesisOutcomes: [{ kind: "keep", inquiry_id: NEW_INQUIRY }],
			memoOutcomes: [
				{
					kind: "revise",
					memo_id: MEMO_A,
					disposition: "incubating",
					revision: {
						revision_id: "memo-revision-00000000-0000-4000-8000-000000000071",
						title: "Capture cadence",
						content: "Capture cadence changes the interruption cost.",
						evidence_ids: [EVIDENCE_B],
						reason: "This revision accidentally duplicates another Memo.",
					},
				},
				{ kind: "keep-incubating", memo_id: MEMO_B },
			],
		});
		const duplicate = requirePass(duplicateRaw);
		const duplicateResult = reconcileMemoPass({
			state: first.state,
			scope,
			pass: duplicate,
			ids: ids("duplicate"),
		});
		assert.equal(duplicateResult.ok, false);
		if (duplicateResult.ok)
			assert.fail("Expected duplicate semantic key rejection");
		assert.equal(duplicateResult.issue.code, "memo-reconcile.duplicate");
		assert.deepEqual(first.state, before);
	});
});
