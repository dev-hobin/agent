import assertModule from "node:assert";
import test from "node:test";

import {
	changeAuthorized,
	developerEventData,
	landingRecorded,
} from "../src/protocol.ts";
import {
	assertAllowedOutcome,
	classifyEvalOutcome,
	parseDeveloperStatus,
	statusFromDeveloperEvents,
} from "../scripts/eval-outcome.mjs";

const assert: typeof assertModule.strict = assertModule.strict;

const status = (overrides: Record<string, string> = {}) => ({
	protocol: "idle",
	active: "none",
	checkpoint: "ready",
	verification: "current",
	pending: "none",
	...overrides,
});

test("eval outcomes distinguish unchanged, pending, paused, and verified paths", () => {
	assert.equal(
		classifyEvalOutcome({ changes: [], status: status() }),
		"settled-unchanged",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [],
			status: status({ protocol: "needs-answer", pending: "question:1" }),
		}),
		"pending",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [{ path: "src/file.ts", kind: "modified" }],
			status: status({
				protocol: "needs-routing",
				checkpoint: "reroute required",
				verification: "required",
			}),
		}),
		"changed-paused",
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [{ path: "src/file.ts", kind: "modified" }],
			status: status(),
		}),
		"changed-verified",
	);
});

test("compact and detailed Developer status produce the same outcome signals", () => {
	assert.deepEqual(
		parseDeveloperStatus(
			"developer: on · target: none · needs-routing\nactive: none\ncheckpoint: reroute required\nverification: required\npending: none",
		),
		{
			protocol: "needs-routing",
			active: "none",
			checkpoint: "reroute required",
			verification: "required",
			pending: "none",
		},
	);
	assert.equal(
		classifyEvalOutcome({
			changes: [{ path: "src/file.ts", kind: "modified" }],
			status: parseDeveloperStatus("developer: on · target: none · idle"),
		}),
		"changed-verified",
	);
});

test("JSON event replay recovers reroute and verification state without TUI status events", () => {
	const authorization = changeAuthorized({
		kind: "authorized-change",
		authorizationId: "change:implementation",
		question: "Apply one change.",
		reason: "The local movement is justified.",
		contract: {
			movement: "Apply one bounded change.",
			stableLanding: "The stable landing is reached.",
			verificationTarget: "Run the focused verifier.",
		},
	});
	const landing = landingRecorded({
		authorizationId: authorization.change.authorizationId,
		changedPaths: ["src/file.ts"],
		result: "The stable landing was reached.",
		verification: ["The focused test passed."],
	});
	const events = [authorization, landing].map((event) => ({
		type: "tool_execution_end",
		isError: false,
		result: { details: developerEventData(event) },
	}));

	assert.deepEqual(statusFromDeveloperEvents(events), {
		protocol: "needs-routing",
		active: "none",
		checkpoint: "reroute required",
		verification: "required",
		pending: "none",
	});
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
