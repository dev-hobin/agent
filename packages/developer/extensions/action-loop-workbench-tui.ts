import {
	copyToClipboard,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import type {
	ActionLoopWorkbenchDetail,
	ActionLoopWorkbenchItem,
	ActionLoopWorkbenchSection,
	ActionLoopWorkbenchSectionId,
	ActionLoopWorkbenchSnapshot,
} from "./action-loop-workbench.ts";

type WorkbenchTone = ActionLoopWorkbenchItem["tone"];
type WorkbenchPane = "sections" | "items" | "detail" | "help";

function tone(theme: Theme, value: WorkbenchTone, text: string): string {
	switch (value) {
		case "success":
			return theme.fg("success", text);
		case "warning":
			return theme.fg("warning", text);
		case "error":
			return theme.fg("error", text);
		case "muted":
			return theme.fg("muted", text);
		default:
			return theme.fg("text", text);
	}
}

function fit(value: string, width: number): string {
	const safeWidth = Math.max(1, width);
	const truncated = truncateToWidth(value, safeWidth, "…", true);
	return truncated + " ".repeat(Math.max(0, safeWidth - visibleWidth(truncated)));
}

function wrap(value: string, width: number): readonly string[] {
	return wrapTextWithAnsi(value, Math.max(1, width));
}

function detailLines(
	detail: ActionLoopWorkbenchDetail,
	width: number,
	theme: Theme,
): readonly string[] {
	return [
		theme.fg("accent", theme.bold(detail.label)),
		...detail.lines.flatMap((line) => wrap(line, width)),
		"",
	];
}

function semanticItemText(item: ActionLoopWorkbenchItem): string {
	return [
		item.title,
		item.summary,
		...item.details.flatMap((detail) => [detail.label, ...detail.lines]),
	].join("\n");
}

const HELP_LINES = [
	"Navigation",
	"←/→       Move section",
	"↑/↓ or j/k Move item or scroll detail",
	"Enter      Open section or item",
	"Esc        Return one level; close from Sections",
	"Tab        Move between Sections and current content",
	"PgUp/PgDn Scroll detail by one page",
	"Home/End  First/last item or top/bottom of detail",
	"y          Copy the focused semantic selection",
	"?          Open or close help",
	"",
	"Safety",
	"The Workbench is a read-only projection of durable canonical checkpoints.",
] as const;

function renderSectionLines(
	snapshot: ActionLoopWorkbenchSnapshot,
	theme: Theme,
	sectionIndex: number,
	width: number,
	height: number,
): readonly string[] {
	const start = Math.min(
		Math.max(0, sectionIndex - height + 1),
		Math.max(0, snapshot.sections.length - height),
	);
	return snapshot.sections.slice(start, start + height).map((section, offset) => {
		const selected = start + offset === sectionIndex;
		const valueWidth = Math.min(15, Math.max(0, width - 6));
		const labelWidth = Math.max(1, width - valueWidth - 2);
		const line = `${selected ? "› " : "  "}${fit(section.label, labelWidth)}${section.value.padStart(valueWidth)}`;
		return selected
			? theme.fg("accent", theme.bold(line))
			: theme.fg("muted", line);
	});
}

function renderItemLines(
	theme: Theme,
	section: ActionLoopWorkbenchSection,
	selectedIndex: number,
	width: number,
	height: number,
): readonly string[] {
	if (section.items.length === 0) {
		return [theme.fg("muted", "No canonical records in this section.")];
	}
	const start = Math.min(
		Math.max(0, selectedIndex - height + 1),
		Math.max(0, section.items.length - height),
	);
	return section.items.slice(start, start + height).map((current, offset) => {
		const selected = start + offset === selectedIndex;
		const line = `${selected ? "› " : "  "}${current.title} · ${current.summary}`;
		return selected
			? theme.fg("accent", theme.bold(fit(line, width)))
			: theme.fg("muted", fit(line, width));
	});
}

function renderDetailLines(
	theme: Theme,
	pane: WorkbenchPane,
	selected: ActionLoopWorkbenchItem | undefined,
	width: number,
): readonly string[] {
	if (pane === "help") return HELP_LINES.flatMap((line) => wrap(line, width));
	if (!selected) return [theme.fg("muted", "No canonical record selected.")];
	return [
		tone(theme, selected.tone, theme.bold(selected.title)),
		...wrap(selected.summary, width),
		"",
		...selected.details.flatMap((current) =>
			detailLines(current, width, theme),
		),
	];
}

async function copyWorkbenchContent(
	ctx: ExtensionContext,
	text: string,
): Promise<void> {
	try {
		await copyToClipboard(text);
		ctx.ui.notify("Focused Developer content copied.", "info");
	} catch (error) {
		ctx.ui.notify(
			`Could not copy Developer content: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
}

export class ActionLoopWorkbenchSurface {
	private readonly copy: ((text: string) => void) | undefined;
	private detailScroll = 0;
	private detailScrollMaximum = 0;
	private readonly done: () => void;
	private readonly itemIndexes = new Map<ActionLoopWorkbenchSectionId, number>();
	private pageSize = 1;
	private pane: WorkbenchPane = "sections";
	private paneBeforeHelp: Exclude<WorkbenchPane, "help"> = "sections";
	private readonly requestRender: () => void;
	private sectionIndex = 0;
	private readonly snapshot: ActionLoopWorkbenchSnapshot;
	private readonly theme: Theme;

	constructor(options: {
		readonly snapshot: ActionLoopWorkbenchSnapshot;
		readonly theme: Theme;
		readonly done: () => void;
		readonly requestRender: () => void;
		readonly copy?: (text: string) => void;
		readonly initialSection?: ActionLoopWorkbenchSectionId;
	}) {
		this.snapshot = options.snapshot;
		this.theme = options.theme;
		this.done = options.done;
		this.copy = options.copy;
		this.requestRender = options.requestRender;
		const initial = options.initialSection
			? options.snapshot.sections.findIndex(
					(section) => section.id === options.initialSection,
				)
			: 0;
		this.sectionIndex = Math.max(0, initial);
	}

	private section(): ActionLoopWorkbenchSection {
		const section =
			this.snapshot.sections[this.sectionIndex] ?? this.snapshot.sections[0];
		if (!section) throw new Error("Action Loop Workbench requires one section");
		return section;
	}

	private itemIndex(section = this.section()): number {
		const current = this.itemIndexes.get(section.id) ?? 0;
		return Math.min(current, Math.max(0, section.items.length - 1));
	}

	private selectedItem(): ActionLoopWorkbenchItem | undefined {
		const section = this.section();
		return section.items[this.itemIndex(section)];
	}

	private moveSection(delta: number): void {
		const count = this.snapshot.sections.length;
		this.sectionIndex = (this.sectionIndex + delta + count) % count;
		this.pane = "sections";
		this.detailScroll = 0;
	}

	private moveItem(delta: number): void {
		if (this.pane === "sections") {
			this.moveSection(delta);
			return;
		}
		if (this.pane === "items") {
			const section = this.section();
			if (section.items.length === 0) return;
			const next = Math.min(
				Math.max(0, this.itemIndex(section) + delta),
				section.items.length - 1,
			);
			this.itemIndexes.set(section.id, next);
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
			this.sectionIndex = end ? this.snapshot.sections.length - 1 : 0;
			return;
		}
		if (this.pane === "items") {
			const section = this.section();
			this.itemIndexes.set(
				section.id,
				end ? Math.max(0, section.items.length - 1) : 0,
			);
			return;
		}
		this.detailScroll = end ? this.detailScrollMaximum : 0;
	}

	private openSelection(): void {
		const section = this.section();
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
		this.done();
	}

	private toggleFocus(): void {
		if (this.pane === "help") return;
		if (this.pane === "sections") {
			this.pane = this.section().items.length > 1 ? "items" : "detail";
		} else {
			this.pane = "sections";
		}
		this.detailScroll = 0;
	}

	private toggleHelp(): void {
		if (this.pane === "help") this.pane = this.paneBeforeHelp;
		else {
			this.paneBeforeHelp = this.pane;
			this.pane = "help";
		}
		this.detailScroll = 0;
	}

	private copySelection(): void {
		if (!this.copy) return;
		if (this.pane === "help") {
			this.copy(HELP_LINES.join("\n"));
			return;
		}
		const section = this.section();
		if (this.pane === "sections") {
			this.copy(`${section.label}\n${section.value}`);
			return;
		}
		const selected = this.selectedItem();
		this.copy(selected ? semanticItemText(selected) : section.label);
	}

	private routeInput(data: string): boolean {
		if (matchesKey(data, Key.escape)) this.back();
		else if (matchesKey(data, Key.enter)) this.openSelection();
		else if (matchesKey(data, Key.left)) this.moveSection(-1);
		else if (matchesKey(data, Key.right)) this.moveSection(1);
		else if (matchesKey(data, Key.tab)) this.toggleFocus();
		else return false;
		return true;
	}

	private movementInput(data: string): boolean {
		if (matchesKey(data, Key.up) || data === "k") {
			this.moveItem(-1);
			return true;
		}
		if (matchesKey(data, Key.down) || data === "j") {
			this.moveItem(1);
			return true;
		}
		if (matchesKey(data, Key.pageUp)) {
			this.moveItem(-this.pageSize);
			return true;
		}
		if (matchesKey(data, Key.pageDown)) {
			this.moveItem(this.pageSize);
			return true;
		}
		if (matchesKey(data, Key.home) || data === "g") {
			this.moveBoundary(false);
			return true;
		}
		if (matchesKey(data, Key.end) || data === "G") {
			this.moveBoundary(true);
			return true;
		}
		return false;
	}

	private utilityInput(data: string): boolean {
		if (data === "?") this.toggleHelp();
		else if (data === "y") this.copySelection();
		else return false;
		return true;
	}

	handleInput(data: string): void {
		if (
			!this.routeInput(data) &&
			!this.movementInput(data) &&
			!this.utilityInput(data)
		) {
			return;
		}
		this.requestRender();
	}


	private footer(): string {
		if (this.pane === "help") return "↑↓ scroll · PgUp/PgDn page · y copy · ?/Esc back";
		if (this.pane === "detail") {
			return "↑↓ scroll · PgUp/PgDn page · Esc back · y copy · ? help";
		}
		return "←→ sections · ↑↓/jk move · Enter open · Esc back · y copy · ? help";
	}

	render(width: number, maximumHeight = Number.MAX_SAFE_INTEGER): string[] {
		const panelWidth = Math.max(20, width);
		const innerWidth = Math.max(1, panelWidth - 2);
		const height = Math.max(10, maximumHeight);
		const bodyHeight = Math.max(3, height - 7);
		const border = (value: string) => this.theme.fg("borderAccent", value);
		const top = border(`╭${"─".repeat(innerWidth)}╮`);
		const title = `${border("│")}${fit(
			this.theme.fg(
				"accent",
				this.theme.bold(` ◆ Developer Workbench · ${this.snapshot.statusLabel}`),
			),
			innerWidth,
		)}${border("│")}`;
		const headline = `${border("│")}${fit(` ${this.snapshot.headline}`, innerWidth)}${border("│")}`;
		const next = `${border("│")}${fit(
			this.theme.fg("dim", ` Next · ${this.snapshot.next}`),
			innerWidth,
		)}${border("│")}`;
		const footer = `${border("│")}${fit(
			this.theme.fg("dim", ` ${this.footer()}`),
			innerWidth,
		)}${border("│")}`;
		const bottom = border(`╰${"─".repeat(innerWidth)}╯`);
		const wide = innerWidth >= 82;

		if (wide) {
			const navigationWidth = Math.min(
				31,
				Math.max(24, Math.floor(innerWidth * 0.3)),
			);
			const contentWidth = Math.max(1, innerWidth - navigationWidth - 1);
			const separator = border(
				`├${"─".repeat(navigationWidth)}┬${"─".repeat(contentWidth)}┤`,
			);
			const left = renderSectionLines(
				this.snapshot,
				this.theme,
				this.sectionIndex,
				navigationWidth,
				bodyHeight,
			);
			let right: readonly string[];
			const section = this.section();
			if (
				this.pane === "detail" ||
				this.pane === "help" ||
				(this.pane === "sections" && section.items.length === 1)
			) {
				const all = renderDetailLines(
					this.theme,
					this.pane,
					this.selectedItem(),
					contentWidth,
				);
				this.pageSize = bodyHeight;
				this.detailScrollMaximum = Math.max(0, all.length - bodyHeight);
				this.detailScroll = Math.min(
					this.detailScroll,
					this.detailScrollMaximum,
				);
				right = all.slice(this.detailScroll, this.detailScroll + bodyHeight);
			} else {
				right = renderItemLines(
					this.theme,
					section,
					this.itemIndex(section),
					contentWidth,
					bodyHeight,
				);
				this.pageSize = bodyHeight;
				this.detailScrollMaximum = 0;
			}
			const rows = Array.from(
				{ length: bodyHeight },
				(_, index) =>
					`${border("│")}${fit(left[index] ?? "", navigationWidth)}${border("│")}${fit(right[index] ?? "", contentWidth)}${border("│")}`,
			);
			return [top, title, headline, next, separator, ...rows, footer, bottom];
		}

		const separator = border(`├${"─".repeat(innerWidth)}┤`);
		let body: readonly string[];
		if (this.pane === "sections") {
			body = renderSectionLines(
				this.snapshot,
				this.theme,
				this.sectionIndex,
				innerWidth,
				bodyHeight,
			);
		} else if (this.pane === "items") {
			const section = this.section();
			body = renderItemLines(
				this.theme,
				section,
				this.itemIndex(section),
				innerWidth,
				bodyHeight,
			);
		} else {
			const all = renderDetailLines(
				this.theme,
				this.pane,
				this.selectedItem(),
				innerWidth,
			);
			this.pageSize = bodyHeight;
			this.detailScrollMaximum = Math.max(0, all.length - bodyHeight);
			this.detailScroll = Math.min(
				this.detailScroll,
				this.detailScrollMaximum,
			);
			body = all.slice(this.detailScroll, this.detailScroll + bodyHeight);
		}
		const rows = Array.from(
			{ length: bodyHeight },
			(_, index) =>
				`${border("│")}${fit(body[index] ?? "", innerWidth)}${border("│")}`,
		);
		return [top, title, headline, next, separator, ...rows, footer, bottom];
	}

	invalidate(): void {}
}

export async function showActionLoopWorkbench(
	ctx: ExtensionContext,
	snapshot: ActionLoopWorkbenchSnapshot,
	initialSection?: ActionLoopWorkbenchSectionId,
): Promise<void> {
	await ctx.ui.custom<void>(
		(tui, theme, _keybindings, done) => {
			const surface = new ActionLoopWorkbenchSurface({
				snapshot,
				theme,
				done: () => done(undefined),
				requestRender: () => tui.requestRender(),
				initialSection,
				copy: (text) => {
					void copyWorkbenchContent(ctx, text);
				},
			});
			return {
				render: (surfaceWidth) =>
					surface.render(surfaceWidth, Math.max(10, tui.terminal.rows - 2)),
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
}
