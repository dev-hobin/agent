import assert from "node:assert/strict";
import test from "node:test";

import { waitLiveWorkCase } from "../extensions/action-loop-continuity.ts";
import {
	inspectActionLoopWorkbench,
	type ActionLoopWorkbenchSnapshot,
} from "../extensions/action-loop-workbench.ts";
import type { LiveCapabilityInventoryResult } from "../extensions/action-loop-capability-inventory.ts";
import { actionLoopWorkCaseOpenedEvent } from "../extensions/action-loop-session-event.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";

const readyInventory: LiveCapabilityInventoryResult = {
	status: "ready",
	value: {
		inventory: {
			status: "inventoried",
			entries: [],
			excluded: [],
			unavailable: [],
		},
		availablePackageSkills: new Map(),
		boundCapabilitiesBySkillName: new Map(),
		summary: { bound: 0, unavailable: 0, excluded: 0 },
	},
};

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
		capabilityInventory: readyInventory,
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

test("canonical Workbench projects durable history semantically", () => {
	const proposal = {
		outcome: {
			statement: "Record the current release decision.",
			acceptanceConditions: ["The durable checkpoint is inspectable."],
			constraints: ["Do not expose internal identity."],
		},
		basis: ["The user delegated the bounded release decision."],
		provenance: { kind: "model" as const, source: "test" },
	};
	const opened = openLiveWorkCase(undefined, proposal);
	if (opened.status !== "opened") throw new Error("Expected opened Work Case");
	const snapshot = inspectActionLoopWorkbench({
		enabled: true,
		capabilityInventory: readyInventory,
		activeWorkCase: opened.value,
		history: [actionLoopWorkCaseOpenedEvent(proposal, opened.value)],
	});
	const history = snapshot.sections.find((section) => section.id === "history");
	assert.equal(history?.value, "1");
	assert.equal(history?.items[0]?.title, "Work Case opened");
	assert.doesNotMatch(
		JSON.stringify(snapshot),
		/(?:work_case|revision|transition)_[a-f0-9]+|\b[a-f0-9]{64}\b/,
	);
});

test("canonical Workbench distinguishes preparing, ready, active, and unavailable", () => {
	assert.equal(inspectActionLoopWorkbench({ enabled: false }).status, "off");
	assert.equal(
		inspectActionLoopWorkbench({ enabled: true }).status,
		"preparing",
	);
	assert.equal(
		inspectActionLoopWorkbench({
			enabled: true,
			capabilityInventory: readyInventory,
		}).status,
		"idle",
	);
	assert.equal(
		inspectActionLoopWorkbench({
			enabled: true,
			capabilityInventory: readyInventory,
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
	assert.match(pending.next, /Bind the current Skill inventory/);
});
