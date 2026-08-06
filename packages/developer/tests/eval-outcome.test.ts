import assertModule from "node:assert";
import test from "node:test";

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

test("JSON event replay recovers checkpoint and verification state without TUI status events", () => {
	const route = {
		protocol: "developer/v5",
		kind: "route",
		routeId: "route:implementation",
		question: "Apply one change.",
		target: "implementation",
		reason: "The local movement is justified.",
		knownEvidence: [],
		consideredAlternatives: [],
	};
	const judgment = {
		protocol: "developer/v5",
		kind: "judgment",
		routeId: route.routeId,
		question: route.question,
		target: route.target,
		status: "resolved",
		result: "The stable landing was reached.",
		basis: ["The artifact changed."],
		openedQuestions: [],
		questionUpdates: [],
		artifacts: ["src/file.ts"],
		changedArtifacts: true,
	};
	const events = [route, judgment].map((details, index) => ({
		type: "tool_execution_end",
		toolName:
			index === 0 ? "developer_route_question" : "developer_record_judgment",
		isError: false,
		result: { details },
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
