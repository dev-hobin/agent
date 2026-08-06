import assert from "node:assert/strict";
import test from "node:test";
import type { ActionClearance } from "../src/action-loop/action/action-clearance.ts";
import {
	beginEffect,
	type ControlledActionOccurrence,
} from "../src/action-loop/effect/begin-effect.ts";

const clearance: ActionClearance = Object.freeze({
	actionClearanceId: "action_clearance_1",
	workCaseId: "work-1",
	actionCandidateId: "action_candidate_1",
	controlledAction: Object.freeze({
		kind: "pi-tool-call",
		fingerprint: "a".repeat(64),
	}),
	intendedEffects: Object.freeze([
		"The target file contains the accepted implementation.",
	]),
	conclusionIds: Object.freeze(["conclusion-1"]),
	warrantBasis: Object.freeze(["The bounded change is warranted."]),
	permission: Object.freeze({
		actionCandidateId: "action_candidate_1",
		status: "granted",
		source: "delegation:current-user-request",
		basis: Object.freeze(["The current delegation permits this action."]),
	}),
	provenance: Object.freeze({ kind: "model", source: "fixture" }),
});

function occurrence(
	overrides: Partial<ControlledActionOccurrence> = {},
): ControlledActionOccurrence {
	return {
		occurrenceId: "tool-call-1",
		actionClearanceId: clearance.actionClearanceId,
		controlledAction: { ...clearance.controlledAction },
		source: "pi:tool_call",
		...overrides,
	};
}

test("one cleared host occurrence begins one pending Effect", () => {
	const first = beginEffect(clearance, occurrence());
	const repeated = beginEffect(clearance, occurrence());

	assert.equal(first.status, "begun");
	assert.equal(repeated.status, "begun");
	if (first.status !== "begun" || repeated.status !== "begun") return;
	assert.match(first.value.effectId, /^effect_[a-f0-9]{64}$/);
	assert.equal(repeated.value.effectId, first.value.effectId);
	assert.equal(first.value.status, "pending");
	assert.equal(first.value.occurrenceId, "tool-call-1");
	assert.deepEqual(first.value.intendedEffects, clearance.intendedEffects);
	assert.equal(Object.isFrozen(first.value), true);
	assert.equal(Object.isFrozen(first.value.controlledAction), true);
});

test("another occurrence receives another Effect identity", () => {
	const first = beginEffect(clearance, occurrence());
	const second = beginEffect(
		clearance,
		occurrence({ occurrenceId: "tool-call-2" }),
	);

	assert.equal(first.status, "begun");
	assert.equal(second.status, "begun");
	if (first.status === "begun" && second.status === "begun") {
		assert.notEqual(second.value.effectId, first.value.effectId);
	}
});

test("uncleared or mismatched occurrence cannot begin Effect tracking", () => {
	for (const [candidate, code] of [
		[
			occurrence({ actionClearanceId: "action_clearance_other" }),
			"identity-mismatch",
		],
		[
			occurrence({
				controlledAction: {
					kind: "pi-tool-call",
					fingerprint: "b".repeat(64),
				},
			}),
			"controlled-action-mismatch",
		],
		[occurrence({ occurrenceId: " " }), "invalid-occurrence-id"],
		[occurrence({ source: " " }), "invalid-source"],
	] as const) {
		const result = beginEffect(clearance, candidate);
		assert.equal(result.status, "invalid", code);
		if (result.status === "invalid") assert.equal(result.error.code, code);
	}
});
