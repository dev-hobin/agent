import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
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

const MAX_WORKBENCH_ROWS = 28;

type WorkbenchTone = ActionLoopWorkbenchItem["tone"];

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
	return truncateToWidth(value, Math.max(1, width));
}

function wrap(value: string, width: number): string[] {
	return wrapTextWithAnsi(value, Math.max(1, width));
}

function statusTone(
	status: ActionLoopWorkbenchSnapshot["status"],
): WorkbenchTone {
	if (status === "blocked" || status === "unavailable") return "error";
	if (status === "waiting") return "warning";
	if (status === "completed") return "success";
	return "normal";
}

function detailLines(
	detail: ActionLoopWorkbenchDetail,
	width: number,
	theme: Theme,
): string[] {
	const label = theme.fg("dim", `${detail.label}`);
	const lines = [label];
	for (const value of detail.lines) {
		for (const line of wrap(`  ${value}`, width)) lines.push(line);
	}
	return lines;
}

export class ActionLoopWorkbenchSurface {
	private readonly snapshot: ActionLoopWorkbenchSnapshot;
	private readonly theme: Theme;
	private readonly done: () => void;
	private readonly requestRender: () => void;
	private sectionIndex = 0;
	private itemIndexes = new Map<ActionLoopWorkbenchSectionId, number>();
	private expanded = false;
	private help = false;

	constructor(options: {
		readonly snapshot: ActionLoopWorkbenchSnapshot;
		readonly theme: Theme;
		readonly done: () => void;
		readonly requestRender: () => void;
		readonly initialSection?: ActionLoopWorkbenchSectionId;
	}) {
		this.snapshot = options.snapshot;
		this.theme = options.theme;
		this.done = options.done;
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
		const maximum = Math.max(0, section.items.length - 1);
		return Math.min(current, maximum);
	}

	private moveSection(delta: number) {
		const count = this.snapshot.sections.length;
		this.sectionIndex = (this.sectionIndex + delta + count) % count;
		this.expanded = false;
		this.requestRender();
	}

	private moveItem(delta: number) {
		const section = this.section();
		if (section.items.length === 0) return;
		const next =
			(this.itemIndex(section) + delta + section.items.length) %
			section.items.length;
		this.itemIndexes.set(section.id, next);
		this.expanded = false;
		this.requestRender();
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) {
			if (this.help || this.expanded) {
				this.help = false;
				this.expanded = false;
				this.requestRender();
				return;
			}
			this.done();
			return;
		}
		if (data === "?") {
			this.help = !this.help;
			this.requestRender();
			return;
		}
		if (matchesKey(data, Key.left)) return this.moveSection(-1);
		if (matchesKey(data, Key.right) || matchesKey(data, Key.tab))
			return this.moveSection(1);
		if (matchesKey(data, Key.up)) return this.moveItem(-1);
		if (matchesKey(data, Key.down)) return this.moveItem(1);
		if (matchesKey(data, Key.enter)) {
			if (this.section().items.length > 0) this.expanded = !this.expanded;
			this.requestRender();
		}
	}

	private header(width: number): string[] {
		const title = `${this.theme.fg("accent", this.theme.bold("Developer"))} ${tone(this.theme, statusTone(this.snapshot.status), this.snapshot.statusLabel)}`;
		return [
			fit(title, width),
			...wrap(this.theme.fg("text", this.snapshot.headline), width),
			fit(this.theme.fg("dim", `Next · ${this.snapshot.next}`), width),
		];
	}

	private tabs(width: number): string {
		const values = this.snapshot.sections.map((section, index) =>
			index === this.sectionIndex
				? this.theme.fg("accent", `[${section.label}]`)
				: this.theme.fg("muted", section.label),
		);
		return fit(values.join("  "), width);
	}

	private items(width: number): string[] {
		const section = this.section();
		if (section.items.length === 0)
			return [this.theme.fg("dim", "No current items in this section.")];
		const selected = this.itemIndex(section);
		const lines: string[] = [];
		section.items.forEach((current, index) => {
			const marker = index === selected ? this.theme.fg("accent", "›") : " ";
			lines.push(
				fit(
					`${marker} ${tone(this.theme, current.tone, current.title)} · ${this.theme.fg("muted", current.summary)}`,
					width,
				),
			);
		});
		if (this.expanded) {
			const current = section.items[selected];
			if (current) {
				lines.push(
					this.theme.fg("borderMuted", "─".repeat(Math.max(1, width))),
				);
				for (const currentDetail of current.details)
					lines.push(...detailLines(currentDetail, width, this.theme));
				if (current.details.length === 0)
					lines.push(this.theme.fg("dim", "No additional detail."));
			}
		}
		return lines;
	}

	render(width: number, maximumHeight = Number.MAX_SAFE_INTEGER): string[] {
		const safeWidth = Math.max(20, width);
		const lines = [
			...this.header(safeWidth),
			this.theme.fg("borderAccent", "─".repeat(safeWidth)),
			this.tabs(safeWidth),
			...this.items(safeWidth),
		];
		if (this.help) {
			lines.push(
				this.theme.fg("borderMuted", "─".repeat(safeWidth)),
				this.theme.fg(
					"dim",
					"←→ sections · ↑↓ items · enter detail · ? help · esc close",
				),
			);
		} else {
			lines.push(
				this.theme.fg(
					"dim",
					"←→ sections · ↑↓ items · enter detail · ? help · esc close",
				),
			);
		}
		const height = Math.max(6, Math.min(MAX_WORKBENCH_ROWS, maximumHeight));
		const bounded = lines.slice(0, height);
		return bounded.map((line) =>
			visibleWidth(line) <= safeWidth ? line : fit(line, safeWidth),
		);
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
			});
			return {
				render: (width) => surface.render(width, tui.terminal.rows - 4),
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
