import assert from "node:assert/strict";
import test from "node:test";

import { waitLiveWorkCase } from "../extensions/action-loop-continuity.ts";
import {
	inspectActionLoopWorkbench,
	type ActionLoopWorkbenchSnapshot,
} from "../extensions/action-loop-workbench.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

function openedWorkCase() {
	const opened = openLiveWorkCase(undefined, {
		outcome: {
			statement: "Release the verified package.",
			acceptanceConditions: [
				"The packed artifact passes its supported Pi smoke.",
			],
			constraints: ["Do not publish without authorization."],
		},
		basis: ["The current request delegates release preparation."],
		provenance: { kind: "model", source: "test" },
	});
	if (opened.status !== "opened") {
		throw new Error("Expected a newly opened Work Case fixture");
	}
	return opened.value;
}

function semanticText(snapshot: ActionLoopWorkbenchSnapshot): string {
	return JSON.stringify(snapshot);
}

test("canonical Workbench shows waiting meaning without internal identity", () => {
	const active = openedWorkCase();
	const waiting = waitLiveWorkCase(active, {
		workCaseId: active.workCase.workCaseId,
		expectedRevisionId: active.workCase.revisionId,
		externalCondition: "External security approval is pending.",
		resumePredicate: "The approval status is confirmed as granted.",
		observation: {
			kind: "human",
			observationId: "observation_hidden",
			source: "pi:user-prompt",
			basis: ["The exact user prompt reports the pending approval."],
		},
	});
	assert.equal(waiting.status, "waiting");
	if (waiting.status !== "waiting") return;
	const snapshot = inspectActionLoopWorkbench({
		enabled: true,
		heldWorkCase: waiting.state,
	});
	assert.equal(snapshot.status, "waiting");
	assert.equal(snapshot.statusLabel, "Waiting");
	assert.match(semanticText(snapshot), /External security approval is pending/);
	assert.match(
		semanticText(snapshot),
		/approval status is confirmed as granted/,
	);
	assert.match(snapshot.next, /normal update/);
	assert.doesNotMatch(
		semanticText(snapshot),
		/(?:observation|work_case|revision|conclusion|transition)_[a-z0-9]+/,
	);
});

test("canonical Workbench distinguishes off, ready, active, and unavailable", () => {
	assert.equal(inspectActionLoopWorkbench({ enabled: false }).status, "off");
	assert.equal(inspectActionLoopWorkbench({ enabled: true }).status, "idle");
	assert.equal(
		inspectActionLoopWorkbench({
			enabled: true,
			activeWorkCase: openedWorkCase(),
		}).status,
		"active",
	);
	assert.equal(
		inspectActionLoopWorkbench({ enabled: true, replayUnavailable: true })
			.status,
		"unavailable",
	);
	const pending = inspectActionLoopWorkbench({
		enabled: true,
		replayPending: true,
	});
	assert.equal(pending.status, "unavailable");
	assert.equal(pending.statusLabel, "Recovery pending");
	assert.match(pending.headline, /awaits inventory-bound recovery/);
	assert.match(pending.next, /normal message/);
});
