import type {
	ExtensionContext,
	Theme,
	ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
	type Keybinding,
	type KeybindingsManager,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import { diffLines, type LineDiffKind } from "../src/line-diff.ts";
import type {
	SaveProposalReview,
	SaveProposalReviewDecision,
	SaveProposalReviewRecord,
} from "../src/save-review.ts";

type ReviewContentMode = "diff" | "proposed" | "existing";
type OverviewItem =
	| { readonly kind: "record"; readonly recordIndex: number }
	| { readonly kind: "action"; readonly decision: SaveProposalReviewDecision };

interface SaveProposalReviewSurfaceOptions {
	readonly review: SaveProposalReview;
	readonly theme: Theme;
	readonly keybindings: KeybindingsManager;
	readonly done: (decision: SaveProposalReviewDecision) => void;
	readonly requestRender: () => void;
}

function displayLine(value: string): string {
	return [...value]
		.map((character) => {
			if (character === "\t") return "    ";
			const code = character.charCodeAt(0);
			if (code === 0x1b) return "␛";
			if (code < 0x20 || (code >= 0x7f && code <= 0x9f))
				return `\\x${code.toString(16).padStart(2, "0")}`;
			return character;
		})
		.join("");
}

function sourceLines(value: string): readonly string[] {
	return value.replaceAll("\r\n", "\n").split("\n").map(displayLine);
}

function wrapped(value: string, width: number): readonly string[] {
	const lines = wrapTextWithAnsi(displayLine(value), Math.max(1, width));
	return lines.length > 0 ? lines : [""];
}

function keyLabel(
	keybindings: KeybindingsManager,
	binding: Keybinding,
): string {
	return keybindings.getKeys(binding).join("/");
}

function counts(review: SaveProposalReview): string {
	const creates = review.records.filter(
		(record) => record.operation === "create",
	).length;
	const updates = review.records.length - creates;
	return `${review.records.length} records · create ${creates} · update ${updates}`;
}

function modeLabel(mode: ReviewContentMode): string {
	switch (mode) {
		case "diff":
			return "Diff";
		case "proposed":
			return "Final Markdown";
		case "existing":
			return "Existing";
	}
}

function modes(record: SaveProposalReviewRecord): readonly ReviewContentMode[] {
	return record.operation === "update"
		? ["diff", "proposed", "existing"]
		: ["proposed"];
}

function diffColor(kind: LineDiffKind): ThemeColor {
	switch (kind) {
		case "added":
			return "success";
		case "removed":
			return "error";
		case "context":
			return "text";
	}
}

function diffPrefix(kind: LineDiffKind): string {
	switch (kind) {
		case "added":
			return "+ ";
		case "removed":
			return "- ";
		case "context":
			return "  ";
	}
}

function renderRawMarkdown(
	markdown: string,
	width: number,
	theme: Theme,
): readonly string[] {
	const values = sourceLines(markdown);
	const digits = String(values.length).length;
	const contentWidth = Math.max(1, width - digits - 3);
	return values.flatMap((value, index) => {
		const prefix = `${String(index + 1).padStart(digits, " ")} │ `;
		return wrapped(value, contentWidth).map((line, wrappedIndex) =>
			wrappedIndex === 0
				? theme.fg("dim", prefix) + theme.fg("text", line)
				: " ".repeat(visibleWidth(prefix)) + theme.fg("text", line),
		);
	});
}

function renderDiff(
	record: SaveProposalReviewRecord,
	width: number,
	theme: Theme,
): readonly string[] {
	const before = record.beforeMarkdown ?? "";
	return diffLines(before, record.proposedMarkdown).flatMap((entry) => {
		const prefix = diffPrefix(entry.kind);
		const color = diffColor(entry.kind);
		return wrapped(entry.text, Math.max(1, width - 2)).map(
			(line, index) =>
				theme.fg(color, index === 0 ? prefix : "  ") + theme.fg(color, line),
		);
	});
}

export class SaveProposalReviewSurface {
	private readonly review: SaveProposalReview;
	private readonly theme: Theme;
	private readonly keybindings: KeybindingsManager;
	private readonly done: (decision: SaveProposalReviewDecision) => void;
	private readonly requestRender: () => void;
	private screen: "overview" | "record" = "overview";
	private selectedIndex = 0;
	private recordIndex = 0;
	private contentMode: ReviewContentMode = "proposed";
	private scrollOffset = 0;
	private pageSize = 8;

	constructor(options: SaveProposalReviewSurfaceOptions) {
		this.review = options.review;
		this.theme = options.theme;
		this.keybindings = options.keybindings;
		this.done = options.done;
		this.requestRender = options.requestRender;
	}

	private overviewItems(): readonly OverviewItem[] {
		return [
			...this.review.records.map((_, recordIndex) => ({
				kind: "record" as const,
				recordIndex,
			})),
			{ kind: "action", decision: "back" },
			{ kind: "action", decision: "reject" },
			{ kind: "action", decision: "approve" },
		];
	}

	private selectedOverviewItem(): OverviewItem {
		const items = this.overviewItems();
		return items[this.selectedIndex] ?? { kind: "action", decision: "back" };
	}

	private currentRecord(): SaveProposalReviewRecord | undefined {
		return this.review.records[this.recordIndex];
	}

	private moveSelection(delta: number): void {
		const last = this.overviewItems().length - 1;
		this.selectedIndex = Math.max(
			0,
			Math.min(last, this.selectedIndex + delta),
		);
	}

	private openRecord(recordIndex: number): void {
		const record = this.review.records[recordIndex];
		if (!record) return;
		this.recordIndex = recordIndex;
		this.contentMode = record.operation === "update" ? "diff" : "proposed";
		this.scrollOffset = 0;
		this.screen = "record";
	}

	private moveRecord(delta: number): void {
		if (this.review.records.length === 0) return;
		this.recordIndex =
			(this.recordIndex + delta + this.review.records.length) %
			this.review.records.length;
		const record = this.currentRecord();
		this.contentMode = record?.operation === "update" ? "diff" : "proposed";
		this.scrollOffset = 0;
	}

	private cycleMode(): void {
		const record = this.currentRecord();
		if (!record) return;
		const available = modes(record);
		const current = available.indexOf(this.contentMode);
		this.contentMode =
			available[(current + 1) % available.length] ?? "proposed";
		this.scrollOffset = 0;
	}

	private activateSelection(): void {
		const item = this.selectedOverviewItem();
		if (item.kind === "record") this.openRecord(item.recordIndex);
		else this.done(item.decision);
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			if (this.screen === "record") {
				this.screen = "overview";
				this.selectedIndex = this.recordIndex;
				this.scrollOffset = 0;
				this.requestRender();
				return;
			}
			this.done("back");
			return;
		}

		if (this.screen === "overview") {
			if (this.keybindings.matches(data, "tui.select.up"))
				this.moveSelection(-1);
			else if (this.keybindings.matches(data, "tui.select.down"))
				this.moveSelection(1);
			else if (this.keybindings.matches(data, "tui.select.pageUp"))
				this.moveSelection(-this.pageSize);
			else if (this.keybindings.matches(data, "tui.select.pageDown"))
				this.moveSelection(this.pageSize);
			else if (matchesKey(data, "home")) this.selectedIndex = 0;
			else if (matchesKey(data, "end"))
				this.selectedIndex = this.overviewItems().length - 1;
			else if (this.keybindings.matches(data, "tui.select.confirm"))
				this.activateSelection();
			this.requestRender();
			return;
		}

		if (this.keybindings.matches(data, "tui.select.up"))
			this.scrollOffset = Math.max(0, this.scrollOffset - 1);
		else if (this.keybindings.matches(data, "tui.select.down"))
			this.scrollOffset += 1;
		else if (this.keybindings.matches(data, "tui.select.pageUp"))
			this.scrollOffset = Math.max(0, this.scrollOffset - this.pageSize);
		else if (this.keybindings.matches(data, "tui.select.pageDown"))
			this.scrollOffset += this.pageSize;
		else if (matchesKey(data, "home")) this.scrollOffset = 0;
		else if (matchesKey(data, "end"))
			this.scrollOffset = Number.MAX_SAFE_INTEGER;
		else if (matchesKey(data, "left")) this.moveRecord(-1);
		else if (matchesKey(data, "right")) this.moveRecord(1);
		else if (this.keybindings.matches(data, "tui.select.confirm"))
			this.cycleMode();
		this.requestRender();
	}

	private header(innerWidth: number): readonly string[] {
		const rows = [
			`  ${this.theme.fg("accent", this.theme.bold("◆ Save Observer proposal"))} ${this.theme.fg("success", "Validated ✓")}`,
			...wrapped(`Notebook · ${this.review.notebookRoot}`, innerWidth - 4)
				.slice(0, 2)
				.map((line) => `  ${this.theme.fg("text", line)}`),
			`  ${this.theme.fg("muted", counts(this.review))} · ${this.theme.fg("muted", this.review.outputLanguage)}`,
		];
		if (this.review.summary.trim()) {
			rows.push(
				...wrapped(`Summary · ${this.review.summary}`, innerWidth - 4)
					.slice(0, 2)
					.map((line) => `  ${this.theme.fg("muted", line)}`),
			);
		}
		return rows;
	}

	private overviewLine(item: OverviewItem, index: number): string {
		const selected = index === this.selectedIndex;
		const prefix = selected ? this.theme.fg("accent", "→ ") : "  ";
		if (item.kind === "record") {
			const record = this.review.records[item.recordIndex];
			if (!record) return prefix;
			const text = `${item.recordIndex + 1}. ${record.operation} · ${record.recordType} · ${displayLine(record.title)} · ${displayLine(record.relativePath)}`;
			return (
				prefix +
				(selected
					? this.theme.fg("accent", this.theme.bold(text))
					: this.theme.fg("text", text))
			);
		}
		const labels: Record<SaveProposalReviewDecision, string> = {
			back: "Back · keep this proposal ready",
			reject: "Return to Review · discard proposal, preserve working state",
			approve: `Save all ${this.review.records.length} records · write Notebook and settle Episode`,
		};
		const color: ThemeColor = item.decision === "approve" ? "warning" : "muted";
		const label = labels[item.decision];
		return (
			prefix +
			(selected
				? this.theme.fg("accent", this.theme.bold(label))
				: this.theme.fg(color, label))
		);
	}

	private overviewBody(width: number, capacity: number): readonly string[] {
		const items = this.overviewItems();
		const start = Math.max(
			0,
			Math.min(
				this.selectedIndex - Math.floor(capacity / 2),
				Math.max(0, items.length - capacity),
			),
		);
		return items
			.slice(start, start + capacity)
			.map((item, localIndex) =>
				truncateToWidth(
					this.overviewLine(item, start + localIndex),
					width,
					"…",
					true,
				),
			);
	}

	private recordBody(width: number, capacity: number): readonly string[] {
		const record = this.currentRecord();
		if (!record)
			return [this.theme.fg("muted", "No records in this proposal.")];
		const available = modes(record);
		if (!available.includes(this.contentMode))
			this.contentMode = available[0] ?? "proposed";
		const metadata = [
			this.theme.fg(
				"accent",
				this.theme.bold(
					`${this.recordIndex + 1}/${this.review.records.length} · ${record.operation} · ${record.recordType} · ${displayLine(record.title)}`,
				),
			),
			this.theme.fg("muted", displayLine(record.relativePath)),
			this.theme.fg(
				"muted",
				`View · ${available.map((mode) => (mode === this.contentMode ? `[${modeLabel(mode)}]` : modeLabel(mode))).join(" · ")}`,
			),
			"",
		];
		let content: readonly string[];
		if (this.contentMode === "diff")
			content = renderDiff(record, width, this.theme);
		else if (this.contentMode === "existing")
			content = renderRawMarkdown(
				record.beforeMarkdown ?? "",
				width,
				this.theme,
			);
		else
			content = renderRawMarkdown(record.proposedMarkdown, width, this.theme);
		const all = [...metadata, ...content];
		const maximumOffset = Math.max(0, all.length - capacity);
		this.scrollOffset = Math.min(this.scrollOffset, maximumOffset);
		return all.slice(this.scrollOffset, this.scrollOffset + capacity);
	}

	render(width: number, maximumHeight = 22): string[] {
		const innerWidth = Math.max(1, width - 2);
		const height = Math.max(12, maximumHeight);
		const border = (value: string) => this.theme.fg("borderAccent", value);
		const row = (value = "") =>
			`${border("│")}${truncateToWidth(value, innerWidth, "…", true)}${border("│")}`;
		const header = this.header(innerWidth);
		const footer =
			this.screen === "overview"
				? `${keyLabel(this.keybindings, "tui.select.up")}/${keyLabel(this.keybindings, "tui.select.down")} move · ${keyLabel(this.keybindings, "tui.select.confirm")} inspect/choose · ${keyLabel(this.keybindings, "tui.select.cancel")} back · ${this.selectedIndex + 1}/${this.overviewItems().length}`
				: `${keyLabel(this.keybindings, "tui.select.up")}/${keyLabel(this.keybindings, "tui.select.down")} scroll · ${keyLabel(this.keybindings, "tui.select.pageUp")}/${keyLabel(this.keybindings, "tui.select.pageDown")} page · ←/→ record · ${keyLabel(this.keybindings, "tui.select.confirm")} view · ${keyLabel(this.keybindings, "tui.select.cancel")} records`;
		const fixedRows = header.length + 5;
		this.pageSize = Math.max(1, height - fixedRows);
		const body =
			this.screen === "overview"
				? this.overviewBody(innerWidth - 2, this.pageSize)
				: this.recordBody(innerWidth - 2, this.pageSize);
		const rows = [
			border(`╭${"─".repeat(innerWidth)}╮`),
			...header.map(row),
			border(`├${"─".repeat(innerWidth)}┤`),
			...body.map((line) => row(` ${line}`)),
			...Array.from({ length: Math.max(0, this.pageSize - body.length) }, () =>
				row(),
			),
			border(`├${"─".repeat(innerWidth)}┤`),
			row(` ${this.theme.fg("dim", footer)}`),
			border(`╰${"─".repeat(innerWidth)}╯`),
		];
		return rows;
	}

	invalidate(): void {
		// Rendering is derived directly from the current interaction state.
	}
}

export async function showSaveProposalReview(
	ctx: ExtensionContext,
	review: SaveProposalReview,
): Promise<SaveProposalReviewDecision> {
	const decision = await ctx.ui.custom<SaveProposalReviewDecision>(
		(tui, theme, keybindings, done) => {
			const surface = new SaveProposalReviewSurface({
				review,
				theme,
				keybindings,
				done,
				requestRender: () => tui.requestRender(),
			});
			return {
				render: (width) =>
					surface.render(width, Math.max(12, tui.terminal.rows - 2)),
				handleInput: (data) => surface.handleInput(data),
				invalidate: () => surface.invalidate(),
			};
		},
	);
	return decision ?? "back";
}
