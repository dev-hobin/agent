import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createActor } from "xstate";

import {
	applyObserverEvent,
	canApplyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	OBSERVER_PROTOCOL,
	reconstructObserverState,
	type ObserverEvent,
	type ObserverState,
	type ObserverTransitionRejection,
} from "../src/lifecycle.ts";
import {
	applyObserverMachineEvent,
	observerMachine,
	observerSnapshot,
} from "../src/lifecycle-machine.ts";

function requireEvent(value: unknown): ObserverEvent {
	const result = normalizeObserverEvent(value);
	if (!result.ok) {
		assert.fail(`Expected valid event: ${JSON.stringify(result.issue)}`);
	}
	return result.event;
}

function applied(state: ObserverState, event: ObserverEvent): ObserverState {
	const result = applyObserverEvent(state, event);
	if (!result.applied) {
		assert.fail(`Expected applied event: ${result.reason}`);
	}
	return result.state;
}

function rejected(
	state: ObserverState,
	event: ObserverEvent,
	reason: ObserverTransitionRejection,
): void {
	const result = applyObserverEvent(state, event);
	if (result.applied) assert.fail(`Expected rejection: ${reason}`);
	assert.equal(result.reason, reason);
	assert.equal(result.state, state);
	assert.equal(canApplyObserverEvent(state, event), false);
	assert.deepEqual(applyObserverMachineEvent(state, event), state);
}

function episodeOpened(
	episodeId = "episode-1",
	notebookId = "notebook-main",
	lang = "ko",
): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId,
		notebookId,
		lang,
	});
}

function activationChanged(enabled: boolean): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "activation-changed",
		enabled,
	});
}

function notebookSelected(notebookId: string): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "notebook-selected",
		notebookId,
	});
}

function memoReconciled(revisionId = "revision-1"): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "memo-reconciled",
		revisionId,
		receipt: {
			receiptId: `memo-receipt-${revisionId}`,
			summary: `Memo ${revisionId}`,
		},
	});
}

function saveProposed(proposalId = "proposal-1"): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "save-proposed",
		proposalId,
		summary: `Review & Save ${proposalId}`,
	});
}

function saveCancelled(proposalId = "proposal-1"): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "save-cancelled",
		proposalId,
	});
}

function saveCommitted(
	proposalId = "proposal-1",
	status: "unvalidated" | "validated" = "validated",
): ObserverEvent {
	return requireEvent({
		protocol: OBSERVER_PROTOCOL,
		kind: "save-committed",
		proposalId,
		receipt: {
			receiptId: `save-receipt-${proposalId}`,
			status,
			recordIds: ["source-record-1", "zettel-record-1"],
		},
	});
}

function openState(): ObserverState {
	return applied(initialObserverState(), episodeOpened());
}

function reviewingState(mode: "off" | "on" = "off"): ObserverState {
	let state = openState();
	if (mode === "on") state = applied(state, activationChanged(true));
	return applied(state, saveProposed());
}

const validRawEvents: readonly (readonly [string, unknown])[] = [
	[
		"episode-opened",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "episode-opened",
			episodeId: "episode-1",
			notebookId: "notebook-main",
			lang: "ko",
		},
	],
	[
		"activation-changed",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "activation-changed",
			enabled: true,
		},
	],
	[
		"notebook-selected",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "notebook-selected",
			notebookId: "notebook-main",
		},
	],
	[
		"memo-reconciled",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "memo-reconciled",
			revisionId: "revision-1",
			receipt: { receiptId: "memo-receipt-1", summary: "Memo summary" },
		},
	],
	[
		"save-proposed",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "save-proposed",
			proposalId: "proposal-1",
			summary: "Review & Save summary",
		},
	],
	[
		"save-cancelled",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "save-cancelled",
			proposalId: "proposal-1",
		},
	],
	[
		"save-committed",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "save-committed",
			proposalId: "proposal-1",
			receipt: {
				receiptId: "save-receipt-1",
				status: "validated",
				recordIds: [],
			},
		},
	],
];

const invalidRawEvents: readonly (readonly [string, unknown, string])[] = [
	["non-object", null, "event.object"],
	[
		"wrong protocol",
		{ protocol: "observer/v0", kind: "activation-changed", enabled: true },
		"event.protocol",
	],
	["missing kind", { protocol: OBSERVER_PROTOCOL }, "event.kind"],
	[
		"unknown kind",
		{ protocol: OBSERVER_PROTOCOL, kind: "unknown" },
		"event.kind",
	],
	[
		"extra field",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "activation-changed",
			enabled: true,
			extra: true,
		},
		"event.shape",
	],
	[
		"blank ID",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "episode-opened",
			episodeId: " ",
			notebookId: "notebook-main",
			lang: "ko",
		},
		"event.shape",
	],
	[
		"unsupported episode language",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "episode-opened",
			episodeId: "episode-1",
			notebookId: "notebook-main",
			lang: "ja",
		},
		"event.shape",
	],
	[
		"incomplete memo receipt",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "memo-reconciled",
			revisionId: "revision-1",
			receipt: { receiptId: "memo-receipt-1" },
		},
		"event.shape",
	],
	[
		"missing save receipt",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "save-committed",
			proposalId: "proposal-1",
		},
		"event.shape",
	],
	[
		"unknown receipt status",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "save-committed",
			proposalId: "proposal-1",
			receipt: {
				receiptId: "save-receipt-1",
				status: "saved",
				recordIds: [],
			},
		},
		"event.shape",
	],
	[
		"invalid receipt record ID",
		{
			protocol: OBSERVER_PROTOCOL,
			kind: "save-committed",
			proposalId: "proposal-1",
			receipt: {
				receiptId: "save-receipt-1",
				status: "validated",
				recordIds: [""],
			},
		},
		"event.shape",
	],
];

describe("Observer lifecycle event decoder", () => {
	for (const [kind, value] of validRawEvents) {
		test(`normalizes ${kind}`, () => {
			const result = normalizeObserverEvent(value);
			if (!result.ok) assert.fail(JSON.stringify(result.issue));
			assert.equal(result.event.kind, kind);
		});
	}

	for (const [name, value, code] of invalidRawEvents) {
		test(`rejects ${name}`, () => {
			const result = normalizeObserverEvent(value);
			if (result.ok) assert.fail(`Expected ${name} to fail`);
			assert.equal(result.issue.code, code);
		});
	}
});

describe("Observer lifecycle transitions", () => {
	test("starts EMPTY and OFF", () => {
		const state = initialObserverState();
		assert.deepEqual(state, {
			mode: "off",
			selectedNotebookId: null,
			episode: { status: "empty" },
		});
		const snapshot = observerSnapshot(state);
		assert.equal(snapshot.matches({ mode: "off", episode: "empty" }), true);
		assert.equal(snapshot.hasTag("observer-on"), false);
	});

	test("runs the Sidecar memo and save-cancel trace", () => {
		let state = openState();
		state = applied(state, activationChanged(true));
		state = applied(state, memoReconciled());
		state = applied(state, saveProposed());
		assert.equal(state.mode, "on");
		assert.equal(state.episode.status, "reviewing-save");
		assert.equal(observerSnapshot(state).hasTag("reviewing-save"), true);
		state = applied(state, saveCancelled());
		assert.equal(state.mode, "on");
		assert.equal(state.episode.status, "open");
		if (state.episode.status !== "open") assert.fail("Expected open episode");
		assert.equal(state.episode.lastMemo?.revisionId, "revision-1");
	});

	test("keeps Mode OFF through a material review memo trace", () => {
		let state = openState();
		state = applied(state, memoReconciled());
		assert.equal(state.mode, "off");
		assert.equal(state.episode.status, "open");
	});

	test("turns observation off without clearing an open episode", () => {
		let state = applied(openState(), activationChanged(true));
		const episode = state.episode;
		state = applied(state, activationChanged(false));
		assert.equal(state.mode, "off");
		assert.deepEqual(state.episode, episode);
	});

	test("accepts repeated activation stutters", () => {
		const off = openState();
		const offResult = applyObserverEvent(off, activationChanged(false));
		assert.equal(offResult.applied, true);
		if (!offResult.applied) assert.fail("Expected OFF stutter");
		assert.equal(offResult.changed, false);
		const on = applied(off, activationChanged(true));
		const onResult = applyObserverEvent(on, activationChanged(true));
		assert.equal(onResult.applied, true);
		if (!onResult.applied) assert.fail("Expected ON stutter");
		assert.equal(onResult.changed, false);
	});

	test("requires an active episode before enabling observation", () => {
		rejected(
			initialObserverState(),
			activationChanged(true),
			"activation.episode-required",
		);
	});

	test("selects notebooks only outside live work or for an exact live identity", () => {
		let state = applied(
			initialObserverState(),
			notebookSelected("notebook-main"),
		);
		assert.equal(state.selectedNotebookId, "notebook-main");
		state = applied(state, episodeOpened());
		const stutter = applyObserverEvent(
			state,
			notebookSelected("notebook-main"),
		);
		assert.equal(stutter.applied, true);
		if (!stutter.applied) assert.fail("Expected notebook selection stutter");
		assert.equal(stutter.changed, false);
		rejected(state, notebookSelected("notebook-other"), "notebook.live-switch");
		const settled = applied(applied(state, saveProposed()), saveCommitted());
		const switched = applied(settled, notebookSelected("notebook-other"));
		assert.equal(switched.selectedNotebookId, "notebook-other");
	});

	test("rejects episode replacement while work is open", () => {
		rejected(openState(), episodeOpened("episode-2"), "episode.already-open");
	});

	test("rejects duplicate memo revision and memo during save review", () => {
		const memoed = applied(openState(), memoReconciled());
		rejected(memoed, memoReconciled(), "memo.revision-duplicate");
		rejected(
			applied(memoed, saveProposed()),
			memoReconciled("revision-2"),
			"memo.episode-open-required",
		);
	});

	test("rejects stale proposal identities", () => {
		const state = reviewingState();
		rejected(state, saveCancelled("proposal-stale"), "save.proposal-mismatch");
		rejected(state, saveCommitted("proposal-stale"), "save.proposal-mismatch");
	});

	test("rejects commit before review and a second proposal", () => {
		rejected(openState(), saveCommitted(), "save.review-required");
		rejected(
			reviewingState(),
			saveProposed("proposal-2"),
			"save.episode-open-required",
		);
	});

	test("rejects an unvalidated save receipt", () => {
		rejected(
			reviewingState(),
			saveCommitted("proposal-1", "unvalidated"),
			"save.receipt-unvalidated",
		);
	});

	test("commits only a matching validated receipt and forces OFF", () => {
		const state = applied(reviewingState("on"), saveCommitted());
		assert.equal(state.mode, "off");
		assert.equal(state.episode.status, "settled");
		if (state.episode.status !== "settled") assert.fail("Expected settled");
		assert.equal(state.episode.committedSave.proposalId, "proposal-1");
		assert.equal(state.episode.committedSave.receipt.status, "validated");
		const snapshot = observerSnapshot(state);
		assert.equal(snapshot.matches({ mode: "off", episode: "settled" }), true);
		assert.equal(snapshot.hasTag("settled"), true);
		assert.equal(snapshot.hasTag("observer-on"), false);
		rejected(state, saveCommitted(), "save.review-required");
	});

	test("opens only a new episode on the selected notebook after settlement", () => {
		const settled = applied(reviewingState(), saveCommitted());
		rejected(settled, episodeOpened(), "episode.id-reused");
		rejected(
			settled,
			episodeOpened("episode-2", "notebook-other"),
			"notebook.mismatch",
		);
		const reopened = applied(settled, episodeOpened("episode-2"));
		assert.equal(reopened.episode.status, "open");
		if (reopened.episode.status !== "open") assert.fail("Expected open");
		assert.equal(reopened.episode.core.lang, "ko");
	});
});

describe("Observer lifecycle replay and XState projection", () => {
	test("reconstructs the same ordered entries deterministically", () => {
		const values: readonly unknown[] = [
			episodeOpened(),
			activationChanged(true),
			memoReconciled(),
			saveProposed(),
			saveCommitted(),
		];
		const first = reconstructObserverState(values);
		const second = reconstructObserverState(values);
		assert.deepEqual(second, first);
		assert.equal(first.appliedEvents, 5);
		assert.deepEqual(first.issues, []);
		assert.equal(first.state.episode.status, "settled");
	});

	test("reports malformed and illegal entries while continuing replay", () => {
		const result = reconstructObserverState([
			episodeOpened(),
			{ protocol: OBSERVER_PROTOCOL, kind: "unknown" },
			saveCommitted(),
			memoReconciled(),
		]);
		assert.equal(result.state.episode.status, "open");
		assert.equal(result.appliedEvents, 2);
		assert.deepEqual(
			result.issues.map((issue) => [issue.index, issue.stage, issue.code]),
			[
				[1, "decode", "event.kind"],
				[2, "transition", "save.review-required"],
			],
		);
	});

	test("reconstructs branch forks independently from a shared prefix", () => {
		const prefix: readonly unknown[] = [
			episodeOpened(),
			activationChanged(true),
		];
		const branchA = reconstructObserverState([
			...prefix,
			activationChanged(false),
		]);
		const branchB = reconstructObserverState([...prefix, saveProposed()]);
		assert.equal(branchA.state.mode, "off");
		assert.equal(branchA.state.episode.status, "open");
		assert.equal(branchB.state.mode, "on");
		assert.equal(branchB.state.episode.status, "reviewing-save");
	});

	test("projects a live XState actor through the full lifecycle", () => {
		const actor = createActor(observerMachine);
		actor.start();
		actor.send({ type: "OBSERVER_EVENT", event: episodeOpened() });
		assert.equal(
			actor.getSnapshot().matches({ mode: "off", episode: "open" }),
			true,
		);
		actor.send({ type: "OBSERVER_EVENT", event: activationChanged(true) });
		assert.equal(actor.getSnapshot().hasTag("observer-on"), true);
		actor.send({ type: "OBSERVER_EVENT", event: saveProposed() });
		assert.equal(actor.getSnapshot().hasTag("reviewing-save"), true);
		actor.send({ type: "OBSERVER_EVENT", event: saveCancelled() });
		assert.equal(
			actor.getSnapshot().matches({ mode: "on", episode: "open" }),
			true,
		);
		actor.send({ type: "OBSERVER_EVENT", event: saveProposed("proposal-2") });
		actor.send({ type: "OBSERVER_EVENT", event: saveCommitted("proposal-2") });
		assert.equal(
			actor.getSnapshot().matches({ mode: "off", episode: "settled" }),
			true,
		);
		assert.equal(actor.getSnapshot().hasTag("settled"), true);
		const settled = actor.getSnapshot().context;
		actor.send({ type: "OBSERVER_EVENT", event: saveCommitted("proposal-2") });
		assert.deepEqual(actor.getSnapshot().context, settled);
		actor.stop();
	});

	test("keeps pure reducer and XState context equivalent for every trace step", () => {
		const trace = [
			episodeOpened(),
			activationChanged(true),
			memoReconciled(),
			saveProposed(),
			saveCancelled(),
			saveProposed("proposal-2"),
			saveCommitted("proposal-2"),
		];
		let reducerState = initialObserverState();
		let machineState = initialObserverState();
		for (const event of trace) {
			assert.equal(canApplyObserverEvent(reducerState, event), true);
			const result = applyObserverEvent(reducerState, event);
			if (!result.applied) assert.fail(result.reason);
			reducerState = result.state;
			machineState = applyObserverMachineEvent(machineState, event);
			assert.deepEqual(machineState, reducerState);
		}
	});
});
