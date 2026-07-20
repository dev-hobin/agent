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
const idleAccess = { canExecute: false, canMutate: false, hasBeforeDirectGate: false };
const judgmentAccess = { canExecute: true, canMutate: false, hasBeforeDirectGate: false };
const directAccess = { canExecute: true, canMutate: true, hasBeforeDirectGate: false };

test("strict idle withholds controlled built-ins and preserves unrelated tools", () => {
  const result = reconcileProtocolTools({
    activeTools: ["read", "edit", "bash", "external_search"],
    allTools,
    mode: "strict",
    access: idleAccess,
    protocolTools,
    memory: emptyMemory(),
  });

  assert.deepEqual(new Set(result.activeTools), new Set(["read", "external_search", ...protocolTools]));
  assert.deepEqual(result.memory.withheldBuiltins, new Set(["edit", "bash"]));
  assert.equal(result.activeTools.includes("grep"), false, "strict must not force-enable disabled read tools");
});

test("a judgment route restores shell execution without restoring artifact mutation", () => {
  const idle = reconcileProtocolTools({
    activeTools: ["read", "edit", "write", "bash", "external_search"],
    allTools,
    mode: "strict",
    access: idleAccess,
    protocolTools,
    memory: emptyMemory(),
  });
  const judgment = reconcileProtocolTools({
    activeTools: idle.activeTools,
    allTools,
    mode: "strict",
    access: judgmentAccess,
    protocolTools,
    memory: idle.memory,
  });

  assert.ok(judgment.activeTools.includes("bash"));
  assert.equal(judgment.activeTools.includes("edit"), false);
  assert.equal(judgment.activeTools.includes("write"), false);
});

test("a direct route additively restores only tools withheld by Developer", () => {
  const strict = reconcileProtocolTools({
    activeTools: ["read", "edit", "write", "external_search"],
    allTools,
    mode: "strict",
    access: idleAccess,
    protocolTools,
    memory: emptyMemory(),
  });
  const direct = reconcileProtocolTools({
    activeTools: [...strict.activeTools, "another_extension_tool"],
    allTools: [...allTools, { name: "another_extension_tool", sourceInfo: { source: "/extensions/other.ts" } }],
    mode: "strict",
    access: directAccess,
    protocolTools,
    memory: strict.memory,
  });

  assert.ok(direct.activeTools.includes("edit"));
  assert.ok(direct.activeTools.includes("write"));
  assert.ok(direct.activeTools.includes("another_extension_tool"));
  assert.equal(direct.activeTools.includes("bash"), false, "inactive bash was not withheld and must stay inactive");
});

test("a before-direct gate preserves the judgment evidence lane and withholds mutation", () => {
  const gatedIdle = reconcileProtocolTools({
    activeTools: ["read", "edit", "write", "bash"],
    allTools,
    mode: "on",
    access: { ...idleAccess, hasBeforeDirectGate: true },
    protocolTools,
    memory: emptyMemory(),
  });
  assert.deepEqual(new Set(gatedIdle.activeTools), new Set(["read", ...protocolTools]));

  const gatedJudgment = reconcileProtocolTools({
    activeTools: gatedIdle.activeTools,
    allTools,
    mode: "on",
    access: { ...judgmentAccess, hasBeforeDirectGate: true },
    protocolTools,
    memory: gatedIdle.memory,
  });
  assert.ok(gatedJudgment.activeTools.includes("bash"));
  assert.equal(gatedJudgment.activeTools.includes("edit"), false);
  assert.equal(gatedJudgment.activeTools.includes("write"), false);
});

test("an impossible direct-plus-blocker snapshot fails closed", () => {
  const result = reconcileProtocolTools({
    activeTools: ["read", "edit", "write", "bash"],
    allTools,
    mode: "strict",
    access: { canExecute: true, canMutate: true, hasBeforeDirectGate: true },
    protocolTools,
    memory: emptyMemory(),
  });

  assert.deepEqual(new Set(result.activeTools), new Set(["read", ...protocolTools]));
  assert.deepEqual(result.memory.withheldBuiltins, new Set(["edit", "write", "bash"]));
});

test("leaving strict restores the Developer delta without replacing later tool changes", () => {
  const strict = reconcileProtocolTools({
    activeTools: ["read", "edit", "external_search"],
    allTools,
    mode: "strict",
    access: idleAccess,
    protocolTools,
    memory: emptyMemory(),
  });
  const on = reconcileProtocolTools({
    activeTools: [...strict.activeTools, "later_tool"],
    allTools: [...allTools, { name: "later_tool", sourceInfo: { source: "/extensions/later.ts" } }],
    mode: "on",
    access: idleAccess,
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
    access: idleAccess,
    protocolTools,
    memory: emptyMemory(),
  });

  assert.ok(result.activeTools.includes("edit"));
  assert.deepEqual(result.memory.withheldBuiltins, new Set());
});
