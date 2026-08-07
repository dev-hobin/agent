import assert from "node:assert/strict";
import test from "node:test";

import {
	actionLoopWorkCaseOpenedEvent,
	replayActionLoopSession,
	withActionLoopReplayEvent,
} from "../extensions/action-loop-session.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

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
