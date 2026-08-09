export type ControlledToolCapability = "shell" | "artifact";

export type DeveloperHostToolDisposition =
	| { readonly kind: "observation" }
	| {
			readonly kind: "controlled-action";
			readonly capability: ControlledToolCapability;
	  }
	| {
			readonly kind: "unsupported-action" | "unclassified";
			readonly reason: string;
	  };

export const TOOL_POLICY_LIFECYCLE_ENTRY = "developer.tool-policy-lifecycle";
export const TOOL_POLICY_LIFECYCLE = "released-before-reload/v1";

type PiAgentBuiltinCapability =
	| { readonly kind: "observation" }
	| {
			readonly kind: "controlled-action";
			readonly capability: ControlledToolCapability;
	  };

const PI_AGENT_BUILTIN_CAPABILITIES: ReadonlyMap<
	string,
	PiAgentBuiltinCapability
> = new Map([
	["read", { kind: "observation" }],
	["bash", { kind: "controlled-action", capability: "shell" }],
	["edit", { kind: "controlled-action", capability: "artifact" }],
	["write", { kind: "controlled-action", capability: "artifact" }],
]);

export interface ToolMetadataLike {
	name: string;
	sourceInfo: { source: string };
}

export interface ToolPolicyMemory {
	withheldBuiltins: Set<string>;
}

export interface ToolPolicyResult {
	activeTools: string[];
	memory: ToolPolicyMemory;
}

interface ToolPolicyBranchEntry {
	type?: string;
	customType?: string;
	data?: unknown;
	message?: {
		role?: string;
		toolName?: string;
		details?: unknown;
	};
}

interface ToolPolicyLifecycleMarker {
	protocol: string;
	kind: "tool-policy-lifecycle";
	lifecycle: typeof TOOL_POLICY_LIFECYCLE;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function reloadSafeToolPolicyMarker(
	protocol: string,
): ToolPolicyLifecycleMarker {
	return {
		protocol,
		kind: "tool-policy-lifecycle",
		lifecycle: TOOL_POLICY_LIFECYCLE,
	};
}

function isReloadSafeToolPolicyMarker(
	entry: ToolPolicyBranchEntry,
	protocol: string,
): boolean {
	if (
		entry.type !== "custom" ||
		entry.customType !== TOOL_POLICY_LIFECYCLE_ENTRY ||
		!isObject(entry.data)
	)
		return false;
	return (
		entry.data.protocol === protocol &&
		entry.data.kind === "tool-policy-lifecycle" &&
		entry.data.lifecycle === TOOL_POLICY_LIFECYCLE
	);
}

export function toolPolicyReloadRequiresRestart(input: {
	entries: readonly ToolPolicyBranchEntry[];
	protocol: string;
	protocolTools: readonly string[];
}): boolean {
	const protocolTools = new Set(input.protocolTools);
	for (let index = input.entries.length - 1; index >= 0; index -= 1) {
		const entry = input.entries[index];
		if (!entry) continue;
		if (isReloadSafeToolPolicyMarker(entry, input.protocol)) return false;

		let value: unknown;
		if (
			entry.type === "custom" &&
			entry.customType?.startsWith("developer.") &&
			entry.customType !== TOOL_POLICY_LIFECYCLE_ENTRY
		) {
			value = entry.data;
		} else if (
			entry.type === "message" &&
			entry.message?.role === "toolResult" &&
			entry.message.toolName &&
			protocolTools.has(entry.message.toolName)
		) {
			value = entry.message.details;
		}
		if (
			isObject(value) &&
			typeof value.protocol === "string" &&
			(value.protocol === "developer.mode/v1" ||
				value.protocol.startsWith("developer-action-loop/"))
		)
			return true;
	}
	return false;
}

export function classifyDeveloperHostToolInvocation(input: {
	readonly toolName: string;
	readonly toolInput: unknown;
	readonly allTools: ToolMetadataLike[];
}): DeveloperHostToolDisposition {
	const tool = input.allTools.find((candidate) => candidate.name === input.toolName);
	if (tool?.sourceInfo.source !== "builtin") {
		return {
			kind: "unclassified",
			reason: `Extension tool ${input.toolName} has no trusted Developer host capability declaration.`,
		};
	}
	const capability = PI_AGENT_BUILTIN_CAPABILITIES.get(input.toolName);
	if (capability) return capability;
	return {
		kind: "unclassified",
		reason: `Pi built-in tool ${input.toolName} has no Developer observation or Action classification.`,
	};
}

export function builtinControlledToolCapabilities(
	tools: ToolMetadataLike[],
): Map<string, ControlledToolCapability> {
	const result = new Map<string, ControlledToolCapability>();
	for (const tool of tools) {
		if (tool.sourceInfo.source !== "builtin") continue;
		const capability = PI_AGENT_BUILTIN_CAPABILITIES.get(tool.name);
		if (capability?.kind === "controlled-action") {
			result.set(tool.name, capability.capability);
		}
	}
	return result;
}

export function reconcileProtocolTools(input: {
	activeTools: string[];
	allTools: ToolMetadataLike[];
	enabled: boolean;
	protocolTools: readonly string[];
	memory: ToolPolicyMemory;
}): ToolPolicyResult {
	const active = new Set(input.activeTools);
	const controlledBuiltins = builtinControlledToolCapabilities(input.allTools);
	const withheld = new Set(
		[...input.memory.withheldBuiltins].filter((name) =>
			controlledBuiltins.has(name),
		),
	);

	if (!input.enabled) {
		for (const name of withheld) active.add(name);
		withheld.clear();
		for (const tool of input.protocolTools) active.delete(tool);
	} else {
		for (const tool of input.protocolTools) active.add(tool);
		for (const name of controlledBuiltins.keys()) {
			if (active.delete(name)) withheld.add(name);
		}
	}

	return {
		activeTools: [...active],
		memory: { withheldBuiltins: withheld },
	};
}
