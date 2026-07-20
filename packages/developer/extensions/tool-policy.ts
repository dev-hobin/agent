import type { DeveloperMode } from "./state.ts";

export type ControlledToolCapability = "execute" | "mutate";

const CONTROLLED_BUILTIN_CAPABILITIES = new Map<string, ControlledToolCapability>([
  ["bash", "execute"],
  ["edit", "mutate"],
  ["write", "mutate"],
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
  canExecute: boolean;
  canMutate: boolean;
  hasBeforeDirectGate: boolean;
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
  mode: DeveloperMode;
  capability: ControlledToolCapability;
  access: ProtocolToolAccess;
}): boolean {
  if (input.mode === "off") return true;

  if (input.access.hasBeforeDirectGate) {
    if (input.capability === "mutate") return false;
    return input.access.canExecute && !input.access.canMutate;
  }

  if (input.mode === "on") return true;
  if (input.capability === "execute") return input.access.canExecute;
  return input.access.canMutate;
}

export function reconcileProtocolTools(input: {
  activeTools: string[];
  allTools: ToolMetadataLike[];
  mode: DeveloperMode;
  access: ProtocolToolAccess;
  protocolTools: readonly string[];
  memory: ToolPolicyMemory;
}): ToolPolicyResult {
  const active = new Set(input.activeTools);
  const controlledBuiltins = builtinControlledToolCapabilities(input.allTools);
  const withheld = new Set(
    [...input.memory.withheldBuiltins].filter((name) => controlledBuiltins.has(name)),
  );

  if (input.mode === "off") {
    for (const name of withheld) active.add(name);
    withheld.clear();
    for (const tool of input.protocolTools) active.delete(tool);
  } else {
    for (const tool of input.protocolTools) active.add(tool);
    for (const [name, capability] of controlledBuiltins) {
      const allowed = isControlledToolAllowed({ mode: input.mode, capability, access: input.access });
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
