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
  const sentUserMessages: Array<{ content: string; options?: unknown }> = [];
  let customResult: unknown;
  let editorResult: string | undefined;
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
    sendUserMessage(content: string, options?: unknown) {
      sentUserMessages.push({ content, options });
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
    async editor() {
      return editorResult;
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
    isIdle: () => true,
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
    sentUserMessages,
    setConfirmResult(value: boolean) {
      confirmResult = value;
    },
    setCustomResult(value: unknown) {
      customResult = value;
    },
    setEditorResult(value: string | undefined) {
      editorResult = value;
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

function agentOpenQuestion(question: string) {
  return {
    question,
    status: "open" as const,
    resolution_owner: "agent" as const,
    gate: "none" as const,
    resolution_criteria: `Obtain concrete evidence that settles: ${question}`,
  };
}

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
        open_questions: Array.from({ length: 21 }, (_, index) =>
          agentOpenQuestion(`Question ${index + 1}`),
        ),
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
      open_questions: [agentOpenQuestion("What evidence is missing?")],
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
  assert.ok(directBranch.required.includes("movement"));
  assert.ok(directBranch.required.includes("stop_condition"));
  assert.ok(directBranch.required.includes("verification"));
  assert.ok(directBranch.properties.alternatives_considered);
  assert.equal(skillBranch.properties.alternatives_considered, undefined);
  assert.equal(
    directBranch.properties.execution_profile.const,
    "behavior-preserving-structure",
  );
});

test("judgment schema classifies open questions and supports cross-route question updates", async () => {
  const harness = createHarness();
  await developer(harness.api);
  const schema = harness.tools.get(JUDGMENT_TOOL).parameters;
  const openQuestion = schema.properties.open_questions.items;
  assert.ok(openQuestion.required.includes("resolution_owner"));
  assert.ok(openQuestion.required.includes("gate"));
  assert.ok(openQuestion.required.includes("resolution_criteria"));
  assert.deepEqual(openQuestion.properties.resolution_owner.enum, ["agent", "user", "environment"]);
  assert.deepEqual(openQuestion.properties.gate.enum, ["none", "before-direct", "before-completion"]);
  assert.ok(schema.properties.question_updates.items.required.includes("question_id"));
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

test("resolved model work must pass through sketch or signal before direct mutation", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const modeled = await route.execute(
    "model-feature",
    {
      question: "Which feature cases must the implementation support?",
      owner: "model",
      reason: "The feature has consequential variants",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await judgment.execute(
    "model-feature-close",
    {
      route_id: modeled.details.routeId,
      status: "resolved",
      result: "The implementation cases are explicit.",
      basis: ["A representative case table was derived."],
    },
    undefined,
    undefined,
    harness.ctx,
  );

  await assert.rejects(
    route.execute(
      "premature-direct",
      {
        question: "Implement the feature",
        owner: "direct",
        reason: "The cases are known",
        movement: "Add the first feature path",
        stop_condition: "The first path is green and reviewable",
        verification: "Run its focused test",
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /requires implementation framing/,
  );

  const sketched = await route.execute(
    "feature-sketch",
    {
      question: "What is the first implementable feature surface?",
      owner: "sketch",
      reason: "New behavior needs an initial implementation shape",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await judgment.execute(
    "feature-sketch-close",
    {
      route_id: sketched.details.routeId,
      status: "resolved",
      result: "The first interface and check are explicit.",
      basis: ["The sketch derives from the modeled cases."],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const direct = await route.execute(
    "framed-direct",
    {
      question: "Implement the first sketched item",
      owner: "direct",
      reason: "Its movement and stop check are now explicit",
      movement: "Add the first wished interface implementation",
      stop_condition: "The focused case is green and the diff has one purpose",
      verification: "Run the focused representative-case test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(direct.details.directStep.movement, "Add the first wished interface implementation");
});

test("a changed direct landing creates verification debt", async () => {
  const harness = await startHarness();
  const direct = await harness.tools.get(ROUTE_TOOL).execute(
    "changed-direct",
    {
      question: "Apply one local change",
      owner: "direct",
      reason: "The step is justified",
      movement: "Change one caller",
      stop_condition: "The caller is green and reviewable",
      verification: "Run the caller test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await harness.emit("tool_call", { toolName: "edit", input: {}, toolCallId: "edit:1" });
  const recorded = await harness.tools.get(JUDGMENT_TOOL).execute(
    "changed-direct-close",
    {
      route_id: direct.details.routeId,
      status: "resolved",
      result: "The caller reached its stable landing.",
      basis: ["The focused caller test passes."],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(recorded.details.changedArtifacts, true);
  assert.match(recorded.content[0].text, /verify is required before claiming completion/);
  await harness.commands.get("develop").handler("status", harness.ctx);
  const status = harness.notifications.at(-1)?.message ?? "";
  assert.match(status, /developer: on · target: none · needs-routing/);
  assert.match(status, /checkpoint: reroute required/);
  assert.match(status, /verification: required/);
});

test("implementation evidence can resolve an unfocused agent question through question_updates", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const evidenceRoute = await route.execute(
    "evidence-question",
    {
      question: "Does the empty schedule preserve absence?",
      owner: "verify",
      reason: "No focused implementation evidence exists yet",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const opened = await judgment.execute(
    "evidence-open",
    {
      route_id: evidenceRoute.details.routeId,
      status: "needs-evidence",
      result: "A focused implementation test is still needed.",
      basis: [],
      open_questions: [agentOpenQuestion("Does the empty schedule preserve absence?")],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const questionId = opened.details.openedQuestions[0].id;

  const implementationRoute = await route.execute(
    "implementation-route",
    {
      question: "Implement the accepted schedule conversion",
      owner: "direct",
      reason: "The conversion contract is already explicit",
      movement: "Add the empty-schedule conversion",
      stop_condition: "The focused conversion test is green",
      verification: "Run the focused conversion test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const implemented = await judgment.execute(
    "implementation-close",
    {
      route_id: implementationRoute.details.routeId,
      status: "resolved",
      result: "The conversion is implemented and its focused test passes.",
      basis: ["The focused conversion test passes."],
      question_updates: [
        {
          question_id: questionId,
          status: "resolved",
          result: "The empty schedule preserves absence.",
          basis: ["The focused conversion test observes absence."],
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );

  assert.equal(implemented.details.questionUpdates[0].questionId, questionId);
  harness.ctx.mode = "tui";
  await harness.commands.get("develop").handler("questions", harness.ctx);
  assert.equal(harness.notifications.at(-1)?.message, "Developer has no open questions on the current branch.");
});

test("consecutive direct routing records prior evidence and reconsidered skill routes without banning direct", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const first = await route.execute(
    "first-direct",
    {
      question: "Implement the first justified movement",
      owner: "direct",
      reason: "The current design makes the movement explicit",
      movement: "Add the first boundary",
      stop_condition: "The boundary test is green",
      verification: "Run the boundary test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await judgment.execute(
    "first-direct-close",
    {
      route_id: first.details.routeId,
      status: "resolved",
      result: "The first boundary is green.",
      basis: ["The boundary test passes."],
    },
    undefined,
    undefined,
    harness.ctx,
  );

  const secondParams = {
    question: "Implement the next justified movement",
    owner: "direct",
    reason: "The first landing exposes one local caller update",
    movement: "Update the local caller",
    stop_condition: "The caller test is green",
    verification: "Run the caller test",
  };
  await assert.rejects(
    route.execute("second-without-evidence", secondParams, undefined, undefined, harness.ctx),
    /cite evidence from the previous direct landing/,
  );
  await assert.rejects(
    route.execute(
      "second-without-alternatives",
      { ...secondParams, known_evidence: ["The first boundary test passes."] },
      undefined,
      undefined,
      harness.ctx,
    ),
    /must record the plausible available skill routes/,
  );

  const second = await route.execute(
    "second-direct",
    {
      ...secondParams,
      known_evidence: ["The first boundary test passes and exposes one unchanged caller."],
      alternatives_considered: [
        { owner: "verify", reason: "The narrow boundary check already settled the current landing claim." },
        { owner: "signal", reason: "No new structural direction appeared; the caller update was already exposed." },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(second.details.owner, "direct");
  assert.deepEqual(second.details.consideredAlternatives.map((item: { owner: string }) => item.owner), [
    "verify",
    "signal",
  ]);
});

test("a user-owned before-direct question blocks routes and built-in mutation until resolved", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const decisionRoute = await route.execute(
    "decision-route",
    {
      question: "What should an empty schedule mean?",
      owner: "specify",
      reason: "The product meaning is human-owned",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const blocked = await judgment.execute(
    "decision-blocked",
    {
      route_id: decisionRoute.details.routeId,
      status: "blocked",
      result: "The product owner must choose the empty-schedule meaning.",
      basis: ["No accepted product policy exists."],
      open_questions: [
        {
          question: "Should an empty schedule mean absent or explicitly cleared?",
          status: "open",
          resolution_owner: "user",
          gate: "before-direct",
          resolution_criteria: "The product owner chooses absent or explicitly cleared.",
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const questionId = blocked.details.openedQuestions[0].id;

  await assert.rejects(
    route.execute(
      "blocked-direct",
      {
        question: "Implement the empty-schedule behavior",
        owner: "direct",
        reason: "Attempt mutation before the decision",
        movement: "Change empty-schedule storage",
        stop_condition: "The storage test passes",
        verification: "Run the storage test",
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /Direct work is blocked/,
  );
  const mutationGate = await harness.emit("tool_call", {
    toolName: "edit",
    input: {},
    toolCallId: "edit:blocked",
  });
  assert.match(mutationGate.reason, /question gate blocks artifact mutation/);

  const answerRoute = await route.execute(
    "answer-route",
    {
      question: "Should an empty schedule mean absent or explicitly cleared?",
      owner: "specify",
      reason: "The product owner answered the focused decision",
      known_evidence: ["The product owner chose absent."],
      open_question_id: questionId,
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await assert.rejects(
    judgment.execute(
      "answer-without-question-review",
      {
        route_id: answerRoute.details.routeId,
        status: "resolved",
        result: "An empty schedule means absent.",
        basis: ["The product owner explicitly chose absent."],
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /Include question_updates/,
  );
  await assert.rejects(
    judgment.execute(
      "answer-without-explicit-resolution",
      {
        route_id: answerRoute.details.routeId,
        status: "resolved",
        result: "An empty schedule means absent.",
        basis: ["The product owner explicitly chose absent."],
        question_updates: [],
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /requires an explicit question_updates entry/,
  );
  await judgment.execute(
    "answer-resolved",
    {
      route_id: answerRoute.details.routeId,
      status: "resolved",
      result: "An empty schedule means absent.",
      basis: ["The product owner explicitly chose absent."],
      question_updates: [
        {
          question_id: questionId,
          status: "resolved",
          result: "The product owner chose absent.",
          basis: ["Explicit product-owner answer."],
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );

  const direct = await route.execute(
    "unblocked-direct",
    {
      question: "Implement the accepted empty-schedule meaning",
      owner: "direct",
      reason: "The blocking product decision is resolved",
      movement: "Store an empty schedule as absent",
      stop_condition: "The storage test is green",
      verification: "Run the storage test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(direct.details.owner, "direct");
});

test("an agent before-direct question keeps a strict judgment evidence lane reachable", async () => {
  const harness = await startHarness();
  await harness.commands.get("develop").handler("strict", harness.ctx);
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  assert.equal(harness.activeTools().includes("bash"), false);

  const discovery = await route.execute(
    "strict-discovery",
    {
      question: "Which source file owns the schedule conversion?",
      owner: "signal",
      reason: "Repository evidence is required before mutation",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(harness.activeTools().includes("bash"), true);
  assert.equal(harness.activeTools().includes("edit"), false);
  const opened = await judgment.execute(
    "strict-discovery-open",
    {
      route_id: discovery.details.routeId,
      status: "needs-evidence",
      result: "A repository search is still required.",
      basis: [],
      open_questions: [
        {
          question: "Which source file owns the schedule conversion?",
          status: "open",
          resolution_owner: "agent",
          gate: "before-direct",
          resolution_criteria: "Repository search identifies the owning source file.",
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const questionId = opened.details.openedQuestions[0].id;
  assert.equal(harness.activeTools().includes("bash"), false);

  await assert.rejects(
    route.execute(
      "strict-blocked-direct",
      {
        question: "Implement the schedule conversion",
        owner: "direct",
        reason: "Attempt implementation before locating the owner",
        movement: "Add the conversion",
        stop_condition: "The conversion test passes",
        verification: "Run the conversion test",
      },
      undefined,
      undefined,
      harness.ctx,
    ),
    /Direct work is blocked/,
  );

  const resolution = await route.execute(
    "strict-resolve-evidence",
    {
      question: "Which source file owns the schedule conversion?",
      owner: "signal",
      reason: "The pending agent question is resolved through repository evidence",
      open_question_id: questionId,
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(harness.activeTools().includes("bash"), true);
  assert.equal(harness.activeTools().includes("edit"), false);
  assert.equal(
    await harness.emit("tool_call", { toolName: "bash", input: { command: "find . -type f" }, toolCallId: "bash:evidence" }),
    undefined,
  );
  const blockedEdit = await harness.emit("tool_call", {
    toolName: "edit",
    input: {},
    toolCallId: "edit:evidence",
  });
  assert.match(blockedEdit.reason, /blocks artifact mutation/);

  await judgment.execute(
    "strict-resolve-evidence-close",
    {
      route_id: resolution.details.routeId,
      status: "resolved",
      result: "src/contracts.ts owns the conversion.",
      basis: ["Repository search result."],
      question_updates: [
        {
          question_id: questionId,
          status: "resolved",
          result: "The owning source file is src/contracts.ts.",
          basis: ["Repository search result."],
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );

  const direct = await route.execute(
    "strict-unblocked-direct",
    {
      question: "Implement the schedule conversion",
      owner: "direct",
      reason: "The owning file and local movement are now known",
      movement: "Add the pure conversion in src/contracts.ts",
      stop_condition: "The focused conversion test passes",
      verification: "Run the conversion test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(direct.details.owner, "direct");
  assert.equal(harness.activeTools().includes("edit"), true);
  assert.equal(harness.activeTools().includes("bash"), true);
});

test("a before-completion question allows direct work but keeps completion evidence unresolved", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const acceptanceRoute = await route.execute(
    "acceptance-question",
    {
      question: "Has the user accepted the rendered checkout behavior?",
      owner: "verify",
      reason: "Acceptance is separate from implementation evidence",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const opened = await judgment.execute(
    "acceptance-open",
    {
      route_id: acceptanceRoute.details.routeId,
      status: "needs-evidence",
      result: "Implementation may continue, but user acceptance is still missing.",
      basis: [],
      open_questions: [
        {
          question: "Does the user accept the rendered checkout behavior?",
          status: "open",
          resolution_owner: "user",
          gate: "before-completion",
          resolution_criteria: "The user explicitly accepts the rendered checkout behavior.",
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(opened.details.openedQuestions[0].gate, "before-completion");

  const direct = await route.execute(
    "allowed-before-completion",
    {
      question: "Implement the already accepted checkout layout",
      owner: "direct",
      reason: "The remaining question gates completion, not implementation",
      movement: "Apply the local checkout layout change",
      stop_condition: "The focused checkout test is green",
      verification: "Run the focused checkout test",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const mutationGate = await harness.emit("tool_call", {
    toolName: "edit",
    input: {},
    toolCallId: "edit:before-completion",
  });
  assert.equal(mutationGate, undefined);
  await judgment.execute(
    "allowed-before-completion-close",
    {
      route_id: direct.details.routeId,
      status: "resolved",
      result: "The local checkout change reached a stable landing.",
      basis: ["The focused checkout test passes."],
      question_updates: [],
    },
    undefined,
    undefined,
    harness.ctx,
  );

  const verifyRoute = await route.execute(
    "verify-before-acceptance",
    {
      question: "Does current implementation evidence support the checkout claim?",
      owner: "verify",
      reason: "The changed landing requires current verification",
      known_evidence: ["The focused checkout test passes."],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await judgment.execute(
    "verify-before-acceptance-close",
    {
      route_id: verifyRoute.details.routeId,
      status: "resolved",
      result: "Implementation evidence is current, but acceptance is not.",
      basis: ["The focused checkout test passes."],
      question_updates: [],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await harness.commands.get("develop").handler("status", harness.ctx);
  const status = harness.notifications.at(-1)?.message ?? "";
  assert.match(status, /needs-answer/);
  assert.match(status, /verification: required/);
});

test("a sole unrelated pending question is not implicitly focused or resolved", async () => {
  const harness = await startHarness();
  const route = harness.tools.get(ROUTE_TOOL);
  const judgment = harness.tools.get(JUDGMENT_TOOL);
  const evidenceRoute = await route.execute(
    "sole-question",
    {
      question: "What does the narrow checkout viewport show?",
      owner: "verify",
      reason: "A rendered observation is missing",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const opened = await judgment.execute(
    "sole-question-open",
    {
      route_id: evidenceRoute.details.routeId,
      status: "needs-evidence",
      result: "The viewport observation is still missing.",
      basis: [],
      open_questions: [agentOpenQuestion("What does the narrow checkout viewport show?")],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const questionId = opened.details.openedQuestions[0].id;

  const unrelated = await route.execute(
    "unrelated-route",
    {
      question: "Are the schedule conversion tests current?",
      owner: "verify",
      reason: "This is independent evidence",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(unrelated.details.targetQuestionId, undefined);
  await judgment.execute(
    "unrelated-route-close",
    {
      route_id: unrelated.details.routeId,
      status: "resolved",
      result: "The schedule conversion tests are current.",
      basis: ["The focused schedule test passes."],
      question_updates: [],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await harness.commands.get("develop").handler("questions", harness.ctx);
  assert.ok((harness.notifications.at(-1)?.message ?? "").includes(questionId));
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
    overlayOptions: { anchor: "center", width: "84%", minWidth: 78, maxHeight: "88%", margin: 1 },
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

test("TUI question selection focuses the pending question and the next route associates it automatically", async () => {
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
      open_questions: [agentOpenQuestion("Which browser observation remains?")],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  const questionId = judgment.details.openedQuestions[0].id;
  assert.equal(judgment.details.status, "needs-evidence");

  harness.ctx.mode = "tui";
  harness.setCustomResult(undefined);
  await harness.commands.get("develop").handler("status", harness.ctx);
  assert.deepEqual(harness.customOptions.at(-1), {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: "90%",
      minWidth: 72,
      maxHeight: "88%",
      margin: 1,
    },
  });

  harness.setCustomResult(questionId);
  harness.setEditorResult(
    "Resolve this open Developer question.\n\nQuestion: Which browser observation remains?\n\nAnswer/evidence: the value remains visible.",
  );
  await harness.commands.get("develop").handler("questions", harness.ctx);
  assert.equal(harness.editorText(), "");
  assert.match(harness.sentUserMessages.at(-1)?.content ?? "", /Which browser observation remains/);
  assert.match(harness.sentUserMessages.at(-1)?.content ?? "", /value remains visible/);
  assert.doesNotMatch(harness.sentUserMessages.at(-1)?.content ?? "", /question:route:/);
  assert.equal(harness.entries.at(-1)?.customType, "developer.question-focus");

  const revisited = await harness.tools.get(ROUTE_TOOL).execute(
    "question-picker-revisit",
    {
      question: "What does the browser now show?",
      owner: "verify",
      reason: "The focused observation is now available",
    },
    undefined,
    undefined,
    harness.ctx,
  );
  assert.equal(revisited.details.targetQuestionId, questionId);
  await harness.tools.get(JUDGMENT_TOOL).execute(
    "question-picker-resolved",
    {
      route_id: revisited.details.routeId,
      status: "resolved",
      result: "The rendered state now supports the claim.",
      basis: ["The focused browser observation was recorded."],
      question_updates: [
        {
          question_id: questionId,
          status: "resolved",
          result: "The browser observation now supports the claim.",
          basis: ["Recorded focused browser observation."],
        },
      ],
    },
    undefined,
    undefined,
    harness.ctx,
  );
  await harness.commands.get("develop").handler("questions", harness.ctx);
  assert.equal(harness.notifications.at(-1)?.message, "Developer has no open questions on the current branch.");
});

test("tool renderers are partial-safe and expose routing evidence when expanded", async () => {
  const harness = createHarness();
  await developer(harness.api);
  const route = harness.tools.get(ROUTE_TOOL);
  assert.equal(route.renderShell, "self");
  const callComponent = route.renderCall({}, theme, {});
  const partialCall = renderedText(callComponent);
  assert.match(partialCall, /…/);
  assert.equal(
    route.renderCall({ owner: "direct", question: "Q" }, theme, { lastComponent: callComponent }),
    callComponent,
  );
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
          consideredAlternatives: [],
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
  assert.match(expanded, /<dim>reason · <\/dim><muted>The invariant is unclear<\/muted>/);
  assert.match(expanded, /evidence · <\/dim><muted>The current behavior differs across callers/);
  assert.match(expanded, /<dim>revisits · <\/dim><muted>question:earlier<\/muted>/);
  assert.match(expanded, /skill · <\/dim><muted>\/skills\/specify\/SKILL\.md/);
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
          protocol: "developer/v4",
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
              status: "open",
              resolutionOwner: "agent",
              gate: "none",
              resolutionCriteria: "Observe the rendered UI.",
              sourceRouteId: "route:render",
            },
          ],
          questionUpdates: [],
        },
      },
      { expanded: true, isPartial: false, isError: false },
      theme,
      {},
    ),
  );
  assert.match(expanded, /<warning>needs-evidence/);
  assert.match(expanded, /A browser observation is still missing\./);
  assert.match(expanded, /basis · <\/dim><muted>Unit tests cover only the pure function/);
  assert.match(expanded, /artifact · <\/dim><muted>pnpm test/);
  assert.match(expanded, /opened agent\/none · <\/dim><warning>What does the rendered UI show\?/);

  const markdownSurface = judgment.renderResult(
    {
      content: [],
      details: {
        protocol: "developer/v3",
        kind: "judgment",
        routeId: "route:markdown",
        question: "Which claims are supported?",
        owner: "verify",
        status: "resolved",
        result:
          "## Evidence matrix\n\n| Claim | Evidence | Status |\n| --- | --- | --- |\n| UI state | Browser observation | supported |",
        basis: ["Observed in browser"],
        artifacts: [],
        openedQuestions: [],
        changedArtifacts: false,
      },
    },
    { expanded: true, isPartial: false, isError: false },
    theme,
    {},
  );
  const markdownOutput = markdownSurface.render(100).join("\n");
  assert.match(markdownOutput, /Evidence matrix/);
  assert.match(markdownOutput, /Claim/);
  assert.match(markdownOutput, /Browser observation/);

  assert.equal(judgment.renderShell, "self");
  const blockedCall = renderedText(
    judgment.renderCall({ status: "blocked", result: "External access is unavailable." }, theme, {}),
  );
  assert.match(blockedCall, /<error>blocked<\/error>/);
});
