import assertModule from "node:assert";
import test from "node:test";

import {
	assertAllowedOutcome,
	classifyEvalOutcome,
	classifyTrialDisposition,
	parseDeveloperStatus,
	statusFromDeveloperEvents,
} from "../scripts/eval-outcome.mjs";

const assert: typeof assertModule.strict = assertModule.strict;

const status = (overrides: Record<string, string> = {}) => ({
	protocol: "completed",
	active: "none",
	checkpoint: "ready",
	verification: "current",
	pending: "none",
	...overrides,
});

test("eval outcomes distinguish unchanged, held, active-changed, and completed paths", () => {
	assert.equal(
		classifyEvalOutcome({ changes: [], status: status() }),
		"settled-unchanged",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [],
			status: status({ protocol: "waiting", pending: "waiting" }),
		}),
		"pending",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [{ path: "src/file.ts", kind: "modified" }],
			status: status({ protocol: "active", active: "active" }),
		}),
		"changed-active",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [],
			status: status({ protocol: "active", active: "active" }),
		}),
		"active-unchanged",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [{ path: "src/file.ts", kind: "modified" }],
			status: status(),
		}),
		"changed-verified",
	);
});

test("trial disposition separates agent settlement from Work Case completion", () => {
	assert.equal(classifyTrialDisposition({ status: status() }), "completed");
	assert.equal(
		classifyTrialDisposition({
			status: status({ protocol: "active", active: "active" }),
		}),
		"active-incomplete",
	);
	assert.equal(
		classifyTrialDisposition({
			status: status({ protocol: "waiting", pending: "waiting" }),
		}),
		"held",
	);
	assert.equal(
		classifyTrialDisposition({
			status: status({ protocol: "active", active: "active" }),
			budgetStop: { kind: "route-limit" },
		}),
		"bounded-stop",
	);
});

test("semantic Developer status is parsed without internal identities", () => {
	assert.deepEqual(
		parseDeveloperStatus("developer · Waiting\nOutcome · Publish"),
		{
			protocol: "waiting",
			active: "none",
			checkpoint: "owned",
			verification: "unsettled",
			pending: "waiting",
		},
	);
	assert.deepEqual(parseDeveloperStatus("developer · Completed"), status());
});

test("JSON event projection recovers canonical Action Loop ownership", () => {
	const events = [
		{
			type: "tool_execution_end",
			isError: false,
			result: {
				details: { replayEvent: { kind: "work-case-opened" } },
			},
		},
		{
			type: "tool_execution_end",
			isError: false,
			result: {
				details: { replayEvent: { kind: "work-case-waiting" } },
			},
		},
	];
	assert.deepEqual(statusFromDeveloperEvents(events), {
		protocol: "waiting",
		active: "none",
		checkpoint: "owned",
		verification: "unsettled",
		pending: "waiting",
	});
	events.push({
		type: "tool_execution_end",
		isError: false,
		result: { details: { replayEvent: { kind: "work-case-completed" } } },
	});
	assert.deepEqual(statusFromDeveloperEvents(events), status());
});

test("fixture outcome declarations reject pass-but-wrong terminal states", () => {
	assert.doesNotThrow(() =>
		assertAllowedOutcome(
			{ id: "change", allowedOutcomes: ["changed-verified"] },
			"changed-verified",
		),
	);
	assert.throws(
		() =>
			assertAllowedOutcome(
				{ id: "change", allowedOutcomes: ["changed-verified"] },
				"changed-paused",
			),
		/not allowed/,
	);
});
