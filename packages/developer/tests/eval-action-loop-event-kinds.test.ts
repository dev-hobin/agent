import assert from "node:assert/strict";
import test from "node:test";

import {
	actionLoopWorkCaseOpenedEvent,
	extractReplayEvent,
	withActionLoopReplayEvent,
} from "../extensions/action-loop-session-event.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import { collectActionLoopEventKinds } from "../scripts/action-loop-event-kinds.mjs";

const proposal = {
	outcome: {
		statement: "The evaluator counts semantic events from every replay carrier.",
		acceptanceConditions: ["The embedded checkpoint is counted."],
		constraints: ["Do not count unrelated entries."],
	},
	basis: ["The matrix oracle depends on semantic replay history."],
	provenance: { kind: "model" as const, source: "test" },
};

test("matrix event kinds include replay events embedded in tool results", () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const event = actionLoopWorkCaseOpenedEvent(proposal, opened.value);
	const branch = [
		{ type: "message", message: { role: "user" } },
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_progress_action_loop",
				details: withActionLoopReplayEvent({}, event),
			},
		},
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_progress_action_loop",
				details: { replayEvent: { protocol: "invalid" } },
			},
		},
	];
	assert.deepEqual(
		collectActionLoopEventKinds(branch, extractReplayEvent),
		{
			eventKinds: ["work-case-opened"],
			eventErrors: ["Claimed Action Loop replay event is invalid"],
		},
	);
});
