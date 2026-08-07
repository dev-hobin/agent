import assert from "node:assert/strict";
import test from "node:test";
import { Type } from "typebox";

import {
	createPiSdkDecisionRunner,
	type PiSdkControllerBindings,
	type PiSdkModel,
	type PiSdkModelRuntime,
} from "../src/action-loop/sdk/decision-controller.ts";

interface FakeDecisionHost {
	readonly bindings: PiSdkControllerBindings;
	readonly prompts: string[];
	readonly executionModes: unknown[];
}

function fakeDecisionHost(
	proposalForPrompt: (prompt: string) => Readonly<Record<string, unknown>>,
): FakeDecisionHost {
	const prompts: string[] = [];
	const executionModes: unknown[] = [];
	const bindings = {
		defineTool(definition: Record<string, unknown>) {
			executionModes.push(definition.executionMode);
			return definition;
		},
		async createAgentSession(options: {
			readonly customTools: readonly {
				readonly name: string;
				readonly execute: (
					toolCallId: string,
					raw: unknown,
				) => Promise<unknown>;
			}[];
		}) {
			const listeners: Array<(event: Record<string, unknown>) => void> = [];
			const tool = options.customTools[0];
			if (tool === undefined) throw new Error("missing proposal tool");
			return {
				session: {
					subscribe(listener: (event: Record<string, unknown>) => void) {
						listeners.push(listener);
						return () => {};
					},
					async prompt(prompt: string) {
						prompts.push(prompt);
						for (const listener of listeners) {
							listener({ type: "agent_start" });
							listener({
								type: "tool_execution_start",
								toolName: tool.name,
							});
						}
						let isError = false;
						let text = "accepted";
						try {
							await tool.execute("tool-call", proposalForPrompt(prompt));
						} catch (error) {
							isError = true;
							text = error instanceof Error ? error.message : String(error);
						}
						for (const listener of listeners) {
							listener({
								type: "tool_execution_end",
								toolName: tool.name,
								isError,
								result: { content: [{ type: "text", text }] },
							});
							listener({ type: "agent_end" });
						}
					},
					async abort() {},
					dispose() {},
				},
			};
		},
		createExtensionRuntime() {
			return {};
		},
		SessionManager: { inMemory: () => ({}) },
		SettingsManager: { inMemory: () => ({}) },
	} as unknown as PiSdkControllerBindings;
	return { bindings, prompts, executionModes };
}

function runner(host: FakeDecisionHost) {
	return createPiSdkDecisionRunner({
		bindings: host.bindings,
		modelRuntime: {} as PiSdkModelRuntime,
		model: {} as PiSdkModel,
		cwd: process.cwd(),
		maxRuns: 2,
		maxToolErrorsPerRun: 2,
		maxRunMs: 5_000,
	});
}

const request = {
	systemPrompt: "Submit one proposal.",
	prompt: "Call the proposal tool.",
	tool: {
		name: "submit_test_proposal",
		label: "Submit test proposal",
		description: "Submit one deterministic test proposal.",
		parameters: Type.Object({ accepted: Type.Boolean() }),
		execute: async (raw: unknown) => {
			if (
				typeof raw !== "object" ||
				raw === null ||
				!("accepted" in raw) ||
				raw.accepted !== true
			) {
				return {
					status: "rejected" as const,
					code: "proposal-not-accepted",
					message: "accepted must be true",
				};
			}
			return {
				status: "accepted" as const,
				value: "accepted",
				message: "proposal accepted",
				resultStatus: "accepted",
			};
		},
	},
};

test("Pi SDK decision accepts a valid first proposal without a forced retry", async () => {
	const host = fakeDecisionHost(() => ({ accepted: true }));
	const result = await runner(host).run(request);

	assert.equal(result.status, "accepted");
	if (result.status !== "accepted") return;
	assert.equal(result.metrics.runs, 1);
	assert.equal(result.metrics.toolCalls, 1);
	assert.equal(result.metrics.toolErrors, 0);
	assert.equal(host.prompts.length, 1);
	assert.doesNotMatch(host.prompts[0] ?? "", /Previous proposal rejection/);
	assert.deepEqual(host.executionModes, ["sequential"]);
});

test("Pi SDK bounded retry carries canonical rejection feedback", async () => {
	const host = fakeDecisionHost((prompt) => ({
		accepted: prompt.includes("proposal-not-accepted"),
	}));
	const result = await runner(host).run(request);

	assert.equal(result.status, "accepted");
	if (result.status !== "accepted") return;
	assert.equal(result.value, "accepted");
	assert.equal(result.metrics.runs, 2);
	assert.equal(result.metrics.toolCalls, 2);
	assert.equal(result.metrics.toolErrors, 1);
	assert.match(
		result.metrics.errorMessages[0] ?? "",
		/proposal-not-accepted: accepted must be true/,
	);
	assert.equal(host.prompts.length, 2);
	assert.doesNotMatch(host.prompts[0] ?? "", /Previous proposal rejection/);
	assert.match(
		host.prompts[1] ?? "",
		/Previous proposal rejection.*proposal-not-accepted/s,
	);
});
