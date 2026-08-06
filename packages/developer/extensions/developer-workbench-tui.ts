import {
	copyToClipboard,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	type Keybinding,
	type KeybindingsManager,
	type KeyId,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import type {
	DeveloperWorkbenchDetailBlock,
	DeveloperWorkbenchItem,
	DeveloperWorkbenchQuestionAction,
	DeveloperWorkbenchSection,
	DeveloperWorkbenchSectionId,
	DeveloperWorkbenchSnapshot,
} from "./developer-workbench.ts";

export type DeveloperWorkbenchAction =
	| { readonly kind: "question"; readonly questionId: string }
	| { readonly kind: "settings" };

type WorkbenchPane = "sections" | "items" | "detail" | "help";

interface DeveloperWorkbenchSurfaceOptions {
	readonly snapshot: DeveloperWorkbenchSnapshot;
	readonly theme: Theme;
	readonly keybindings?: KeybindingsManager;
	readonly initialSection?: DeveloperWorkbenchSectionId;
	readonly done: (action: DeveloperWorkbenchAction | null) => void;
	readonly copy?: (text: string) => void;
	readonly requestRender: () => void;
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

function fit(value: string, width: number): string {
	const safeWidth = Math.max(1, width);
	const truncated = truncateToWidth(value, safeWidth, "…", true);
	return (
		truncated + " ".repeat(Math.max(0, safeWidth - visibleWidth(truncated)))
	);
}

function wrap(value: string, width: number): readonly string[] {
	const visible = displayTerminalText(value);
	if (visible === "") return [""];
	return visible
		.split("\n")
		.flatMap((line) => wrapTextWithAnsi(line, Math.max(1, width)));
}

function blockLines(
	block: DeveloperWorkbenchDetailBlock,
	width: number,
	theme: Theme,
): readonly string[] {
	return [
		theme.fg("accent", theme.bold(block.heading)),
		...block.lines.flatMap((line) => wrap(line, width)),
		"",
	];
}

function semanticItemText(item: DeveloperWorkbenchItem): string {
	const state = item.state ? ` · ${item.state}` : "";
	return displayTerminalText(
		[
			item.title,
			`${item.label}${state}`,
			item.summary,
			...item.blocks.flatMap((block) => ["", block.heading, ...block.lines]),
		].join("\n"),
	).trimEnd();
}

function itemDetailLines(
	item: DeveloperWorkbenchItem,
	width: number,
	theme: Theme,
): readonly string[] {
	const state = item.state ? ` · ${item.state}` : "";
	return [
		theme.fg("accent", theme.bold(item.title)),
		theme.fg("muted", `${item.label}${state}`),
		...wrap(item.summary, width).map((line) => theme.fg("text", line)),
		"",
		...item.blocks.flatMap((block) => blockLines(block, width, theme)),
	];
}

function emptySectionText(
	section: DeveloperWorkbenchSection,
): readonly string[] {
	const explanation =
		section.id === "route"
			? "No judgment route is currently active. Idle does not imply product completion."
			: "The current branch contains no records in this section.";
	return ["No items in this section.", "", explanation];
}

function emptySectionLines(
	section: DeveloperWorkbenchSection,
	width: number,
	theme: Theme,
): readonly string[] {
	const [heading = "", ...detail] = emptySectionText(section);
	return [
		theme.fg("muted", heading),
		...detail.flatMap((line) => wrap(line, width)),
	];
}

function questionActionLabel(
	action: DeveloperWorkbenchQuestionAction | undefined,
): string {
	if (action === "answer") return "answer";
	if (action === "investigate") return "investigate";
	if (action === "provide-evidence") return "provide evidence";
	return "classify";
}

const DEVELOPER_HELP_LINES = [
	"Navigation",
	"↑/↓ or j/k  Move selection or scroll detail",
	"Enter        Open selected section or item",
	"Esc          Return one level; close from Sections",
	"Tab          Move between Sections and current content",
	"PgUp/PgDn   Scroll detail by one page",
	"Home/End     First/last item or top/bottom of detail",
	"y            Copy the focused semantic selection",
	"?            Open or close this help",
	"",
	"Contextual actions",
	"a            Answer or investigate the selected Question",
	"s            Open Settings from the Settings section",
	"",
	"Safety",
	"Opening the workbench, sections, and details is read-only. Question actions re-check the current branch before sending a response. Developer protocol state is not a product-completion claim.",
] as const;

function helpLines(width: number, theme: Theme): readonly string[] {
	return DEVELOPER_HELP_LINES.flatMap((line) => {
		if (
			line === "Navigation" ||
			line === "Contextual actions" ||
			line === "Safety"
		)
			return [theme.fg("accent", theme.bold(line))];
		if (line === "") return [""];
		return wrap(line, width);
	});
}

export class DeveloperWorkbenchSurface {
	private readonly copy: ((text: string) => void) | undefined;
	private detailScroll = 0;
	private detailScrollMaximum = 0;
	private readonly done: (action: DeveloperWorkbenchAction | null) => void;
	private readonly keybindings: KeybindingsManager | undefined;
	private pageSize = 1;
	private pane: WorkbenchPane = "sections";
	private paneBeforeHelp: Exclude<WorkbenchPane, "help"> = "sections";
	private readonly requestRender: () => void;
	private readonly sections: readonly DeveloperWorkbenchSection[];
	private readonly selectedItems = new Map<
		DeveloperWorkbenchSectionId,
		number
	>();
	private sectionIndex: number;
	private readonly snapshot: DeveloperWorkbenchSnapshot;
	private readonly theme: Theme;

	constructor(options: DeveloperWorkbenchSurfaceOptions) {
		this.snapshot = options.snapshot;
		this.theme = options.theme;
		this.keybindings = options.keybindings;
		this.done = options.done;
		this.copy = options.copy;
		this.requestRender = options.requestRender;
		this.sections = options.snapshot.sections;
		const initial = options.initialSection
			? this.sections.findIndex(
					(section) => section.id === options.initialSection,
				)
			: 0;
		this.sectionIndex = initial >= 0 ? initial : 0;
	}

	private matches(data: string, binding: Keybinding, fallback: KeyId): boolean {
		return this.keybindings
			? this.keybindings.matches(data, binding)
			: matchesKey(data, fallback);
	}

	private key(binding: Keybinding, fallback: string): string {
		return this.keybindings?.getKeys(binding).join("/") ?? fallback;
	}

	private section(): DeveloperWorkbenchSection {
		const section = this.sections[this.sectionIndex] ?? this.sections[0];
		if (!section) throw new Error("Developer workbench has no sections.");
		return section;
	}

	private selectedIndex(section = this.section()): number {
		return Math.min(
			Math.max(0, this.selectedItems.get(section.id) ?? 0),
			Math.max(0, section.items.length - 1),
		);
	}

	private selectedItem(): DeveloperWorkbenchItem | undefined {
		const section = this.section();
		return section.items[this.selectedIndex(section)];
	}

	private moveSelection(delta: number): void {
		if (this.pane === "sections") {
			this.sectionIndex = Math.min(
				Math.max(0, this.sectionIndex + delta),
				this.sections.length - 1,
			);
			this.detailScroll = 0;
			return;
		}
		if (this.pane === "items") {
			const section = this.section();
			const next = Math.min(
				Math.max(0, this.selectedIndex(section) + delta),
				Math.max(0, section.items.length - 1),
			);
			this.selectedItems.set(section.id, next);
			this.detailScroll = 0;
			return;
		}
		this.detailScroll = Math.min(
			Math.max(0, this.detailScroll + delta),
			this.detailScrollMaximum,
		);
	}

	private moveBoundary(end: boolean): void {
		if (this.pane === "sections") {
			this.sectionIndex = end ? this.sections.length - 1 : 0;
			return;
		}
		if (this.pane === "items") {
			const section = this.section();
			this.selectedItems.set(
				section.id,
				end ? Math.max(0, section.items.length - 1) : 0,
			);
			return;
		}
		this.detailScroll = end ? this.detailScrollMaximum : 0;
	}

	private openSelection(): void {
		const section = this.section();
		if (section.id === "settings") {
			this.done({ kind: "settings" });
			return;
		}
		if (this.pane === "sections") {
			this.pane = section.items.length > 1 ? "items" : "detail";
			this.detailScroll = 0;
			return;
		}
		if (this.pane === "items") {
			this.pane = "detail";
			this.detailScroll = 0;
		}
	}

	private back(): void {
		if (this.pane === "help") {
			this.pane = this.paneBeforeHelp;
			this.detailScroll = 0;
			return;
		}
		if (this.pane === "detail") {
			this.pane = this.section().items.length > 1 ? "items" : "sections";
			this.detailScroll = 0;
			return;
		}
		if (this.pane === "items") {
			this.pane = "sections";
			return;
		}
		this.done(null);
	}

	private toggleFocus(): void {
		if (this.pane === "help") return;
		if (this.pane === "sections") {
			const section = this.section();
			if (section.id === "settings") return;
			this.pane = section.items.length > 1 ? "items" : "detail";
		} else this.pane = "sections";
		this.detailScroll = 0;
	}

	private contextualAction(data: string): boolean {
		if (this.pane === "help") return false;
		const section = this.section();
		if (data === "s" && section.id === "settings") {
			this.done({ kind: "settings" });
			return true;
		}
		if (data !== "a" || section.id !== "questions" || this.pane === "sections")
			return false;
		const item = this.selectedItem();
		if (!item?.questionAction) return false;
		this.done({ kind: "question", questionId: item.id });
		return true;
	}

	private toggleHelp(): void {
		if (this.pane === "help") this.pane = this.paneBeforeHelp;
		else {
			this.paneBeforeHelp = this.pane;
			this.pane = "help";
		}
		this.detailScroll = 0;
	}

	private copyFocusedSelection(): void {
		if (!this.copy) return;
		if (this.pane === "help") {
			this.copy(DEVELOPER_HELP_LINES.join("\n"));
			return;
		}
		const section = this.section();
		if (this.pane === "sections") {
			this.copy(
				displayTerminalText(
					[section.label, section.value].filter(Boolean).join("\n"),
				),
			);
			return;
		}
		const item = this.selectedItem();
		this.copy(
			item
				? semanticItemText(item)
				: displayTerminalText(emptySectionText(section).join("\n")),
		);
	}

	private routeInput(data: string): boolean {
		if (this.matches(data, "tui.select.cancel", "escape")) this.back();
		else if (this.matches(data, "tui.select.confirm", "enter"))
			this.openSelection();
		else if (matchesKey(data, "tab")) this.toggleFocus();
		else return false;
		return true;
	}

	private movementInput(data: string): boolean {
		if (this.matches(data, "tui.select.up", "up") || data === "k") {
			this.moveSelection(-1);
			return true;
		}
		if (this.matches(data, "tui.select.down", "down") || data === "j") {
			this.moveSelection(1);
			return true;
		}
		if (this.matches(data, "tui.select.pageUp", "pageUp")) {
			this.moveSelection(-this.pageSize);
			return true;
		}
		if (this.matches(data, "tui.select.pageDown", "pageDown")) {
			this.moveSelection(this.pageSize);
			return true;
		}
		if (matchesKey(data, "home") || data === "g") {
			this.moveBoundary(false);
			return true;
		}
		if (matchesKey(data, "end") || data === "G") {
			this.moveBoundary(true);
			return true;
		}
		return false;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "ctrl+c")) {
			this.done(null);
			return;
		}
		if (data === "y") {
			this.copyFocusedSelection();
			return;
		}
		if (data === "?") {
			this.toggleHelp();
			this.requestRender();
			return;
		}
		if (this.contextualAction(data)) return;
		if (this.routeInput(data) || this.movementInput(data)) this.requestRender();
	}

	private sectionLines(width: number, height: number): readonly string[] {
		const start = Math.min(
			Math.max(0, this.sectionIndex - height + 1),
			Math.max(0, this.sections.length - height),
		);
		return this.sections.slice(start, start + height).map((section, offset) => {
			const index = start + offset;
			const selected = index === this.sectionIndex;
			const cursor = selected ? "› " : "  ";
			const valueWidth = Math.min(18, Math.max(0, width - 5));
			const labelWidth = Math.max(1, width - 2 - valueWidth);
			const label = fit(section.label, labelWidth);
			const value = section.value.padStart(valueWidth);
			const text = `${cursor}${label}${value}`;
			if (!selected) return this.theme.fg("muted", text);
			return this.pane === "sections"
				? this.theme.fg("accent", this.theme.bold(text))
				: this.theme.fg("text", text);
		});
	}

	private itemLines(
		section: DeveloperWorkbenchSection,
		width: number,
		height: number,
	): readonly string[] {
		if (section.items.length === 0)
			return emptySectionLines(section, width, this.theme).slice(0, height);
		const selectedIndex = this.selectedIndex(section);
		const start = Math.min(
			Math.max(0, selectedIndex - height + 1),
			Math.max(0, section.items.length - height),
		);
		return section.items.slice(start, start + height).map((item, offset) => {
			const selected = start + offset === selectedIndex;
			const cursor = selected ? "› " : "  ";
			const state = item.state ? ` · ${item.state}` : "";
			const text = `${cursor}${item.label}${state} · ${item.title}`;
			if (!selected) return this.theme.fg("muted", text);
			return this.pane === "items"
				? this.theme.fg("accent", this.theme.bold(text))
				: this.theme.fg("text", text);
		});
	}

	private detailLines(width: number): readonly string[] {
		if (this.pane === "help") return helpLines(width, this.theme);
		const section = this.section();
		const item = this.selectedItem();
		return item
			? itemDetailLines(item, width, this.theme)
			: emptySectionLines(section, width, this.theme);
	}

	private footer(): string {
		if (this.pane === "help")
			return `${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")} scroll · PgUp/PgDn page · y copy · ?/${this.key("tui.select.cancel", "Esc")} back`;
		const base =
			this.pane === "detail"
				? `${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")} scroll · PgUp/PgDn page · Esc back`
				: `${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")}/jk move · ${this.key("tui.select.confirm", "Enter")} open · ${this.key("tui.select.cancel", "Esc")} back`;
		const section = this.section();
		const contextual: string[] = [];
		const item = this.selectedItem();
		if (
			section.id === "questions" &&
			this.pane !== "sections" &&
			item?.questionAction
		)
			contextual.push(`a ${questionActionLabel(item.questionAction)}`);
		if (section.id === "settings") contextual.push("s Settings");
		contextual.push("y copy", "? help");
		return `${base} · ${contextual.join(" · ")}`;
	}

	render(width: number, maximumHeight = Number.MAX_SAFE_INTEGER): string[] {
		const panelWidth = Math.max(12, width);
		const innerWidth = Math.max(1, panelWidth - 2);
		const height = Math.max(8, maximumHeight);
		const bodyHeight = Math.max(3, height - 5);
		const wide = innerWidth >= 82;
		const border = (value: string) => this.theme.fg("borderAccent", value);
		const title = ` ◆ Developer workbench · ${this.snapshot.enabled ? "ON" : "OFF"} · ${this.snapshot.protocol} · ${this.snapshot.activeTarget}`;
		const top = border(`╭${"─".repeat(innerWidth)}╮`);
		const titleRow = `${border("│")}${fit(
			this.theme.fg("accent", this.theme.bold(title)),
			innerWidth,
		)}${border("│")}`;
		const separator = wide ? undefined : border(`├${"─".repeat(innerWidth)}┤`);
		const footer = `${border("│")}${fit(
			this.theme.fg("dim", ` ${this.footer()}`),
			innerWidth,
		)}${border("│")}`;
		const bottom = border(`╰${"─".repeat(innerWidth)}╯`);

		if (wide) {
			const navigationWidth = Math.min(
				30,
				Math.max(23, Math.floor(innerWidth * 0.29)),
			);
			const contentWidth = Math.max(1, innerWidth - navigationWidth - 1);
			const wideSeparator = border(
				`├${"─".repeat(navigationWidth)}┬${"─".repeat(contentWidth)}┤`,
			);
			const left = this.sectionLines(navigationWidth, bodyHeight);
			let right: readonly string[];
			const section = this.section();
			const showDetail =
				this.pane === "detail" ||
				this.pane === "help" ||
				(this.pane === "sections" && section.items.length === 1);
			if (showDetail) {
				const all = this.detailLines(contentWidth);
				this.pageSize = bodyHeight;
				this.detailScrollMaximum = Math.max(0, all.length - bodyHeight);
				this.detailScroll = Math.min(
					this.detailScroll,
					this.detailScrollMaximum,
				);
				right = all.slice(this.detailScroll, this.detailScroll + bodyHeight);
			} else {
				right = this.itemLines(section, contentWidth, bodyHeight);
				this.pageSize = bodyHeight;
				this.detailScrollMaximum = 0;
			}
			const rows = Array.from(
				{ length: bodyHeight },
				(_, index) =>
					`${border("│")}${fit(left[index] ?? "", navigationWidth)}${border("│")}${fit(right[index] ?? "", contentWidth)}${border("│")}`,
			);
			return [top, titleRow, wideSeparator, ...rows, footer, bottom];
		}

		let body: readonly string[];
		if (this.pane === "sections")
			body = this.sectionLines(innerWidth, bodyHeight);
		else if (this.pane === "items")
			body = this.itemLines(this.section(), innerWidth, bodyHeight);
		else {
			const all = this.detailLines(innerWidth);
			this.pageSize = bodyHeight;
			this.detailScrollMaximum = Math.max(0, all.length - bodyHeight);
			this.detailScroll = Math.min(this.detailScroll, this.detailScrollMaximum);
			body = all.slice(this.detailScroll, this.detailScroll + bodyHeight);
		}
		const rows = Array.from(
			{ length: bodyHeight },
			(_, index) =>
				`${border("│")}${fit(body[index] ?? "", innerWidth)}${border("│")}`,
		);
		return [top, titleRow, separator!, ...rows, footer, bottom];
	}

	invalidate(): void {}
}

export async function showDeveloperWorkbench(
	ctx: ExtensionContext,
	snapshot: DeveloperWorkbenchSnapshot,
	initialSection?: DeveloperWorkbenchSectionId,
): Promise<DeveloperWorkbenchAction | undefined> {
	const result = await ctx.ui.custom<DeveloperWorkbenchAction | null>(
		(tui, theme, keybindings, done) => {
			const surface = new DeveloperWorkbenchSurface({
				snapshot,
				theme,
				keybindings,
				initialSection,
				done,
				copy: (text) => {
					void copyToClipboard(text).then(
						() =>
							ctx.ui.notify(
								"Focused Developer content copied to clipboard.",
								"info",
							),
						(error: unknown) =>
							ctx.ui.notify(
								`Could not copy focused Developer content: ${error instanceof Error ? error.message : String(error)}`,
								"error",
							),
					);
				},
				requestRender: () => tui.requestRender(),
			});
			return {
				render: (width) =>
					surface.render(width, Math.max(8, tui.terminal.rows)),
				handleInput: (data) => surface.handleInput(data),
				invalidate: () => surface.invalidate(),
			};
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "top-center",
				width: "100%",
				maxHeight: "100%",
			},
		},
	);
	return result ?? undefined;
}
