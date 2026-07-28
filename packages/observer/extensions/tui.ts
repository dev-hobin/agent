import { basename } from "node:path";

import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
	type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
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

export const OBSERVER_HYPOTHESIS_DRAFT = "/observe hypothesis ";
export const OBSERVER_OBSERVE_MATERIAL_DRAFT =
	"Observe this material with Observer without enabling continuous mode:\n";
export type ObserverControlAction =
	| { readonly kind: "activation"; readonly enabled: boolean }
	| { readonly kind: "setup" }
	| { readonly kind: "language"; readonly language: EpisodeLanguage }
	| { readonly kind: "memo" }
	| { readonly kind: "review-save" }
	| { readonly kind: "track-hypothesis" }
	| { readonly kind: "observe-material" }
	| { readonly kind: "status" };

export interface ObserverControlEffects {
	applyActivation(enabled: boolean): Promise<ObserverStatusView>;
	applyLanguage(language: EpisodeLanguage): Promise<ObserverStatusView>;
	onError(error: unknown): void;
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

function defaultOutputLanguageSubmenu(
	theme: Theme,
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
			new Text(theme.fg("dim", "↑↓ move · Enter choose · Esc back"), 0, 0),
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
	return basename(view.control.notebookRoot ?? view.notebook) || view.notebook;
}

function memoValue(view: ObserverStatusView): string {
	return view.pendingMemos === "Not counted yet"
		? "Reconcile"
		: `Reconcile ${view.pendingMemos}`;
}

function saveValue(view: ObserverStatusView): string {
	return view.control.episode === "reviewing-save"
		? "Review proposal"
		: "Prepare save plan";
}

function activationDescription(view: ObserverStatusView): string {
	if (view.control.mode === "on")
		return "Quietly observing material and conversation · only material changes are surfaced";
	if (view.control.episode === "open")
		return "Observation is paused while the open Episode and working state are preserved";
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
			view.control.episode === "open" ||
			view.control.episode === "reviewing-save"
				? `Memo and Zettel Markdown use this for the next Episode · the current Episode remains ${view.episodeLanguage}`
				: "Language used when Observer writes Memo and Zettel Markdown · does not change the UI language",
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
			id: "track-hypothesis",
			label: "Track a hypothesis",
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
	if (view.control.canSave) {
		items.push({
			id: "review-save",
			label: "Review & Save",
			currentValue: saveValue(view),
			values: [saveValue(view)],
			description:
				view.control.episode === "reviewing-save"
					? "Review proposed Notebook changes, then approve or cancel"
					: "Reconcile pending work, prepare Notebook changes, and settle the Episode after approval",
		});
	}

	if (view.control.notebook === "ready") items.push(notebook, language);
	if (
		view.control.mode === "off" &&
		view.control.notebook === "ready" &&
		view.control.episode !== "reviewing-save"
	) {
		items.push({
			id: "observe-material",
			label: "Observe material",
			currentValue: "Draft request",
			values: ["Draft request"],
			description:
				"Analyze supplied or retrieved material without enabling continuous Observer mode",
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
	if (view.control.notebook === "unselected")
		return "Connect a Notebook, then turn Observer on.";
	if (view.control.episode === "reviewing-save")
		return "Review the save proposal, then approve or cancel it.";
	if (view.pendingHypothesisReviews > 0)
		return `Review the current context through ${view.pendingHypothesisReviews} ${view.pendingHypothesisReviews === 1 ? "tracked hypothesis" : "tracked hypotheses"} before Memo reconciliation.`;
	if (view.control.mode === "on")
		return "Keep working normally. Track hypotheses, reconcile with Memo, then review and save when ready.";
	if (view.control.episode === "open")
		return "Your open work is preserved. Resume observation, track a hypothesis, or review and save.";
	return "Turn Observer on, track a hypothesis, or observe material on demand.";
}

interface ObserverControlSurfaceOptions {
	readonly view: ObserverStatusView;
	readonly pendingLanguage: EpisodeLanguage;
	readonly theme: Theme;
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
		this.effects = options.effects;
		this.done = options.done;
		this.requestRender = options.requestRender;
		this.rebuild();
	}

	private helpText(): string {
		return this.busy
			? "Applying change…"
			: "↑↓ move · Enter select/change · Esc close · changes apply to the current Pi branch";
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
			defaultOutputLanguageSubmenu(this.theme),
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
			defaultOutputLanguageSubmenu(this.theme),
		);
		const nextItems = observerControlItems(
			next,
			pendingLanguage,
			defaultOutputLanguageSubmenu(this.theme),
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
			case "review-save":
				this.done({ kind: "review-save" });
				break;
			case "track-hypothesis":
				this.done({ kind: "track-hypothesis" });
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
		(tui, theme, _keybindings, done) => {
			const surface = new ObserverControlSurface({
				view,
				pendingLanguage,
				theme,
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
	private cachedLines?: string[];
	private cachedWidth?: number;
	private readonly onClose: () => void;
	private readonly theme: Theme;
	private readonly view: ObserverStatusView;

	constructor(view: ObserverStatusView, theme: Theme, onClose: () => void) {
		this.view = view;
		this.theme = theme;
		this.onClose = onClose;
	}

	handleInput(data: string): void {
		if (
			matchesKey(data, "escape") ||
			matchesKey(data, "enter") ||
			matchesKey(data, "ctrl+c")
		)
			this.onClose();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const innerWidth = Math.max(1, width - 2);
		const border = (text: string) => this.theme.fg("borderAccent", text);
		const rows: string[] = [];
		const row = (content = "") =>
			`${border("│")}${truncateToWidth(content, innerWidth, "…", true)}${border("│")}`;
		const section = (title: string) =>
			rows.push(row(`  ${this.theme.fg("accent", this.theme.bold(title))}`));
		const add = (
			label: string,
			value: string,
			color: ThemeColor = "muted",
			maxLines = 3,
		) => {
			const plainPrefix = `  ${label} · `;
			const styledPrefix = `  ${this.theme.fg("dim", `${label} ·`)} `;
			const contentWidth = Math.max(1, innerWidth - visibleWidth(plainPrefix));
			const wrapped = wrapTextWithAnsi(
				this.theme.fg(color, value),
				contentWidth,
			);
			const visible = wrapped.slice(0, maxLines);
			if (wrapped.length > visible.length && visible.length > 0) {
				const last = visible.length - 1;
				visible[last] =
					truncateToWidth(
						visible[last] ?? "",
						Math.max(1, contentWidth - 1),
						"",
					) + this.theme.fg("dim", "…");
			}
			rows.push(row(styledPrefix + (visible[0] ?? "")));
			const indent = " ".repeat(visibleWidth(plainPrefix));
			for (const line of visible.slice(1)) rows.push(row(indent + line));
		};

		rows.push(border(`╭${"─".repeat(innerWidth)}╮`));
		rows.push(
			row(`  ${this.theme.fg("accent", this.theme.bold("◆ Observer status"))}`),
		);
		rows.push(row());
		section("Current flow");
		add(
			"Mode",
			this.view.mode,
			this.view.control.mode === "on" ? "success" : "dim",
		);
		add("Episode", this.view.episode, "text");
		add("Output language", this.view.episodeLanguage);
		add("Next", observerNextStep(this.view), "accent", 4);

		rows.push(row());
		section("Notebook");
		add("Location", this.view.notebook, "text", 4);
		add(
			"Default output language",
			this.view.control.notebookDefaultLanguage ?? "Not set",
		);
		add("Validation", this.view.notebookHealth, healthColor(this.view), 4);

		rows.push(row());
		section("Working set");
		add("Pending Memo", this.view.pendingMemos);
		add(
			"Hypothesis context review",
			String(this.view.pendingHypothesisReviews),
			this.view.pendingHypothesisReviews > 0 ? "warning" : "muted",
		);
		add("Open Inquiry", this.view.openInquiries);
		add("Zettel candidates", this.view.zettelCandidates);
		add(
			"Memo preparation",
			this.view.preparedMemo === "None" ? "None" : "Prepared",
		);
		add(
			"Save proposal",
			this.view.preparedSave === "None" ? "None" : "Ready for review",
		);

		rows.push(row());
		section("Recovery and persistence");
		add("Branch replay", this.view.replayHealth, healthColor(this.view));
		add("Pi session", this.view.sessionPersistence);
		if (this.view.operationalIssue)
			add("Recovery required", this.view.operationalIssue, "error", 6);

		rows.push(row());
		for (const line of wrapTextWithAnsi(
			this.theme.fg(
				"dim",
				"mouse wheel scroll · drag select · Cmd+C copy · Enter/Esc close",
			),
			Math.max(1, innerWidth - 2),
		))
			rows.push(row(`  ${line}`));
		rows.push(border(`╰${"─".repeat(innerWidth)}╯`));
		this.cachedWidth = width;
		this.cachedLines = rows;
		return rows;
	}

	invalidate(): void {
		this.cachedLines = undefined;
		this.cachedWidth = undefined;
	}
}

export async function showObserverStatus(
	ctx: ExtensionContext,
	view: ObserverStatusView,
): Promise<void> {
	await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
		const panel = new ObserverStatusPanel(view, theme, () => done());
		return {
			render: (width) => panel.render(width),
			handleInput: (data) => panel.handleInput(data),
			invalidate: () => panel.invalidate(),
		};
	});
}

export function renderObserverChromeStatus(
	view: ObserverStatusView,
	theme: Theme,
): string {
	const separator = theme.fg("dim", " · ");
	if (view.operationalIssue || view.control.notebook === "unhealthy")
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("error", "needs attention")
		);
	if (view.control.notebook === "unselected")
		return (
			theme.fg("accent", "observer") + separator + theme.fg("warning", "setup")
		);
	if (view.control.episode === "reviewing-save")
		return (
			theme.fg("accent", "observer") +
			separator +
			theme.fg("warning", "save review")
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
			theme.fg("warning", "paused") +
			separator +
			theme.fg("muted", "Episode preserved")
		);
	return theme.fg("dim", "observer · ready");
}

export function shouldShowObserverWidget(view: ObserverStatusView): boolean {
	return Boolean(
		view.operationalIssue ||
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
		} else if (this.view.control.episode === "reviewing-save") {
			lines.push(
				this.theme.fg("warning", "! Observer · save proposal awaiting review"),
			);
			lines.push(
				this.theme.fg("dim", "  /observe → Review & Save → approve or cancel"),
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
				this.theme.fg("success", "◆ Observer · observing") +
					this.theme.fg("dim", ` · ${this.view.episodeLanguage}`),
			);
			lines.push(
				this.theme.fg(
					"dim",
					`  Memo ${this.view.pendingMemos} · Inquiry ${this.view.openInquiries} · only material changes are surfaced`,
				),
			);
		} else {
			lines.push(this.theme.fg("warning", "◇ Observer · paused"));
			lines.push(
				this.theme.fg(
					"dim",
					"  Open Episode preserved · use /observe to resume, Memo, or Review & Save",
				),
			);
		}
		return lines.map((line) => truncateToWidth(line, Math.max(1, width), "…"));
	}

	invalidate(): void {}
}
