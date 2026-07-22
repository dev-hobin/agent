import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, visibleWidth } from "@earendil-works/pi-tui";

import type { DeveloperState, PendingQuestion } from "../extensions/state.ts";
import {
  DeveloperStatusPanel,
  DeveloperWidget,
  developerActionItems,
  editQuestionResolutionRequest,
  pendingQuestionItems,
  promptImmediateUserQuestion,
  questionResolutionPrompt,
  renderDeveloperFooter,
  showDeveloperActionSelector,
  showDeveloperStatus,
  showPendingQuestionSelector,
} from "../extensions/tui.ts";

interface InteractiveTestComponent extends Component {
  handleInput(data: string): void;
}

type TestComponentFactory = (
  tui: {
    requestRender(): void;
    terminal?: { rows: number; write(data: string): void };
  },
  theme: Theme,
  keybindings: unknown,
  done: (value: unknown) => void,
) => InteractiveTestComponent | Promise<InteractiveTestComponent>;

const theme = {
  bold: (text: string) => text,
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
} as Theme;

const ansiTheme = {
  ...theme,
  bold: (text: string) => `\u001b[1m${text}\u001b[22m`,
  fg: (_color: string, text: string) => `\u001b[38;5;7m${text}\u001b[39m`,
} as Theme;

const keybindings = {
  matches(data: string, binding: string): boolean {
    if (binding === "tui.select.up") return data === "\u001b[A";
    if (binding === "tui.select.down") return data === "\u001b[B";
    if (binding === "tui.select.pageUp") return data === "\u001b[5~";
    if (binding === "tui.select.pageDown") return data === "\u001b[6~";
    if (binding === "tui.select.confirm") return data === "\r";
    if (binding === "tui.select.cancel") return data === "\u001b" || data === "\u0003";
    return false;
  },
};

const openQuestion: PendingQuestion = {
  id: "question:route:earlier",
  question: "Which browser observation is still missing?",
  status: "open",
  resolutionOwner: "agent",
  gate: "none",
  resolutionCriteria: "Observe the rendered browser state.",
  sourceRouteId: "route:earlier",
};

const choiceQuestion: PendingQuestion = {
  ...openQuestion,
  id: "question:product-controls",
  question: "Which controls should be exposed?",
  resolutionOwner: "user",
  gate: "before-direct",
  resolutionCriteria: "The product owner selects every control policy.",
  responseSpec: {
    kind: "choice-form",
    fields: [
      {
        id: "A",
        prompt: "Choose the mobile-view policy",
        options: [
          { value: "A1", label: "Expose all" },
          {
            value: "A2",
            label: "Expose selected components",
            detailPrompt: "List the selected component types.",
          },
        ],
      },
      {
        id: "B1",
        prompt: "Expose the catalog icon control?",
        options: [
          { value: "show", label: "Expose" },
          { value: "hide", label: "Hide" },
        ],
      },
    ],
  },
};

function activeState(): DeveloperState {
  const activeRoute = {
    protocol: "developer/v4" as const,
    kind: "route" as const,
    routeId: "route:active",
    question: "Does the rendered interface preserve the product invariant?",
    owner: "verify",
    reason: "Unit tests do not cover the rendered state.",
    knownEvidence: ["Pure-function tests pass."],
    consideredAlternatives: [],
    methodLocation: "/skills/verify/SKILL.md",
  };
  const earlierRoute = {
    ...activeRoute,
    routeId: "route:earlier",
    question: "Is the implementation complete?",
  };
  const lastJudgment = {
    protocol: "developer/v4" as const,
    kind: "judgment" as const,
    routeId: "route:earlier",
    question: "Is the implementation complete?",
    owner: "verify",
    status: "needs-evidence" as const,
    result: "A browser observation remains.",
    basis: ["Unit tests pass."],
    openedQuestions: [openQuestion],
    questionUpdates: [],
    artifacts: ["pnpm check"],
    changedArtifacts: false,
  };
  return {
    mode: "strict",
    activeRoute,
    lastRoute: activeRoute,
    lastJudgment,
    routeHistory: [earlierRoute, activeRoute],
    judgmentHistory: [lastJudgment],
    pendingQuestions: [openQuestion],
    rerouteRequired: false,
    implementationFramingRequired: false,
    verificationRequired: false,
  };
}

test("Developer assigns footer, widget, action list, and pending list distinct information roles", () => {
  const state = activeState();
  assert.equal(renderDeveloperFooter(state, theme), "developer · strict · needs-judgment · verify");

  const widgetLines = new DeveloperWidget(state, theme).render(64);
  assert.match(widgetLines[0], /^◆ route · verify/);
  assert.match(widgetLines[1], /^\? evidence · none · Which browser observation/);
  assert.ok(widgetLines.every((line) => visibleWidth(line) <= 64));

  const actions = developerActionItems(state);
  assert.deepEqual(
    actions.map((item) => item.value),
    ["status", openQuestion.id, "on", "strict", "off"],
  );
  assert.match(actions.find((item) => item.value === "strict")?.label ?? "", /active/);
  assert.match(
    actions.find((item) => item.value === openQuestion.id)?.description ?? "",
    /ask Pi to investigate/,
  );

  const questions = pendingQuestionItems(state.pendingQuestions);
  assert.equal(questions[0]?.value, openQuestion.id);
  assert.equal(questions[0]?.label, openQuestion.question);
  assert.match(questions[0]?.description ?? "", /open · agent · none/);
  assert.match(questions[0]?.description ?? "", /ask Pi to investigate/);
});

test("implementation framing is rendered as a direct gate rather than a next-step prediction", () => {
  const state = { ...activeState(), implementationFramingRequired: true };
  const widgetLines = new DeveloperWidget(state, theme).render(100);

  assert.ok(widgetLines.includes("◇ gate · frame implementation before direct (sketch or signal)"));
  assert.equal(
    widgetLines.some((line) => line.includes("next · sketch")),
    false,
  );
});

test("pending question UI distinguishes agent evidence from required user answers", () => {
  const userQuestion: PendingQuestion = {
    ...openQuestion,
    id: "question:user-decision",
    question: "Should empty mean absent or cleared?",
    context: "Choose one:\n- A1: absent\n- A2: explicitly cleared",
    resolutionOwner: "user",
    gate: "before-direct",
    resolutionCriteria: "The product owner chooses absent or cleared.",
  };
  const description = pendingQuestionItems([userQuestion])[0]?.description ?? "";
  assert.match(description, /user · before-direct/);
  assert.match(description, /required answer/);
  const prompt = questionResolutionPrompt(userQuestion);
  assert.match(
    prompt,
    /Decision or evidence context:\nChoose one:\n- A1: absent\n- A2: explicitly cleared/,
  );
  assert.match(prompt, /Required answer or product decision:/);
  assert.match(prompt, /Gate: before-direct/);
});

test("a new blocking user question can be answered immediately", async () => {
  let editorInitial = "";
  let overlayOptions: unknown;
  const question: PendingQuestion = {
    ...openQuestion,
    question: "Should empty mean absent or cleared?",
    context: "Choose one:\n- A1: absent\n- A2: explicitly cleared",
    resolutionOwner: "user",
    gate: "before-direct",
  };
  const ctx = {
    ui: {
      async custom(_factory: TestComponentFactory, options: unknown) {
        overlayOptions = options;
        return "answer";
      },
      async editor(_title: string, initial: string) {
        editorInitial = initial;
        return `${initial}\nA1: absent`;
      },
      notify() {},
    },
  };

  const disposition = await promptImmediateUserQuestion(ctx as never, question);

  assert.equal(disposition.kind, "answer");
  assert.match(disposition.kind === "answer" ? disposition.request : "", /A1: absent$/);
  assert.match(editorInitial, /Decision or evidence context:\nChoose one:/);
  assert.deepEqual(overlayOptions, {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: "92%",
      minWidth: 88,
      maxHeight: "88%",
      margin: 1,
    },
  });
});

test("choice response specs render field controls and submit exact structured answers", async () => {
  let customCall = 0;
  let editorInitial = "";
  const renderedControls: string[] = [];
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory) {
        customCall += 1;
        let selected: unknown;
        const component = await factory({ requestRender() {} }, theme, keybindings, (value) => {
          selected = value;
        });
        renderedControls.push(component.render(100).join("\n"));
        if (customCall === 2) component.handleInput("\u001b[B");
        component.handleInput("\r");
        return selected;
      },
      async editor(_title: string, initial: string) {
        editorInitial = initial;
        return `${initial}\n카드그룹__타일, 특장점__슬라이드_탭`;
      },
      notify() {},
    },
  };

  const disposition = await promptImmediateUserQuestion(ctx as never, choiceQuestion);

  assert.equal(customCall, 4);
  assert.match(renderedControls[1] ?? "", /A1 · Expose all/);
  assert.match(renderedControls[1] ?? "", /A2 · Expose selected components/);
  assert.match(renderedControls[2] ?? "", /show · Expose/);
  assert.match(renderedControls[3] ?? "", /A · A2 — Expose selected components/);
  assert.match(editorInitial, /List the selected component types/);
  assert.equal(disposition.kind, "answer");
  const request = disposition.kind === "answer" ? disposition.request : "";
  assert.match(request, /Structured answer:/);
  assert.match(request, /- A: A2 — Expose selected components/);
  assert.match(request, /Detail: 카드그룹__타일, 특장점__슬라이드_탭/);
  assert.match(request, /- B1: show — Expose/);
  assert.doesNotMatch(request, /question:product-controls/);
});

test("structured answer navigation backs through fields, detail, review, and edits", async () => {
  const selections: Array<string | undefined> = [
    "A1",
    undefined,
    "A2",
    "A2",
    "hide",
    "edit:0",
    "A1",
    undefined,
    "show",
    "submit",
  ];
  let customCalls = 0;
  let editorCalls = 0;
  const ctx = {
    ui: {
      async custom() {
        customCalls += 1;
        return selections.shift();
      },
      async editor(_title: string, initial: string) {
        editorCalls += 1;
        if (editorCalls === 1) return undefined;
        return `${initial}\n카드그룹__타일`;
      },
      getEditorText() {
        throw new Error("structured forms must not consume the freeform editor draft");
      },
      notify() {},
    },
  };

  const request = await editQuestionResolutionRequest(ctx as never, choiceQuestion);

  assert.equal(customCalls, 10);
  assert.equal(editorCalls, 2);
  assert.match(request ?? "", /- A: A1 — Expose all/);
  assert.match(request ?? "", /- B1: show — Expose/);
  assert.doesNotMatch(request ?? "", /Detail:/);
});

test("escape from the immediate answer editor returns to a deferable decision card", async () => {
  const selections = ["answer", "defer"];
  let customCalls = 0;
  let editorCalls = 0;
  const question: PendingQuestion = {
    ...openQuestion,
    resolutionOwner: "user",
    gate: "before-direct",
  };
  const ctx = {
    ui: {
      async custom() {
        customCalls += 1;
        return selections.shift();
      },
      async editor() {
        editorCalls += 1;
        return undefined;
      },
      notify() {},
    },
  };

  assert.deepEqual(await promptImmediateUserQuestion(ctx as never, question), {
    kind: "defer",
  });
  assert.equal(customCalls, 2);
  assert.equal(editorCalls, 1);
});

test("Developer control uses a stable, roomy selection overlay with inline wrapping", async () => {
  let rendered = "";
  let renderedAfterNavigation = "";
  let overlayOptions: unknown;
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory, options: unknown) {
        overlayOptions = options;
        let selected: unknown;
        const component = await factory(
          { requestRender() {} },
          theme,
          keybindings,
          (value: unknown) => {
            selected = value;
          },
        );
        rendered = component.render(78).join("\n");
        component.handleInput("\u001b[B");
        renderedAfterNavigation = component.render(78).join("\n");
        component.handleInput("\r");
        return selected;
      },
    },
  };

  const result = await showDeveloperActionSelector(ctx as never, activeState());
  assert.deepEqual(result, { kind: "question", questionId: openQuestion.id });
  assert.match(rendered, /Developer control/);
  assert.match(rendered, /Which browser observation is still missing\?/);
  assert.doesNotMatch(rendered, /Revisit an open question/);
  assert.match(rendered, /strict · needs-judgment · 1 open/);
  assert.doesNotMatch(rendered, /Selected detail|scroll detail/);
  const renderedLines = rendered.split("\n");
  assert.match(renderedLines[0] ?? "", /^╭.*╮$/);
  assert.match(renderedLines.at(-1) ?? "", /^╰.*╯$/);
  assert.ok(renderedLines.slice(1, -1).every((line) => line.startsWith("│") && line.endsWith("│")));
  assert.ok(renderedLines.every((line) => visibleWidth(line) <= 78));
  assert.equal(renderedAfterNavigation.split("\n").length, renderedLines.length);
  assert.deepEqual(overlayOptions, {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: "84%",
      minWidth: 78,
      maxHeight: "88%",
      margin: 1,
    },
  });
});

test("pending selection wraps the selected question and returns its exact protocol ID", async () => {
  let rendered = "";
  const longQuestion: PendingQuestion = {
    ...openQuestion,
    question:
      "Which browser observation is still missing after the narrow checkout modal wraps onto the next terminal line?",
  };
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory) {
        let selected: unknown;
        const component = await factory(
          { requestRender() {} },
          ansiTheme,
          keybindings,
          (value: unknown) => {
            selected = value;
          },
        );
        rendered = component.render(52).join("\n");
        component.handleInput("\r");
        return selected;
      },
    },
  };
  assert.equal(await showPendingQuestionSelector(ctx as never, [longQuestion]), longQuestion.id);
  assert.match(rendered, /terminal line\?/);
  assert.match(rendered, /agent · none/);
  assert.match(rendered, /ask Pi to/);
  assert.match(rendered, /investigate/);
  assert.doesNotMatch(rendered, /…/);
  assert.equal(rendered.match(/Which browser observation/g)?.length, 1);
  assert.doesNotMatch(rendered, /question:route:earlier/);
  assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 52));
});

test("selection modals support wheel, page, and jump navigation without leaking mouse tracking", async () => {
  const writes: string[] = [];
  let rendered = "";
  const questions = Array.from(
    { length: 10 },
    (_, index): PendingQuestion => ({
      ...openQuestion,
      id: `question:${index}`,
      question: `Question ${index}`,
    }),
  );
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory) {
        let selected: unknown;
        const component = await factory(
          {
            requestRender() {},
            terminal: { rows: 40, write: (data: string) => writes.push(data) },
          },
          theme,
          keybindings,
          (value: unknown) => {
            selected = value;
          },
        );
        rendered = component.render(78).join("\n");
        component.handleInput("\u001b[6~");
        component.handleInput("\u001b[<64;12;8M");
        component.handleInput("\u001b[F");
        component.handleInput("\u001b[<64;12;8M");
        component.handleInput("\r");
        return selected;
      },
    },
  };

  assert.equal(await showPendingQuestionSelector(ctx as never, questions), "question:6");
  assert.match(rendered, /wheel\/↑↓/);
  assert.match(rendered, /PgUp\/PgDn/);
  assert.deepEqual(writes, ["\u001b[?1000h\u001b[?1006h", "\u001b[?1006l\u001b[?1000l"]);
});

test("status overlay scopes terminal mouse tracking to the modal lifetime", async () => {
  const writes: string[] = [];
  let closed = false;
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory) {
        const component = await factory(
          {
            requestRender() {},
            terminal: { rows: 40, write: (data: string) => writes.push(data) },
          },
          theme,
          keybindings,
          () => {
            closed = true;
          },
        );
        component.render(88);
        component.handleInput("\u001b[<65;12;8M");
        component.handleInput("\r");
      },
    },
  };

  await showDeveloperStatus(ctx as never, {
    state: activeState(),
    activeTools: ["read"],
    availableSkills: ["verify"],
  });
  assert.equal(closed, true);
  assert.deepEqual(writes, ["\u001b[?1000h\u001b[?1006h", "\u001b[?1006l\u001b[?1000l"]);
});

test("status panel is bounded, branch-grounded, and keyboard dismissible", () => {
  let closed = false;
  const panel = new DeveloperStatusPanel(
    {
      state: activeState(),
      activeTools: ["read", "developer_route_question", "developer_record_judgment"],
      availableSkills: ["verify", "specify"],
    },
    theme,
    () => {
      closed = true;
    },
  );
  const lines = panel.render(88);
  const output = lines.join("\n");
  assert.match(output, /Developer status/);
  assert.match(output, /Does the rendered interface preserve the product invariant/);
  assert.match(output, /Open questions · 1/);
  assert.match(output, /Judgment history · 1/);
  assert.match(output, /A browser observation/);
  assert.match(output, /remains\./);
  assert.match(output, /2 skills · 3 active tools/);
  assert.ok(lines.length <= 28);
  assert.ok(lines.every((line) => visibleWidth(line) <= 88));

  const narrowLines = panel.render(52);
  assert.match(narrowLines.join("\n"), /question · Does the rendered interface preserve/);
  assert.match(narrowLines.join("\n"), / {13}the product invariant\?/);
  assert.ok(narrowLines.every((line) => visibleWidth(line) <= 52));
  panel.handleInput("\r");
  assert.equal(closed, true);
});

test("status panel keeps a fixed height while scrolling so a centered modal does not move", () => {
  let renderRequests = 0;
  const panel = new DeveloperStatusPanel(
    {
      state: activeState(),
      activeTools: ["read"],
      availableSkills: ["verify"],
    },
    theme,
    () => {},
    {
      viewportHeight: 14,
      requestRender: () => {
        renderRequests += 1;
      },
    },
  );
  const initial = panel.render(72);
  panel.handleInput("\u001b[B");
  const afterDown = panel.render(72);
  panel.handleInput("\u001b[A");
  const afterUp = panel.render(72);
  panel.handleInput("\u001b[6~");
  const afterPageDown = panel.render(72);
  panel.handleInput("\u001b[<64;12;8M");
  const afterWheelUp = panel.render(72);
  panel.handleInput("\u001b[F");
  const afterEnd = panel.render(72);
  panel.handleInput("\u001b[H");
  const afterHome = panel.render(72);

  assert.equal(initial.length, 14);
  assert.equal(afterDown.length, initial.length);
  assert.equal(afterUp.length, initial.length);
  assert.equal(afterPageDown.length, initial.length);
  assert.equal(afterWheelUp.length, initial.length);
  assert.equal(afterEnd.length, initial.length);
  assert.deepEqual(afterHome, initial);
  assert.notDeepEqual(afterPageDown, initial);
  assert.match(afterEnd.join("\n"), /wheel\/↑↓/);
  assert.equal(renderRequests, 6);
});

test("Developer overlays do not paint full-panel backgrounds", async () => {
  let backgroundCalls = 0;
  const transparentTheme = {
    ...theme,
    bg: (_color: string, text: string) => {
      backgroundCalls += 1;
      return text;
    },
  } as Theme;
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory) {
        const component = await factory(
          { requestRender() {} },
          transparentTheme,
          keybindings,
          () => {},
        );
        component.render(78);
        return null;
      },
    },
  };

  await showDeveloperActionSelector(ctx as never, activeState());
  new DeveloperStatusPanel(
    { state: activeState(), activeTools: [], availableSkills: [] },
    transparentTheme,
    () => {},
  ).render(78);
  assert.equal(backgroundCalls, 0);
});

test("question resolution opens an answerable editor without exposing its internal ID", async () => {
  let editorInitial = "";
  const ctx = {
    ui: {
      getEditorText: () => "Existing draft",
      async editor(_title: string, initial: string) {
        editorInitial = initial;
        return `${initial}\nThe browser preserves the selected value.`;
      },
    },
  };
  const request = await editQuestionResolutionRequest(ctx as never, openQuestion);
  assert.match(editorInitial, /^Existing draft\n\nResolve this open Developer question\./);
  assert.match(editorInitial, /Resolution owner: agent/);
  assert.match(editorInitial, /Evidence or investigation request for Pi:/);
  assert.match(request ?? "", /The browser preserves the selected value/);
  assert.doesNotMatch(request ?? "", /question:route:earlier/);
  assert.doesNotMatch(questionResolutionPrompt(openQuestion), /question:route:earlier/);
  assert.doesNotMatch(questionResolutionPrompt(openQuestion), /Decision or evidence context:/);
});
