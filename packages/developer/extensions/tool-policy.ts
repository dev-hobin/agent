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

const CONTROLLED_BUILTIN_CAPABILITIES = new Map<
	string,
	ControlledToolCapability
>([
	["bash", "shell"],
	["edit", "artifact"],
	["write", "artifact"],
]);

const OBSERVATIONAL_TOOL_NAMES: ReadonlySet<string> = new Set([
	"ast_grep_dump",
	"ast_grep_outline",
	"ast_grep_search",
	"fetch_content",
	"find",
	"get_search_content",
	"grep",
	"lens_diagnostics",
	"ls",
	"lsp_diagnostics",
	"module_report",
	"pi_lens_activate_tools",
	"project_report",
	"read",
	"read_enclosing",
	"read_symbol",
	"source_check",
	"symbol_search",
	"web_search",
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

function astGrepReplaceDisposition(
	input: Readonly<Record<string, unknown>>,
): DeveloperHostToolDisposition {
	if (input.apply !== true) return { kind: "observation" };
	return {
		kind: "unsupported-action",
		reason:
			"Applying an AST replacement is a workspace mutation without a Developer Action adapter.",
	};
}

function lspNavigationDisposition(
	input: Readonly<Record<string, unknown>>,
): DeveloperHostToolDisposition {
	if (input.operation !== "rename" && input.action !== "rename") {
		return { kind: "observation" };
	}
	return {
		kind: "unsupported-action",
		reason:
			"LSP rename is a workspace mutation without a Developer Action adapter.",
	};
}

function mcpDisposition(
	input: Readonly<Record<string, unknown>>,
): DeveloperHostToolDisposition {
	const action = input.action;
	const observationalAction = action === undefined || action === "ui-messages";
	if (
		!Object.hasOwn(input, "tool") &&
		!Object.hasOwn(input, "connect") &&
		observationalAction
	) {
		return { kind: "observation" };
	}
	return {
		kind: "unsupported-action",
		reason:
			"Calling or connecting an MCP service may change external state and has no Developer Action adapter.",
	};
}

const MIXED_TOOL_CLASSIFIERS: ReadonlyMap<
	string,
	(input: Readonly<Record<string, unknown>>) => DeveloperHostToolDisposition
> = new Map([
	["ast_grep_replace", astGrepReplaceDisposition],
	["lsp_navigation", lspNavigationDisposition],
	["mcp", mcpDisposition],
	[
		"mcpScript",
		() => ({
			kind: "unsupported-action",
			reason:
				"An MCP script can compose stateful external calls and has no Developer Action adapter.",
		}),
	],
]);

export function classifyDeveloperHostToolInvocation(input: {
	readonly toolName: string;
	readonly toolInput: unknown;
	readonly allTools: ToolMetadataLike[];
}): DeveloperHostToolDisposition {
	const controlled = builtinControlledToolCapabilities(input.allTools).get(
		input.toolName,
	);
	if (controlled) return { kind: "controlled-action", capability: controlled };
	if (OBSERVATIONAL_TOOL_NAMES.has(input.toolName)) {
		return { kind: "observation" };
	}
	const mixedClassifier = MIXED_TOOL_CLASSIFIERS.get(input.toolName);
	if (mixedClassifier) {
		return mixedClassifier(isObject(input.toolInput) ? input.toolInput : {});
	}
	return {
		kind: "unclassified",
		reason: `Tool ${input.toolName} has no Developer observation or Action classification.`,
	};
}

export function builtinControlledToolCapabilities(
	tools: ToolMetadataLike[],
): Map<string, ControlledToolCapability> {
	const result = new Map<string, ControlledToolCapability>();
	for (const tool of tools) {
		if (tool.sourceInfo.source !== "builtin") continue;
		const capability = CONTROLLED_BUILTIN_CAPABILITIES.get(tool.name);
		if (capability) result.set(tool.name, capability);
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
