import assert from "node:assert/strict";
import test from "node:test";

import {
	assertObservedEvidenceBeforeMutation,
	validateExecutionTrace,
} from "../scripts/eval-assertions.mjs";

function execution(
	index: number,
	toolName: string,
	args: Record<string, unknown> = {},
	details: Record<string, unknown> = {},
) {
	const toolCallId = `call-${index}`;
	return [
		{ type: "tool_execution_start", toolCallId, toolName, args },
		{
			type: "tool_execution_end",
			toolCallId,
			toolName,
			isError: false,
			result: { content: [], details },
		},
	];
}

const fixture = {
	id: "canonical",
	admissibleFirstTargets: ["signal"],
	preferredFirstTargets: ["signal"],
	mustRecordJudgment: true,
	mutationRequiresActionClearance: true,
	maxRoutes: 2,
};

function canonicalTrace() {
	return [
		...execution(1, "developer_open_work_case"),
		...execution(2, "developer_open_judgment"),
		...execution(3, "developer_assess_capability", {
			capability: "signal",
			status: "applicable",
		}),
		...execution(4, "developer_propose_action", {
			tool_name: "bash",
			tool_input: { command: "test -f src/contracts.ts" },
		}),
		...execution(5, "bash", { command: "test -f src/contracts.ts" }),
		...execution(6, "developer_settle_effect"),
		...execution(7, "developer_accept_observation_contribution"),
		...execution(8, "developer_propose_action", {
			tool_name: "write",
			tool_input: {
				path: "src/marker.ts",
				content: "export const marker = true",
			},
		}),
		...execution(9, "write", {
			path: "src/marker.ts",
			content: "export const marker = true",
		}),
		...execution(10, "developer_settle_effect"),
	];
}

test("canonical trace admits Capability routing and exact cleared Actions", async () => {
	const result = await validateExecutionTrace(
		fixture,
		canonicalTrace(),
		"/tmp/package",
	);
	assert.equal(result.firstTarget, "signal");
	assert.equal(result.routeCount, 1);
	assert.equal(result.preferredFirstTarget, true);
});

test("removed compatibility tools and unsettled Effects fail trace validation", async () => {
	await assert.rejects(
		validateExecutionTrace(
			fixture,
			[...canonicalTrace(), ...execution(11, "developer_route_question")],
			"/tmp/package",
		),
		/removed compatibility tool/,
	);
	const unsettled = canonicalTrace().filter(
		(event) => event.toolCallId !== "call-10",
	);
	await assert.rejects(
		validateExecutionTrace(fixture, unsettled, "/tmp/package"),
		/Effect was not settled/,
	);
});

test("agent evidence sequence requires host Contribution before mutation", () => {
	const executions = [
		{ start: { toolName: "bash" } },
		{ start: { toolName: "developer_accept_observation_contribution" } },
		{
			start: {
				toolName: "developer_propose_action",
				args: { tool_name: "write" },
			},
		},
	];
	assert.doesNotThrow(() =>
		assertObservedEvidenceBeforeMutation({ id: "agent-evidence" }, executions),
	);
	assert.throws(
		() =>
			assertObservedEvidenceBeforeMutation({ id: "agent-evidence" }, [
				executions[0],
				executions[2],
			]),
		/host Contribution/,
	);
});
