import type {
  ExtensionCommandContext,
  ExtensionContext,
  KeybindingsManager,
  Theme,
  ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  matchesKey,
  type SelectItem,
  type SizeValue,
  Text,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import {
  protocolState,
  type ChoiceResponseField,
  type ChoiceResponseOption,
  type DeveloperMode,
  type DeveloperState,
  type JudgmentStatus,
  type PendingQuestion,
  type ProtocolState,
} from "./state.ts";

export type DeveloperAction =
  | { kind: "command"; value: "status" | "questions" | DeveloperMode }
  | { kind: "question"; questionId: string };

function modeName(mode: DeveloperMode): string {
  if (mode === "on") return "adaptive";
  return mode;
}

function protocolColor(value: ProtocolState): ThemeColor {
  if (value === "blocked") return "error";
  if (
    value === "needs-evidence" ||
    value === "needs-answer" ||
    value === "needs-routing" ||
    value === "needs-verification"
  )
    return "warning";
  if (value === "needs-judgment") return "accent";
  return "dim";
}

function modeColor(mode: DeveloperMode): ThemeColor {
  if (mode === "strict") return "warning";
  if (mode === "on") return "accent";
  return "dim";
}

function judgmentColor(status: JudgmentStatus): ThemeColor {
  if (status === "blocked") return "error";
  if (status === "needs-evidence") return "warning";
  if (status === "resolved") return "success";
  return "muted";
}

function judgmentSummary(result: string): string {
  return (
    result
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("```")) ?? result
  );
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
  items.push(...pendingQuestionItems(state.pendingQuestions));
  items.push(
    {
      value: "on",
      label: state.mode === "on" ? "Adaptive mode (active)" : "Adaptive mode",
      description: "Route judgments adaptively while preserving the current active tool set",
    },
    {
      value: "strict",
      label: state.mode === "strict" ? "Strict mode (active)" : "Strict mode",
      description: "Allow bash on judgment routes; require direct for Pi built-in edit/write",
    },
    {
      value: "off",
      label: state.mode === "off" ? "Off (active)" : "Turn off",
      description: "Clear Developer protocol state and remove its persistent UI",
    },
  );
  return items;
}

function questionAction(owner: PendingQuestion["resolutionOwner"]): string {
  if (owner === "user") return "enter to provide the required answer";
  if (owner === "environment") return "enter to provide access or external evidence";
  if (owner === "agent") return "enter to ask Pi to investigate";
  return "enter to classify and resolve this legacy question";
}

function resolutionRequestLabel(owner: PendingQuestion["resolutionOwner"]): string {
  if (owner === "user") return "Required answer or product decision:";
  if (owner === "environment") return "External access, observation, or environment evidence:";
  return "Evidence or investigation request for Pi:";
}

const MAX_IMMEDIATE_REQUEST_BYTES = 16_000;
const MAX_IMMEDIATE_REQUEST_LINES = 1_000;
const ENABLE_MOUSE_SCROLL = "\u001b[?1000h\u001b[?1006h";
const DISABLE_MOUSE_SCROLL = "\u001b[?1006l\u001b[?1000l";

export type ImmediateQuestionDisposition = { kind: "answer"; request: string } | { kind: "defer" };

interface WritableTerminal {
  write(data: string): void;
}

function enableMouseScroll(tui: { terminal?: WritableTerminal }): WritableTerminal | undefined {
  const terminal = tui.terminal;
  if (!terminal || typeof terminal.write !== "function") return undefined;
  terminal.write(ENABLE_MOUSE_SCROLL);
  return terminal;
}

function disableMouseScroll(terminal: WritableTerminal | undefined): void {
  terminal?.write(DISABLE_MOUSE_SCROLL);
}

function mouseWheelDirection(data: string): -1 | 1 | undefined {
  const match = /^\u001b\[<(\d+);\d+;\d+M$/.exec(data);
  if (!match?.[1]) return undefined;
  const button = Number(match[1]);
  if ((button & 64) === 0 || (button & 3) > 1) return undefined;
  return (button & 1) === 0 ? -1 : 1;
}

export function pendingQuestionItems(questions: PendingQuestion[]): SelectItem[] {
  return questions.map((question) => {
    const action = questionAction(question.resolutionOwner);
    return {
      value: question.id,
      label: question.question,
      description: `${question.status} · ${question.resolutionOwner} · ${question.gate} · ${action}`,
    };
  });
}

interface SelectDialogOptions {
  title: string;
  subtitle: string;
  items: SelectItem[];
  width: SizeValue;
  minWidth: number;
  maxVisible: number;
  selectedLabelMaxLines: number;
  selectedDescriptionMaxLines: number;
}

function boundedWrappedLines(
  content: string,
  width: number,
  maxLines: number,
  ellipsis: string,
): string[] {
  const contentWidth = Math.max(1, width);
  const wrapped = wrapTextWithAnsi(content, contentWidth);
  const visible = wrapped.slice(0, Math.max(1, maxLines));
  if (wrapped.length > visible.length && visible.length > 0) {
    const last = visible.length - 1;
    visible[last] =
      truncateToWidth(visible[last] ?? "", Math.max(1, contentWidth - 1), "") + ellipsis;
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
  private readonly renderHeight: number;
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
    this.renderHeight = Math.max(
      1,
      maxVisible - 1 + options.selectedLabelMaxLines + options.selectedDescriptionMaxLines + 1,
    );
  }

  render(width: number): string[] {
    if (this.items.length === 0) return [this.theme.fg("warning", "  No items")];

    const lines: string[] = [];
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(this.maxVisible / 2),
        this.items.length - this.maxVisible,
      ),
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
          truncateToWidth(
            `  (${this.selectedIndex + 1}/${this.items.length})`,
            Math.max(1, width - 2),
            "",
          ),
        ),
      );
    }
    const visible = lines.slice(0, this.renderHeight);
    while (visible.length < this.renderHeight) visible.push("");
    return visible;
  }

  handleInput(data: string): void {
    const wheelDirection = mouseWheelDirection(data);
    if (wheelDirection !== undefined) {
      this.moveSelection(wheelDirection * 3);
    } else if (this.keybindings.matches(data, "tui.select.up")) {
      this.selectedIndex =
        this.selectedIndex === 0 ? this.items.length - 1 : this.selectedIndex - 1;
    } else if (this.keybindings.matches(data, "tui.select.down")) {
      this.selectedIndex =
        this.selectedIndex === this.items.length - 1 ? 0 : this.selectedIndex + 1;
    } else if (this.keybindings.matches(data, "tui.select.pageUp")) {
      this.moveSelection(-Math.max(1, this.maxVisible - 1));
    } else if (this.keybindings.matches(data, "tui.select.pageDown")) {
      this.moveSelection(Math.max(1, this.maxVisible - 1));
    } else if (matchesKey(data, "home")) {
      this.selectedIndex = 0;
    } else if (matchesKey(data, "end")) {
      this.selectedIndex = Math.max(0, this.items.length - 1);
    } else if (this.keybindings.matches(data, "tui.select.confirm")) {
      const selected = this.items[this.selectedIndex];
      if (selected) this.onSelect?.(selected);
    } else if (this.keybindings.matches(data, "tui.select.cancel")) {
      this.onCancel?.();
    }
  }

  private moveSelection(delta: number): void {
    this.selectedIndex = Math.max(0, Math.min(this.items.length - 1, this.selectedIndex + delta));
  }

  invalidate(): void {}
}

async function showSelectDialog(
  ctx: ExtensionContext,
  options: SelectDialogOptions,
): Promise<string | undefined> {
  let mouseTerminal: WritableTerminal | undefined;
  try {
    const result = await ctx.ui.custom<string | null>(
      (tui, theme, keybindings, done) => {
        mouseTerminal = enableMouseScroll(tui);
        const container = new Container();
        const title = new Text("", 1, 0);
        const subtitle = new Text("", 1, 0);
        const hint = new Text("", 1, 0);
        const updateText = () => {
          title.setText(theme.fg("accent", theme.bold(`◆ ${options.title}`)));
          subtitle.setText(theme.fg("muted", options.subtitle));
          hint.setText(
            theme.fg("dim", "wheel/↑↓ · PgUp/PgDn · Home/End · enter select · esc cancel"),
          );
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
          minWidth: options.minWidth,
          maxHeight: "88%",
          margin: 1,
        },
      },
    );
    return result ?? undefined;
  } finally {
    disableMouseScroll(mouseTerminal);
  }
}

export async function showDeveloperActionSelector(
  ctx: ExtensionCommandContext,
  state: DeveloperState,
): Promise<DeveloperAction | undefined> {
  const result = await showSelectDialog(ctx, {
    title: "Developer control",
    subtitle: `Current · ${modeName(state.mode)} · ${protocolState(state)}`,
    items: developerActionItems(state),
    width: "84%",
    minWidth: 78,
    maxVisible: 6,
    selectedLabelMaxLines: 3,
    selectedDescriptionMaxLines: 3,
  });
  if (!result) return undefined;
  if (
    result === "status" ||
    result === "questions" ||
    result === "on" ||
    result === "strict" ||
    result === "off"
  ) {
    return { kind: "command", value: result };
  }
  if (state.pendingQuestions.some((question) => question.id === result)) {
    return { kind: "question", questionId: result };
  }
  return undefined;
}

export function showPendingQuestionSelector(
  ctx: ExtensionCommandContext,
  questions: PendingQuestion[],
): Promise<string | undefined> {
  if (questions.length === 0) return Promise.resolve(undefined);
  return showSelectDialog(ctx, {
    title: "Resolve an open Developer question",
    subtitle:
      "Enter opens an answer/evidence editor; the question closes after a resolved or not-applicable judgment",
    items: pendingQuestionItems(questions),
    width: "92%",
    minWidth: 88,
    maxVisible: 10,
    selectedLabelMaxLines: 5,
    selectedDescriptionMaxLines: 3,
  });
}

interface ChoiceResponseAnswer {
  option: ChoiceResponseOption;
  detail?: string;
}

function responseWithinLimits(
  ctx: ExtensionContext,
  request: string,
  label = "Question response",
): boolean {
  const requestBytes = new TextEncoder().encode(request).byteLength;
  const requestLines = request.split(/\r?\n/).length;
  if (requestBytes <= MAX_IMMEDIATE_REQUEST_BYTES && requestLines <= MAX_IMMEDIATE_REQUEST_LINES) {
    return true;
  }
  ctx.ui.notify(
    `${label} is too large (${requestBytes} bytes, ${requestLines} lines); shorten it before submitting.`,
    "warning",
  );
  return false;
}

function choiceDetailInitial(field: ChoiceResponseField, option: ChoiceResponseOption): string {
  return [
    `Decision: ${field.prompt}`,
    `Selected: ${option.value} — ${option.label}`,
    "",
    option.detailPrompt,
    "",
    "Required detail:",
  ].join("\n");
}

async function editChoiceDetail(
  ctx: ExtensionContext,
  field: ChoiceResponseField,
  option: ChoiceResponseOption,
): Promise<string | undefined> {
  const initial = choiceDetailInitial(field, option);
  while (true) {
    const response = await ctx.ui.editor(`Add detail for ${field.id} · ${option.value}`, initial);
    if (response === undefined) return undefined;
    const detail = (
      response.startsWith(initial) ? response.slice(initial.length) : response
    ).trim();
    if (!detail) {
      ctx.ui.notify("This choice requires a non-empty detail.", "warning");
      continue;
    }
    if (!responseWithinLimits(ctx, detail, "Choice detail")) continue;
    return detail;
  }
}

function structuredResolutionRequest(
  question: PendingQuestion,
  answers: ReadonlyArray<ChoiceResponseAnswer | undefined>,
): string {
  const fields = question.responseSpec?.fields ?? [];
  const lines = [questionResolutionPrompt(question), "", "Structured answer:"];
  for (const [index, field] of fields.entries()) {
    const answer = answers[index];
    if (!answer) continue;
    lines.push(`- ${field.id}: ${answer.option.value} — ${answer.option.label}`);
    if (answer.detail) lines.push(`  Detail: ${answer.detail}`);
  }
  return lines.join("\n");
}

type ChoiceFieldAction =
  | { kind: "answer"; answer: ChoiceResponseAnswer }
  | { kind: "cancel" }
  | { kind: "retry" };

type ChoiceReviewAction =
  | { kind: "submit" }
  | { kind: "edit"; fieldIndex: number }
  | { kind: "back" };

async function selectChoiceAnswer(
  ctx: ExtensionContext,
  field: ChoiceResponseField,
  fieldIndex: number,
  fieldCount: number,
): Promise<ChoiceFieldAction> {
  const selectedValue = await showSelectDialog(ctx, {
    title: `Decision ${fieldIndex + 1}/${fieldCount} · ${field.id}`,
    subtitle: field.description ?? field.prompt,
    items: field.options.map((option) => ({
      value: option.value,
      label: `${option.value} · ${option.label}`,
      description: option.description ?? field.prompt,
    })),
    width: "92%",
    minWidth: 88,
    maxVisible: Math.min(field.options.length, 12),
    selectedLabelMaxLines: 3,
    selectedDescriptionMaxLines: 4,
  });
  if (!selectedValue) return { kind: "cancel" };
  const option = field.options.find((candidate) => candidate.value === selectedValue);
  if (!option) return { kind: "retry" };
  const detail = option.detailPrompt ? await editChoiceDetail(ctx, field, option) : undefined;
  if (option.detailPrompt && detail === undefined) return { kind: "retry" };
  return { kind: "answer", answer: { option, detail } };
}

async function reviewChoiceAnswers(
  ctx: ExtensionContext,
  question: PendingQuestion,
  fields: ChoiceResponseField[],
  answers: ReadonlyArray<ChoiceResponseAnswer | undefined>,
): Promise<ChoiceReviewAction> {
  const action = await showSelectDialog(ctx, {
    title: "Review structured answer",
    subtitle: question.question,
    items: [
      {
        value: "submit",
        label: "Submit answers",
        description: "Send these decisions to Pi; the question remains open until judgment",
      },
      ...fields.map((field, index) => {
        const answer = answers[index];
        return {
          value: `edit:${index}`,
          label: `${field.id} · ${answer?.option.value ?? "missing"} — ${answer?.option.label ?? "Missing answer"}`,
          description: answer?.detail ? `Detail: ${answer.detail}` : "Enter to change this answer",
        };
      }),
    ],
    width: "92%",
    minWidth: 88,
    maxVisible: Math.min(fields.length + 1, 12),
    selectedLabelMaxLines: 3,
    selectedDescriptionMaxLines: 4,
  });
  if (action === "submit") return { kind: "submit" };
  if (!action?.startsWith("edit:")) return { kind: "back" };
  const fieldIndex = Number(action.slice("edit:".length));
  if (!Number.isInteger(fieldIndex) || fieldIndex < 0 || fieldIndex >= fields.length) {
    return { kind: "back" };
  }
  return { kind: "edit", fieldIndex };
}

function previousChoiceField(
  fieldIndex: number,
  fieldCount: number,
  returnToReview: boolean,
): number | undefined {
  if (returnToReview) return fieldCount;
  return fieldIndex === 0 ? undefined : fieldIndex - 1;
}

async function collectChoiceResponse(
  ctx: ExtensionContext,
  question: PendingQuestion,
): Promise<string | undefined> {
  const fields = question.responseSpec?.fields;
  if (!fields || fields.length === 0) return undefined;
  const answers: Array<ChoiceResponseAnswer | undefined> = [];
  let fieldIndex = 0;
  let returnToReview = false;

  while (true) {
    if (fieldIndex < fields.length) {
      const field = fields[fieldIndex];
      if (!field) return undefined;
      const action = await selectChoiceAnswer(ctx, field, fieldIndex, fields.length);
      if (action.kind === "retry") continue;
      if (action.kind === "cancel") {
        fieldIndex = previousChoiceField(fieldIndex, fields.length, returnToReview) ?? -1;
      }
      if (fieldIndex < 0) return undefined;
      if (action.kind === "cancel") continue;
      answers[fieldIndex] = action.answer;
      fieldIndex = returnToReview ? fields.length : fieldIndex + 1;
      continue;
    }

    const action = await reviewChoiceAnswers(ctx, question, fields, answers);
    if (action.kind === "submit") return structuredResolutionRequest(question, answers);
    if (action.kind === "edit") {
      fieldIndex = action.fieldIndex;
      returnToReview = true;
      continue;
    }
    returnToReview = false;
    fieldIndex = fields.length - 1;
  }
}

export async function promptImmediateUserQuestion(
  ctx: ExtensionContext,
  question: PendingQuestion,
): Promise<ImmediateQuestionDisposition> {
  while (true) {
    const action = await showSelectDialog(ctx, {
      title: "Developer needs a decision",
      subtitle: question.question,
      items: [
        {
          value: "answer",
          label: "Answer now",
          description:
            "Review the full context and provide the decision required before direct work",
        },
        {
          value: "defer",
          label: "Leave open",
          description: "Keep this question in Developer and answer it later",
        },
      ],
      width: "92%",
      minWidth: 88,
      maxVisible: 2,
      selectedLabelMaxLines: 3,
      selectedDescriptionMaxLines: 3,
    });
    if (action !== "answer") return { kind: "defer" };

    const request = question.responseSpec
      ? await collectChoiceResponse(ctx, question)
      : await ctx.ui.editor(
          "Answer the new Developer question",
          questionResolutionPrompt(question),
        );
    if (request === undefined) continue;
    if (!responseWithinLimits(ctx, request)) continue;
    return { kind: "answer", request };
  }
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
      const label = question.resolutionOwner === "user" ? "? answer" : "? evidence";
      lines.push(
        truncateToWidth(
          `${this.theme.fg(question.status === "blocked" ? "error" : "warning", label)} ${this.theme.fg("dim", `· ${question.gate} ·`)} ${this.theme.fg("muted", question.question)}`,
          width,
          "…",
        ),
      );
    }
    if (this.state.pendingQuestions.length > 3) {
      lines.push(
        this.theme.fg("dim", `  +${this.state.pendingQuestions.length - 3} more open questions`),
      );
    }
    if (this.state.implementationFramingRequired) {
      lines.push(
        this.theme.fg("warning", "◇ gate · frame implementation before direct (sketch or signal)"),
      );
    }
    if (this.state.rerouteRequired) {
      lines.push(this.theme.fg("warning", "→ next · reroute from the latest direct landing"));
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
    const wheelDirection = mouseWheelDirection(data);
    const pageSize = Math.max(1, this.viewportHeight - 6);
    if (wheelDirection !== undefined) this.moveScroll(wheelDirection * 3);
    else if (matchesKey(data, "up")) this.moveScroll(-1);
    else if (matchesKey(data, "down")) this.moveScroll(1);
    else if (matchesKey(data, "pageUp")) this.moveScroll(-pageSize);
    else if (matchesKey(data, "pageDown")) this.moveScroll(pageSize);
    else if (matchesKey(data, "home")) this.scrollOffset = 0;
    else if (matchesKey(data, "end")) this.scrollOffset = this.maxScrollOffset;
    else return;
    this.invalidate();
    this.requestRender();
  }

  private moveScroll(delta: number): void {
    this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.scrollOffset + delta));
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const panelWidth = Math.max(1, width);
    const innerWidth = Math.max(1, panelWidth - 2);
    const rows: string[] = [];
    const border = (text: string) => this.theme.fg("borderAccent", text);
    const row = (content = "") =>
      `${border("│")}${truncateToWidth(content, innerWidth, "…", true)}${border("│")}`;
    const addWrapped = (
      label: string,
      value: string,
      color: ThemeColor = "muted",
      maxLines = 2,
    ) => {
      const labelText = `${label} ·`;
      const plainPrefix = `  ${labelText} `;
      const styledPrefix = `  ${this.theme.fg("dim", labelText)} `;
      const contentWidth = Math.max(1, innerWidth - visibleWidth(plainPrefix));
      const wrapped = wrapTextWithAnsi(this.theme.fg(color, value.trim()), contentWidth);
      const visible = wrapped.slice(0, Math.max(1, maxLines));
      if (wrapped.length > visible.length && visible.length > 0) {
        const last = visible.length - 1;
        visible[last] =
          truncateToWidth(visible[last] ?? "", Math.max(1, contentWidth - 1), "") +
          this.theme.fg("dim", "…");
      }
      rows.push(row(styledPrefix + (visible[0] ?? "")));
      const hangingIndent = " ".repeat(visibleWidth(plainPrefix));
      for (const line of visible.slice(1)) rows.push(row(hangingIndent + line));
    };
    const section = (title: string) =>
      rows.push(row(`  ${this.theme.fg("accent", this.theme.bold(title))}`));

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
    for (const line of wrapTextWithAnsi(summary, Math.max(1, innerWidth - 2)))
      rows.push(row(`  ${line}`));
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
          `${question.status} · ${question.resolutionOwner} · ${question.gate}`,
          question.question,
          question.status === "blocked" ? "error" : "warning",
          2,
        );
        addWrapped("resolves when", question.resolutionCriteria, "dim", 2);
      }
      if (state.pendingQuestions.length > 4) {
        addWrapped(
          "more",
          `${state.pendingQuestions.length - 4} additional open questions`,
          "dim",
          1,
        );
      }
    }

    rows.push(row());
    section(`Judgment history · ${state.judgmentHistory.length}`);
    if (state.judgmentHistory.length === 0) {
      addWrapped("state", "No judgment has been recorded on this branch.", "dim", 2);
    } else {
      const recentJudgments = state.judgmentHistory.slice(-10).toReversed();
      for (const judgment of recentJudgments) {
        const route = state.routeHistory.find(
          (candidate) => candidate.routeId === judgment.routeId,
        );
        addWrapped(
          `${judgment.owner} ${judgment.status}`,
          `${judgment.question} → ${judgmentSummary(judgment.result)}`,
          judgmentColor(judgment.status),
          3,
        );
        if (route) addWrapped("route reason", route.reason, "dim", 2);
        for (const alternative of route?.consideredAlternatives ?? []) {
          addWrapped(`considered ${alternative.owner}`, alternative.reason, "dim", 2);
        }
        for (const update of judgment.questionUpdates ?? []) {
          addWrapped(
            `question ${update.status}`,
            `${update.questionId} → ${update.result}`,
            "accent",
            2,
          );
        }
      }
      if (state.judgmentHistory.length > recentJudgments.length) {
        addWrapped(
          "earlier",
          `${state.judgmentHistory.length - recentJudgments.length} earlier judgments`,
          "dim",
          1,
        );
      }
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
    while (visibleBody.length < bodyCapacity) visibleBody.push(row());
    const position =
      body.length > bodyCapacity
        ? `wheel/↑↓ · PgUp/PgDn · Home/End · ${this.scrollOffset + 1}–${Math.min(body.length, this.scrollOffset + bodyCapacity)}/${body.length} · enter/esc close`
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

export async function showDeveloperStatus(
  ctx: ExtensionCommandContext,
  view: DeveloperStatusView,
): Promise<void> {
  let mouseTerminal: WritableTerminal | undefined;
  try {
    await ctx.ui.custom<void>(
      (tui, theme, _keybindings, done) => {
        mouseTerminal = enableMouseScroll(tui);
        return new DeveloperStatusPanel(view, theme, () => done(), {
          viewportHeight: Math.max(10, Math.min(36, Math.floor(tui.terminal.rows * 0.88))),
          requestRender: () => tui.requestRender(),
        });
      },
      {
        overlay: true,
        overlayOptions: {
          anchor: "center",
          width: "90%",
          minWidth: 72,
          maxHeight: "88%",
          margin: 1,
        },
      },
    );
  } finally {
    disableMouseScroll(mouseTerminal);
  }
}

export function questionResolutionPrompt(question: PendingQuestion): string {
  const requestLabel = resolutionRequestLabel(question.resolutionOwner);
  const context = question.context
    ? ["", "Decision or evidence context:", question.context, ""]
    : [];
  return [
    "Resolve this open Developer question.",
    "",
    `Question: ${question.question}`,
    ...context,
    `Resolution owner: ${question.resolutionOwner}`,
    `Gate: ${question.gate}`,
    `Resolution criteria: ${question.resolutionCriteria}`,
    "",
    requestLabel,
    "",
    "Use the supplied answer as new evidence, or investigate with available tools when the owner is agent.",
    "Route the focused question, then record resolved/not-applicable with question_updates when it is settled; otherwise retain it with the specific remaining evidence gap.",
  ].join("\n");
}

export function editQuestionResolutionRequest(
  ctx: ExtensionCommandContext,
  question: PendingQuestion,
): Promise<string | undefined> {
  if (question.responseSpec) return collectChoiceResponse(ctx, question);
  const current = ctx.ui.getEditorText();
  const request = questionResolutionPrompt(question);
  const initial = current.trim() ? `${current.trimEnd()}\n\n${request}` : request;
  return ctx.ui.editor("Answer or investigate the selected Developer question", initial);
}
