import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
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
	ObserverWorkbenchDetailBlock,
	ObserverWorkbenchItem,
	ObserverWorkbenchSectionId,
	ObserverWorkbenchView,
} from "../src/observer-workbench.ts";
import type { ObserverControlAction } from "./tui.ts";

export type ObserverWorkbenchAction =
	| ObserverControlAction
	| { readonly kind: "settings" };

type WorkbenchPane = "sections" | "items" | "detail" | "help";

interface WorkbenchSection {
	readonly id: ObserverWorkbenchSectionId;
	readonly label: string;
	readonly value: string;
	readonly items: readonly ObserverWorkbenchItem[];
}

interface ObserverWorkbenchSurfaceOptions {
	readonly view: ObserverWorkbenchView;
	readonly theme: Theme;
	readonly keybindings?: KeybindingsManager;
	readonly done: (action: ObserverWorkbenchAction | null) => void;
	readonly requestRender: () => void;
}

function assertNever(value: never): never {
	throw new Error(`Unexpected Observer workbench value: ${String(value)}`);
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

function proposalValue(view: ObserverWorkbenchView): string {
	switch (view.proposal.kind) {
		case "not-requested":
			return view.proposal.reviewAvailable ? "Available" : "None";
		case "needs-reconciliation":
			return "Working";
		case "preparing":
			return "Preparing";
		case "ready":
			return "Ready";
		case "invalid":
			return "Invalid";
		default:
			return assertNever(view.proposal);
	}
}

export function observerWorkbenchSections(
	view: ObserverWorkbenchView,
): readonly WorkbenchSection[] {
	return [
		{ id: "overview", label: "Overview", value: view.status.mode, items: [] },
		{
			id: "activity",
			label: "Activity",
			value: String(view.activity.length),
			items: view.activity,
		},
		{
			id: "inquiries",
			label: "Inquiries",
			value: String(view.inquiries.length),
			items: view.inquiries,
		},
		{
			id: "memos",
			label: "Memos",
			value: String(view.memos.length),
			items: view.memos,
		},
		{
			id: "proposal",
			label: "Proposal",
			value: proposalValue(view),
			items: view.proposal.kind === "ready" ? view.proposal.records : [],
		},
		{
			id: "notebook",
			label: "Notebook",
			value: view.notebookInventoryIssue
				? "Issue"
				: String(view.notebook.length),
			items: view.notebook,
		},
		{ id: "settings", label: "Settings", value: "", items: [] },
	];
}

function blockLines(
	block: ObserverWorkbenchDetailBlock,
	width: number,
	theme: Theme,
): readonly string[] {
	return [
		theme.fg("accent", theme.bold(block.heading)),
		...block.lines.flatMap((line) => wrap(line, width)),
		"",
	];
}

function itemDetailLines(
	item: ObserverWorkbenchItem,
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

function processingWaitReason(view: ObserverWorkbenchView): string {
	switch (view.status.processingMode) {
		case "Piggyback":
			return "The next eligible foreground model turn can prepare one bounded atomic proposal.";
		case "Local background":
			return "The explicit local worker can prepare the proposal while the foreground is idle.";
		case "Off":
			return "Model processing is Off. The request remains inspectable and will not advance automatically.";
		default:
			return assertNever(view.status.processingMode);
	}
}

function overviewLines(
	view: ObserverWorkbenchView,
	width: number,
	theme: Theme,
): readonly string[] {
	const proposal = proposalValue(view);
	const issue =
		view.status.operationalIssue ??
		view.status.processingIssue ??
		view.status.backgroundIssue;
	const lines = [
		theme.fg("accent", theme.bold("Current inquiry")),
		`Mode: ${view.status.mode}`,
		`Episode: ${view.status.episode}`,
		`Processing: ${view.status.processingMode} · ${view.status.processingDetail}`,
		`Notebook: ${view.status.notebook}`,
		"",
		theme.fg("accent", theme.bold("Working set")),
		`Activity: ${view.activity.length}`,
		`Pending observations: ${view.status.pendingObservations}`,
		`Inquiries: ${view.inquiries.length}`,
		`Memos: ${view.memos.length}`,
		`Hypothesis reviews pending: ${view.status.pendingHypothesisReviews}`,
		"",
		theme.fg("accent", theme.bold("Publication")),
		`Proposal: ${proposal}`,
		`Saved Notebook records: ${view.notebook.length}`,
		...(view.notebookInventoryIssue
			? [`Notebook inspection issue: ${view.notebookInventoryIssue}`]
			: []),
		...(issue ? ["", `Recovery: ${issue}`] : []),
	];
	return lines.flatMap((line) => wrap(line, width));
}

function proposalStateLines(
	view: ObserverWorkbenchView,
	width: number,
	theme: Theme,
): readonly string[] {
	const proposal = view.proposal;
	let lines: string[];
	switch (proposal.kind) {
		case "not-requested":
			lines = [
				"No publication proposal is prepared.",
				proposal.reviewAvailable
					? "Review is available. Press r to freeze current scope and prepare exact Markdown."
					: "Open or recover an Episode before requesting Review.",
			];
			break;
		case "needs-reconciliation":
			lines = [
				"Working meaning is inspectable but not yet frozen for publication.",
				`Pending observations: ${proposal.observationCount}`,
				`Working Memos: ${proposal.memoCount}`,
				"Press r to reconcile and prepare one atomic proposal.",
			];
			break;
		case "preparing":
			lines = [
				proposal.stage === "memo-reconciliation"
					? "Review is reconciling its locked Observation scope before proposal preparation."
					: "Exact publication proposal preparation is in progress.",
				`Stage: ${proposal.stage}`,
				`Request ID: ${proposal.requestId}`,
				...(proposal.proposalId ? [`Proposal ID: ${proposal.proposalId}`] : []),
				`Locked Observations: ${proposal.observationCount}`,
				`Locked SourceReads: ${proposal.sourceReadCount}`,
				`Memo revision included: ${proposal.hasMemoRevision ? "yes" : "no"}`,
				processingWaitReason(view),
				"Partial model output is not exposed as a valid proposal.",
			];
			break;
		case "ready":
			lines = [
				"The complete proposal passed current local preflight.",
				`Proposal ID: ${proposal.proposalId}`,
				`Records: ${proposal.records.length} · create ${proposal.createCount} · update ${proposal.updateCount}`,
				`Summary: ${proposal.summary}`,
				"Open a record to inspect Diff, Proposed Markdown, and Existing Markdown.",
				"Press s to enter the separate batch approval flow.",
			];
			break;
		case "invalid":
			lines = [
				"The reviewed proposal is no longer ready to save.",
				`Proposal ID: ${proposal.proposalId}`,
				`Reason: ${proposal.reason}`,
				"No write occurred. Press s to keep it for diagnosis or return it to Review.",
			];
			break;
		default:
			return assertNever(proposal);
	}
	return [
		theme.fg("accent", theme.bold(`Proposal · ${proposalValue(view)}`)),
		"",
		...lines.flatMap((line) => wrap(line, width)),
	];
}

function emptySectionLines(
	view: ObserverWorkbenchView,
	section: ObserverWorkbenchSectionId,
	width: number,
	theme: Theme,
): readonly string[] {
	if (section === "overview") return overviewLines(view, width, theme);
	if (section === "proposal") return proposalStateLines(view, width, theme);
	if (section === "notebook" && view.notebookInventoryIssue)
		return [
			theme.fg("error", theme.bold("Notebook inspection failed")),
			...wrap(view.notebookInventoryIssue, width),
		];
	if (section === "settings")
		return [
			theme.fg("accent", theme.bold("Settings")),
			"",
			"Observer activation, processing policy, output language, and Notebook setup live here.",
			"Press Enter to open Settings. Esc returns to this workbench.",
		];
	return [
		theme.fg("muted", "No items in this section."),
		"",
		section === "activity"
			? "Observer remains quiet until SourceReads or semantic observations are recorded."
			: "The current branch contains no working records of this type.",
	];
}

interface WorkbenchActionRule {
	readonly action: ObserverControlAction;
	readonly sections?: readonly ObserverWorkbenchSectionId[];
	allowed(view: ObserverWorkbenchView): boolean;
}

const WORKBENCH_ACTION_RULES: Readonly<Record<string, WorkbenchActionRule>> = {
	m: {
		action: { kind: "memo" },
		sections: ["memos"],
		allowed: (view) => view.status.control.canMemo,
	},
	r: {
		action: { kind: "review" },
		sections: ["proposal"],
		allowed: (view) => view.status.control.canReview,
	},
	s: {
		action: { kind: "save" },
		sections: ["proposal"],
		allowed: (view) => view.status.control.canSave,
	},
	h: {
		action: { kind: "add-hypothesis" },
		sections: ["activity", "inquiries"],
		allowed: () => true,
	},
	o: {
		action: { kind: "observe-material" },
		sections: ["activity"],
		allowed: () => true,
	},
	t: {
		action: { kind: "retry-material" },
		allowed: (view) => view.status.pendingMaterialReview !== undefined,
	},
	x: {
		action: { kind: "cancel-material" },
		allowed: (view) => view.status.pendingMaterialReview !== undefined,
	},
};

export function observerWorkbenchActionForKey(
	view: ObserverWorkbenchView,
	section: ObserverWorkbenchSectionId,
	data: string,
): ObserverControlAction | undefined {
	const rule = WORKBENCH_ACTION_RULES[data];
	if (!rule || !rule.allowed(view)) return undefined;
	if (rule.sections && !rule.sections.includes(section)) return undefined;
	return rule.action;
}

function helpLines(width: number, theme: Theme): readonly string[] {
	const lines = [
		"Navigation",
		"↑/↓ or j/k  Move selection or scroll detail",
		"Enter        Open selected section or item",
		"Esc          Return one level; close from Sections",
		"Tab          Move between Sections and current content",
		"PgUp/PgDn   Scroll detail by one page",
		"Home/End     First/last item or top/bottom of detail",
		"?            Open or close this contextual help",
		"",
		"Contextual actions",
		"m            Reconcile pending work into Memos",
		"r            Review and prepare publication proposal",
		"s            Inspect and authorize ready Save batch",
		"h            Draft a user hypothesis",
		"o            Draft material for explicit observation",
		"t/x          Retry/cancel a pending material review",
		"",
		"Safety",
		"Opening items is read-only. Save requires a separate explicit batch approval. Partial proposal output is never shown as ready Markdown.",
	];
	return lines.flatMap((line) => {
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

export class ObserverWorkbenchSurface {
	private readonly done: (action: ObserverWorkbenchAction | null) => void;
	private readonly keybindings: KeybindingsManager | undefined;
	private readonly requestRender: () => void;
	private readonly sections: readonly WorkbenchSection[];
	private readonly theme: Theme;
	private readonly view: ObserverWorkbenchView;
	private detailScroll = 0;
	private detailScrollMaximum = 0;
	private pageSize = 1;
	private pane: WorkbenchPane = "sections";
	private paneBeforeHelp: Exclude<WorkbenchPane, "help"> = "sections";
	private sectionIndex = 0;
	private readonly selectedItems = new Map<
		ObserverWorkbenchSectionId,
		number
	>();

	constructor(options: ObserverWorkbenchSurfaceOptions) {
		this.view = options.view;
		this.theme = options.theme;
		this.keybindings = options.keybindings;
		this.done = options.done;
		this.requestRender = options.requestRender;
		this.sections = observerWorkbenchSections(options.view);
	}

	private matches(data: string, binding: Keybinding, fallback: KeyId): boolean {
		return this.keybindings
			? this.keybindings.matches(data, binding)
			: matchesKey(data, fallback);
	}

	private key(binding: Keybinding, fallback: string): string {
		return this.keybindings?.getKeys(binding).join("/") ?? fallback;
	}

	private section(): WorkbenchSection {
		const section = this.sections[this.sectionIndex] ?? this.sections[0];
		if (!section) throw new Error("Observer workbench has no sections.");
		return section;
	}

	private selectedIndex(section = this.section()): number {
		return Math.min(
			Math.max(0, this.selectedItems.get(section.id) ?? 0),
			Math.max(0, section.items.length - 1),
		);
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
		if (this.pane === "sections") {
			if (section.id === "settings") {
				this.done({ kind: "settings" });
				return;
			}
			this.pane = section.items.length > 0 ? "items" : "detail";
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
			this.pane = this.section().items.length > 0 ? "items" : "sections";
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
			this.pane = section.items.length > 0 ? "items" : "detail";
		} else this.pane = "sections";
		this.detailScroll = 0;
	}

	private contextualAction(data: string): boolean {
		if (this.pane === "help") return false;
		const action = observerWorkbenchActionForKey(
			this.view,
			this.section().id,
			data,
		);
		if (!action) return false;
		this.done(action);
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
			const valueWidth = Math.min(12, Math.max(0, width - 5));
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
		section: WorkbenchSection,
		width: number,
		height: number,
	): readonly string[] {
		if (section.items.length === 0)
			return emptySectionLines(this.view, section.id, width, this.theme).slice(
				0,
				height,
			);
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
		const item = section.items[this.selectedIndex(section)];
		return item
			? itemDetailLines(item, width, this.theme)
			: emptySectionLines(this.view, section.id, width, this.theme);
	}

	private footer(): string {
		if (this.pane === "help")
			return `${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")} scroll · ${this.key("tui.select.pageUp", "PgUp")}/${this.key("tui.select.pageDown", "PgDn")} page · ?/${this.key("tui.select.cancel", "Esc")} back`;
		const base =
			this.pane === "detail"
				? `${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")} scroll · PgUp/PgDn page · Esc back`
				: `${this.key("tui.select.up", "↑")}/${this.key("tui.select.down", "↓")}/jk move · ${this.key("tui.select.confirm", "Enter")} open · ${this.key("tui.select.cancel", "Esc")} back`;
		const section = this.section().id;
		const contextual: string[] = [];
		if (section === "memos" && this.view.status.control.canMemo)
			contextual.push("m Memo");
		if (section === "proposal" && this.view.status.control.canReview)
			contextual.push("r Review");
		if (section === "proposal" && this.view.status.control.canSave)
			contextual.push("s Save");
		if (section === "activity") contextual.push("h Hypothesis", "o Material");
		if (section === "inquiries") contextual.push("h Hypothesis");
		if (this.view.status.pendingMaterialReview)
			contextual.push("t retry", "x cancel");
		contextual.push("? help");
		return `${base} · ${contextual.join(" · ")}`;
	}

	render(width: number, maximumHeight = Number.MAX_SAFE_INTEGER): string[] {
		const panelWidth = Math.max(12, width);
		const innerWidth = Math.max(1, panelWidth - 2);
		const height = Math.max(8, maximumHeight);
		const bodyHeight = Math.max(3, height - 5);
		const wide = innerWidth >= 82;
		const border = (value: string) => this.theme.fg("borderAccent", value);
		const status = `${this.view.status.mode} · ${this.view.status.episode} · ${this.view.status.processingMode}`;
		const title = ` ◆ Observer inquiry workbench · ${status}`;
		const top = border(`╭${"─".repeat(innerWidth)}╮`);
		const titleRow = `${border("│")}${fit(
			this.theme.fg("accent", this.theme.bold(title)),
			innerWidth,
		)}${border("│")}`;
		const bottom = border(`╰${"─".repeat(innerWidth)}╯`);
		const footer = `${border("│")}${fit(
			this.theme.fg("dim", ` ${this.footer()}`),
			innerWidth,
		)}${border("│")}`;
		let rows: string[];
		if (wide) {
			const navigationWidth = Math.min(
				28,
				Math.max(22, Math.floor(innerWidth * 0.27)),
			);
			const contentWidth = Math.max(1, innerWidth - navigationWidth - 1);
			const separator = border(
				`├${"─".repeat(navigationWidth)}┬${"─".repeat(contentWidth)}┤`,
			);
			const left = this.sectionLines(navigationWidth, bodyHeight);
			let right: readonly string[];
			if (this.pane === "detail" || this.pane === "help") {
				const all = this.detailLines(contentWidth);
				this.pageSize = bodyHeight;
				this.detailScrollMaximum = Math.max(0, all.length - bodyHeight);
				this.detailScroll = Math.min(
					this.detailScroll,
					this.detailScrollMaximum,
				);
				right = all.slice(this.detailScroll, this.detailScroll + bodyHeight);
			} else {
				right = this.itemLines(this.section(), contentWidth, bodyHeight);
				this.pageSize = bodyHeight;
				this.detailScrollMaximum = 0;
			}
			rows = Array.from(
				{ length: bodyHeight },
				(_, index) =>
					`${border("│")}${fit(left[index] ?? "", navigationWidth)}${border("│")}${fit(right[index] ?? "", contentWidth)}${border("│")}`,
			);
			return [top, titleRow, separator, ...rows, footer, bottom];
		}
		const separator = border(`├${"─".repeat(innerWidth)}┤`);
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
		rows = Array.from(
			{ length: bodyHeight },
			(_, index) =>
				`${border("│")}${fit(body[index] ?? "", innerWidth)}${border("│")}`,
		);
		return [top, titleRow, separator, ...rows, footer, bottom];
	}

	invalidate(): void {}
}

export async function showObserverWorkbench(
	ctx: ExtensionContext,
	view: ObserverWorkbenchView,
): Promise<ObserverWorkbenchAction | undefined> {
	const result = await ctx.ui.custom<ObserverWorkbenchAction | null>(
		(tui, theme, keybindings, done) => {
			const surface = new ObserverWorkbenchSurface({
				view,
				theme,
				keybindings,
				done,
				requestRender: () => tui.requestRender(),
			});
			return {
				render: (width) =>
					surface.render(width, Math.max(8, tui.terminal.rows - 2)),
				handleInput: (data) => surface.handleInput(data),
				invalidate: () => surface.invalidate(),
			};
		},
	);
	return result ?? undefined;
}
