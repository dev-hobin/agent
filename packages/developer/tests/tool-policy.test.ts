import assert from "node:assert/strict";
import test from "node:test";

import {
	TOOL_POLICY_LIFECYCLE_ENTRY,
	reconcileProtocolTools,
	reloadSafeToolPolicyMarker,
	toolPolicyReloadRequiresRestart,
	type ToolPolicyMemory,
} from "../extensions/tool-policy.ts";

const protocolTools = ["developer_route_question", "developer_record_judgment"];
const allTools = [
	{ name: "read", sourceInfo: { source: "builtin" } },
	{ name: "edit", sourceInfo: { source: "builtin" } },
	{ name: "write", sourceInfo: { source: "builtin" } },
	{ name: "bash", sourceInfo: { source: "builtin" } },
	{ name: "external_search", sourceInfo: { source: "/extensions/search.ts" } },
	{
		name: protocolTools[0],
		sourceInfo: { source: "/extensions/developer.ts" },
	},
	{
		name: protocolTools[1],
		sourceInfo: { source: "/extensions/developer.ts" },
	},
];

const emptyMemory = (): ToolPolicyMemory => ({ withheldBuiltins: new Set() });
const idleAccess = {
	allowsShell: false,
	allowsArtifactTools: false,
	hasBeforeImplementationGate: false,
};
const judgmentAccess = {
	allowsShell: true,
	allowsArtifactTools: false,
	hasBeforeImplementationGate: false,
};
const implementationAccess = {
	allowsShell: true,
	allowsArtifactTools: true,
	hasBeforeImplementationGate: false,
};

const protocol = "developer/v5";

const lifecycleEntry = {
	type: "custom",
	customType: TOOL_POLICY_LIFECYCLE_ENTRY,
	data: reloadSafeToolPolicyMarker(protocol),
};

test("reloads with Developer history require a restart until a safe lifecycle marker exists", () => {
	const legacyEntries = [
		{
			type: "custom",
			customType: "developer.mode",
			data: {
				protocol: "developer/v4",
				kind: "mode",
				mode: "strict",
			},
		},
	];
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: legacyEntries,
			protocol,
			protocolTools,
		}),
		true,
	);
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: [...legacyEntries, lifecycleEntry],
			protocol,
			protocolTools,
		}),
		false,
	);
});

test("a first reload without Developer history can establish the safe lifecycle", () => {
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: [{ type: "custom", customType: "other.extension", data: {} }],
			protocol,
			protocolTools,
		}),
		false,
	);
});

test("current-protocol history without a lifecycle marker is treated as an unsafe old runtime", () => {
	assert.equal(
		toolPolicyReloadRequiresRestart({
			entries: [
				lifecycleEntry,
				{
					type: "message",
					message: {
						role: "toolResult",
						toolName: protocolTools[0],
						details: { protocol, kind: "route" },
					},
				},
			],
			protocol,
			protocolTools,
		}),
		true,
	);
});

test("enabled idle withholds controlled built-ins and preserves unrelated tools", () => {
	const result = reconcileProtocolTools({
		activeTools: ["read", "edit", "bash", "external_search"],
		allTools,
		enabled: true,
		access: idleAccess,
		protocolTools,
		memory: emptyMemory(),
	});

	assert.deepEqual(
		new Set(result.activeTools),
		new Set(["read", "external_search", ...protocolTools]),
	);
	assert.deepEqual(result.memory.withheldBuiltins, new Set(["edit", "bash"]));
	assert.equal(
		result.activeTools.includes("grep"),
		false,
		"Developer must not force-enable disabled read tools",
	);
});

test("a judgment route restores shell execution without restoring artifact mutation", () => {
	const idle = reconcileProtocolTools({
		activeTools: ["read", "edit", "write", "bash", "external_search"],
		allTools,
		enabled: true,
		access: idleAccess,
		protocolTools,
		memory: emptyMemory(),
	});
	const judgment = reconcileProtocolTools({
		activeTools: idle.activeTools,
		allTools,
		enabled: true,
		access: judgmentAccess,
		protocolTools,
		memory: idle.memory,
	});

	assert.ok(judgment.activeTools.includes("bash"));
	assert.equal(judgment.activeTools.includes("edit"), false);
	assert.equal(judgment.activeTools.includes("write"), false);
});

test("an implementation route additively restores only tools withheld by Developer", () => {
	const enabled = reconcileProtocolTools({
		activeTools: ["read", "edit", "write", "external_search"],
		allTools,
		enabled: true,
		access: idleAccess,
		protocolTools,
		memory: emptyMemory(),
	});
	const implementation = reconcileProtocolTools({
		activeTools: [...enabled.activeTools, "another_extension_tool"],
		allTools: [
			...allTools,
			{
				name: "another_extension_tool",
				sourceInfo: { source: "/extensions/other.ts" },
			},
		],
		enabled: true,
		access: implementationAccess,
		protocolTools,
		memory: enabled.memory,
	});

	assert.ok(implementation.activeTools.includes("edit"));
	assert.ok(implementation.activeTools.includes("write"));
	assert.ok(implementation.activeTools.includes("another_extension_tool"));
	assert.equal(
		implementation.activeTools.includes("bash"),
		false,
		"inactive bash was not withheld and must stay inactive",
	);
});

test("a before-implementation gate preserves the judgment evidence lane and withholds mutation", () => {
	const gatedIdle = reconcileProtocolTools({
		activeTools: ["read", "edit", "write", "bash"],
		allTools,
		enabled: true,
		access: { ...idleAccess, hasBeforeImplementationGate: true },
		protocolTools,
		memory: emptyMemory(),
	});
	assert.deepEqual(
		new Set(gatedIdle.activeTools),
		new Set(["read", ...protocolTools]),
	);

	const gatedJudgment = reconcileProtocolTools({
		activeTools: gatedIdle.activeTools,
		allTools,
		enabled: true,
		access: { ...judgmentAccess, hasBeforeImplementationGate: true },
		protocolTools,
		memory: gatedIdle.memory,
	});
	assert.ok(gatedJudgment.activeTools.includes("bash"));
	assert.equal(gatedJudgment.activeTools.includes("edit"), false);
	assert.equal(gatedJudgment.activeTools.includes("write"), false);
});

test("an impossible implementation-plus-blocker snapshot fails closed", () => {
	const result = reconcileProtocolTools({
		activeTools: ["read", "edit", "write", "bash"],
		allTools,
		enabled: true,
		access: {
			allowsShell: true,
			allowsArtifactTools: true,
			hasBeforeImplementationGate: true,
		},
		protocolTools,
		memory: emptyMemory(),
	});

	assert.deepEqual(
		new Set(result.activeTools),
		new Set(["read", ...protocolTools]),
	);
	assert.deepEqual(
		result.memory.withheldBuiltins,
		new Set(["edit", "write", "bash"]),
	);
});

test("disabling Developer restores its tool delta without replacing later tool changes", () => {
	const enabled = reconcileProtocolTools({
		activeTools: ["read", "edit", "external_search"],
		allTools,
		enabled: true,
		access: idleAccess,
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
		access: idleAccess,
		protocolTools,
		memory: enabled.memory,
	});

	assert.ok(disabled.activeTools.includes("edit"));
	assert.ok(disabled.activeTools.includes("later_tool"));
	assert.ok(disabled.activeTools.includes("external_search"));
});

test("an extension override named edit is not classified as a Pi built-in", () => {
	const overridden = allTools.map((tool) =>
		tool.name === "edit"
			? { ...tool, sourceInfo: { source: "/extensions/custom-edit.ts" } }
			: tool,
	);
	const result = reconcileProtocolTools({
		activeTools: ["read", "edit"],
		allTools: overridden,
		enabled: true,
		access: idleAccess,
		protocolTools,
		memory: emptyMemory(),
	});

	assert.ok(result.activeTools.includes("edit"));
	assert.deepEqual(result.memory.withheldBuiltins, new Set());
});
