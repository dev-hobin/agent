import assert from "node:assert/strict";
import test from "node:test";

import {
	ACTION_LOOP_SESSION_ENTRY,
	ACTION_LOOP_SESSION_PROTOCOL,
	MAX_ACTION_LOOP_SESSION_EVENT_BYTES,
	actionLoopWorkCaseOpenedEvent,
	replayActionLoopSession,
	withActionLoopReplayEvent,
} from "../extensions/action-loop-session.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import { ACTIVATION_ENTRY, PROTOCOL } from "../extensions/state.ts";

const proposal = {
	outcome: {
		statement: "The active Work Case survives Pi session resume.",
		acceptanceConditions: [
			"The current branch reconstructs the exact canonical Work Case.",
		],
		constraints: ["No separate Developer persistence store is introduced."],
	},
	basis: ["Pi persists the current branch as append-only session entries."],
	provenance: { kind: "model" as const, source: "pi:tool-call" },
};

test("a Pi tool-result replay event reconstructs one exact active Work Case", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const event = actionLoopWorkCaseOpenedEvent(proposal, opened.value);
	const details = withActionLoopReplayEvent(
		{ protocol: "developer-action-loop/v1", kind: "opened" },
		event,
	);

	const replayed = await replayActionLoopSession([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_open_work_case",
				details,
			},
		},
	]);

	assert.equal(replayed.status, "ready");
	if (replayed.status !== "ready") return;
	assert.equal(
		replayed.activeWorkCase?.workCase.workCaseId,
		opened.value.workCase.workCaseId,
	);
	assert.equal(
		replayed.activeWorkCase?.workCase.revisionId,
		opened.value.workCase.revisionId,
	);
	assert.equal(replayed.appliedTransitions, 1);
});

test("a later Developer-off entry clears replayed Action Loop ownership", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const replayed = await replayActionLoopSession([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_open_work_case",
				details: withActionLoopReplayEvent(
					{ protocol: "developer-action-loop/v1", kind: "opened" },
					actionLoopWorkCaseOpenedEvent(proposal, opened.value),
				),
			},
		},
		{
			type: "custom",
			customType: ACTIVATION_ENTRY,
			data: { protocol: PROTOCOL, kind: "activation", enabled: false },
		},
	]);

	assert.equal(replayed.status, "ready");
	if (replayed.status !== "ready") return;
	assert.equal(replayed.activeWorkCase, undefined);
});

test("an oversized claimed replay event fails before domain replay", async () => {
	const replayed = await replayActionLoopSession([
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: {
				protocol: ACTION_LOOP_SESSION_PROTOCOL,
				kind: "action-cleared",
				transitionId: "clearance-oversized",
				proposal: {
					toolName: "write",
					toolInput: {
						content: "x".repeat(MAX_ACTION_LOOP_SESSION_EVENT_BYTES),
					},
					summary: "Oversized session event",
					intendedEffects: ["The event is rejected."],
					requiredConclusionIds: ["conclusion-1"],
				},
				expected: {
					actionCandidateId: "candidate-1",
					actionClearanceId: "clearance-oversized",
					revisionId: "revision-1",
				},
			},
		},
	]);

	assert.equal(replayed.status, "unavailable");
	if (replayed.status !== "unavailable") return;
	assert.match(replayed.message, /malformed or unsupported/i);
});

test("a malformed claimed replay event fails closed instead of becoming absence", async () => {
	const replayed = await replayActionLoopSession([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_open_work_case",
				details: {
					replayEvent: {
						protocol: "developer-action-loop/session-event/v1",
						kind: "work-case-opened",
					},
				},
			},
		},
	]);

	assert.equal(replayed.status, "unavailable");
	if (replayed.status !== "unavailable") return;
	assert.equal(replayed.entryIndex, 0);
	assert.match(replayed.message, /malformed/i);
});
