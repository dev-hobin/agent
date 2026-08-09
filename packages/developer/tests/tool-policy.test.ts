import assert from "node:assert/strict";
import test from "node:test";

import { MODEL_FACING_ACTION_LOOP_TOOLS } from "../extensions/action-loop-model-tools.ts";
import {
	TOOL_POLICY_LIFECYCLE_ENTRY,
	builtinControlledToolCapabilities,
	classifyDeveloperHostToolInvocation,
	reconcileProtocolTools,
	reloadSafeToolPolicyMarker,
	toolPolicyReloadRequiresRestart,
	type ToolPolicyMemory,
} from "../extensions/tool-policy.ts";

const protocolTools = [...MODEL_FACING_ACTION_LOOP_TOOLS];
const allTools = [
	{ name: "read", sourceInfo: { source: "builtin" } },
	{ name: "edit", sourceInfo: { source: "builtin" } },
	{ name: "write", sourceInfo: { source: "builtin" } },
	{ name: "bash", sourceInfo: { source: "builtin" } },
	{ name: "external_search", sourceInfo: { source: "/extensions/search.ts" } },
	...protocolTools.map((name) => ({
		name,
		sourceInfo: { source: "/extensions/developer.ts" },
	})),
];
const emptyMemory = (): ToolPolicyMemory => ({ withheldBuiltins: new Set() });
const protocol = "developer-action-loop/tool-policy/v1";
const lifecycleEntry = {
	type: "custom",
	customType: TOOL_POLICY_LIFECYCLE_ENTRY,
	data: reloadSafeToolPolicyMarker(protocol),
};

test("reloads with Developer history require a safe lifecycle marker", () => {
	const oldHistory = [
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: protocolTools[0],
				details: { protocol, kind: "opened" },
			},
		},
	];
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: oldHistory,
			protocol,
			protocolTools,
		}),
		true,
	);
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: [...oldHistory, lifecycleEntry],
			protocol,
			protocolTools,
		}),
		false,
	);
});

test("a first reload without Developer history can establish lifecycle safety", () => {
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: [{ type: "custom", customType: "other.extension", data: {} }],
			protocol,
			protocolTools,
		}),
		false,
	);
});

test("history after the last lifecycle marker requires restart", () => {
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: [
				lifecycleEntry,
				{
					type: "message",
					message: {
						role: "toolResult",
						toolName: protocolTools[0],
						details: { protocol, kind: "opened" },
					},
				},
			],
			protocol,
			protocolTools,
		}),
		true,
	);
});

test("enabled Developer withholds every controlled built-in and preserves unrelated tools", () => {
	const result = reconcileProtocolTools({
		activeTools: ["read", "edit", "write", "bash", "external_search"],
		allTools,
		enabled: true,
		protocolTools,
		memory: emptyMemory(),
	});
	assert.deepEqual(
		new Set(result.activeTools),
		new Set(["read", "external_search", ...protocolTools]),
	);
	assert.deepEqual(
		result.memory.withheldBuiltins,
		new Set(["edit", "write", "bash"]),
	);
	assert.equal(result.activeTools.includes("grep"), false);
});

test("disabling Developer restores only its withheld built-in delta", () => {
	const enabled = reconcileProtocolTools({
		activeTools: ["read", "edit", "external_search"],
		allTools,
		enabled: true,
		protocolTools,
		memory: emptyMemory(),
	});
	const disabled = reconcileProtocolTools({
		activeTools: [...enabled.activeTools, "later_tool"],
		allTools: [
			...allTools,
			{ name: "later_tool", sourceInfo: { source: "/extensions/later.ts" } },
		],
		enabled: false,
		protocolTools,
		memory: enabled.memory,
	});
	assert.ok(disabled.activeTools.includes("edit"));
	assert.ok(disabled.activeTools.includes("later_tool"));
	assert.ok(disabled.activeTools.includes("external_search"));
	for (const tool of protocolTools)
		assert.equal(disabled.activeTools.includes(tool), false);
});

test("an extension override named edit is not classified as a Pi built-in", () => {
	assert.equal(
		builtinControlledToolCapabilities([
			{ name: "edit", sourceInfo: { source: "/extensions/override.ts" } },
		]).has("edit"),
		false,
	);
});

test("only stable Pi built-ins have default Developer host capabilities", () => {
	const classify = (toolName: string, toolInput: unknown) =>
		classifyDeveloperHostToolInvocation({ toolName, toolInput, allTools });
	assert.deepEqual(classify("read", { path: "src/index.ts" }), {
		kind: "observation",
	});
	assert.deepEqual(classify("edit", { path: "src/index.ts" }), {
		kind: "controlled-action",
		capability: "artifact",
	});
	for (const [toolName, toolInput] of [
		["ast_grep_replace", { apply: false }],
		["ast_grep_replace", { apply: true }],
		["mcp", { search: "read tools" }],
		["mcp", { tool: "external_write", args: {} }],
		["mcpScript", { code: "emit('x')" }],
		["external_search", {}],
	] as const) {
		assert.equal(classify(toolName, toolInput).kind, "unclassified");
	}
});
