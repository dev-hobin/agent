import assert from "node:assert/strict";
import test from "node:test";

import { reconcileProtocolTools, type ToolPolicyMemory } from "../extensions/tool-policy.ts";

const protocolTools = ["developer_route_question", "developer_record_judgment"];
const allTools = [
  { name: "read", sourceInfo: { source: "builtin" } },
  { name: "edit", sourceInfo: { source: "builtin" } },
  { name: "write", sourceInfo: { source: "builtin" } },
  { name: "bash", sourceInfo: { source: "builtin" } },
  { name: "external_search", sourceInfo: { source: "/extensions/search.ts" } },
  { name: protocolTools[0], sourceInfo: { source: "/extensions/developer.ts" } },
  { name: protocolTools[1], sourceInfo: { source: "/extensions/developer.ts" } },
];

const emptyMemory = (): ToolPolicyMemory => ({ withheldBuiltins: new Set() });

test("strict mode removes only active built-in mutation tools and preserves other tools", () => {
  const result = reconcileProtocolTools({
    activeTools: ["read", "edit", "external_search"],
    allTools,
    mode: "strict",
    directRouteOpen: false,
    protocolTools,
    memory: emptyMemory(),
  });

  assert.deepEqual(new Set(result.activeTools), new Set(["read", "external_search", ...protocolTools]));
  assert.deepEqual(result.memory.withheldBuiltins, new Set(["edit"]));
  assert.equal(result.activeTools.includes("grep"), false, "strict must not force-enable disabled read tools");
});

test("a direct route additively restores only tools withheld by Developer", () => {
  const strict = reconcileProtocolTools({
    activeTools: ["read", "edit", "write", "external_search"],
    allTools,
    mode: "strict",
    directRouteOpen: false,
    protocolTools,
    memory: emptyMemory(),
  });
  const direct = reconcileProtocolTools({
    activeTools: [...strict.activeTools, "another_extension_tool"],
    allTools: [...allTools, { name: "another_extension_tool", sourceInfo: { source: "/extensions/other.ts" } }],
    mode: "strict",
    directRouteOpen: true,
    protocolTools,
    memory: strict.memory,
  });

  assert.ok(direct.activeTools.includes("edit"));
  assert.ok(direct.activeTools.includes("write"));
  assert.ok(direct.activeTools.includes("another_extension_tool"));
  assert.equal(direct.activeTools.includes("bash"), false, "inactive bash was not withheld and must stay inactive");
});

test("leaving strict restores the Developer delta without replacing later tool changes", () => {
  const strict = reconcileProtocolTools({
    activeTools: ["read", "edit", "external_search"],
    allTools,
    mode: "strict",
    directRouteOpen: false,
    protocolTools,
    memory: emptyMemory(),
  });
  const on = reconcileProtocolTools({
    activeTools: [...strict.activeTools, "later_tool"],
    allTools: [...allTools, { name: "later_tool", sourceInfo: { source: "/extensions/later.ts" } }],
    mode: "on",
    directRouteOpen: false,
    protocolTools,
    memory: strict.memory,
  });

  assert.ok(on.activeTools.includes("edit"));
  assert.ok(on.activeTools.includes("later_tool"));
  assert.ok(on.activeTools.includes("external_search"));
});

test("an extension override named edit is not classified as a Pi built-in", () => {
  const overridden = allTools.map((tool) =>
    tool.name === "edit" ? { ...tool, sourceInfo: { source: "/extensions/custom-edit.ts" } } : tool,
  );
  const result = reconcileProtocolTools({
    activeTools: ["read", "edit"],
    allTools: overridden,
    mode: "strict",
    directRouteOpen: false,
    protocolTools,
    memory: emptyMemory(),
  });

  assert.ok(result.activeTools.includes("edit"));
  assert.deepEqual(result.memory.withheldBuiltins, new Set());
});
