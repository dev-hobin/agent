import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, visibleWidth } from "@earendil-works/pi-tui";

import type { DeveloperState, PendingQuestion } from "../extensions/state.ts";
import {
  DeveloperStatusPanel,
  DeveloperWidget,
  developerActionItems,
  pendingQuestionItems,
  prepareQuestionPrompt,
  renderDeveloperFooter,
  showDeveloperActionSelector,
  showPendingQuestionSelector,
} from "../extensions/tui.ts";

interface InteractiveTestComponent extends Component {
  handleInput(data: string): void;
}

type TestComponentFactory = (
  tui: { requestRender(): void },
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
    if (binding === "tui.select.confirm") return data === "\r";
    if (binding === "tui.select.cancel") return data === "\u001b" || data === "\u0003";
    return false;
  },
};

const openQuestion: PendingQuestion = {
  id: "question:route:earlier",
  question: "Which browser observation is still missing?",
  status: "needs-evidence",
  sourceRouteId: "route:earlier",
};

function activeState(): DeveloperState {
  return {
    mode: "strict",
    activeRoute: {
      protocol: "developer/v3",
      kind: "route",
      routeId: "route:active",
      question: "Does the rendered interface preserve the product invariant?",
      owner: "verify",
      reason: "Unit tests do not cover the rendered state.",
      knownEvidence: ["Pure-function tests pass."],
      methodLocation: "/skills/verify/SKILL.md",
    },
    lastJudgment: {
      protocol: "developer/v3",
      kind: "judgment",
      routeId: "route:earlier",
      question: "Is the implementation complete?",
      owner: "verify",
      status: "needs-evidence",
      result: "A browser observation remains.",
      basis: ["Unit tests pass."],
      openedQuestions: [openQuestion],
      artifacts: ["pnpm check"],
      changedArtifacts: false,
    },
    pendingQuestions: [openQuestion],
    implementationFramingRequired: false,
    verificationRequired: false,
  };
}

test("Developer assigns footer, widget, action list, and pending list distinct information roles", () => {
  const state = activeState();
  assert.equal(renderDeveloperFooter(state, theme), "developer · strict · needs-judgment · verify");

  const widgetLines = new DeveloperWidget(state, theme).render(64);
  assert.match(widgetLines[0], /^◆ route · verify/);
  assert.match(widgetLines[1], /^\? open · Which browser observation/);
  assert.ok(widgetLines.every((line) => visibleWidth(line) <= 64));

  const actions = developerActionItems(state);
  assert.deepEqual(actions.map((item) => item.value), ["status", "questions", "on", "strict", "off"]);
  assert.match(actions.find((item) => item.value === "strict")?.label ?? "", /active/);
  assert.match(actions.find((item) => item.value === "questions")?.description ?? "", /1 unresolved/);

  const questions = pendingQuestionItems(state.pendingQuestions);
  assert.equal(questions[0]?.value, openQuestion.id);
  assert.equal(questions[0]?.label, openQuestion.question);
  assert.match(questions[0]?.description ?? "", /needs-evidence/);
});

test("Developer control uses a compact selection overlay with inline wrapping", async () => {
  let rendered = "";
  let overlayOptions: unknown;
  const ctx = {
    ui: {
      async custom(factory: TestComponentFactory, options: unknown) {
        overlayOptions = options;
        let selected: unknown;
        const component = await factory({ requestRender() {} }, theme, keybindings, (value: unknown) => {
          selected = value;
        });
        rendered = component.render(78).join("\n");
        component.handleInput("\u001b[B");
        component.handleInput("\r");
        return selected;
      },
    },
  };

  const result = await showDeveloperActionSelector(ctx as never, activeState());
  assert.equal(result, "questions");
  assert.match(rendered, /Developer control/);
  assert.match(rendered, /Revisit an open question/);
  assert.match(rendered, /strict · needs-judgment · 1 open/);
  assert.doesNotMatch(rendered, /Selected detail|scroll detail/);
  const renderedLines = rendered.split("\n");
  assert.match(renderedLines[0] ?? "", /^╭.*╮$/);
  assert.match(renderedLines.at(-1) ?? "", /^╰.*╯$/);
  assert.ok(renderedLines.slice(1, -1).every((line) => line.startsWith("│") && line.endsWith("│")));
  assert.ok(renderedLines.every((line) => visibleWidth(line) <= 78));
  assert.deepEqual(overlayOptions, {
    overlay: true,
    overlayOptions: { anchor: "center", width: 78, maxHeight: 17, margin: 1 },
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
        const component = await factory({ requestRender() {} }, ansiTheme, keybindings, (value: unknown) => {
          selected = value;
        });
        rendered = component.render(52).join("\n");
        component.handleInput("\r");
        return selected;
      },
    },
  };
  assert.equal(await showPendingQuestionSelector(ctx as never, [longQuestion]), longQuestion.id);
  assert.match(rendered, /terminal line\?/);
  assert.doesNotMatch(rendered, /…/);
  assert.equal(rendered.match(/Which browser observation/g)?.length, 1);
  assert.doesNotMatch(rendered, /question:route:earlier/);
  assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 52));
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
  assert.match(output, /A browser observation remains/);
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
        const component = await factory({ requestRender() {} }, transparentTheme, keybindings, () => {});
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

test("preparing an open question preserves existing editor text without exposing its internal ID", () => {
  let editor = "Existing draft";
  const ctx = {
    ui: {
      getEditorText: () => editor,
      setEditorText: (value: string) => {
        editor = value;
      },
    },
  };
  prepareQuestionPrompt(ctx as never, openQuestion);
  assert.match(editor, /^Existing draft\n\nRevisit this Developer question:/);
  assert.match(editor, /Which browser observation is still missing/);
  assert.doesNotMatch(editor, /question:route:earlier/);
});
