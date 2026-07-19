import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

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

const theme = {
  bold: (text: string) => text,
  fg: (_color: string, text: string) => text,
} as Theme;

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
      protocol: "developer/v2",
      kind: "route",
      routeId: "route:active",
      question: "Does the rendered interface preserve the product invariant?",
      owner: "verify",
      reason: "Unit tests do not cover the rendered state.",
      knownEvidence: ["Pure-function tests pass."],
      methodLocation: "/skills/verify/SKILL.md",
    },
    lastJudgment: {
      protocol: "developer/v2",
      kind: "judgment",
      routeId: "route:earlier",
      question: "Is the implementation complete?",
      owner: "verify",
      status: "needs-evidence",
      result: "A browser observation remains.",
      basis: ["Unit tests pass."],
      openedQuestions: [openQuestion],
      artifacts: ["pnpm check"],
    },
    pendingQuestions: [openQuestion],
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

test("Developer control uses a descriptive SelectList overlay", async () => {
  let rendered = "";
  let overlayOptions: unknown;
  const ctx = {
    ui: {
      async custom(factory: any, options: unknown) {
        overlayOptions = options;
        let selected: unknown;
        const component = await factory(
          { requestRender() {} },
          theme,
          {},
          (value: unknown) => {
            selected = value;
          },
        );
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
  assert.deepEqual(overlayOptions, {
    overlay: true,
    overlayOptions: { anchor: "center", width: 78, maxHeight: 13, margin: 1 },
  });
});

test("pending selection returns an exact protocol question ID", async () => {
  const ctx = {
    ui: {
      async custom(factory: any) {
        let selected: unknown;
        const component = await factory(
          { requestRender() {} },
          theme,
          {},
          (value: unknown) => {
            selected = value;
          },
        );
        component.handleInput("\r");
        return selected;
      },
    },
  };
  assert.equal(await showPendingQuestionSelector(ctx as never, [openQuestion]), openQuestion.id);
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
  assert.ok(lines.length <= 30);
  assert.ok(lines.every((line) => visibleWidth(line) <= 88));
  panel.handleInput("\r");
  assert.equal(closed, true);
});

test("preparing an open question preserves existing editor text without mutating protocol state", () => {
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
  assert.match(editor, /^Existing draft\n\nRevisit Developer question question:route:earlier:/);
  assert.match(editor, /Which browser observation is still missing/);
});
