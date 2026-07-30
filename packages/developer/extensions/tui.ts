import type {
	ExtensionCommandContext,
	ExtensionContext,
	KeybindingsManager,
	Theme,
	ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	Markdown,
	type MarkdownTheme,
	matchesKey,
	type SelectItem,
	type SettingItem,
	SettingsList,
	type SettingsListTheme,
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
	type DeveloperState,
	type PendingQuestion,
	type ProtocolState,
} from "./state.ts";

export interface DeveloperSettingsBinding {
	read(): DeveloperState;
	commitActivation(enabled: boolean): DeveloperState;
}

function developerMarkdownTheme(theme: Theme): MarkdownTheme {
	return {
		heading: (text) => theme.fg("mdHeading", text),
		link: (text) => theme.fg("mdLink", text),
		linkUrl: (text) => theme.fg("mdLinkUrl", text),
		code: (text) => theme.fg("mdCode", text),
		codeBlock: (text) => theme.fg("mdCodeBlock", text),
		codeBlockBorder: (text) => theme.fg("mdCodeBlockBorder", text),
		quote: (text) => theme.fg("mdQuote", text),
		quoteBorder: (text) => theme.fg("mdQuoteBorder", text),
		hr: (text) => theme.fg("mdHr", text),
		listBullet: (text) => theme.fg("mdListBullet", text),
		bold: (text) => theme.bold(text),
		italic: (text) => theme.italic(text),
		strikethrough: (text) => theme.strikethrough(text),
		underline: (text) => theme.underline(text),
	};
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

export function renderDeveloperFooter(
	state: DeveloperState,
	theme: Theme,
): string {
	const currentProtocol = protocolState(state);
	const target = state.activeRoute?.target ?? "none";
	return (
		theme.fg("accent", "developer") +
		theme.fg("dim", " · ") +
		theme.fg(state.enabled ? "success" : "dim", state.enabled ? "on" : "off") +
		theme.fg("dim", " · ") +
		theme.fg(protocolColor(currentProtocol), currentProtocol) +
		theme.fg("dim", ` · ${target}`)
	);
}

export function hasDiscardableDeveloperWork(state: DeveloperState): boolean {
	return Boolean(state.activeRoute) || state.pendingQuestions.length > 0;
}

export function developerSettingItems(state: DeveloperState): SettingItem[] {
	return [
		{
			id: "activation",
			label: "Developer",
			currentValue: state.enabled ? "On" : "Off",
			values: ["On", "Off"],
			description:
				"Enable judgment routing and route-bound access to Pi mutation tools",
		},
	];
}

function settingsListTheme(theme: Theme): SettingsListTheme {
	return {
		label: (text, selected) =>
			selected ? theme.fg("accent", theme.bold(text)) : theme.fg("text", text),
		value: (text, selected) => theme.fg(selected ? "accent" : "muted", text),
		description: (text) => theme.fg("muted", text),
		cursor: theme.fg("accent", "→ "),
		hint: (text) => theme.fg("dim", text),
	};
}

function questionAction(owner: PendingQuestion["resolutionOwner"]): string {
	if (owner === "user") return "enter to provide the required answer";
	if (owner === "environment")
		return "enter to provide access or external evidence";
	if (owner === "agent") return "enter to ask Pi to investigate";
	return "enter to classify and resolve this legacy question";
}

function resolutionRequestLabel(
	owner: PendingQuestion["resolutionOwner"],
): string {
	if (owner === "user") return "Required answer or product decision:";
	if (owner === "environment")
		return "External access, observation, or environment evidence:";
	return "Evidence or investigation request for Pi:";
}

const MAX_IMMEDIATE_REQUEST_BYTES = 16_000;
const MAX_IMMEDIATE_REQUEST_LINES = 1_000;

export type ImmediateQuestionDisposition =
	| { kind: "answer"; request: string }
	| { kind: "defer" };

export function pendingQuestionItems(
	questions: PendingQuestion[],
): SelectItem[] {
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
	initialValue?: string;
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
			truncateToWidth(visible[last] ?? "", Math.max(1, contentWidth - 1), "") +
			ellipsis;
	}
	return visible;
}

function renderModalFrame(
	container: Container,
	theme: Theme,
	width: number,
): string[] {
	if (width < 3) return container.render(Math.max(1, width));

	const innerWidth = width - 2;
	const border = (text: string) => theme.fg("borderAccent", text);
	const rows = container
		.render(innerWidth)
		.map(
			(line) =>
				`${border("│")}${truncateToWidth(line, innerWidth, "…", true)}${border("│")}`,
		);
	return [
		border(`╭${"─".repeat(innerWidth)}╮`),
		...rows,
		border(`╰${"─".repeat(innerWidth)}╯`),
	];
}

class WrappedSelectList {
	private selectedIndex: number;
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
			initialValue?: string;
		},
	) {
		this.items = items;
		this.maxVisible = maxVisible;
		this.theme = theme;
		this.keybindings = keybindings;
		this.selectedLabelMaxLines = options.selectedLabelMaxLines;
		this.selectedDescriptionMaxLines = options.selectedDescriptionMaxLines;
		const initialIndex = options.initialValue
			? items.findIndex((item) => item.value === options.initialValue)
			: -1;
		this.selectedIndex = initialIndex >= 0 ? initialIndex : 0;
		this.renderHeight = Math.max(
			1,
			maxVisible -
				1 +
				options.selectedLabelMaxLines +
				options.selectedDescriptionMaxLines +
				1,
		);
	}

	render(width: number, maximumHeight = this.renderHeight): string[] {
		const height = Math.max(1, Math.floor(maximumHeight));
		if (this.items.length === 0) {
			const empty = [this.theme.fg("warning", "  No items")];
			while (empty.length < height) empty.push("");
			return empty.slice(0, height);
		}

		const selected = this.items[this.selectedIndex];
		if (!selected) return Array.from({ length: height }, () => "");
		const selectedLines = (() => {
			const lines: string[] = [];
			const labels = boundedWrappedLines(
				this.theme.fg("accent", selected.label),
				width - 2,
				this.selectedLabelMaxLines,
				this.theme.fg("dim", "…"),
			);
			lines.push(`${this.theme.fg("accent", "→ ")}${labels[0] ?? ""}`);
			for (const line of labels.slice(1)) lines.push(`  ${line}`);
			if (selected.description) {
				const descriptions = boundedWrappedLines(
					this.theme.fg("muted", selected.description),
					width - 4,
					this.selectedDescriptionMaxLines,
					this.theme.fg("dim", "…"),
				);
				for (const line of descriptions) lines.push(`  ${line}`);
			}
			return lines;
		})();
		const allRows = this.items.length - 1 + selectedLines.length;
		const showsEveryItem =
			this.items.length <= this.maxVisible && allRows <= height;
		const itemRows = showsEveryItem ? height : Math.max(1, height - 1);
		const selectedExtraRows = Math.max(0, selectedLines.length - 1);
		const visibleItems = showsEveryItem
			? this.items.length
			: Math.min(
					this.maxVisible,
					this.items.length,
					Math.max(1, itemRows - selectedExtraRows),
				);
		const startIndex = Math.max(
			0,
			Math.min(
				this.selectedIndex - Math.floor(visibleItems / 2),
				this.items.length - visibleItems,
			),
		);
		const endIndex = Math.min(startIndex + visibleItems, this.items.length);
		const lines: string[] = [];
		for (let index = startIndex; index < endIndex; index += 1) {
			const item = this.items[index];
			if (!item) continue;
			if (index === this.selectedIndex) lines.push(...selectedLines);
			else
				lines.push(
					`  ${truncateToWidth(item.label, Math.max(1, width - 2), "…")}`,
				);
		}
		const visible = lines.slice(0, itemRows);
		if (!showsEveryItem) {
			visible.push(
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
		while (visible.length < height) visible.push("");
		return visible.slice(0, height);
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.up")) {
			this.selectedIndex =
				this.selectedIndex === 0
					? this.items.length - 1
					: this.selectedIndex - 1;
		} else if (this.keybindings.matches(data, "tui.select.down")) {
			this.selectedIndex =
				this.selectedIndex === this.items.length - 1
					? 0
					: this.selectedIndex + 1;
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
		this.selectedIndex = Math.max(
			0,
			Math.min(this.items.length - 1, this.selectedIndex + delta),
		);
	}

	invalidate(): void {}
}

async function showSelectDialog(
	ctx: ExtensionContext,
	options: SelectDialogOptions,
	presentation: "overlay" | "surface" = "overlay",
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
				hint.setText(
					theme.fg(
						"dim",
						"PgUp/PgDn page · ↑↓ select · enter open · esc back · drag select · Cmd+C copy",
					),
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
					initialValue: options.initialValue,
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
					if (presentation === "overlay")
						return renderModalFrame(container, theme, width);
					const height = Math.max(1, tui.terminal?.rows ?? 24);
					const titleLines = title.render(width);
					const subtitleLines = subtitle.render(width);
					const hintLines = hint.render(width);
					const listHeight = Math.max(
						1,
						height -
							titleLines.length -
							subtitleLines.length -
							hintLines.length,
					);
					return [
						...titleLines,
						...subtitleLines,
						...list.render(width, listHeight),
						...hintLines,
					].slice(0, height);
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
			overlayOptions:
				presentation === "overlay"
					? {
							anchor: "center",
							width: options.width,
							minWidth: options.minWidth,
							maxHeight: "88%",
							margin: 1,
						}
					: {
							anchor: "top-center",
							width: "100%",
							maxHeight: "100%",
						},
		},
	);
	return result ?? undefined;
}

function discardableDeveloperWorkLabel(state: DeveloperState): string {
	return [
		...(state.activeRoute ? ["the active route"] : []),
		...(state.pendingQuestions.length > 0
			? [`${state.pendingQuestions.length} open question(s)`]
			: []),
	].join(" and ");
}

export async function confirmDisableDeveloper(
	ctx: ExtensionContext,
	state: DeveloperState,
): Promise<boolean> {
	const work = discardableDeveloperWorkLabel(state);
	const selected = await showSelectDialog(ctx, {
		title: "Turn off Developer?",
		subtitle: `Turning off clears ${work} from current protocol state. Session history remains.`,
		items: [
			{
				value: "keep-on",
				label: "Keep Developer On",
				description: "Return without changing protocol state",
			},
			{
				value: "turn-off",
				label: "Turn Off and Clear",
				description: `Clear ${work}`,
			},
		],
		width: 64,
		minWidth: 42,
		maxVisible: 2,
		selectedLabelMaxLines: 2,
		selectedDescriptionMaxLines: 2,
	});
	return selected === "turn-off";
}

export class DeveloperSettingsSurface extends Container {
	private activationPending = false;
	private readonly binding: DeveloperSettingsBinding;
	private readonly ctx: ExtensionCommandContext;
	private readonly done: () => void;
	private readonly requestRender: () => void;
	private settings!: SettingsList;
	private state: DeveloperState;
	private readonly theme: Theme;

	constructor(
		ctx: ExtensionCommandContext,
		binding: DeveloperSettingsBinding,
		theme: Theme,
		done: () => void,
		requestRender: () => void,
	) {
		super();
		this.ctx = ctx;
		this.binding = binding;
		this.theme = theme;
		this.done = done;
		this.requestRender = requestRender;
		this.state = binding.read();
		this.rebuild();
	}

	private rebuild(): void {
		this.clear();
		this.addChild(
			new Text(this.theme.fg("accent", this.theme.bold("◆ Developer")), 0, 0),
		);
		this.addChild(
			new Text(
				this.theme.fg(
					"muted",
					"Activation settings · current branch work stays in the Workbench",
				),
				0,
				0,
			),
		);
		this.addChild(new Text("", 0, 0));

		const items = developerSettingItems(this.state);
		this.settings = new SettingsList(
			items,
			items.length,
			settingsListTheme(this.theme),
			(id, value) => {
				if (id !== "activation") return;
				this.sync(this.binding.read());
				this.requestRender();
				void this.requestActivation(value === "On");
			},
			() => this.done(),
		);
		this.addChild(this.settings);
	}

	private sync(next: DeveloperState): void {
		this.state = next;
		this.settings.updateValue("activation", next.enabled ? "On" : "Off");
		this.invalidate();
	}

	private async requestActivation(enabled: boolean): Promise<void> {
		if (this.activationPending) return;
		this.activationPending = true;
		try {
			const current = this.binding.read();
			const accepted =
				enabled || !hasDiscardableDeveloperWork(current)
					? true
					: await confirmDisableDeveloper(this.ctx, current);
			this.sync(
				accepted ? this.binding.commitActivation(enabled) : this.binding.read(),
			);
		} catch (error) {
			this.sync(this.binding.read());
			this.ctx.ui.notify(
				`Developer activation failed: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		} finally {
			this.activationPending = false;
			this.requestRender();
		}
	}

	handleInput(data: string): void {
		if (this.activationPending) return;
		this.settings.handleInput(data);
		this.requestRender();
	}
}

export async function showDeveloperSettings(
	ctx: ExtensionCommandContext,
	binding: DeveloperSettingsBinding,
): Promise<void> {
	await ctx.ui.custom<null>(
		(tui, theme, _keybindings, done) =>
			new DeveloperSettingsSurface(
				ctx,
				binding,
				theme,
				() => done(null),
				() => tui.requestRender(),
			),
	);
}

export function showPendingQuestionSelector(
	ctx: ExtensionCommandContext,
	questions: PendingQuestion[],
): Promise<string | undefined> {
	if (questions.length === 0) return Promise.resolve(undefined);
	return showSelectDialog(
		ctx,
		{
			title: "Resolve an open Developer question",
			subtitle:
				"Enter opens an answer/evidence editor; the question closes after a resolved or not-applicable judgment",
			items: pendingQuestionItems(questions),
			width: "92%",
			minWidth: 88,
			maxVisible: questions.length,
			selectedLabelMaxLines: 5,
			selectedDescriptionMaxLines: 3,
		},
		"surface",
	);
}

export type QuestionBriefAction = "continue" | "defer";

const QUESTION_BRIEF_DEFAULT_ROWS = 19;
const QUESTION_BRIEF_MIN_ROWS = 9;
const QUESTION_BRIEF_RESERVED_APP_ROWS = 5;
const QUESTION_BRIEF_FIXED_ROWS = 8;

function questionGateExplanation(question: PendingQuestion): string {
	if (question.gate === "before-implementation")
		return "Implementation remains blocked until this question is resolved.";
	if (question.gate === "before-completion")
		return "Completion remains blocked until this question is resolved.";
	return "This question does not currently block implementation or completion.";
}

export class DeveloperQuestionBriefPanel {
	private bodyLineCount = 0;
	private bodyViewportRows = 1;
	private cachedLines?: string[];
	private cachedViewportRows?: number;
	private cachedWidth?: number;
	private readonly done: (action: QuestionBriefAction) => void;
	private readonly keybindings: KeybindingsManager;
	private readonly question: PendingQuestion;
	private readonly requestRender: () => void;
	private readonly requestedViewportRows: () => number;
	private scrollOffset = 0;
	private selected: QuestionBriefAction = "continue";
	private readonly theme: Theme;

	constructor(
		question: PendingQuestion,
		theme: Theme,
		keybindings: KeybindingsManager,
		done: (action: QuestionBriefAction) => void,
		requestRender: () => void = () => {},
		requestedViewportRows: () => number = () => QUESTION_BRIEF_DEFAULT_ROWS,
	) {
		this.question = question;
		this.theme = theme;
		this.keybindings = keybindings;
		this.done = done;
		this.requestRender = requestRender;
		this.requestedViewportRows = requestedViewportRows;
	}

	private scrollPage(direction: -1 | 1): void {
		const maxOffset = Math.max(0, this.bodyLineCount - this.bodyViewportRows);
		const pageSize = Math.max(1, this.bodyViewportRows - 1);
		const nextOffset = Math.max(
			0,
			Math.min(maxOffset, this.scrollOffset + direction * pageSize),
		);
		if (nextOffset === this.scrollOffset) return;
		this.scrollOffset = nextOffset;
		this.invalidate();
		this.requestRender();
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			this.done("defer");
			return;
		}
		if (this.keybindings.matches(data, "tui.select.pageUp")) {
			this.scrollPage(-1);
			return;
		}
		if (this.keybindings.matches(data, "tui.select.pageDown")) {
			this.scrollPage(1);
			return;
		}
		if (
			this.keybindings.matches(data, "tui.select.up") ||
			this.keybindings.matches(data, "tui.select.down")
		) {
			this.selected = this.selected === "continue" ? "defer" : "continue";
			this.invalidate();
			this.requestRender();
			return;
		}
		if (this.keybindings.matches(data, "tui.select.confirm"))
			this.done(this.selected);
	}

	render(width: number): string[] {
		const viewportRows = Math.max(
			QUESTION_BRIEF_MIN_ROWS,
			Math.floor(this.requestedViewportRows()),
		);
		if (
			this.cachedLines &&
			this.cachedWidth === width &&
			this.cachedViewportRows === viewportRows
		)
			return this.cachedLines;

		const panelWidth = Math.max(1, width);
		const innerWidth = Math.max(1, panelWidth - 2);
		const bodyRows: string[] = [];
		const border = (text: string) => this.theme.fg("borderAccent", text);
		const row = (content = "") =>
			`${border("│")}${truncateToWidth(content, innerWidth, "", true)}${border("│")}`;
		const section = (title: string) =>
			bodyRows.push(
				row(`  ${this.theme.fg("accent", this.theme.bold(title))}`),
			);
		const addField = (
			label: string,
			value: string,
			color: ThemeColor = "text",
		) => {
			const labelText = `${label} ·`;
			const plainPrefix = `  ${labelText} `;
			const styledPrefix = `  ${this.theme.fg("dim", labelText)} `;
			const contentWidth = Math.max(1, innerWidth - visibleWidth(plainPrefix));
			const wrapped = wrapTextWithAnsi(
				this.theme.fg(color, value.length > 0 ? value : "(none)"),
				contentWidth,
			);
			bodyRows.push(row(styledPrefix + (wrapped[0] ?? "")));
			const indent = " ".repeat(visibleWidth(plainPrefix));
			for (const line of wrapped.slice(1)) bodyRows.push(row(indent + line));
		};
		const addMarkdownField = (
			label: string,
			value: string,
			color: ThemeColor = "text",
		) => {
			bodyRows.push(row(`  ${this.theme.fg("dim", `${label} ·`)}`));
			const contentWidth = Math.max(1, innerWidth - 4);
			const markdown = new Markdown(
				value,
				0,
				0,
				developerMarkdownTheme(this.theme),
				{ color: (text) => this.theme.fg(color, text) },
			);
			for (const line of markdown.render(contentWidth))
				bodyRows.push(row(`    ${line}`));
		};
		const action = (
			value: QuestionBriefAction,
			label: string,
			description: string,
		) => {
			const selected = this.selected === value;
			const cursor = selected ? this.theme.fg("accent", "→ ") : "  ";
			const labelColor: ThemeColor = selected ? "accent" : "text";
			const content = `${cursor}${this.theme.fg(
				labelColor,
				selected ? this.theme.bold(label) : label,
			)} ${this.theme.fg("muted", `· ${description}`)}`;
			return row(content);
		};

		section("Why this decision is required");
		if (this.question.context)
			addMarkdownField("context", this.question.context);
		else
			addField(
				"context",
				"No additional context was recorded for this legacy question.",
				"warning",
			);
		bodyRows.push(row());

		section("Decision contract");
		addField("question", this.question.question);
		addField(
			"owner / gate",
			`${this.question.resolutionOwner} / ${this.question.gate}`,
			"muted",
		);
		addField("blocked work", questionGateExplanation(this.question), "warning");
		addField("resolves when", this.question.resolutionCriteria, "muted");

		const fields = this.question.responseSpec?.fields ?? [];
		if (fields.length > 0) {
			bodyRows.push(row());
			section(`Choice preview · ${fields.length}`);
			for (const [fieldIndex, field] of fields.entries()) {
				addField(
					`field ${fieldIndex + 1}/${fields.length} · ${field.id}`,
					field.prompt,
					"accent",
				);
				if (field.description)
					addField("description", field.description, "muted");
				for (const [optionIndex, option] of field.options.entries()) {
					addField(
						`option ${optionIndex + 1}`,
						`${option.value} · ${option.label}`,
					);
					if (option.description)
						addField("meaning", option.description, "muted");
					if (option.detailPrompt)
						addField("required detail", option.detailPrompt, "warning");
				}
				addField(
					"custom answer",
					"Available after continuing if none of the listed options fit.",
					"dim",
				);
			}
		}

		this.bodyLineCount = bodyRows.length;
		this.bodyViewportRows = Math.max(
			1,
			viewportRows - QUESTION_BRIEF_FIXED_ROWS,
		);
		const maxOffset = Math.max(0, this.bodyLineCount - this.bodyViewportRows);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxOffset));
		const visibleBody = bodyRows.slice(
			this.scrollOffset,
			this.scrollOffset + this.bodyViewportRows,
		);
		while (visibleBody.length < this.bodyViewportRows) visibleBody.push(row());
		const visibleStart = this.bodyLineCount === 0 ? 0 : this.scrollOffset + 1;
		const visibleEnd = Math.min(
			this.bodyLineCount,
			this.scrollOffset + this.bodyViewportRows,
		);
		const detailStatus =
			this.bodyLineCount > this.bodyViewportRows
				? `detail ${visibleStart}-${visibleEnd}/${this.bodyLineCount} · PgUp/PgDn scroll`
				: `detail ${this.bodyLineCount}/${this.bodyLineCount}`;
		const rows = [
			border(`╭${"─".repeat(innerWidth)}╮`),
			row(
				`  ${this.theme.fg("accent", this.theme.bold("◆ Developer decision brief"))} ${this.theme.fg("muted", `· ${this.question.question}`)}`,
			),
			row(`  ${this.theme.fg("dim", detailStatus)}`),
			...visibleBody,
			border(`├${"─".repeat(innerWidth)}┤`),
			action("continue", "Continue to answer", "open the response fields"),
			action("defer", "Leave open", "keep this question and gate for later"),
			row(
				`  ${this.theme.fg("dim", "PgUp/PgDn detail · ↑↓ choose · enter confirm · esc leave open · drag select · Cmd+C copy")}`,
			),
			border(`╰${"─".repeat(innerWidth)}╯`),
		];

		this.cachedWidth = width;
		this.cachedViewportRows = viewportRows;
		this.cachedLines = rows;
		return rows;
	}

	invalidate(): void {
		this.cachedLines = undefined;
		this.cachedViewportRows = undefined;
		this.cachedWidth = undefined;
	}
}

export async function showDeveloperQuestionBrief(
	ctx: ExtensionContext,
	question: PendingQuestion,
): Promise<QuestionBriefAction> {
	const action = await ctx.ui.custom<QuestionBriefAction | null>(
		(tui, theme, keybindings, done) =>
			new DeveloperQuestionBriefPanel(
				question,
				theme,
				keybindings,
				(value) => done(value),
				() => tui.requestRender(),
				() =>
					Math.max(
						QUESTION_BRIEF_MIN_ROWS,
						(tui.terminal?.rows ??
							QUESTION_BRIEF_DEFAULT_ROWS + QUESTION_BRIEF_RESERVED_APP_ROWS) -
							QUESTION_BRIEF_RESERVED_APP_ROWS,
					),
			),
		{
			overlay: true,
			overlayOptions: {
				anchor: "center",
				width: "94%",
				maxHeight: "100%",
				margin: 1,
			},
		},
	);
	return action ?? "defer";
}

const CUSTOM_CHOICE_VALUE = "__custom__";

type ChoiceResponseAnswer =
	| { kind: "preset"; option: ChoiceResponseOption; detail?: string }
	| { kind: "custom"; text: string };

function responseWithinLimits(
	ctx: ExtensionContext,
	request: string,
	label = "Question response",
): boolean {
	const requestBytes = new TextEncoder().encode(request).byteLength;
	const requestLines = request.split(/\r?\n/).length;
	if (
		requestBytes <= MAX_IMMEDIATE_REQUEST_BYTES &&
		requestLines <= MAX_IMMEDIATE_REQUEST_LINES
	) {
		return true;
	}
	ctx.ui.notify(
		`${label} is too large (${requestBytes} bytes, ${requestLines} lines); shorten it before submitting.`,
		"warning",
	);
	return false;
}

function choiceDetailInitial(
	field: ChoiceResponseField,
	option: ChoiceResponseOption,
): string {
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
		const response = await ctx.ui.editor(
			`Add detail for ${field.id} · ${option.value}`,
			initial,
		);
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

async function editCustomChoiceAnswer(
	ctx: ExtensionContext,
	field: ChoiceResponseField,
): Promise<string | undefined> {
	const context = field.description
		? `${field.prompt}\n\n${field.description}`
		: field.prompt;
	const prefix = `${context}\n\nYour answer:\n`;
	let initial = prefix;
	while (true) {
		const response = await ctx.ui.editor(
			`Write another answer · ${field.id}`,
			initial,
		);
		if (response === undefined) return undefined;
		const text = (
			response.startsWith(prefix) ? response.slice(prefix.length) : response
		).trim();
		if (!text) {
			ctx.ui.notify(
				"Write a non-empty answer or press Esc to go back.",
				"warning",
			);
			continue;
		}
		if (!responseWithinLimits(ctx, text, "Custom answer")) {
			initial = `${prefix}${text}`;
			continue;
		}
		return text;
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
		if (answer.kind === "custom") {
			const [firstLine = "", ...remainingLines] = answer.text.split(/\r?\n/);
			lines.push(`- ${field.id}: custom — user wrote: ${firstLine}`);
			lines.push(...remainingLines.map((line) => `  ${line}`));
			continue;
		}
		lines.push(
			`- ${field.id}: ${answer.option.value} — ${answer.option.label}`,
		);
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
	const selectedValue = await showSelectDialog(
		ctx,
		{
			title: `Decision ${fieldIndex + 1}/${fieldCount} · ${field.id}`,
			subtitle: field.description ?? field.prompt,
			items: [
				...field.options.map((option) => ({
					value: option.value,
					label: `${option.value} · ${option.label}`,
					description: option.description ?? field.prompt,
				})),
				{
					value: CUSTOM_CHOICE_VALUE,
					label: "Write another answer…",
					description: "Enter an answer that is not listed above",
				},
			],
			width: "92%",
			minWidth: 88,
			maxVisible: field.options.length + 1,
			selectedLabelMaxLines: 3,
			selectedDescriptionMaxLines: 4,
		},
		"surface",
	);
	if (!selectedValue) return { kind: "cancel" };
	if (selectedValue === CUSTOM_CHOICE_VALUE) {
		const text = await editCustomChoiceAnswer(ctx, field);
		return text === undefined
			? { kind: "retry" }
			: { kind: "answer", answer: { kind: "custom", text } };
	}
	const option = field.options.find(
		(candidate) => candidate.value === selectedValue,
	);
	if (!option) return { kind: "retry" };
	const detail = option.detailPrompt
		? await editChoiceDetail(ctx, field, option)
		: undefined;
	if (option.detailPrompt && detail === undefined) return { kind: "retry" };
	return { kind: "answer", answer: { kind: "preset", option, detail } };
}

async function reviewChoiceAnswers(
	ctx: ExtensionContext,
	question: PendingQuestion,
	fields: ChoiceResponseField[],
	answers: ReadonlyArray<ChoiceResponseAnswer | undefined>,
): Promise<ChoiceReviewAction> {
	const action = await showSelectDialog(
		ctx,
		{
			title: "Review structured answer",
			subtitle: question.question,
			items: [
				{
					value: "submit",
					label: "Submit answers",
					description:
						"Send these decisions to Pi; the question remains open until judgment",
				},
				...fields.map((field, index) => {
					const answer = answers[index];
					if (!answer) {
						return {
							value: `edit:${index}`,
							label: `${field.id} · missing — Missing answer`,
							description: "Enter to answer this decision",
						};
					}
					if (answer.kind === "custom") {
						return {
							value: `edit:${index}`,
							label: `${field.id} · custom — ${answer.text.replace(/\s+/g, " ").trim()}`,
							description: "User-entered answer · Enter to change this answer",
						};
					}
					return {
						value: `edit:${index}`,
						label: `${field.id} · ${answer.option.value} — ${answer.option.label}`,
						description: answer.detail
							? `Detail: ${answer.detail}`
							: "Enter to change this answer",
					};
				}),
			],
			width: "92%",
			minWidth: 88,
			maxVisible: fields.length + 1,
			selectedLabelMaxLines: 3,
			selectedDescriptionMaxLines: 4,
		},
		"surface",
	);
	if (action === "submit") return { kind: "submit" };
	if (!action?.startsWith("edit:")) return { kind: "back" };
	const fieldIndex = Number(action.slice("edit:".length));
	if (
		!Number.isInteger(fieldIndex) ||
		fieldIndex < 0 ||
		fieldIndex >= fields.length
	) {
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
			const action = await selectChoiceAnswer(
				ctx,
				field,
				fieldIndex,
				fields.length,
			);
			if (action.kind === "retry") continue;
			if (action.kind === "cancel") {
				fieldIndex =
					previousChoiceField(fieldIndex, fields.length, returnToReview) ?? -1;
			}
			if (fieldIndex < 0) return undefined;
			if (action.kind === "cancel") continue;
			answers[fieldIndex] = action.answer;
			fieldIndex = returnToReview ? fields.length : fieldIndex + 1;
			continue;
		}

		const action = await reviewChoiceAnswers(ctx, question, fields, answers);
		if (action.kind === "submit")
			return structuredResolutionRequest(question, answers);
		if (action.kind === "edit") {
			fieldIndex = action.fieldIndex;
			returnToReview = true;
			continue;
		}
		returnToReview = false;
		fieldIndex = fields.length - 1;
	}
}

interface QuestionEditorSpec {
	title: string;
	initial: string;
}

async function prepareQuestionResolution(
	ctx: ExtensionContext,
	question: PendingQuestion,
	editor: QuestionEditorSpec,
): Promise<ImmediateQuestionDisposition> {
	while (true) {
		const action = await showDeveloperQuestionBrief(ctx, question);
		if (action === "defer") return { kind: "defer" };

		const request = question.responseSpec
			? await collectChoiceResponse(ctx, question)
			: await ctx.ui.editor(editor.title, editor.initial);
		if (request === undefined) continue;
		if (!responseWithinLimits(ctx, request)) continue;
		return { kind: "answer", request };
	}
}

export function promptImmediateUserQuestion(
	ctx: ExtensionContext,
	question: PendingQuestion,
): Promise<ImmediateQuestionDisposition> {
	return prepareQuestionResolution(ctx, question, {
		title: "Answer the new Developer question",
		initial: questionResolutionPrompt(question),
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
					`${this.theme.fg("accent", "◆ route")} ${this.theme.fg("muted", "·")} ${this.theme.fg("accent", this.state.activeRoute.target)} ${this.theme.fg("muted", this.state.activeRoute.question)}`,
					width,
					"…",
				),
			);
		}
		for (const question of this.state.pendingQuestions.slice(0, 3)) {
			const label =
				question.resolutionOwner === "user" ? "? answer" : "? evidence";
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
				this.theme.fg(
					"dim",
					`  +${this.state.pendingQuestions.length - 3} more open questions`,
				),
			);
		}
		if (this.state.implementationFramingRequired) {
			lines.push(
				this.theme.fg(
					"warning",
					"◇ gate · frame implementation before mutation (sketch or signal)",
				),
			);
		}
		if (this.state.rerouteRequired) {
			lines.push(
				this.theme.fg(
					"warning",
					"→ next · reroute from the latest implementation landing",
				),
			);
		}
		if (this.state.verificationRequired) {
			lines.push(
				this.theme.fg(
					"warning",
					"→ next · verify changed artifacts before completion",
				),
			);
		}
		return lines;
	}

	invalidate(): void {}
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

export async function editQuestionResolutionRequest(
	ctx: ExtensionCommandContext,
	question: PendingQuestion,
): Promise<string | undefined> {
	const request = questionResolutionPrompt(question);
	const current = question.responseSpec ? "" : ctx.ui.getEditorText();
	const initial = current.trim()
		? `${current.trimEnd()}\n\n${request}`
		: request;
	const disposition = await prepareQuestionResolution(ctx, question, {
		title: "Answer or investigate the selected Developer question",
		initial,
	});
	return disposition.kind === "answer" ? disposition.request : undefined;
}
