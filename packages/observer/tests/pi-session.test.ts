import assert from "node:assert/strict";
import test from "node:test";

import { OBSERVER_PROTOCOL, type ObserverEvent } from "../src/lifecycle.ts";
import {
	decodeApprovedWrapAttempt,
	decodePreparedWrapHandoff,
	OBSERVER_LIFECYCLE_ENTRY,
	OBSERVER_PREPARED_WRAP_ENTRY,
	OBSERVER_PREPARED_WRAP_PROTOCOL,
	OBSERVER_WRAP_ATTEMPT_ENTRY,
	OBSERVER_WRAP_ATTEMPT_PROTOCOL,
	preparedWrapDigest,
	reconstructObserverPiState,
	type ApprovedWrapAttempt,
	type PiBranchEntryLike,
	type PreparedWrapHandoff,
} from "../src/pi-session.ts";
import { OBSERVER_WRAP_SCHEMA } from "../src/wrap-profile.ts";

const notebookId = "notebook-11111111-1111-4111-8111-111111111111";

function lifecycle(event: ObserverEvent): PiBranchEntryLike {
	return {
		type: "custom",
		customType: OBSERVER_LIFECYCLE_ENTRY,
		data: event,
	};
}

function selected(): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "notebook-selected",
		notebookId,
	};
}

function opened(): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId: "episode-1",
		notebookId,
		lang: "ko",
	};
}

function activation(enabled: boolean): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "activation-changed",
		enabled,
	};
}

function proposed(summary = "승인할 계획"): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-proposed",
		proposalId: "proposal-1",
		summary,
	};
}

function cancelled(): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-cancelled",
		proposalId: "proposal-1",
	};
}

function committed(): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "wrap-committed",
		proposalId: "proposal-1",
		receipt: {
			receiptId: "receipt-1",
			status: "validated",
			recordIds: [],
		},
	};
}

function handoff(summary = "승인할 계획"): PreparedWrapHandoff {
	return {
		protocol: OBSERVER_PREPARED_WRAP_PROTOCOL,
		summary,
		prepared: {
			observer_wrap: OBSERVER_WRAP_SCHEMA,
			proposal_id: "proposal-1",
			notebook_id: notebookId,
			root: "/tmp/observer-notebook",
			episode_language: "ko",
			records: [],
		},
	};
}

function preparedEntry(value: unknown = handoff()): PiBranchEntryLike {
	return {
		type: "custom",
		customType: OBSERVER_PREPARED_WRAP_ENTRY,
		data: value,
	};
}

function approvedAttempt(
	value: PreparedWrapHandoff = handoff(),
): ApprovedWrapAttempt {
	return {
		protocol: OBSERVER_WRAP_ATTEMPT_PROTOCOL,
		kind: "approved",
		attemptId: "attempt-1",
		proposalId: value.prepared.proposal_id,
		preparedDigest: preparedWrapDigest(value),
	};
}

function attemptEntry(value: unknown = approvedAttempt()): PiBranchEntryLike {
	return {
		type: "custom",
		customType: OBSERVER_WRAP_ATTEMPT_ENTRY,
		data: value,
	};
}

function openBranch(): PiBranchEntryLike[] {
	return [
		lifecycle(selected()),
		lifecycle(opened()),
		lifecycle(activation(true)),
	];
}

test("strictly decodes prepared handoffs and approved attempts", () => {
	const accepted = decodePreparedWrapHandoff(handoff());
	assert.equal(accepted.ok, true);
	const withExtra = decodePreparedWrapHandoff({ ...handoff(), extra: true });
	assert.equal(withExtra.ok, false);
	if (!withExtra.ok)
		assert.equal(withExtra.issue.code, "pi-entry.handoff.shape");
	const unsupported = decodePreparedWrapHandoff({
		...handoff(),
		protocol: "observer.pi-prepared-wrap/v2",
	});
	assert.equal(unsupported.ok, false);
	if (!unsupported.ok)
		assert.equal(unsupported.issue.code, "pi-entry.handoff.unsupported");

	const attempt = approvedAttempt();
	assert.equal(decodeApprovedWrapAttempt(attempt).ok, true);
	const invalidDigest = decodeApprovedWrapAttempt({
		...attempt,
		preparedDigest: "not-a-hash",
	});
	assert.equal(invalidDigest.ok, false);
});

test("normalizes handoff field order before computing proposal identity", () => {
	const reordered = {
		prepared: {
			records: [],
			episode_language: "ko",
			root: "/tmp/observer-notebook",
			notebook_id: notebookId,
			proposal_id: "proposal-1",
			observer_wrap: OBSERVER_WRAP_SCHEMA,
		},
		summary: "승인할 계획",
		protocol: OBSERVER_PREPARED_WRAP_PROTOCOL,
	};
	const decoded = decodePreparedWrapHandoff(reordered);
	assert.equal(decoded.ok, true);
	if (!decoded.ok) return;
	assert.equal(
		preparedWrapDigest(decoded.value),
		preparedWrapDigest(handoff()),
	);
});

test("replays a prepared approved commit and clears transient proposal state", () => {
	const snapshot = reconstructObserverPiState([
		...openBranch(),
		preparedEntry(),
		lifecycle(proposed()),
		attemptEntry(),
		lifecycle(committed()),
	]);
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.state.mode, "off");
	assert.equal(snapshot.state.episode.status, "settled");
	assert.equal(snapshot.prepared, null);
	assert.equal(snapshot.attempt, null);
});

test("keeps exact duplicate handoff and attempt entries idempotent", () => {
	const snapshot = reconstructObserverPiState([
		...openBranch(),
		preparedEntry(),
		preparedEntry(),
		lifecycle(proposed()),
		attemptEntry(),
		attemptEntry(),
	]);
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.state.episode.status, "reviewing-wrap");
	assert.equal(snapshot.attempt?.attemptId, "attempt-1");
});

test("reports conflicting prepared proposals without replacing the first", () => {
	const conflict = handoff("다른 계획");
	const snapshot = reconstructObserverPiState([
		...openBranch(),
		preparedEntry(),
		preparedEntry(conflict),
		lifecycle(proposed()),
	]);
	assert.deepEqual(
		snapshot.issues.map((issue) => issue.code),
		["pi-entry.handoff.conflict"],
	);
	assert.equal(snapshot.prepared?.handoff.summary, "승인할 계획");
	assert.equal(snapshot.state.episode.status, "reviewing-wrap");
});

test("fails closed for reordered lifecycle and stale attempt history", () => {
	const stale = {
		...approvedAttempt(),
		preparedDigest: "a".repeat(64),
	};
	const snapshot = reconstructObserverPiState([
		...openBranch(),
		lifecycle(proposed()),
		preparedEntry(),
		attemptEntry(stale),
		lifecycle(committed()),
	]);
	assert.deepEqual(
		snapshot.issues.map((issue) => issue.code),
		[
			"pi-entry.lifecycle.order",
			"pi-entry.attempt.order",
			"pi-entry.lifecycle.order",
		],
	);
	assert.equal(snapshot.state.episode.status, "open");
	assert.equal(snapshot.prepared?.handoff.prepared.proposal_id, "proposal-1");
});

test("surfaces malformed owned entries while ignoring unrelated custom entries", () => {
	const snapshot = reconstructObserverPiState([
		{ type: "custom", customType: "another.extension", data: { bad: true } },
		{
			type: "custom",
			customType: OBSERVER_LIFECYCLE_ENTRY,
			data: { protocol: OBSERVER_PROTOCOL, kind: "unknown" },
		},
		{
			type: "custom",
			customType: OBSERVER_PREPARED_WRAP_ENTRY,
			data: null,
		},
	]);
	assert.deepEqual(
		snapshot.issues.map((issue) => issue.code),
		["pi-entry.lifecycle.decode", "pi-entry.handoff.shape"],
	);
	assert.equal(snapshot.state.episode.status, "empty");
});

test("keeps cancellation ordered and returns to the same open episode", () => {
	const snapshot = reconstructObserverPiState([
		...openBranch(),
		preparedEntry(),
		lifecycle(proposed()),
		lifecycle(cancelled()),
	]);
	assert.deepEqual(snapshot.issues, []);
	assert.equal(snapshot.state.mode, "on");
	assert.equal(snapshot.state.episode.status, "open");
	assert.equal(snapshot.prepared, null);
});

test("uses supplied branch ancestry while compaction entries only stutter", () => {
	const branchPoint = openBranch();
	const parentFuture = [...branchPoint, lifecycle(activation(false))];
	const fork = [
		...branchPoint,
		{
			type: "compaction",
			data: { summary: "old conversation" },
		},
	];
	const parentState = reconstructObserverPiState(parentFuture);
	const forkState = reconstructObserverPiState(fork);
	assert.equal(parentState.state.mode, "off");
	assert.equal(forkState.state.mode, "on");
	assert.deepEqual(forkState.issues, []);
});

test("rejects a handoff whose notebook or language differs from the open episode", () => {
	const other = handoff();
	const mismatched = {
		...other,
		prepared: { ...other.prepared, episode_language: "en" },
	};
	const snapshot = reconstructObserverPiState([
		...openBranch(),
		preparedEntry(mismatched),
	]);
	assert.deepEqual(
		snapshot.issues.map((issue) => issue.code),
		["pi-entry.handoff.order"],
	);
	assert.equal(snapshot.prepared, null);
});
