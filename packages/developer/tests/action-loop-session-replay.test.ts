import assert from "node:assert/strict";
import test from "node:test";

import {
	pauseLiveWorkCase,
	resumeLivePausedWorkCase,
	resumeLiveWaitingWorkCase,
	waitLiveWorkCase,
} from "../extensions/action-loop-continuity.ts";
import {
	ACTION_LOOP_SESSION_ENTRY,
	ACTION_LOOP_SESSION_PROTOCOL,
	MAX_ACTION_LOOP_SESSION_EVENT_BYTES,
	actionLoopPausedWorkCaseResumedEvent,
	actionLoopWaitingWorkCaseResumedEvent,
	actionLoopWorkCaseOpenedEvent,
	actionLoopWorkCasePausedEvent,
	actionLoopWorkCaseWaitingEvent,
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

test("human pause and resume replay as branch-local ownership transitions", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const pauseProposal = {
		workCaseId: opened.value.workCase.workCaseId,
		expectedRevisionId: opened.value.workCase.revisionId,
		reason: "The delegating human requested a bounded pause.",
		decision: {
			kind: "human",
			decisionId: "pi-command-pause-test",
			source: "pi:/developer pause",
			basis: ["The human explicitly invoked the pause command."],
		},
	};
	const paused = pauseLiveWorkCase(opened.value, pauseProposal);
	assert.equal(paused.status, "paused");
	if (paused.status !== "paused") return;
	const openingEntry = {
		type: "message",
		message: {
			role: "toolResult",
			toolName: "developer_open_work_case",
			details: withActionLoopReplayEvent(
				{ protocol: "developer-action-loop/v1", kind: "opened" },
				actionLoopWorkCaseOpenedEvent(proposal, opened.value),
			),
		},
	};
	const pauseEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: actionLoopWorkCasePausedEvent(pauseProposal, paused.state),
	};
	const pausedReplay = await replayActionLoopSession([
		openingEntry,
		pauseEntry,
	]);
	assert.equal(pausedReplay.status, "ready");
	if (pausedReplay.status !== "ready") return;
	assert.equal(pausedReplay.activeWorkCase, undefined);
	assert.equal(
		pausedReplay.heldWorkCase?.workCase.revisionId,
		paused.state.workCase.revisionId,
	);

	const resumeProposal = {
		workCaseId: paused.state.workCase.workCaseId,
		expectedRevisionId: paused.state.workCase.revisionId,
		decision: {
			kind: "human",
			decisionId: "pi-command-resume-test",
			source: "pi:/developer resume",
			basis: ["The human explicitly confirmed the resume command."],
		},
	};
	const resumed = resumeLivePausedWorkCase(paused.state, resumeProposal);
	assert.equal(resumed.status, "active");
	if (resumed.status !== "active") return;
	const resumedReplay = await replayActionLoopSession([
		openingEntry,
		pauseEntry,
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopPausedWorkCaseResumedEvent(
				resumeProposal,
				resumed.state,
			),
		},
	]);
	assert.equal(resumedReplay.status, "ready");
	if (resumedReplay.status !== "ready") return;
	assert.equal(resumedReplay.heldWorkCase, undefined);
	assert.equal(
		resumedReplay.activeWorkCase?.workCase.revisionId,
		resumed.state.workCase.revisionId,
	);
	assert.equal(resumedReplay.appliedTransitions, 3);
});

test("observed wait and predicate-bound resume replay branch-locally", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const waitProposal = {
		workCaseId: opened.value.workCase.workCaseId,
		expectedRevisionId: opened.value.workCase.revisionId,
		externalCondition: "The external registry is currently unavailable.",
		resumePredicate: "A bounded registry probe succeeds.",
		observation: {
			kind: "human" as const,
			observationId: "pi-command-wait-test",
			source: "pi:/developer wait",
			basis: ["The human observed and reported the current external condition."],
		},
	};
	const waiting = waitLiveWorkCase(opened.value, waitProposal);
	assert.equal(waiting.status, "waiting");
	if (waiting.status !== "waiting") return;
	const openingEntry = {
		type: "message",
		message: {
			role: "toolResult",
			toolName: "developer_open_work_case",
			details: withActionLoopReplayEvent(
				{ protocol: "developer-action-loop/v1", kind: "opened" },
				actionLoopWorkCaseOpenedEvent(proposal, opened.value),
			),
		},
	};
	const waitEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: actionLoopWorkCaseWaitingEvent(waitProposal, waiting.state),
	};
	const waitingReplay = await replayActionLoopSession([
		openingEntry,
		waitEntry,
	]);
	assert.equal(waitingReplay.status, "ready");
	if (waitingReplay.status !== "ready") return;
	assert.equal(waitingReplay.heldWorkCase?.workCase.status, "waiting");
	assert.equal(
		waitingReplay.heldWorkCase?.workCase.revisionId,
		waiting.state.workCase.revisionId,
	);

	const resumeProposal = {
		workCaseId: waiting.state.workCase.workCaseId,
		expectedRevisionId: waiting.state.workCase.revisionId,
		assessment: {
			resumePredicate: waiting.state.workCase.wait.resumePredicate,
			status: "satisfied" as const,
			observationKind: "human" as const,
			observationId: "pi-command-wait-resume-test",
			source: "pi:/developer resume",
			basis: ["The human observed that the exact predicate is now satisfied."],
		},
	};
	const resumed = resumeLiveWaitingWorkCase(waiting.state, resumeProposal);
	assert.equal(resumed.status, "active");
	if (resumed.status !== "active") return;
	const resumedReplay = await replayActionLoopSession([
		openingEntry,
		waitEntry,
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopWaitingWorkCaseResumedEvent(
				resumeProposal,
				resumed.state,
			),
		},
	]);
	assert.equal(resumedReplay.status, "ready");
	if (resumedReplay.status !== "ready") return;
	assert.equal(resumedReplay.heldWorkCase, undefined);
	assert.equal(
		resumedReplay.activeWorkCase?.workCase.revisionId,
		resumed.state.workCase.revisionId,
	);
	assert.equal(resumedReplay.appliedTransitions, 3);
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
