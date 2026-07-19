import {
  DynamicBorder,
  type ExtensionCommandContext,
  type Theme,
  type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  matchesKey,
  type SelectItem,
  SelectList,
  Text,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import {
  protocolState,
  type DeveloperMode,
  type DeveloperState,
  type PendingQuestion,
  type ProtocolState,
} from "./state.ts";

export type DeveloperAction = "status" | "questions" | DeveloperMode;

function modeName(mode: DeveloperMode): string {
  if (mode === "on") return "adaptive";
  return mode;
}

function protocolColor(value: ProtocolState): ThemeColor {
  if (value === "blocked") return "error";
  if (value === "needs-evidence") return "warning";
  if (value === "needs-judgment") return "accent";
  return "dim";
}

function modeColor(mode: DeveloperMode): ThemeColor {
  if (mode === "strict") return "warning";
  if (mode === "on") return "accent";
  return "dim";
}

export function renderDeveloperFooter(state: DeveloperState, theme: Theme): string {
  const currentProtocol = protocolState(state);
  const target = state.activeRoute?.owner ?? "none";
  return (
    theme.fg("accent", "developer") +
    theme.fg("dim", " · ") +
    theme.fg(modeColor(state.mode), modeName(state.mode)) +
    theme.fg("dim", " · ") +
    theme.fg(protocolColor(currentProtocol), currentProtocol) +
    theme.fg("dim", ` · ${target}`)
  );
}

export function developerActionItems(state: DeveloperState): SelectItem[] {
  const currentProtocol = protocolState(state);
  const items: SelectItem[] = [
    {
      value: "status",
      label: "Inspect status",
      description: `${modeName(state.mode)} · ${currentProtocol} · ${state.pendingQuestions.length} open`,
    },
  ];
  if (state.pendingQuestions.length > 0) {
    items.push({
      value: "questions",
      label: "Revisit an open question",
      description: `Choose from ${state.pendingQuestions.length} unresolved question(s) and prepare the editor`,
    });
  }
  items.push(
    {
      value: "on",
      label: state.mode === "on" ? "Adaptive mode (active)" : "Adaptive mode",
      description: "Route judgments adaptively while preserving the current active tool set",
    },
    {
      value: "strict",
      label: state.mode === "strict" ? "Strict mode (active)" : "Strict mode",
      description: "Require a direct route before Pi built-in mutation tools become active",
    },
    {
      value: "off",
      label: state.mode === "off" ? "Off (active)" : "Turn off",
      description: "Clear Developer protocol state and remove its persistent UI",
    },
  );
  return items;
}

export function pendingQuestionItems(questions: PendingQuestion[]): SelectItem[] {
  return questions.map((question) => ({
    value: question.id,
    label: question.question,
    description: `${question.status} · ${question.id}`,
  }));
}

interface SelectDialogOptions {
  title: string;
  subtitle: string;
  items: SelectItem[];
  width: number;
  maxVisible: number;
  maxPrimaryColumnWidth?: number;
}

async function showSelectDialog(
  ctx: ExtensionCommandContext,
  options: SelectDialogOptions,
): Promise<string | undefined> {
  const result = await ctx.ui.custom<string | null>(
    (tui, theme, _keybindings, done) => {
      const container = new Container();
      const title = new Text("", 1, 0);
      const subtitle = new Text("", 1, 0);
      const hint = new Text("", 1, 0);
      const updateText = () => {
        title.setText(theme.fg("accent", theme.bold(options.title)));
        subtitle.setText(theme.fg("muted", options.subtitle));
        hint.setText(theme.fg("dim", "↑↓ navigate · enter select · esc cancel"));
      };
      updateText();

      const list = new SelectList(
        options.items,
        Math.min(options.items.length, options.maxVisible),
        {
          selectedPrefix: (text) => theme.fg("accent", text),
          selectedText: (text) => theme.fg("accent", text),
          description: (text) => theme.fg("muted", text),
          scrollInfo: (text) => theme.fg("dim", text),
          noMatch: (text) => theme.fg("warning", text),
        },
        options.maxPrimaryColumnWidth
          ? { minPrimaryColumnWidth: 24, maxPrimaryColumnWidth: options.maxPrimaryColumnWidth }
          : undefined,
      );
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
        width: options.width,
        maxHeight: Math.min(options.maxVisible + 7, 20),
        margin: 1,
      },
    },
  );
  return result ?? undefined;
}

export async function showDeveloperActionSelector(
  ctx: ExtensionCommandContext,
  state: DeveloperState,
): Promise<DeveloperAction | undefined> {
  const result = await showSelectDialog(ctx, {
    title: "Developer control",
    subtitle: `Current · ${modeName(state.mode)} · ${protocolState(state)}`,
    items: developerActionItems(state),
    width: 78,
    maxVisible: 6,
  });
  if (result === "status" || result === "questions" || result === "on" || result === "strict" || result === "off") {
    return result;
  }
  return undefined;
}

export async function showPendingQuestionSelector(
  ctx: ExtensionCommandContext,
  questions: PendingQuestion[],
): Promise<string | undefined> {
  if (questions.length === 0) return undefined;
  return showSelectDialog(ctx, {
    title: "Revisit an open Developer question",
    subtitle: "Selection prepares an editable prompt; protocol state changes only after the route is judged",
    items: pendingQuestionItems(questions),
    width: 96,
    maxVisible: 10,
    maxPrimaryColumnWidth: 52,
  });
}

export class DeveloperWidget {
  private readonly state: DeveloperState;
  private readonly theme: Theme;

  constructor(state: DeveloperState, theme: Theme) {
    this.state = state;
    this.theme = theme;
  }

  render(width: number): string[] {
    const lines: string[] = [];
    if (this.state.activeRoute) {
      lines.push(
        truncateToWidth(
          `${this.theme.fg("accent", "◆ route")} ${this.theme.fg("muted", "·")} ${this.theme.fg("accent", this.state.activeRoute.owner)} ${this.theme.fg("muted", this.state.activeRoute.question)}`,
          width,
          "…",
        ),
      );
    }
    for (const question of this.state.pendingQuestions.slice(0, 3)) {
      lines.push(
        truncateToWidth(
          `${this.theme.fg(question.status === "blocked" ? "error" : "warning", "? open")} ${this.theme.fg("dim", "·")} ${this.theme.fg("muted", question.question)}`,
          width,
          "…",
        ),
      );
    }
    if (this.state.pendingQuestions.length > 3) {
      lines.push(this.theme.fg("dim", `  +${this.state.pendingQuestions.length - 3} more open questions`));
    }
    return lines;
  }

  invalidate(): void {}
}

export interface DeveloperStatusView {
  state: DeveloperState;
  activeTools: string[];
  availableSkills: string[];
}

export class DeveloperStatusPanel {
  private cachedWidth?: number;
  private cachedLines?: string[];
  private readonly view: DeveloperStatusView;
  private readonly theme: Theme;
  private readonly onClose: () => void;

  constructor(view: DeveloperStatusView, theme: Theme, onClose: () => void) {
    this.view = view;
    this.theme = theme;
    this.onClose = onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "enter") || matchesKey(data, "ctrl+c")) {
      this.onClose();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const panelWidth = Math.max(20, width);
    const innerWidth = Math.max(18, panelWidth - 2);
    const rows: string[] = [];
    const border = (text: string) => this.theme.fg("borderMuted", text);
    const row = (content = "") => `${border("│")}${truncateToWidth(content, innerWidth, "…", true)}${border("│")}`;
    const addWrapped = (label: string, value: string, color: ThemeColor = "muted", maxLines = 2) => {
      const prefix = `  ${this.theme.fg("dim", `${label} ·`)} `;
      const wrapped = wrapTextWithAnsi(prefix + this.theme.fg(color, value), innerWidth).slice(0, maxLines);
      for (const line of wrapped) rows.push(row(line));
    };
    const section = (title: string) => rows.push(row(`  ${this.theme.fg("accent", this.theme.bold(title))}`));

    rows.push(border(`╭${"─".repeat(innerWidth)}╮`));
    rows.push(row(`  ${this.theme.fg("accent", this.theme.bold("Developer status"))}`));
    rows.push(row());

    const state = this.view.state;
    const currentProtocol = protocolState(state);
    rows.push(
      row(
        `  mode ${this.theme.fg(modeColor(state.mode), modeName(state.mode))}` +
          this.theme.fg("dim", " · ") +
          `protocol ${this.theme.fg(protocolColor(currentProtocol), currentProtocol)}` +
          this.theme.fg("dim", " · ") +
          `target ${this.theme.fg("muted", state.activeRoute?.owner ?? "none")}`,
      ),
    );
    rows.push(row());

    section("Active route");
    if (state.activeRoute) {
      addWrapped("id", state.activeRoute.routeId, "dim", 1);
      addWrapped("question", state.activeRoute.question, "text");
      addWrapped("reason", state.activeRoute.reason);
      addWrapped("skill", state.activeRoute.methodLocation ?? "direct action", "dim", 1);
      addWrapped("known evidence", String(state.activeRoute.knownEvidence.length), "muted", 1);
    } else {
      addWrapped("state", "No route is currently waiting for judgment.", "dim", 1);
    }

    rows.push(row());
    section(`Open questions · ${state.pendingQuestions.length}`);
    if (state.pendingQuestions.length === 0) {
      addWrapped("state", "No unresolved Developer questions.", "dim", 1);
    } else {
      for (const question of state.pendingQuestions.slice(0, 4)) {
        addWrapped(
          question.status === "blocked" ? "blocked" : "needs evidence",
          question.question,
          question.status === "blocked" ? "error" : "warning",
          1,
        );
      }
      if (state.pendingQuestions.length > 4) {
        addWrapped("more", String(state.pendingQuestions.length - 4), "dim", 1);
      }
    }

    rows.push(row());
    section("Last judgment");
    if (state.lastJudgment) {
      addWrapped("status", state.lastJudgment.status, protocolColor(
        state.lastJudgment.status === "blocked"
          ? "blocked"
          : state.lastJudgment.status === "needs-evidence"
            ? "needs-evidence"
            : "idle",
      ), 1);
      addWrapped("result", state.lastJudgment.result, "muted");
      addWrapped(
        "evidence",
        `${state.lastJudgment.basis.length} basis · ${state.lastJudgment.artifacts.length} artifacts`,
        "dim",
        1,
      );
    } else {
      addWrapped("state", "No judgment has been recorded on this branch.", "dim", 1);
    }

    rows.push(row());
    addWrapped(
      "resources",
      `${this.view.availableSkills.length} skills · ${this.view.activeTools.length} active tools`,
      "dim",
      1,
    );
    rows.push(row());
    rows.push(row(`  ${this.theme.fg("dim", "enter/esc close · /develop questions revisits open work")}`));
    rows.push(border(`╰${"─".repeat(innerWidth)}╯`));

    this.cachedWidth = width;
    this.cachedLines = rows;
    return rows;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export async function showDeveloperStatus(
  ctx: ExtensionCommandContext,
  view: DeveloperStatusView,
): Promise<void> {
  await ctx.ui.custom<void>((_tui, theme, _keybindings, done) =>
    new DeveloperStatusPanel(view, theme, () => done()));
}

export function prepareQuestionPrompt(ctx: ExtensionCommandContext, question: PendingQuestion): void {
  const prompt = `Revisit Developer question ${question.id}: ${question.question}`;
  const current = ctx.ui.getEditorText();
  ctx.ui.setEditorText(current.trim() ? `${current.trimEnd()}\n\n${prompt}` : prompt);
}
