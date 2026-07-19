import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { initTheme, loadSkillsFromDir, type ExtensionAPI, type Skill } from "@earendil-works/pi-coding-agent";

import developer from "../extensions/developer.ts";
import { JUDGMENT_TOOL, ROUTE_TOOL } from "../extensions/state.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const loadedLeaves = loadSkillsFromDir({
  dir: join(packageRoot, "skills"),
  source: "@hobin/developer",
}).skills;

initTheme(undefined, false);

function createHarness() {
  const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const entries: Array<{ customType: string; data: unknown }> = [];
  const statuses: Array<{ key: string; value: unknown }> = [];
  const widgets: Array<{ key: string; value: unknown; options?: unknown }> = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const confirmations: Array<{ title: string; message: string }> = [];
  let customResult: unknown;
  let confirmResult = true;
  let customCalls = 0;
  const customOptions: unknown[] = [];
  let editorText = "";
  let activeTools = ["read", "edit", "write", "bash"];

  const api = {
    on(name: string, handler: (event: any, ctx: any) => any) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    },
    registerTool(tool: any) {
      tools.set(tool.name, tool);
      activeTools.push(tool.name);
    },
    registerCommand(name: string, command: any) {
      commands.set(name, command);
    },
    registerFlag() {},
    getFlag() {
      return undefined;
    },
    appendEntry(customType: string, data: unknown) {
      entries.push({ customType, data });
    },
    getActiveTools() {
      return [...activeTools];
    },
    getAllTools() {
      const builtins = ["read", "edit", "write", "bash"].map((name) => ({
        name,
        description: name,
        parameters: {},
        sourceInfo: { path: `<builtin:${name}>`, source: "builtin", scope: "temporary", origin: "top-level" },
      }));
      const extensionTools = [...tools.values()].map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        sourceInfo: { path: "/developer.ts", source: "/developer.ts", scope: "temporary", origin: "top-level" },
      }));
      return [...builtins, ...extensionTools];
    },
    setActiveTools(names: string[]) {
      activeTools = [...names];
    },
  } as unknown as ExtensionAPI;

  const ui = {
    theme,
    setStatus(key: string, value: unknown) {
      statuses.push({ key, value });
    },
    setWidget(key: string, value: unknown, options?: unknown) {
      widgets.push({ key, value, options });
    },
    notify(message: string, level: string) {
      notifications.push({ message, level });
    },
    async confirm(title: string, message: string) {
      confirmations.push({ title, message });
      return confirmResult;
    },
    async custom(_factory: unknown, options: unknown) {
      customCalls += 1;
      customOptions.push(options);
      return customResult;
    },
    getEditorText() {
      return editorText;
    },
    setEditorText(value: string) {
      editorText = value;
    },
  };
  const ctx = {
    mode: "print",
    ui,
    sessionManager: { getBranch: () => [] },
  };

  return {
    api,
    tools,
    commands,
    entries,
    ctx,
    statuses,
    widgets,
    notifications,
    confirmations,
    setConfirmResult(value: boolean) {
      confirmResult = value;
    },
    setCustomResult(value: unknown) {
      customResult = value;
    },
    customCalls: () => customCalls,
    customOptions,
    editorText: () => editorText,
    activeTools: () => [...activeTools],
    async emit(name: string, event: any) {
      let result;
      for (const handler of handlers.get(name) ?? []) result = await handler(event, ctx);
      return result;
    },
  };
}

const theme = {
  bold: (text: string) => text,
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
};

function renderedText(component: { render(width: number): string[] }): string {
  return component.render(10_000).join("\n");
}

async function startHarness(loadedSkills: Skill[] = loadedLeaves) {
  const harness = createHarness();
  await developer(harness.api);
  await harness.emit("session_start", { type: "session_start", reason: "startup" });
  await harness.commands.get("develop").handler("on", harness.ctx);
  await harness.emit("before_agent_start", {
    type: "before_agent_start",
    prompt: "test",
    systemPrompt: "base",
    systemPromptOptions: { cwd: packageRoot, skills: loadedSkills },
  });
  return harness;
}

test("tool contract failures throw so Pi records them as errors", async () => {
  const harness = createHarness();
  await developer(harness.api);
  await harness.emit("session_start", { type: "session_start", reason: "startup" });
  const route = harness.tools.get(ROUTE_TOOL);

  await assert.rejects(
    route.execute("off", { question: "Q", owner: "direct", reason: "R" }, undefined, undefined, harness.ctx),
    /protocol is off/,
  );

  await harness.commands.get("develop").handler("on", harness.ctx);
  await harness.emit("before_agent_start", {
    type: "before_agent_start",
    prompt: "test",
    systemPrompt: "base",
    systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
  });
  const opened = await route.execute(
    "valid",
    { question: "What must be true?", owner: "specify", reason: "Product meaning is unclear" },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.match(opened.content[0].text.slice(0, 2_000), /Route ID: route:valid/);
  assert.match(opened.content[0].text.slice(0, 2_000), /developer_record_judgment/);
  assert.match(opened.content[0].text, /<developer-method name="specify" location="[^"]+" base-dir="[^"]+">/);
  await assert.rejects(
    route.execute(
      "overlap",
      { question: "Can another route start?", owner: "direct", reason: "Testing route ownership" },
      undefined,
      undefined,
      harness.ctx,
    ),
    /is still active/,
  );

  const judgment = harness.tools.get(JUDGMENT_TOOL);
  await assert.rejects(
    judgment.execute(
      "wrong",
      { route_id: "route:wrong", status: "resolved", result: "Done", basis: ["Evidence"] },
      undefined,
      undefined,
      harness.ctx,
    ),
    /Route ID mismatch/,
  );
});

test("concurrent route attempts cannot overwrite a route that is still opening", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const opening = route.execute(
    "opening",
    { question: "What must be true?", owner: "specify", reason: "Product meaning is unclear" },
    undefined,
    undefined,
    harness.ctx,
  );
  await assert.rejects(
    route.execute(
      "overlap",
      { question: "Can direct work start too?", owner: "direct", reason: "Testing concurrent ownership" },
      undefined,
      undefined,
      harness.ctx,
    ),
    /currently opening|still active/,
  );
  const opened = await opening;
  assert.equal(opened.details.routeId, "route:opening");
});

test("oversized route output fails before protocol state is mutated", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  await assert.rejects(
    route.execute(
      "oversized",
      { question: "x".repeat(60_000), owner: "direct", reason: "The action is otherwise justified" },
      undefined,
      undefined,
      harness.ctx,
    ),
    /exceeds Pi's tool-output limit/,
  );

  const opened = await route.execute(
    "after-oversized",
    { question: "Can a valid route still open?", owner: "direct", reason: "The failed result was atomic" },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(opened.details.routeId, "route:after-oversized");
});

test("oversized judgment output leaves the active route available for a valid retry", async () => {
  const harness = await startHarness();
  const route = await harness.tools.get(ROUTE_TOOL).execute(
    "judgment-output",
    { question: "Record a bounded result", owner: "direct", reason: "The local action is justified" },
    undefined,
    undefined,
    harness.ctx,
  );
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  await assert.rejects(
    judgment.execute(
      "oversized-judgment",
      {
        route_id: route.details.routeId,
        status: "resolved",
        result: "x".repeat(60_000),
        basis: ["Observed evidence"],
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /exceeds Pi's tool-output limit/,
  );

  const recorded = await judgment.execute(
    "bounded-judgment",
    {
      route_id: route.details.routeId,
      status: "resolved",
      result: "The bounded result is recorded.",
      basis: ["Observed evidence"],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(recorded.details.status, "resolved");
});

test("a judgment cannot commit an unbounded pending-question set", async () => {
  const harness = await startHarness();
  const route = await harness.tools.get(ROUTE_TOOL).execute(
    "pending-limit",
    { question: "Which questions remain?", owner: "direct", reason: "The evidence has been inspected" },
    undefined,
    undefined,
    harness.ctx,
  );
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  await assert.rejects(
    judgment.execute(
      "too-many-pending",
      {
        route_id: route.details.routeId,
        status: "needs-evidence",
        result: "Too many separate questions were proposed.",
        basis: [],
        open_questions: Array.from({ length: 21 }, (_, index) => `Question ${index + 1}`),
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /pending questions; resolve or consolidate/,
  );

  const recorded = await judgment.execute(
    "bounded-pending",
    {
      route_id: route.details.routeId,
      status: "needs-evidence",
      result: "One question remains.",
      basis: [],
      open_questions: ["What evidence is missing?"],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(recorded.details.openedQuestions.length, 1);
});

test("a Pi-filtered leaf cannot be routed even though it exists in the package", async () => {
  const harness = await startHarness([]);
  await assert.rejects(
    harness.tools.get(ROUTE_TOOL).execute(
      "filtered",
      { question: "What must be true?", owner: "specify", reason: "Need a contract" },
      undefined,
      undefined,
      harness.ctx,
    ),
    /unavailable or disabled/,
  );
});

test("direct execution profiles load only the protocol selected for that action", async () => {
  const ordinaryHarness = await startHarness();
  const ordinary = await ordinaryHarness.tools.get(ROUTE_TOOL).execute(
    "ordinary-direct",
    {
      question: "Apply the already-justified generated-file update",
      owner: "direct",
      reason: "The output and verifier are already fixed",
    },
    undefined,
    undefined,
    ordinaryHarness.ctx,
  );
  assert.equal(ordinary.details.executionProfile, "ordinary");
  assert.doesNotMatch(ordinary.content[0].text, /Smallest Green Transformation/);

  const structuralHarness = await startHarness();
  const structural = await structuralHarness.tools.get(ROUTE_TOOL).execute(
    "structural-direct",
    {
      question: "Move the accepted responsibility without changing behavior",
      owner: "direct",
      reason: "Signal and abstraction review already justified one structural move",
      execution_profile: "behavior-preserving-structure",
    },
    undefined,
    undefined,
    structuralHarness.ctx,
  );
  assert.equal(structural.details.executionProfile, "behavior-preserving-structure");
  assert.match(structural.content[0].text, /<developer-direct-profile name="behavior-preserving-structure">/);
  assert.match(structural.content[0].text, /## Smallest Green Transformation/);
  assert.match(structural.content[0].text, /## Stable Landing/);
  assert.match(structural.content[0].text, /99 Bottles of OOP/);
});

test("route schema exposes execution profiles only on the direct branch", async () => {
  const harness = createHarness();
  await developer(harness.api);
  const schema = harness.tools.get(ROUTE_TOOL).parameters;
  assert.equal(schema.anyOf.length, 2);

  const skillBranch = schema.anyOf.find((branch: any) => branch.properties.owner.pattern);
  const directBranch = schema.anyOf.find((branch: any) => branch.properties.owner.const === "direct");
  assert.ok(skillBranch);
  assert.ok(directBranch);
  assert.equal(skillBranch.additionalProperties, false);
  assert.equal(skillBranch.properties.execution_profile, undefined);
  assert.equal(directBranch.additionalProperties, false);
  assert.equal(
    directBranch.properties.execution_profile.const,
    "behavior-preserving-structure",
  );
});

test("skill routes reject direct execution profiles", async () => {
  const harness = await startHarness();
  await assert.rejects(
    harness.tools.get(ROUTE_TOOL).execute(
      "profile-on-skill",
      {
        question: "What must be true?",
        owner: "specify",
        reason: "Product meaning is unclear",
        execution_profile: "behavior-preserving-structure",
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /execution_profile is valid only when owner=direct/,
  );
});

test("the protocol prompt lists only skills Pi made available", async () => {
  const specify = loadedLeaves.find((skill) => skill.name === "specify")!;
  const harness = createHarness();
  await developer(harness.api);
  await harness.emit("session_start", { type: "session_start", reason: "startup" });
  await harness.commands.get("develop").handler("on", harness.ctx);
  const result = await harness.emit("before_agent_start", {
    type: "before_agent_start",
    prompt: "test",
    systemPrompt: "base",
    systemPromptOptions: { cwd: packageRoot, skills: [specify] },
  });

  assert.match(result.systemPrompt, /Available Developer skills: specify\./);
  assert.doesNotMatch(result.systemPrompt, /Available Developer skills:.*model/);
});

test("a later turn can recover the active leaf method from its canonical location", async () => {
  const harness = await startHarness();
  await harness.tools.get(ROUTE_TOOL).execute(
    "recoverable",
    { question: "What must be true?", owner: "specify", reason: "Product meaning is unclear" },
    undefined,
    undefined,
    harness.ctx,
  );
  const result = await harness.emit("before_agent_start", {
    type: "before_agent_start",
    prompt: "continue",
    systemPrompt: "base",
    systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
  });

  assert.match(result.systemPrompt, /Active skill location: .*specify\/SKILL\.md/);
  assert.match(result.systemPrompt, /Read it again if compaction/);
});

test("leaf routing remains adaptive rather than enforcing a phase order", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const verifyFirst = await route.execute(
    "verify-first",
    { question: "Does current evidence support the claim?", owner: "verify", reason: "A claim already exists" },
    undefined,
    undefined,
    harness.ctx,
  );
  await judgment.execute(
    "verify-close",
    {
      route_id: verifyFirst.details.routeId,
      status: "resolved",
      result: "The claim is supported.",
      basis: ["Observed test output"],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const modelSecond = await route.execute(
    "model-second",
    { question: "Which condition distinguishes absence from empty?", owner: "model", reason: "A new state question appeared" },
    undefined,
    undefined,
    harness.ctx,
  );

  assert.equal(verifyFirst.details.owner, "verify");
  assert.equal(modelSecond.details.owner, "model");
});

test("strict direct routing uses additive built-in activation and preserves unrelated tools", async () => {
  const harness = createHarness();
  await developer(harness.api);
  await harness.emit("session_start", { type: "session_start", reason: "startup" });
  await harness.commands.get("develop").handler("strict", harness.ctx);
  assert.equal(harness.activeTools().includes("edit"), false);

  const beforeDirect = [...harness.activeTools(), "other_extension_tool"];
  (harness.api as any).setActiveTools(beforeDirect);
  const route = harness.tools.get(ROUTE_TOOL);
  const opened = await route.execute(
    "direct",
    { question: "Apply the justified local change", owner: "direct", reason: "The contract is explicit" },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.ok(harness.activeTools().includes("edit"));
  assert.ok(harness.activeTools().includes("write"));
  assert.ok(harness.activeTools().includes("bash"));
  assert.ok(harness.activeTools().includes("other_extension_tool"));

  await harness.tools.get(JUDGMENT_TOOL).execute(
    "close",
    {
      route_id: opened.details.routeId,
      status: "resolved",
      result: "The local change is implemented.",
      basis: ["Relevant test passes"],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(harness.activeTools().includes("edit"), false);
  assert.ok(harness.activeTools().includes("other_extension_tool"));
});

test("persistent TUI state stays compact and disappears when routing is idle", async () => {
  const harness = await startHarness();
  assert.equal(harness.widgets.at(-1)?.value, undefined);

  const route = await harness.tools.get(ROUTE_TOOL).execute(
    "widget-route",
    {
      question: `${"A long active route question ".repeat(12)}?`,
      owner: "direct",
      reason: "The local action is justified",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const activeWidget = harness.widgets.at(-1)?.value as string[];
  assert.equal(activeWidget.length, 1);
  assert.match(activeWidget[0], /^route · direct ·/);
  assert.ok(activeWidget[0].length < 190);

  await harness.tools.get(JUDGMENT_TOOL).execute(
    "widget-close",
    {
      route_id: route.details.routeId,
      status: "resolved",
      result: "The action is complete.",
      basis: ["The focused test passes."],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(harness.widgets.at(-1)?.value, undefined);
});

test("the no-argument command uses a selector only in TUI mode", async () => {
  const harness = createHarness();
  await developer(harness.api);
  await harness.emit("session_start", { type: "session_start", reason: "startup" });

  await harness.commands.get("develop").handler("", harness.ctx);
  assert.equal(harness.customCalls(), 0);
  assert.match(harness.notifications.at(-1)?.message ?? "", /developer: off/);

  harness.ctx.mode = "tui";
  harness.setCustomResult("strict");
  await harness.commands.get("develop").handler("", harness.ctx);
  assert.equal(harness.customCalls(), 1);
  assert.deepEqual(harness.customOptions.at(-1), {
    overlay: true,
    overlayOptions: { anchor: "center", width: 78, maxHeight: 13, margin: 1 },
  });
  assert.equal((harness.entries.at(-1)?.data as { mode: string }).mode, "strict");
  assert.equal(harness.activeTools().includes("edit"), false);
});

test("/develop completes actions and confirms before discarding active TUI state", async () => {
  const harness = await startHarness();
  const command = harness.commands.get("develop");
  assert.deepEqual(command.getArgumentCompletions("st"), [
    { value: "strict", label: "strict" },
    { value: "status", label: "status" },
  ]);
  assert.equal(command.getArgumentCompletions("unknown"), null);

  await harness.tools.get(ROUTE_TOOL).execute(
    "off-confirmation",
    {
      question: "Should the active work be discarded?",
      owner: "direct",
      reason: "The next action was already justified",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  harness.ctx.mode = "tui";
  const entryCount = harness.entries.length;

  harness.setConfirmResult(false);
  await command.handler("off", harness.ctx);
  assert.equal(harness.entries.length, entryCount);
  assert.deepEqual(harness.confirmations.at(-1), {
    title: "Turn off Developer?",
    message: "This clears the active route from the current protocol state. Existing session history remains.",
  });

  harness.setConfirmResult(true);
  await command.handler("off", harness.ctx);
  assert.equal((harness.entries.at(-1)?.data as { mode: string }).mode, "off");
});

test("TUI status uses a read-only panel and open-question selection only prepares editor text", async () => {
  const harness = await startHarness();
  const route = await harness.tools.get(ROUTE_TOOL).execute(
    "question-picker",
    {
      question: "Which browser observation remains?",
      owner: "direct",
      reason: "The implementation evidence has been inspected",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const judgment = await harness.tools.get(JUDGMENT_TOOL).execute(
    "question-picker-close",
    {
      route_id: route.details.routeId,
      status: "needs-evidence",
      result: "A rendered-state observation is missing.",
      basis: ["Pure-function tests pass."],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const questionId = `question:${route.details.routeId}`;
  assert.equal(judgment.details.status, "needs-evidence");

  harness.ctx.mode = "tui";
  harness.setCustomResult(undefined);
  await harness.commands.get("develop").handler("status", harness.ctx);
  assert.equal(harness.customOptions.at(-1), undefined);

  harness.setCustomResult(questionId);
  await harness.commands.get("develop").handler("questions", harness.ctx);
  assert.match(harness.editorText(), new RegExp(`Revisit Developer question ${questionId}:`));
  assert.match(harness.editorText(), /Which browser observation remains/);
  assert.equal(harness.entries.at(-1)?.customType, "developer.mode");
});

test("tool renderers are partial-safe and expose routing evidence when expanded", () => {
  const harness = createHarness();
  return developer(harness.api).then(() => {
    const route = harness.tools.get(ROUTE_TOOL);
    const callComponent = route.renderCall({}, theme, {});
    const partialCall = renderedText(callComponent);
    assert.match(partialCall, /…/);
    assert.equal(route.renderCall({ owner: "direct", question: "Q" }, theme, { lastComponent: callComponent }), callComponent);
    const partialResult = renderedText(
      route.renderResult(
        { content: [], details: undefined },
        { expanded: false, isPartial: true, isError: false },
        theme,
        {},
      ),
    );
    assert.match(partialResult, /routing development question/);

    const expanded = renderedText(
      route.renderResult(
        {
          content: [],
          details: {
            protocol: "developer/v2",
            kind: "route",
            routeId: "route:render",
            question: "What should own this change?",
            owner: "specify",
            reason: "The invariant is unclear",
            knownEvidence: ["The current behavior differs across callers"],
            targetQuestionId: "question:earlier",
            methodLocation: "/skills/specify/SKILL.md",
            executionProfile: undefined,
          },
        },
        { expanded: true, isPartial: false, isError: false },
        theme,
        {},
      ),
    );
    assert.match(expanded, /reason · The invariant is unclear/);
    assert.match(expanded, /evidence · The current behavior differs across callers/);
    assert.match(expanded, /revisits · question:earlier/);
    assert.match(expanded, /skill · \/skills\/specify\/SKILL\.md/);
  });
});

test("judgment renderers use status semantics and show opened questions", async () => {
  const harness = createHarness();
  await developer(harness.api);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const expanded = renderedText(
    judgment.renderResult(
      {
        content: [],
        details: {
          protocol: "developer/v2",
          kind: "judgment",
          routeId: "route:render",
          question: "Is the evidence sufficient?",
          owner: "verify",
          status: "needs-evidence",
          result: "A browser observation is still missing.",
          basis: ["Unit tests cover only the pure function."],
          artifacts: ["pnpm test"],
          openedQuestions: [
            {
              id: "question:route:render:open:1",
              question: "What does the rendered UI show?",
              status: "needs-evidence",
              sourceRouteId: "route:render",
            },
          ],
        },
      },
      { expanded: true, isPartial: false, isError: false },
      theme,
      {},
    ),
  );
  assert.match(expanded, /<warning>needs-evidence/);
  assert.match(expanded, /basis · Unit tests cover only the pure function/);
  assert.match(expanded, /artifact · pnpm test/);
  assert.match(expanded, /opened · question:route:render:open:1 · What does the rendered UI show/);

  const blockedCall = renderedText(
    judgment.renderCall({ status: "blocked", result: "External access is unavailable." }, theme, {}),
  );
  assert.match(blockedCall, /<error>blocked<\/error>/);
});
