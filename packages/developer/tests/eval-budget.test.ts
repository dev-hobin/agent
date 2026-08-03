import assertModule from "node:assert";
import test from "node:test";

import {
	containsProtocolProgress,
	createFixtureBudgetMonitor,
	fixtureBudgetFailure,
} from "../scripts/eval-budget.mjs";

const assert: typeof assertModule.strict = assertModule.strict;
const fixture = {
	id: "bounded",
	maxDecisions: 2,
	maxToolCalls: 4,
	maxToolErrors: 1,
};
const budget = (trace: unknown[], elapsedMs = 10, noProgressMs = 10) =>
	fixtureBudgetFailure({
		trace,
		fixture,
		elapsedMs,
		noProgressMs,
		fixtureTimeoutMs: 100,
		noProgressTimeoutMs: 50,
	});

test("eval progress ignores token streaming and recognizes protocol movement", () => {
	assert.equal(containsProtocolProgress([{ type: "message_update" }]), false);
	assert.equal(
		containsProtocolProgress([{ type: "tool_execution_start" }]),
		true,
	);
	assert.equal(containsProtocolProgress([{ type: "agent_settled" }]), true);
});

test("eval budgets stop decision, tool, error, wall-clock, and no-progress loops", () => {
	const decisions = Array.from({ length: 3 }, (_, index) => ({
		type: "tool_execution_start",
		toolName: "developer_open_judgment",
		toolCallId: `decision:${index}`,
	}));
	assert.equal(budget(decisions), "decision budget 3/2");

	const calls = Array.from({ length: 5 }, (_, index) => ({
		type: "tool_execution_start",
		toolName: "read",
		toolCallId: `read:${index}`,
	}));
	assert.equal(budget(calls), "tool-call budget 5/4");

	const failures = Array.from({ length: 2 }, () => ({
		type: "tool_execution_end",
		isError: true,
	}));
	assert.equal(budget(failures), "tool-error budget 2/1");
	assert.equal(budget([], 101, 10), "wall-clock budget 101/100ms");
	assert.equal(budget([], 10, 51), "no-progress budget 51/50ms");
	assert.equal(budget([]), undefined);
});

test("Developer calls and duplicate reads have independent release budgets", () => {
	const developerCalls = Array.from({ length: 3 }, (_, callIndex) => ({
		type: "tool_execution_start",
		toolName: "developer_conclude_judgment",
		toolCallId: `developer:${callIndex}`,
	}));
	assert.equal(
		fixtureBudgetFailure({
			trace: developerCalls,
			fixture: {
				id: "developer-budget",
				maxDecisions: 20,
				maxToolCalls: 20,
				maxDeveloperCalls: 2,
			},
			elapsedMs: 10,
			noProgressMs: 10,
			fixtureTimeoutMs: 100,
			noProgressTimeoutMs: 50,
		}),
		"Developer-call budget 3/2",
	);
	assert.equal(
		budget([
			{
				type: "tool_execution_start",
				toolName: "read",
				toolCallId: "read:first",
				args: { path: "src/current.ts", offset: 1 },
			},
			{
				type: "tool_execution_start",
				toolName: "read",
				toolCallId: "read:second",
				args: { path: "src/current.ts", offset: 20 },
			},
		]),
		"duplicate file read src/current.ts",
	);
	assert.equal(
		budget([
			{
				type: "tool_execution_start",
				toolName: "read",
				toolCallId: "developer:self-read",
				args: {
					path: "/repo/node_modules/@hobin/developer/extensions/developer-v8.ts",
				},
			},
		]),
		"forbidden Developer implementation self-inspection",
	);
});

test("eval budgets reject the inefficient calls observed in the real v8 session", () => {
	for (const toolName of [
		"mcp",
		"web_search",
		"fetch_content",
		"source_check",
	]) {
		assert.equal(
			budget([
				{
					type: "tool_execution_start",
					toolName,
					toolCallId: `forbidden:${toolName}`,
					args: {},
				},
			]),
			`forbidden local-workflow tool ${toolName}`,
		);
	}
	assert.match(
		budget([
			{
				type: "tool_execution_start",
				toolName: "read",
				toolCallId: "session-read",
				args: { path: "/home/user/.pi/agent/sessions/run.jsonl" },
			},
		]) ?? "",
		/session\/network escape/u,
	);
	assert.equal(
		budget([
			{
				type: "tool_execution_start",
				toolName: "developer_open_judgment",
				toolCallId: "placeholder",
				args: {
					question: "Conclude current frame?",
					obligations: [{ statement: "x" }],
				},
			},
		]),
		"placeholder Developer frame",
	);
	const repeatedFailure = [
		{
			type: "tool_execution_start",
			toolName: "read",
			toolCallId: "failed:1",
			args: { path: "missing.ts" },
		},
		{
			type: "tool_execution_end",
			toolName: "read",
			toolCallId: "failed:1",
			isError: true,
		},
		{
			type: "tool_execution_start",
			toolName: "read",
			toolCallId: "failed:2",
			args: { path: "missing.ts" },
		},
		{
			type: "tool_execution_end",
			toolName: "read",
			toolCallId: "failed:2",
			isError: true,
		},
	];
	assert.equal(budget(repeatedFailure), "repeated failed call read");
});

test("the shared budget monitor ignores token streaming and resets only on protocol progress", () => {
	let current = 0;
	const monitor = createFixtureBudgetMonitor({
		fixture,
		fixtureTimeoutMs: 1_000,
		noProgressTimeoutMs: 50,
		now: () => current,
	});

	current = 40;
	monitor.observe([{ type: "message_update" }]);
	current = 51;
	assert.equal(monitor.failure([]), "no-progress budget 51/50ms");

	current = 60;
	const progressing = createFixtureBudgetMonitor({
		fixture,
		fixtureTimeoutMs: 1_000,
		noProgressTimeoutMs: 50,
		now: () => current,
	});
	current = 100;
	progressing.observe([{ type: "tool_execution_start" }]);
	current = 145;
	assert.equal(progressing.failure([]), undefined);
});
