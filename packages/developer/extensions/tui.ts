import {
  type ExtensionCommandContext,
  type KeybindingsManager,
  type Theme,
  type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  matchesKey,
  type SelectItem,
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
  if (value === "needs-evidence" || value === "needs-verification") return "warning";
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
    description: question.status,
  }));
}

interface SelectDialogOptions {
  title: string;
  subtitle: string;
  items: SelectItem[];
  width: number;
  maxVisible: number;
  selectedLabelMaxLines: number;
  selectedDescriptionMaxLines: number;
}

function boundedWrappedLines(content: string, width: number, maxLines: number, ellipsis: string): string[] {
  const contentWidth = Math.max(1, width);
  const wrapped = wrapTextWithAnsi(content, contentWidth);
  const visible = wrapped.slice(0, Math.max(1, maxLines));
  if (wrapped.length > visible.length && visible.length > 0) {
    const last = visible.length - 1;
    visible[last] = truncateToWidth(visible[last] ?? "", Math.max(1, contentWidth - 1), "") + ellipsis;
  }
  return visible;
}

function renderModalFrame(container: Container, theme: Theme, width: number): string[] {
  if (width < 3) return container.render(Math.max(1, width));

  const innerWidth = width - 2;
  const border = (text: string) => theme.fg("borderAccent", text);
  const rows = container
    .render(innerWidth)
    .map((line) => `${border("│")}${truncateToWidth(line, innerWidth, "…", true)}${border("│")}`);
  return [border(`╭${"─".repeat(innerWidth)}╮`), ...rows, border(`╰${"─".repeat(innerWidth)}╯`)];
}

class WrappedSelectList {
  private selectedIndex = 0;
  private readonly items: SelectItem[];
  private readonly keybindings: KeybindingsManager;
  private readonly maxVisible: number;
  private readonly selectedDescriptionMaxLines: number;
  private readonly selectedLabelMaxLines: number;
  private readonly theme: Theme;
  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;

  constructor(
    items: SelectItem[],
    maxVisible: number,
    theme: Theme,
    keybindings: KeybindingsManager,
    options: {
      selectedLabelMaxLines: number;
      selectedDescriptionMaxLines: number;
    },
  ) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
    this.keybindings = keybindings;
    this.selectedLabelMaxLines = options.selectedLabelMaxLines;
    this.selectedDescriptionMaxLines = options.selectedDescriptionMaxLines;
  }

  render(width: number): string[] {
    if (this.items.length === 0) return [this.theme.fg("warning", "  No items")];

    const lines: string[] = [];
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.items.length - this.maxVisible),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.items.length);

    for (let index = startIndex; index < endIndex; index += 1) {
      const item = this.items[index];
      if (!item) continue;
      if (index !== this.selectedIndex) {
        lines.push(`  ${truncateToWidth(item.label, Math.max(1, width - 2), "…")}`);
        continue;
      }

      const labels = boundedWrappedLines(
        this.theme.fg("accent", item.label),
        width - 2,
        this.selectedLabelMaxLines,
        this.theme.fg("dim", "…"),
      );
      lines.push(`${this.theme.fg("accent", "→ ")}${labels[0] ?? ""}`);
      for (const line of labels.slice(1)) lines.push(`  ${line}`);

      if (item.description) {
        const descriptions = boundedWrappedLines(
          this.theme.fg("muted", item.description),
          width - 4,
          this.selectedDescriptionMaxLines,
          this.theme.fg("dim", "…"),
        );
        for (const line of descriptions) lines.push(`  ${line}`);
      }
    }

    if (startIndex > 0 || endIndex < this.items.length) {
      lines.push(
        this.theme.fg(
          "dim",
          truncateToWidth(`  (${this.selectedIndex + 1}/${this.items.length})`, Math.max(1, width - 2), ""),
        ),
      );
    }
    return lines;
  }

  handleInput(data: string): void {
    if (this.keybindings.matches(data, "tui.select.up")) {
      this.selectedIndex = this.selectedIndex === 0 ? this.items.length - 1 : this.selectedIndex - 1;
    } else if (this.keybindings.matches(data, "tui.select.down")) {
      this.selectedIndex = this.selectedIndex === this.items.length - 1 ? 0 : this.selectedIndex + 1;
    } else if (this.keybindings.matches(data, "tui.select.confirm")) {
      const selected = this.items[this.selectedIndex];
      if (selected) this.onSelect?.(selected);
    } else if (this.keybindings.matches(data, "tui.select.cancel")) {
      this.onCancel?.();
    }
  }

  invalidate(): void {}
}

async function showSelectDialog(
  ctx: ExtensionCommandContext,
  options: SelectDialogOptions,
): Promise<string | undefined> {
  const result = await ctx.ui.custom<string | null>(
    (tui, theme, keybindings, done) => {
      const container = new Container();
      const title = new Text("", 1, 0);
      const subtitle = new Text("", 1, 0);
      const hint = new Text("", 1, 0);
      const updateText = () => {
        title.setText(theme.fg("accent", theme.bold(`◆ ${options.title}`)));
        subtitle.setText(theme.fg("muted", options.subtitle));
        hint.setText(theme.fg("dim", "↑↓ navigate · enter select · esc cancel"));
      };
      updateText();

      const list = new WrappedSelectList(
        options.items,
        Math.min(options.items.length, options.maxVisible),
        theme,
        keybindings,
        {
          selectedLabelMaxLines: options.selectedLabelMaxLines,
          selectedDescriptionMaxLines: options.selectedDescriptionMaxLines,
        },
      );
      list.onSelect = (item) => done(item.value);
      list.onCancel = () => done(null);

      container.addChild(title);
      container.addChild(subtitle);
      container.addChild(list);
      container.addChild(hint);

      return {
        render(width: number) {
          return renderModalFrame(container, theme, width);
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
        maxHeight: Math.min(
          options.maxVisible + options.selectedLabelMaxLines + options.selectedDescriptionMaxLines + 7,
          24,
        ),
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
    selectedLabelMaxLines: 2,
    selectedDescriptionMaxLines: 2,
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
    selectedLabelMaxLines: 5,
    selectedDescriptionMaxLines: 1,
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
    if (this.state.implementationFramingRequired) {
      lines.push(this.theme.fg("warning", "→ next · sketch feature shape or signal structural movement"));
    }
    if (this.state.verificationRequired) {
      lines.push(this.theme.fg("warning", "→ next · verify changed artifacts before completion"));
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
  private readonly requestRender: () => void;
  private readonly viewportHeight: number;
  private scrollOffset = 0;
  private maxScrollOffset = 0;

  constructor(
    view: DeveloperStatusView,
    theme: Theme,
    onClose: () => void,
    options: { viewportHeight?: number; requestRender?: () => void } = {},
  ) {
    this.view = view;
    this.theme = theme;
    this.onClose = onClose;
    this.viewportHeight = options.viewportHeight ?? 24;
    this.requestRender = options.requestRender ?? (() => {});
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "enter") || matchesKey(data, "ctrl+c")) {
      this.onClose();
      return;
    }
    if (matchesKey(data, "up")) this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    else if (matchesKey(data, "down")) {
      this.scrollOffset = Math.min(this.maxScrollOffset, this.scrollOffset + 1);
    } else return;
    this.invalidate();
    this.requestRender();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const panelWidth = Math.max(1, width);
    const innerWidth = Math.max(1, panelWidth - 2);
    const rows: string[] = [];
    const border = (text: string) => this.theme.fg("borderAccent", text);
    const row = (content = "") => `${border("│")}${truncateToWidth(content, innerWidth, "…", true)}${border("│")}`;
    const addWrapped = (label: string, value: string, color: ThemeColor = "muted", maxLines = 2) => {
      const labelText = `${label} ·`;
      const plainPrefix = `  ${labelText} `;
      const styledPrefix = `  ${this.theme.fg("dim", labelText)} `;
      const contentWidth = Math.max(1, innerWidth - visibleWidth(plainPrefix));
      const wrapped = wrapTextWithAnsi(this.theme.fg(color, value.trim()), contentWidth);
      const visible = wrapped.slice(0, Math.max(1, maxLines));
      if (wrapped.length > visible.length && visible.length > 0) {
        const last = visible.length - 1;
        visible[last] =
          truncateToWidth(visible[last] ?? "", Math.max(1, contentWidth - 1), "") + this.theme.fg("dim", "…");
      }
      rows.push(row(styledPrefix + (visible[0] ?? "")));
      const hangingIndent = " ".repeat(visibleWidth(plainPrefix));
      for (const line of visible.slice(1)) rows.push(row(hangingIndent + line));
    };
    const section = (title: string) => rows.push(row(`  ${this.theme.fg("accent", this.theme.bold(title))}`));

    rows.push(border(`╭${"─".repeat(innerWidth)}╮`));
    rows.push(row(`  ${this.theme.fg("accent", this.theme.bold("◆ Developer status"))}`));
    rows.push(row());

    const state = this.view.state;
    const currentProtocol = protocolState(state);
    const summary =
      `mode ${this.theme.fg(modeColor(state.mode), modeName(state.mode))}` +
      this.theme.fg("dim", " · ") +
      `protocol ${this.theme.fg(protocolColor(currentProtocol), currentProtocol)}` +
      this.theme.fg("dim", " · ") +
      `target ${this.theme.fg("muted", state.activeRoute?.owner ?? "none")}`;
    for (const line of wrapTextWithAnsi(summary, Math.max(1, innerWidth - 2))) rows.push(row(`  ${line}`));
    rows.push(row());

    section("Active route");
    if (state.activeRoute) {
      addWrapped("id", state.activeRoute.routeId, "dim", 1);
      addWrapped("question", state.activeRoute.question, "text", 3);
      addWrapped("reason", state.activeRoute.reason, "muted", 2);
      addWrapped("skill", state.activeRoute.methodLocation ?? "direct action", "dim", 1);
      addWrapped("known evidence", String(state.activeRoute.knownEvidence.length), "muted", 1);
    } else {
      addWrapped("state", "No route is currently waiting for judgment.", "dim", 2);
    }

    rows.push(row());
    section(`Open questions · ${state.pendingQuestions.length}`);
    if (state.pendingQuestions.length === 0) {
      addWrapped("state", "No unresolved Developer questions.", "dim", 2);
    } else {
      for (const question of state.pendingQuestions.slice(0, 4)) {
        addWrapped(
          question.status === "blocked" ? "blocked" : "needs evidence",
          question.question,
          question.status === "blocked" ? "error" : "warning",
          2,
        );
      }
      if (state.pendingQuestions.length > 4) {
        addWrapped("more", `${state.pendingQuestions.length - 4} additional open questions`, "dim", 1);
      }
    }

    rows.push(row());
    section("Last judgment");
    if (state.lastJudgment) {
      addWrapped(
        "status",
        state.lastJudgment.status,
        protocolColor(
          state.lastJudgment.status === "blocked"
            ? "blocked"
            : state.lastJudgment.status === "needs-evidence"
              ? "needs-evidence"
              : "idle",
        ),
        1,
      );
      addWrapped("result", state.lastJudgment.result, "muted", 3);
      addWrapped(
        "evidence",
        `${state.lastJudgment.basis.length} basis · ${state.lastJudgment.artifacts.length} artifacts`,
        "dim",
        1,
      );
    } else {
      addWrapped("state", "No judgment has been recorded on this branch.", "dim", 2);
    }

    rows.push(row());
    addWrapped(
      "resources",
      `${this.view.availableSkills.length} skills · ${this.view.activeTools.length} active tools`,
      "dim",
      1,
    );
    rows.push(row());

    const header = rows.slice(0, 2);
    const body = rows.slice(2);
    const bodyCapacity = Math.max(1, this.viewportHeight - 4);
    this.maxScrollOffset = Math.max(0, body.length - bodyCapacity);
    this.scrollOffset = Math.min(this.scrollOffset, this.maxScrollOffset);
    const visibleBody = body.slice(this.scrollOffset, this.scrollOffset + bodyCapacity);
    const position =
      body.length > bodyCapacity
        ? `↑↓ scroll · ${this.scrollOffset + 1}–${Math.min(body.length, this.scrollOffset + bodyCapacity)}/${body.length} · enter/esc close`
        : "enter/esc close · /develop questions revisits open work";
    const visibleRows = [
      ...header,
      ...visibleBody,
      row(`  ${this.theme.fg("dim", position)}`),
      border(`╰${"─".repeat(innerWidth)}╯`),
    ];

    this.cachedWidth = width;
    this.cachedLines = visibleRows;
    return visibleRows;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export async function showDeveloperStatus(ctx: ExtensionCommandContext, view: DeveloperStatusView): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) =>
      new DeveloperStatusPanel(view, theme, () => done(), {
        viewportHeight: Math.max(6, Math.min(28, tui.terminal.rows - 2)),
        requestRender: () => tui.requestRender(),
      }),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: 92,
        minWidth: 56,
        maxHeight: 28,
        margin: 1,
      },
    },
  );
}

export function prepareQuestionPrompt(ctx: ExtensionCommandContext, question: PendingQuestion): void {
  const prompt = `Revisit this Developer question: ${question.question}`;
  const current = ctx.ui.getEditorText();
  ctx.ui.setEditorText(current.trim() ? `${current.trimEnd()}\n\n${prompt}` : prompt);
}
