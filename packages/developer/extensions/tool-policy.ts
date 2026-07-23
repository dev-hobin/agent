export type ControlledToolCapability = "shell" | "artifact";

const CONTROLLED_BUILTIN_CAPABILITIES = new Map<
	string,
	ControlledToolCapability
>([
	["bash", "shell"],
	["edit", "artifact"],
	["write", "artifact"],
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

export interface ProtocolToolAccess {
	allowsShell: boolean;
	allowsArtifactTools: boolean;
	hasBeforeImplementationGate: boolean;
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

export function isControlledToolAllowed(input: {
	enabled: boolean;
	capability: ControlledToolCapability;
	access: ProtocolToolAccess;
}): boolean {
	if (!input.enabled) return true;

	if (input.access.hasBeforeImplementationGate) {
		if (input.capability === "artifact") return false;
		return input.access.allowsShell && !input.access.allowsArtifactTools;
	}

	if (input.capability === "shell") return input.access.allowsShell;
	return input.access.allowsArtifactTools;
}

export function reconcileProtocolTools(input: {
	activeTools: string[];
	allTools: ToolMetadataLike[];
	enabled: boolean;
	access: ProtocolToolAccess;
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
		for (const [name, capability] of controlledBuiltins) {
			const allowed = isControlledToolAllowed({
				enabled: input.enabled,
				capability,
				access: input.access,
			});
			if (allowed) {
				if (withheld.delete(name)) active.add(name);
			} else if (active.delete(name)) {
				withheld.add(name);
			}
		}
	}

	return {
		activeTools: [...active],
		memory: { withheldBuiltins: withheld },
	};
}
