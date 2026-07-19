import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";

import learning from "../extensions/learning.ts";
import {
  learningActionItems,
  prepareLearningAction,
  showLearningActionSelector,
} from "../extensions/tui.ts";

const theme = {
  bold: (text: string) => text,
  fg: (_color: string, text: string) => text,
} as Theme;

test("Learning presents its independent leaves as outcomes rather than a fixed sequence", () => {
  const items = learningActionItems();
  assert.deepEqual(
    items.map((item) => item.value),
    [
      "technical-reading",
      "opensource-reading",
      "conceptualize",
      "patternize",
      "exercise",
      "validate",
    ],
  );
  assert.match(items[0]?.label ?? "", /Read technical material/);
  assert.match(items[5]?.description ?? "", /read-only structural check/);
});

test("Learning selector uses a descriptive SelectList overlay", async () => {
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

  assert.equal(await showLearningActionSelector(ctx as never), "opensource-reading");
  assert.match(rendered, /Choose a Learning approach/);
  assert.match(rendered, /Study open-source code/);
  assert.match(rendered, /does not send or impose a workflow order/);
  assert.deepEqual(overlayOptions, {
    overlay: true,
    overlayOptions: { anchor: "center", width: 78, maxHeight: 13, margin: 1 },
  });
});

test("Learning action preparation preserves a draft and replaces only its Learning route", () => {
  let editor = "Explain how this parser recovers after malformed input.";
  const ctx = {
    ui: {
      getEditorText: () => editor,
      setEditorText(value: string) {
        editor = value;
      },
    },
  };

  prepareLearningAction(ctx as never, "opensource-reading");
  assert.equal(
    editor,
    "/skill:opensource-reading Explain how this parser recovers after malformed input.",
  );

  prepareLearningAction(ctx as never, "exercise");
  assert.equal(
    editor,
    "/skill:exercise Explain how this parser recovers after malformed input.",
  );

  prepareLearningAction(ctx as never, "validate");
  assert.match(editor, /^\/skill:exercise Explain how this parser/);
  assert.match(editor, /\n\nValidate this saved learning artifact.*: @$/);
});

test("/learning registers argument completion and prepares an explicit leaf in the editor", async () => {
  let command: any;
  let editor = "Turn these observations into a durable mental model.";
  const notifications: Array<{ message: string; level: string }> = [];
  learning({
    registerTool() {},
    registerCommand(name: string, definition: unknown) {
      assert.equal(name, "learning");
      command = definition;
    },
  } as never);

  assert.deepEqual(command.getArgumentCompletions("con"), [
    { value: "conceptualize", label: "conceptualize" },
  ]);
  await command.handler("conceptualize", {
    mode: "tui",
    ui: {
      getEditorText: () => editor,
      setEditorText(value: string) {
        editor = value;
      },
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
    },
  });

  assert.equal(
    editor,
    "/skill:conceptualize Turn these observations into a durable mental model.",
  );
  assert.deepEqual(notifications, [
    { message: "conceptualize prepared in the editor.", level: "info" },
  ]);
});
