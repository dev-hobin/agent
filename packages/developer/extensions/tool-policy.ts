import type { DeveloperMode } from "./state.ts";

const MUTATION_TOOL_NAMES = new Set(["edit", "write", "bash"]);

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

export function builtinMutationToolNames(tools: ToolMetadataLike[]): Set<string> {
  return new Set(
    tools
      .filter((tool) => tool.sourceInfo.source === "builtin" && MUTATION_TOOL_NAMES.has(tool.name))
      .map((tool) => tool.name),
  );
}

export function reconcileProtocolTools(input: {
  activeTools: string[];
  allTools: ToolMetadataLike[];
  mode: DeveloperMode;
  directRouteOpen: boolean;
  protocolTools: readonly string[];
  memory: ToolPolicyMemory;
}): ToolPolicyResult {
  const active = new Set(input.activeTools);
  const mutationBuiltins = builtinMutationToolNames(input.allTools);
  const withheld = new Set(
    [...input.memory.withheldBuiltins].filter((name) => mutationBuiltins.has(name)),
  );

  if (input.mode === "strict") {
    for (const tool of input.protocolTools) active.add(tool);

    if (input.directRouteOpen) {
      for (const tool of withheld) active.add(tool);
    } else {
      for (const tool of mutationBuiltins) {
        if (active.delete(tool)) withheld.add(tool);
      }
    }
  } else {
    for (const tool of withheld) active.add(tool);
    withheld.clear();

    for (const tool of input.protocolTools) {
      if (input.mode === "on") active.add(tool);
      else active.delete(tool);
    }
  }

  return {
    activeTools: [...active],
    memory: { withheldBuiltins: withheld },
  };
}
