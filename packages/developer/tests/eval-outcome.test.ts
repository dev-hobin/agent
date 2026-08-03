import assert from "node:assert/strict";
import test from "node:test";

import {
	assertAllowedOutcome,
	classifyEvalOutcome,
	parseDeveloperRuntimeResultDetails,
	statusFromDeveloperEvents,
} from "../scripts/eval-outcome.mjs";

const runtime = (
	overrides: Partial<{
		state: "inactive" | "blocked" | "idle" | "frame" | "authorized";
		reroutePending: boolean;
		verificationPending: boolean;
	}> = {},
) => ({
	state: "idle" as const,
	reroutePending: false,
	verificationPending: false,
	...overrides,
});

const details = (value = runtime()) => ({
	protocol: "developer/v8-result",
	workScopeId: "scope:evaluation",
	eventIds: ["event:evaluation"],
	runtime: value,
});

const toolResult = (value: unknown, errorResult = false) => ({
	type: "tool_execution_end",
	isError: errorResult,
	result: { details: value },
});

test("eval outcomes distinguish unchanged, pending, paused, and verified v8 paths", () => {
	assert.equal(
		classifyEvalOutcome({ changes: [], status: runtime() }),
		"settled-unchanged",
	);
	for (const status of [
		runtime({ state: "inactive" }),
		runtime({ state: "blocked" }),
		runtime({ state: "frame" }),
		runtime({ state: "authorized" }),
		runtime({ reroutePending: true }),
		runtime({ verificationPending: true }),
	]) {
		assert.equal(classifyEvalOutcome({ changes: [], status }), "pending");
		assert.equal(
			classifyEvalOutcome({
				changes: [{ path: "src/file.ts", kind: "modified" }],
				status,
			}),
			"changed-paused",
		);
	}
	assert.equal(
		classifyEvalOutcome({
			changes: [{ path: "src/file.ts", kind: "modified" }],
			status: runtime(),
		}),
		"changed-verified",
	);
});

test("Developer v8 result details parse to an immutable exact status", () => {
	const parsed = parseDeveloperRuntimeResultDetails(
		JSON.parse(JSON.stringify(details())),
	);
	assert.deepEqual(parsed, details());
	assert.equal(Object.isFrozen(parsed), true);
	assert.equal(Object.isFrozen(parsed?.eventIds), true);
	assert.equal(Object.isFrozen(parsed?.runtime), true);
	assert.equal(
		parseDeveloperRuntimeResultDetails({ protocol: "foreign" }),
		null,
	);
});

test("matching malformed Developer v8 details fail before outcome classification", () => {
	assert.throws(
		() =>
			parseDeveloperRuntimeResultDetails({
				...details(),
				extra: true,
			}),
		/unexpected fields/,
	);
	assert.throws(
		() =>
			parseDeveloperRuntimeResultDetails({
				...details(),
				runtime: { ...runtime(), state: "unknown" },
			}),
		/runtime state is invalid/,
	);
	assert.throws(
		() =>
			parseDeveloperRuntimeResultDetails({
				...details(),
				runtime: runtime({ state: "authorized", reroutePending: true }),
			}),
		/cannot carry landing debt/,
	);
	assert.throws(
		() =>
			parseDeveloperRuntimeResultDetails({
				...details(),
				eventIds: [""],
			}),
		/must be a non-empty string/,
	);
});

test("event status uses the latest valid v8 result and fails closed when absent", () => {
	const events = [
		toolResult({ protocol: "foreign" }),
		toolResult(details(runtime({ state: "frame" }))),
		toolResult(details(runtime({ verificationPending: true })), true),
		toolResult(details()),
	];
	assert.deepEqual(statusFromDeveloperEvents(events), runtime());
	assert.throws(
		() => statusFromDeveloperEvents([toolResult({ protocol: "foreign" })]),
		/no valid Developer v8 result details/,
	);
	assert.throws(
		() =>
			statusFromDeveloperEvents([
				toolResult({ ...details(), runtime: { ...runtime(), extra: true } }),
			]),
		/unexpected fields/,
	);
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
