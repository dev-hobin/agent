import { basename } from "node:path";

import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
	type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	type Keybinding,
	type KeybindingsManager,
	type KeyId,
	type SelectItem,
	SelectList,
	type SettingItem,
	SettingsList,
	type SettingsListTheme,
	Text,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import type { EpisodeLanguage } from "../src/lifecycle.ts";
import type { ObserverStatusView } from "../src/observer-status.ts";

export const OBSERVER_HYPOTHESIS_DRAFT = "/observe add-hypothesis ";
export const OBSERVER_OBSERVE_MATERIAL_DRAFT = "/observe material ";
export type ObserverControlAction =
	| { readonly kind: "activation"; readonly enabled: boolean }
	| { readonly kind: "setup" }
	| { readonly kind: "language"; readonly language: EpisodeLanguage }
	| { readonly kind: "memo" }
	| { readonly kind: "review" }
	| { readonly kind: "save" }
	| { readonly kind: "add-hypothesis" }
	| { readonly kind: "observe-material" }
	| { readonly kind: "status" };

export interface ObserverControlEffects {
	applyActivation(enabled: boolean): Promise<ObserverStatusView>;
	applyLanguage(language: EpisodeLanguage): Promise<ObserverStatusView>;
	onError(error: unknown): void;
}

function displayTerminalText(value: string): string {
	return [...value.replaceAll("\r\n", "\n")]
		.map((character) => {
			if (character === "\n") return "\n";
			const code = character.charCodeAt(0);
			if (code === 0x1b) return "␛";
			if (code < 0x20 || (code >= 0x7f && code <= 0x9f))
				return character === "\t"
					? "    "
					: `\\x${code.toString(16).padStart(2, "0")}`;
			return character;
		})
		.join("");
}

function settingsTheme(theme: Theme): SettingsListTheme {
	return {
		label: (text, selected) =>
			selected ? theme.fg("accent", theme.bold(text)) : theme.fg("text", text),
		value: (text, selected) => theme.fg(selected ? "accent" : "muted", text),
		description: (text) => theme.fg("muted", text),
		cursor: theme.fg("accent", "→ "),
		hint: (text) => theme.fg("dim", text),
	};
}

function configuredKey(
	keybindings: KeybindingsManager | undefined,
	binding: Keybinding,
	fallback: string,
): string {
	return typeof keybindings?.getKeys === "function"
		? keybindings.getKeys(binding).join("/")
		: fallback;
}

function defaultOutputLanguageSubmenu(
	theme: Theme,
	keybindings?: KeybindingsManager,
): NonNullable<SettingItem["submenu"]> {
	return (currentValue, done) => {
		const items: SelectItem[] = [
			{
				value: "en",
				label: `English (en)${currentValue === "en" ? " ✓ current" : ""}`,
				description: "Write Memo and Zettel Markdown in English",
			},
			{
				value: "ko",
				label: `Korean (ko)${currentValue === "ko" ? " ✓ current" : ""}`,
				description: "Write Memo and Zettel Markdown in Korean",
			},
		];
		const list = new SelectList(items, items.length, {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", theme.bold(text)),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});
		list.setSelectedIndex(currentValue === "ko" ? 1 : 0);
		list.onSelect = (item) => done(item.value);
		list.onCancel = () => done();

		const container = new Container();
		const border = () =>
			new DynamicBorder((text: string) => theme.fg("borderAccent", text));
		container.addChild(border());
		container.addChild(
			new Text(
				theme.fg("accent", theme.bold("Choose default output language")),
				0,
				0,
			),
		);
		container.addChild(new Text("", 0, 0));
		container.addChild(list);
		container.addChild(
			new Text(
				theme.fg(
					"dim",
					`${configuredKey(keybindings, "tui.select.up", "↑")}/${configuredKey(keybindings, "tui.select.down", "↓")} move · ${configuredKey(keybindings, "tui.select.confirm", "Enter")} choose · ${configuredKey(keybindings, "tui.select.cancel", "Esc")} back`,
				),
				0,
				0,
			),
		);
		container.addChild(border());
		return {
			render: (width) => container.render(width),
			handleInput: (data) => list.handleInput(data),
			invalidate: () => container.invalidate(),
		};
	};
}

function notebookValue(view: ObserverStatusView): string {
	if (view.control.notebook === "unselected") return "Setup required";
	if (view.control.notebook === "unhealthy") return "Needs attention";
	return (
		displayTerminalText(
			basename(view.control.notebookRoot ?? view.notebook) || view.notebook,
		) || "Notebook"
	);
}

function memoValue(view: ObserverStatusView): string {
	return view.pendingMemos === "Not counted yet"
		? "Reconcile"
		: `Reconcile ${view.pendingMemos}`;
}

function reviewValue(view: ObserverStatusView): string {
	if (view.pendingObservations > 0)
		return `Review ${view.pendingObservations} observations`;
	return view.pendingMemos === "Not counted yet"
		? "Prepare proposal"
		: `Review ${view.pendingMemos} Memos`;
}

function activationDescription(view: ObserverStatusView): string {
	if (view.control.mode === "on" && view.control.episode === "reviewing-save")
		return "Observer remains On · capture is suspended until this proposal is saved or returned to Review";
	if (view.control.mode === "on")
		return "Quietly observing material and conversation · only material changes are surfaced";
	if (view.control.episode === "open")
		return "Observer is Off · the open Episode and working state remain available";
	return "Start continuous Sidecar observation";
}

/** Projects legal Observer actions into the interactive control center. */
export function observerControlItems(
	view: ObserverStatusView,
	pendingLanguage: EpisodeLanguage = view.control.notebookDefaultLanguage ??
		"en",
	languageSubmenu?: SettingItem["submenu"],
): SettingItem[] {
	const notebook: SettingItem = {
		id: view.control.canChangeNotebook ? "notebook" : "notebook-status",
		label: view.control.canChangeNotebook
			? "Notebook"
			: "Notebook (current Episode)",
		currentValue: notebookValue(view),
		values: [notebookValue(view)],
		description: view.control.canChangeNotebook
			? "Create a folder or select an existing Observer Notebook · absolute and relative paths are supported"
			: "The open Episode keeps this Notebook fixed · press Enter to inspect it",
	};
	const language: SettingItem = {
		id: "language",
		label: "Default output language",
		currentValue: view.control.notebookDefaultLanguage ?? pendingLanguage,
		...(languageSubmenu
			? { submenu: languageSubmenu }
			: { values: ["en", "ko"] }),
		description:
			"Memo and Zettel Markdown use this immediately for new work · prepared work keeps its locked language · does not change the UI language",
	};
	const activation: SettingItem = {
		id: "activation",
		label: "Observer",
		currentValue: view.control.mode === "on" ? "On" : "Off",
		values: ["On", "Off"],
		description: activationDescription(view),
	};
	const items: SettingItem[] =
		view.control.notebook === "ready"
			? [activation]
			: [notebook, language, activation];

	if (
		view.control.notebook === "ready" &&
		view.control.episode !== "reviewing-save"
	) {
		items.push({
			id: "add-hypothesis",
			label: "Add a hypothesis",
			currentValue: "Draft hypothesis",
			values: ["Draft hypothesis"],
			description:
				"Preserve an idea, then re-read the current context through it as a lens",
		});
	}

	if (view.control.canMemo) {
		items.push({
			id: "memo",
			label: "Memo",
			currentValue: memoValue(view),
			values: [memoValue(view)],
			description:
				"Reconcile current observations with related Inquiries · does not write Notebook files",
		});
	}
	if (view.control.canReview) {
		items.push({
			id: "review",
			label: "Review",
			currentValue: reviewValue(view),
			values: [reviewValue(view)],
			description:
				"Reconcile pending work and prepare an inspectable proposal · does not write Notebook files",
		});
	}
	if (view.control.canSave) {
		items.push({
			id: "save",
			label: "Save",
			currentValue: "Inspect and approve",
			values: ["Inspect and approve"],
			description:
				"Inspect the exact proposed Notebook changes, then approve or cancel",
		});
	}

	if (view.control.notebook === "ready") items.push(notebook, language);
	if (
		view.control.notebook === "ready" &&
		view.control.episode !== "reviewing-save"
	) {
		items.push({
			id: "observe-material",
			label: "Observe material",
			currentValue: "Draft request",
			values: ["Draft request"],
			description:
				"Analyze supplied or retrieved material without changing continuous Observer Mode",
		});
	}
	const healthy = view.replayHealth === "Healthy" && !view.operationalIssue;
	items.push({
		id: "status",
		label: "Status and health",
		currentValue: healthy ? "Healthy" : "Needs attention",
		values: [healthy ? "Healthy" : "Needs attention"],
		description:
			"Inspect Episode, Notebook, working set, replay, and recovery state",
	});
	return items;
}

export function observerNextStep(view: ObserverStatusView): string {
	if (view.operationalIssue || view.control.notebook === "unhealthy")
		return "Open Status and health first to inspect the recovery cause.";
	if (view.automaticProcessingPause)
		return "Automatic processing is paused. Run Memo or Review explicitly to retry.";
	if (view.control.notebook === "unselected")
		return "Connect a Notebook, then turn Observer on.";
	if (view.control.episode === "reviewing-save")
		return "Inspect the prepared proposal, then Save or cancel it.";
	if (view.pendingHypothesisReviews > 0)
		return `Review the current context through ${view.pendingHypothesisReviews} ${view.pendingHypothesisReviews === 1 ? "added hypothesis" : "added hypotheses"} before Memo reconciliation.`;
	if (view.control.mode === "on")
		return "Keep working normally. Reconcile with Memo, then Review before Save.";
	if (view.control.episode === "open")
		return "Your open work is preserved. Resume observation, inspect Status, or run Review.";
	return "Turn Observer on, add a hypothesis, or observe material on demand.";
}

interface ObserverControlSurfaceOptions {
	readonly view: ObserverStatusView;
	readonly pendingLanguage: EpisodeLanguage;
	readonly theme: Theme;
	readonly keybindings?: KeybindingsManager;
	readonly effects?: ObserverControlEffects;
	readonly done: (action: ObserverControlAction | null) => void;
	readonly requestRender: () => void;
}

function sameControlShape(
	left: readonly SettingItem[],
	right: readonly SettingItem[],
): boolean {
	return (
		left.length === right.length &&
		left.every((item, index) => {
			const other = right[index];
			return (
				other !== undefined &&
				item.id === other.id &&
				item.label === other.label &&
				item.description === other.description &&
				JSON.stringify(item.values) === JSON.stringify(other.values)
			);
		})
	);
}

export class ObserverControlSurface extends Container {
	private busy = false;
	private readonly done: (action: ObserverControlAction | null) => void;
	private readonly effects: ObserverControlEffects | undefined;
	private help!: Text;
	private readonly keybindings: KeybindingsManager | undefined;
	private pendingLanguage: EpisodeLanguage;
	private readonly requestRender: () => void;
	private settings!: SettingsList;
	private readonly theme: Theme;
	private view: ObserverStatusView;

	constructor(options: ObserverControlSurfaceOptions) {
		super();
		this.view = options.view;
		this.pendingLanguage = options.pendingLanguage;
		this.theme = options.theme;
		this.keybindings = options.keybindings;
		this.effects = options.effects;
		this.done = options.done;
		this.requestRender = options.requestRender;
		this.rebuild();
	}

	private helpText(): string {
		return this.busy
			? "Applying change…"
			: `${configuredKey(this.keybindings, "tui.select.up", "↑")}/${configuredKey(this.keybindings, "tui.select.down", "↓")} move · ${configuredKey(this.keybindings, "tui.select.confirm", "Enter")} select/change · ${configuredKey(this.keybindings, "tui.select.cancel", "Esc")} close · changes apply to the current Pi branch`;
	}

	private rebuild(): void {
		this.clear();
		this.addChild(
			new Text(this.theme.fg("accent", this.theme.bold("◆ Observer")), 0, 0),
		);
		this.addChild(
			new Text(
				this.theme.fg(
					"muted",
					"Control observation, reconciliation, and persistence in one place",
				),
				0,
				0,
			),
		);
		this.addChild(
			new Text(
				this.theme.fg("dim", `Next · ${observerNextStep(this.view)}`),
				0,
				0,
			),
		);
		this.addChild(new Text("", 0, 0));

		const items = observerControlItems(
			this.view,
			this.pendingLanguage,
			defaultOutputLanguageSubmenu(this.theme, this.keybindings),
		);
		this.settings = new SettingsList(
			items,
			items.length,
			settingsTheme(this.theme),
			(id, value) => this.select(id, value),
			() => this.done(null),
		);
		this.addChild(this.settings);
		this.help = new Text(this.theme.fg("dim", this.helpText()), 0, 0);
		this.addChild(this.help);
	}

	private setBusy(value: boolean): void {
		this.busy = value;
		this.help.setText(this.theme.fg("dim", this.helpText()));
		this.requestRender();
	}

	private sync(
		next: ObserverStatusView,
		pendingLanguage = this.pendingLanguage,
	): void {
		const previousItems = observerControlItems(
			this.view,
			this.pendingLanguage,
			defaultOutputLanguageSubmenu(this.theme, this.keybindings),
		);
		const nextItems = observerControlItems(
			next,
			pendingLanguage,
			defaultOutputLanguageSubmenu(this.theme, this.keybindings),
		);
		this.view = next;
		this.pendingLanguage = pendingLanguage;
		if (!sameControlShape(previousItems, nextItems)) {
			this.rebuild();
		} else {
			for (const item of nextItems)
				this.settings.updateValue(item.id, item.currentValue);
		}
		this.invalidate();
		this.requestRender();
	}

	private async requestActivation(enabled: boolean): Promise<void> {
		if (!this.effects || this.view.control.notebook !== "ready") {
			this.done({ kind: "activation", enabled });
			return;
		}
		if (this.busy) return;
		this.setBusy(true);
		try {
			this.sync(await this.effects.applyActivation(enabled));
		} catch (error) {
			this.effects.onError(error);
			this.sync(this.view);
		} finally {
			this.setBusy(false);
		}
	}

	private async requestLanguage(language: EpisodeLanguage): Promise<void> {
		if (!this.effects) {
			this.done({ kind: "language", language });
			return;
		}
		const current =
			this.view.control.notebookDefaultLanguage ?? this.pendingLanguage;
		if (language === current || this.busy) return;
		this.setBusy(true);
		try {
			const next = await this.effects.applyLanguage(language);
			this.sync(next, next.control.notebookDefaultLanguage ?? language);
		} catch (error) {
			this.effects.onError(error);
			this.sync(this.view);
		} finally {
			this.setBusy(false);
		}
	}

	private select(id: string, value: string): void {
		switch (id) {
			case "activation":
				void this.requestActivation(value === "On");
				break;
			case "notebook":
				this.done({ kind: "setup" });
				break;
			case "notebook-status":
			case "status":
				this.done({ kind: "status" });
				break;
			case "language":
				if (value === "ko" || value === "en") void this.requestLanguage(value);
				break;
			case "memo":
				this.done({ kind: "memo" });
				break;
			case "review":
				this.done({ kind: "review" });
				break;
			case "save":
				this.done({ kind: "save" });
				break;
			case "add-hypothesis":
				this.done({ kind: "add-hypothesis" });
				break;
			case "observe-material":
				this.done({ kind: "observe-material" });
				break;
			default:
				break;
		}
		this.requestRender();
	}

	handleInput(data: string): void {
		if (this.busy) return;
		this.settings.handleInput(data);
		this.requestRender();
	}
}

export async function showObserverControl(
	ctx: ExtensionContext,
	view: ObserverStatusView,
	pendingLanguage: EpisodeLanguage = view.control.notebookDefaultLanguage ??
		"en",
	effects?: ObserverControlEffects,
): Promise<ObserverControlAction | undefined> {
	const result = await ctx.ui.custom<ObserverControlAction | null>(
		(tui, theme, keybindings, done) => {
			const surface = new ObserverControlSurface({
				view,
				pendingLanguage,
				theme,
				keybindings,
				...(effects ? { effects } : {}),
				done,
				requestRender: () => tui.requestRender(),
			});
			return {
				render: (width) => surface.render(width),
				handleInput: (data) => surface.handleInput(data),
				invalidate: () => surface.invalidate(),
			};
		},
	);
	return result ?? undefined;
}

function healthColor(view: ObserverStatusView): ThemeColor {
	if (view.operationalIssue || view.control.notebook === "unhealthy")
		return "error";
	if (view.replayHealth !== "Healthy" || view.notebookHealth !== "Healthy")
		return "warning";
	return "success";
}

export class ObserverStatusPanel {
	private cachedHeight?: number;
	private cachedLines?: string[];
	private cachedOffset?: number;
	private cachedWidth?: number;
	private readonly keybindings?: KeybindingsManager;
	private readonly onClose: () => void;
	private readonly requestRender: () => void;
	private readonly theme: Theme;
	private readonly view: ObserverStatusView;
	private pageSize = 10;
	private scrollOffset = 0;

	constructor(
		view: ObserverStatusView,
		theme: Theme,
		onClose: () => void,
		keybindings?: KeybindingsManager,
		requestRender: () => void = () => {},
	) {
		this.view = view;
		this.theme = theme;
		this.onClose = onClose;
		this.keybindings = keybindings;
		this.requestRender = requestRender;
	}

	private matches(data: string, binding: Keybinding, fallback: KeyId): boolean {
		return this.keybindings
			? this.keybindings.matches(data, binding)
			: matchesKey(data, fallback);
	}

	private key(binding: Keybinding, fallback: string): string {
		return this.keybindings?.getKeys(binding).join("/") ?? fallback;
	}

	handleInput(data: string): void {
		if (
			this.matches(data, "tui.select.cancel", "escape") ||
			this.matches(data, "tui.select.confirm", "enter") ||
			matchesKey(data, "ctrl+c")
		) {
			this.onClose();
			return;
		}
		const previous = this.scrollOffset;
		if (this.matches(data, "tui.select.up", "up"))
			this.scrollOffset = Math.max(0, this.scrollOffset - 1);
		else if (this.matches(data, "tui.select.down", "down"))
			this.scrollOffset += 1;
		else if (this.matches(data, "tui.select.pageUp", "pageUp"))
			this.scrollOffset = Math.max(0, this.scrollOffset - this.pageSize);
		else if (this.matches(data, "tui.select.pageDown", "pageDown"))
			this.scrollOffset += this.pageSize;
		else if (matchesKey(data, "home")) this.scrollOffset = 0;
		else if (matchesKey(data, "end"))
			this.scrollOffset = Number.MAX_SAFE_INTEGER;
		if (previous !== this.scrollOffset) {
			this.invalidate();
			this.requestRender();
		}
	}

	render(width: number, maximumHeight = Number.MAX_SAFE_INTEGER): string[] {
		if (
			this.cachedLines &&
			this.cachedWidth === width &&
			this.cachedHeight === maximumHeight &&
			this.cachedOffset === this.scrollOffset
		)
			return this.cachedLines;
		const innerWidth = Math.max(1, width - 2);
		const border = (text: string) => this.theme.fg("borderAccent", text);
		const body: string[] = [];
		const row = (content = "") =>
			`${border("│")}${truncateToWidth(content, innerWidth, "…", true)}${border("│")}`;
		const section = (title: string) =>
			body.push(row(`  ${this.theme.fg("accent", this.theme.bold(title))}`));
		const add = (
			label: string,
			value: string,
			color: ThemeColor = "muted",
			maxLines: number | "all" = 3,
		) => {
			const plainPrefix = `  ${label} · `;
			const styledPrefix = `  ${this.theme.fg("dim", `${label} ·`)} `;
			const contentWidth = Math.max(1, innerWidth - visibleWidth(plainPrefix));
			const wrapped = wrapTextWithAnsi(
				this.theme.fg(color, displayTerminalText(value)),
				contentWidth,
			);
			const visible =
				maxLines === "all" ? wrapped : wrapped.slice(0, maxLines);
			if (wrapped.length > visible.length && visible.length > 0) {
				const last = visible.length - 1;
				visible[last] =
					truncateToWidth(
						visible[last] ?? "",
						Math.max(1, contentWidth - 1),
						"",
					) + this.theme.fg("dim", "…");
			}
			body.push(row(styledPrefix + (visible[0] ?? "")));
			const indent = " ".repeat(visibleWidth(plainPrefix));
			for (const line of visible.slice(1)) body.push(row(indent + line));
		};

		body.push(row());
		section("Current flow");
		add(
			"Mode",
			this.view.mode,
			this.view.control.mode === "on" ? "success" : "dim",
		);
		add("Episode", this.view.episode, "text");
		add("Output language", this.view.outputLanguage);
		add("Next", observerNextStep(this.view), "accent", 4);

		body.push(row());
		section("Notebook");
		add("Location", this.view.notebook, "text", "all");
		add(
			"Default output language",
			this.view.control.notebookDefaultLanguage ?? "Not set",
		);
		add("Validation", this.view.notebookHealth, healthColor(this.view), 4);

		body.push(row());
		section("Working set");
		add("Pending observations", String(this.view.pendingObservations));
		add("Working Memos", this.view.pendingMemos);
		for (const memo of this.view.memoItems) {
			add(
				`Memo · ${memo.title} [${memo.disposition}]`,
				memo.content,
				"text",
				"all",
			);
		}
		add(
			"Hypothesis context review",
			String(this.view.pendingHypothesisReviews),
			this.view.pendingHypothesisReviews > 0 ? "warning" : "muted",
		);
		add("Open Inquiries", this.view.openInquiries);
		for (const inquiry of this.view.inquiryItems)
			add(`Inquiry · ${inquiry.origin}`, inquiry.current, "text", "all");
		add("Zettel candidates", this.view.zettelCandidates);
		add(
			"Memo preparation",
			this.view.preparedMemo === "None" ? "None" : "Prepared",
		);
		if (this.view.preparedSaveDetails) {
			const proposal = this.view.preparedSaveDetails;
			add(
				"Save proposal",
				`${proposal.recordCount} records · create ${proposal.createCount} · update ${proposal.updateCount}`,
				"warning",
			);
			add("Proposal summary", proposal.summary, "text", 5);
			add("Proposal ID", proposal.proposalId, "muted", 2);
		} else add("Save proposal", "None");

		body.push(row());
		section("Recovery and persistence");
		add("Branch replay", this.view.replayHealth, healthColor(this.view));
		add("Pi session", this.view.sessionPersistence);
		if (this.view.automaticProcessingPause)
			add(
				"Automatic processing paused",
				this.view.automaticProcessingPause,
				"warning",
				5,
			);
		if (this.view.operationalIssue)
			add("Recovery required", this.view.operationalIssue, "error", 6);

		const top = border(`╭${"─".repeat(innerWidth)}╮`);
		const title = row(
			`  ${this.theme.fg("accent", this.theme.bold("◆ Observer status"))}`,
		);
		const bottom = border(`╰${"─".repeat(innerWidth)}╯`);
		const footer = row(
			`  ${this.theme.fg(
				"dim",
				`${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")} scroll · ${this.key("tui.select.pageUp", "PgUp")}/${this.key("tui.select.pageDown", "PgDn")} page · ${this.key("tui.select.confirm", "Enter")}/${this.key("tui.select.cancel", "Esc")} close`,
			)}`,
		);
		const height = Math.max(8, maximumHeight);
		let result: string[];
		if (body.length + 4 <= height) {
			this.scrollOffset = 0;
			this.pageSize = body.length;
			result = [top, title, ...body, footer, bottom];
		} else {
			this.pageSize = Math.max(1, height - 5);
			const maximumOffset = Math.max(0, body.length - this.pageSize);
			this.scrollOffset = Math.min(this.scrollOffset, maximumOffset);
			const position = row(
				`  ${this.theme.fg(
					"dim",
					`Showing ${this.scrollOffset + 1}-${Math.min(body.length, this.scrollOffset + this.pageSize)} of ${body.length}`,
				)}`,
			);
			result = [
				top,
				title,
				...body.slice(this.scrollOffset, this.scrollOffset + this.pageSize),
				position,
				footer,
				bottom,
			];
		}
		this.cachedWidth = width;
		this.cachedHeight = maximumHeight;
		this.cachedOffset = this.scrollOffset;
		this.cachedLines = result;
		return result;
	}

	invalidate(): void {
		this.cachedHeight = undefined;
		this.cachedLines = undefined;
		this.cachedOffset = undefined;
		this.cachedWidth = undefined;
	}
}

export async function showObserverStatus(
	ctx: ExtensionContext,
	view: ObserverStatusView,
): Promise<void> {
	await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
		const panel = new ObserverStatusPanel(
			view,
			theme,
			() => done(),
			keybindings,
			() => tui.requestRender(),
		);
		return {
			render: (width) =>
				panel.render(width, Math.max(8, tui.terminal.rows - 2)),
			handleInput: (data) => panel.handleInput(data),
			invalidate: () => panel.invalidate(),
		};
	});
}

export function renderObserverChromeStatus(
	view: ObserverStatusView,
	theme: Theme,
): string | undefined {
	const separator = theme.fg("dim", " · ");
	if (view.operationalIssue || view.control.notebook === "unhealthy")
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("error", "needs attention")
		);
	if (view.control.notebook === "unselected") return undefined;
	if (view.automaticProcessingPause)
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("warning", "processing paused")
		);
	if (view.control.episode === "reviewing-save")
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("warning", "ready to save")
		);
	if (view.control.mode === "on")
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("success", "on") +
			separator +
			theme.fg("muted", view.episode)
		);
	if (view.control.episode === "open")
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("muted", "off") +
			separator +
			theme.fg("muted", "Episode preserved")
		);
	return undefined;
}

export function shouldShowObserverWidget(view: ObserverStatusView): boolean {
	return Boolean(
		view.operationalIssue ||
			view.automaticProcessingPause ||
			view.control.notebook === "unhealthy" ||
			view.control.episode === "reviewing-save" ||
			view.control.mode === "on" ||
			view.control.episode === "open",
	);
}

export class ObserverWidget {
	private readonly theme: Theme;
	private readonly view: ObserverStatusView;

	constructor(view: ObserverStatusView, theme: Theme) {
		this.view = view;
		this.theme = theme;
	}

	render(width: number): string[] {
		const lines: string[] = [];
		if (
			this.view.operationalIssue ||
			this.view.control.notebook === "unhealthy"
		) {
			lines.push(this.theme.fg("error", "! Observer · recovery required"));
			lines.push(this.theme.fg("dim", "  /observe → Status and health"));
		} else if (this.view.automaticProcessingPause) {
			lines.push(
				this.theme.fg("warning", "! Observer · automatic processing paused"),
			);
			lines.push(
				this.theme.fg("dim", "  /observe → Memo or Review to retry explicitly"),
			);
		} else if (this.view.control.episode === "reviewing-save") {
			lines.push(
				this.theme.fg(
					"warning",
					"! Observer · reviewed proposal awaiting Save",
				),
			);
			lines.push(
				this.theme.fg(
					"dim",
					"  /observe → Save → inspect and approve or cancel",
				),
			);
		} else if (this.view.pendingHypothesisReviews > 0) {
			lines.push(
				this.theme.fg(
					"warning",
					`! Observer · ${this.view.pendingHypothesisReviews} hypothesis context review${this.view.pendingHypothesisReviews === 1 ? "" : "s"} pending`,
				),
			);
			lines.push(
				this.theme.fg(
					"dim",
					"  The next agent turn resumes the exact tracked hypothesis",
				),
			);
		} else if (this.view.control.mode === "on") {
			lines.push(
				this.theme.fg("success", "◆ Observer · on") +
					this.theme.fg("dim", ` · ${this.view.outputLanguage}`),
			);
			lines.push(
				this.theme.fg(
					"dim",
					`  Memo ${this.view.pendingMemos} · Inquiry ${this.view.openInquiries} · only material changes are surfaced`,
				),
			);
		} else {
			lines.push(this.theme.fg("muted", "◇ Observer · off"));
			lines.push(
				this.theme.fg(
					"dim",
					"  Open Episode preserved · use /observe to turn On, Memo, or Review",
				),
			);
		}
		return lines.map((line) => truncateToWidth(line, Math.max(1, width), "…"));
	}

	invalidate(): void {}
}
