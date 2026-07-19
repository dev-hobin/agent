import {
  DynamicBorder,
  type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  type SelectItem,
  SelectList,
  Text,
} from "@earendil-works/pi-tui";

export const LEARNING_ROUTES = [
  "technical-reading",
  "opensource-reading",
  "conceptualize",
  "patternize",
  "exercise",
] as const;

export type LearningRoute = (typeof LEARNING_ROUTES)[number];
export type LearningAction = LearningRoute | "validate";

const routeSet = new Set<string>(LEARNING_ROUTES);
const learningSkillPrefix = new RegExp(
  `^/skill:(${LEARNING_ROUTES.join("|")})(?:\\s+|$)`,
);

export function isLearningAction(value: string): value is LearningAction {
  return value === "validate" || routeSet.has(value);
}

export function learningActionItems(): SelectItem[] {
  return [
    {
      value: "technical-reading",
      label: "Read technical material",
      description: "Books, documentation, specifications, articles, PDFs, or webpages",
    },
    {
      value: "opensource-reading",
      label: "Study open-source code",
      description: "Trace one evidence-backed repository slice through docs, tests, and code",
    },
    {
      value: "conceptualize",
      label: "Form or update a concept",
      description: "Turn source-bound learning into a durable concept or graph update",
    },
    {
      value: "patternize",
      label: "Build a reusable pattern",
      description: "Coordinate concepts into a workflow, decision routine, or diagnostic",
    },
    {
      value: "exercise",
      label: "Design deliberate practice",
      description: "Create retrieval, diagnosis, repair, transfer, and mastery exercises",
    },
    {
      value: "validate",
      label: "Validate a saved artifact",
      description: "Prepare a read-only structural check for a graph-shaped Markdown artifact",
    },
  ];
}

export async function showLearningActionSelector(
  ctx: ExtensionCommandContext,
): Promise<LearningAction | undefined> {
  const result = await ctx.ui.custom<string | null>(
    (tui, theme, _keybindings, done) => {
      const container = new Container();
      const title = new Text("", 1, 0);
      const subtitle = new Text("", 1, 0);
      const hint = new Text("", 1, 0);
      const updateText = () => {
        title.setText(theme.fg("accent", theme.bold("Choose a Learning approach")));
        subtitle.setText(
          theme.fg("muted", "Selection prepares the editor; it does not send or impose a workflow order"),
        );
        hint.setText(theme.fg("dim", "↑↓ navigate · enter select · esc cancel"));
      };
      updateText();

      const list = new SelectList(learningActionItems(), 6, {
        selectedPrefix: (text) => theme.fg("accent", text),
        selectedText: (text) => theme.fg("accent", text),
        description: (text) => theme.fg("muted", text),
        scrollInfo: (text) => theme.fg("dim", text),
        noMatch: (text) => theme.fg("warning", text),
      });
      list.onSelect = (item) => done(item.value);
      list.onCancel = () => done(null);

      container.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)));
      container.addChild(title);
      container.addChild(subtitle);
      container.addChild(list);
      container.addChild(hint);
      container.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)));

      return {
        render(width: number) {
          return container.render(width);
        },
        invalidate() {
          updateText();
          container.invalidate();
        },
        handleInput(data: string) {
          list.handleInput(data);
          tui.requestRender();
        },
      };
    },
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: 78,
        maxHeight: 13,
        margin: 1,
      },
    },
  );
  return result && isLearningAction(result) ? result : undefined;
}

export function prepareLearningAction(
  ctx: ExtensionCommandContext,
  action: LearningAction,
): string {
  const current = ctx.ui.getEditorText();
  if (action === "validate") {
    const instruction = "Validate this saved learning artifact with validate_learning_artifact: @";
    const next = current.trim() ? `${current.trimEnd()}\n\n${instruction}` : instruction;
    ctx.ui.setEditorText(next);
    return next;
  }

  const body = current.replace(learningSkillPrefix, "").trimStart();
  const next = body ? `/skill:${action} ${body}` : `/skill:${action} `;
  ctx.ui.setEditorText(next);
  return next;
}
