import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	applyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	OBSERVER_PROTOCOL,
	type ObserverEvent,
	type ObserverState,
} from "../src/lifecycle.ts";
import {
	decodePreparedMemoPass,
	type PreparedMemoPass,
} from "../src/memo-profile.ts";
import {
	hydrateMemoScope,
	initialMemoWorkingState,
	reconcileMemoPass,
	type MemoPassReceipt,
	type MemoScopeSnapshot,
} from "../src/memo-reconciliation.ts";
import {
	encodeAppliedMemoPass,
	encodePreparedMemoEntry,
	memoAcknowledgmentEvent,
	OBSERVER_APPLIED_MEMO_ENTRY,
	OBSERVER_PREPARED_MEMO_ENTRY,
	reconstructMemoSession,
	type PendingMemoAcknowledgment,
} from "../src/memo-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";

const EPISODE_ID = "episode-session-memo";
const PASS_ID = "memo-pass-00000000-0000-4000-8000-000000000101";
const REVISION_ID =
	"memo-working-revision-00000000-0000-4000-8000-000000000102";
const RECEIPT_ID =
	"memo-receipt-00000000-0000-4000-8000-000000000103";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function event(value: unknown): ObserverEvent {
	const decoded = normalizeObserverEvent(value);
	if (!decoded.ok) assert.fail(JSON.stringify(decoded.issue));
	return decoded.event;
}

function openedEvent(): ObserverEvent {
	return event({
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId: EPISODE_ID,
		notebookId: "notebook-main",
		lang: "ko",
	});
}

function openLifecycle(): ObserverState {
	const applied = applyObserverEvent(initialObserverState(), openedEvent());
	if (!applied.applied) assert.fail(applied.reason);
	return applied.state;
}

function custom(customType: string, data: unknown): PiBranchEntryLike {
	return { type: "custom", customType, data };
}

function prepared(scope: MemoScopeSnapshot): PreparedMemoPass {
	const decoded = decodePreparedMemoPass({
		observer_memo_pass: "observer.prepared-memo-pass/v1",
		pass_id: PASS_ID,
		episode_id: EPISODE_ID,
		base_revision_id: null,
		basis_digest: scope.basisDigest,
		related_inquiry_ids: [],
		instruction_id: null,
		evidence: [],
		hypothesis_outcomes: [],
		memo_outcomes: [],
	});
	if (!decoded.ok) assert.fail(JSON.stringify(decoded.issue));
	return decoded.value;
}

function sessionFixture(): {
	readonly open: PiBranchEntryLike;
	readonly prepared: PiBranchEntryLike;
	readonly applied: PiBranchEntryLike;
	readonly acknowledgment: PiBranchEntryLike;
	readonly receipt: MemoPassReceipt;
} {
	const state = initialMemoWorkingState();
	const scopeResult = hydrateMemoScope({
		lifecycle: openLifecycle(),
		working: state,
		inventory: [],
		relatedInquiryIds: [],
	});
	if (!scopeResult.ok) assert.fail(JSON.stringify(scopeResult.issue));
	const pass = prepared(scopeResult.value);
	const reconciled = reconcileMemoPass({
		state,
		scope: scopeResult.value,
		pass,
		ids: {
			revisionId() {
				return REVISION_ID;
			},
			receiptId(): `memo-receipt-${string}` {
				return RECEIPT_ID;
			},
		},
	});
	if (!reconciled.ok) assert.fail(JSON.stringify(reconciled.issue));
	const pending: PendingMemoAcknowledgment = {
		revisionId: REVISION_ID,
		receipt: reconciled.value.receipt,
	};
	return {
		open: custom(OBSERVER_LIFECYCLE_ENTRY, openedEvent()),
		prepared: custom(OBSERVER_PREPARED_MEMO_ENTRY, encodePreparedMemoEntry(pass)),
		applied: custom(
			OBSERVER_APPLIED_MEMO_ENTRY,
			encodeAppliedMemoPass({
				pass,
				scope: scopeResult.value,
				receipt: reconciled.value.receipt,
			}),
		),
		acknowledgment: custom(
			OBSERVER_LIFECYCLE_ENTRY,
			memoAcknowledgmentEvent(pending),
		),
		receipt: reconciled.value.receipt,
	};
}

describe("Memo current-branch session replay", () => {
	test("replays prepared, applied, and compact acknowledgment in required order", () => {
		const fixture = sessionFixture();
		const preparedOnly = reconstructMemoSession([fixture.open, fixture.prepared]);
		assert.equal(preparedOnly.issues.length, 0);
		assert.equal(preparedOnly.prepared?.passId, PASS_ID);
		assert.equal(preparedOnly.state.passes, 0);

		const applied = reconstructMemoSession([
			fixture.open,
			fixture.prepared,
			fixture.applied,
		]);
		assert.equal(applied.issues.length, 0);
		assert.equal(applied.prepared, null);
		assert.equal(applied.state.passes, 1);
		assert.equal(applied.pendingAcknowledgment?.receipt.receiptId, RECEIPT_ID);
		assert.equal(applied.lifecycle.episode.status, "open");
		if (applied.lifecycle.episode.status !== "open") assert.fail("Expected open episode");
		assert.equal(applied.lifecycle.episode.lastMemo, null);

		const acknowledged = reconstructMemoSession([
			fixture.open,
			fixture.prepared,
			fixture.applied,
			fixture.acknowledgment,
		]);
		assert.equal(acknowledged.issues.length, 0);
		assert.equal(acknowledged.pendingAcknowledgment, null);
		assert.equal(acknowledged.lifecycle.episode.status, "open");
		if (acknowledged.lifecycle.episode.status !== "open") assert.fail("Expected open episode");
		assert.equal(acknowledged.lifecycle.episode.lastMemo?.revisionId, REVISION_ID);
	});

	test("treats exact duplicate prepared/applied entries idempotently", () => {
		const fixture = sessionFixture();
		const replayed = reconstructMemoSession([
			fixture.open,
			fixture.prepared,
			fixture.prepared,
			fixture.applied,
			fixture.acknowledgment,
			fixture.applied,
		]);
		assert.equal(replayed.issues.length, 0);
		assert.equal(replayed.state.passes, 1);
		assert.equal(replayed.pendingAcknowledgment, null);
	});

	test("fails closed for reordered, malformed, and conflicting applied entries", () => {
		const fixture = sessionFixture();
		const reordered = reconstructMemoSession([fixture.open, fixture.applied]);
		assert.equal(reordered.state.passes, 0);
		assert.equal(reordered.issues[0]?.code, "memo-session.order");

		const malformed = reconstructMemoSession([
			fixture.open,
			custom(OBSERVER_PREPARED_MEMO_ENTRY, { observer_memo_pass: "wrong" }),
		]);
		assert.equal(malformed.prepared, null);
		assert.equal(malformed.issues[0]?.code, "memo-session.malformed");

		const changedApplied = structuredClone(fixture.applied);
		if (!isObject(changedApplied.data)) {
			assert.fail("Expected applied data object");
		}
		changedApplied.data.receipt = { altered: true };
		const tampered = reconstructMemoSession([
			fixture.open,
			fixture.prepared,
			changedApplied,
		]);
		assert.equal(tampered.state.passes, 0);
		assert.equal(tampered.issues[0]?.code, "memo-session.applied");

		const conflict = reconstructMemoSession([
			fixture.open,
			fixture.prepared,
			fixture.applied,
			fixture.acknowledgment,
			changedApplied,
		]);
		assert.equal(conflict.state.passes, 1);
		assert.equal(conflict.issues[0]?.code, "memo-session.conflict");
	});

	test("uses only supplied fork ancestry and ignores compaction entries", () => {
		const fixture = sessionFixture();
		const prefix: PiBranchEntryLike[] = [
			fixture.open,
			{ type: "compaction", data: { summary: "compact" } },
			fixture.prepared,
		];
		const branchA = reconstructMemoSession([
			...prefix,
			fixture.applied,
			fixture.acknowledgment,
		]);
		const branchB = reconstructMemoSession(prefix);
		assert.equal(branchA.state.passes, 1);
		assert.equal(branchA.prepared, null);
		assert.equal(branchB.state.passes, 0);
		assert.equal(branchB.prepared?.passId, PASS_ID);
		assert.equal(branchA.issues.length, 0);
		assert.equal(branchB.issues.length, 0);
	});
});
