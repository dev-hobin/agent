import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	type Keybinding,
	type KeybindingsManager,
	type KeyId,
	matchesKey,
	visibleWidth,
} from "@earendil-works/pi-tui";

import { observerCommandPresentation } from "../extensions/observer.ts";
import {
	ObserverWorkbenchSurface,
	observerWorkbenchSections,
	type ObserverWorkbenchAction,
} from "../extensions/observer-workbench-tui.ts";
import { SaveProposalReviewSurface } from "../extensions/save-proposal-tui.ts";
import {
	OBSERVER_HYPOTHESIS_DRAFT,
	OBSERVER_OBSERVE_MATERIAL_DRAFT,
	ObserverStatusPanel,
	ObserverWidget,
	observerControlItems,
	observerNextStep,
	renderObserverChromeStatus,
	shouldShowObserverWidget,
	showObserverControl,
} from "../extensions/tui.ts";
import type { ObserverStatusView } from "../src/observer-status.ts";
import type { ObserverWorkbenchView } from "../src/observer-workbench.ts";
import type { SaveProposalReview } from "../src/save-review.ts";

interface InteractiveTestComponent extends Component {
	handleInput(data: string): void;
}

type TestComponentFactory = (
	tui: { requestRender(): void },
	theme: Theme,
	keybindings: unknown,
	done: (value: unknown) => void,
) => InteractiveTestComponent | Promise<InteractiveTestComponent>;

const keybindings = {
	matches(data: string, binding: Keybinding): boolean {
		const keys: Partial<Record<Keybinding, KeyId>> = {
			"tui.select.up": "up",
			"tui.select.down": "down",
			"tui.select.pageUp": "pageUp",
			"tui.select.pageDown": "pageDown",
			"tui.select.confirm": "enter",
			"tui.select.cancel": "escape",
		};
		const key = keys[binding];
		return key ? matchesKey(data, key) : false;
	},
	getKeys(binding: Keybinding): string[] {
		const labels: Partial<Record<Keybinding, string>> = {
			"tui.select.up": "↑",
			"tui.select.down": "↓",
			"tui.select.pageUp": "PgUp",
			"tui.select.pageDown": "PgDn",
			"tui.select.confirm": "Enter",
			"tui.select.cancel": "Esc",
		};
		return [labels[binding] ?? binding];
	},
} as KeybindingsManager;

const theme = {
	bold: (text: string) => text,
	italic: (text: string) => text,
	underline: (text: string) => text,
	strikethrough: (text: string) => text,
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
} as Theme;

function statusView(
	overrides: Partial<ObserverStatusView> = {},
): ObserverStatusView {
	return {
		control: {
			mode: "off",
			episode: "empty",
			notebook: "unselected",
			canChangeNotebook: true,
			canMemo: false,
			canReview: false,
			canSave: false,
		},
		mode: "Off",
		episode: "Empty",
		notebook: "Not selected",
		outputLanguage: "Not set",
		notebookHealth: "Setup required",
		replayHealth: "Healthy",
		sessionPersistence: "Persistent session",
		preparedSave: "None",
		preparedMemo: "None",
		pendingMemos: "Not counted yet",
		pendingObservations: 0,
		memoItems: [],
		pendingHypothesisReviews: 0,
		openInquiries: "Not counted yet",
		inquiryItems: [],
		zettelCandidates: "Not counted yet",
		processingMode: "Piggyback",
		processingDetail: "No additional model request",
		...overrides,
	};
}

function openView(mode: "on" | "off" = "on"): ObserverStatusView {
	return statusView({
		control: {
			mode,
			episode: "open",
			notebook: "ready",
			notebookRoot: "/Users/me/notes/observer",
			notebookDefaultLanguage: "ko",
			canChangeNotebook: false,
			canMemo: true,
			canReview: true,
			canSave: false,
		},
		mode: mode === "on" ? "On" : "Off",
		episode: "Open",
		notebook: "/Users/me/notes/observer",
		outputLanguage: "ko",
		notebookHealth: "Healthy",
		pendingMemos: "3",
		openInquiries: "2",
		zettelCandidates: "1",
	});
}

function workbenchView(
	overrides: Partial<ObserverWorkbenchView> = {},
): ObserverWorkbenchView {
	return {
		status: openView(),
		activity: [
			{
				id: "source-read-test",
				kind: "source-read",
				label: "SourceRead",
				title: "Inspectable terminal workbench",
				summary: "Working meaning remains visible before publication.",
				state: "Sidecar",
				blocks: [
					{
						heading: "Faithful summary",
						lines: [
							"Line 1",
							"Line 2",
							"Line 3",
							"Line 4",
							"Line 5",
							"Line 6",
							"Line 7",
							"Line 8",
							"Line 9",
							"Line 10",
						],
					},
				],
			},
		],
		inquiries: [],
		memos: [],
		proposal: {
			kind: "needs-reconciliation",
			observationCount: 1,
			memoCount: 0,
		},
		notebook: [],
		materialReviewPending: false,
		...overrides,
	};
}

function proposalReview(): SaveProposalReview {
	return {
		proposalId: "proposal-tui-test",
		summary: "Create one source and revise one inquiry without partial saves.",
		notebookRoot: "/Users/me/notes/observer",
		outputLanguage: "ko",
		records: [
			{
				operation: "update",
				recordId: "inquiry-tui-test",
				recordType: "inquiry",
				title: "Bounded review surfaces\u001b[31m",
				relativePath: "records/inquiry-tui-test.md",
				beforeMarkdown: "---\ntitle: Old title\n---\n# Old title\nold body\n",
				proposedMarkdown: [
					"---",
					"title: Bounded review surfaces",
					"---",
					"# Bounded review surfaces",
					...Array.from(
						{ length: 40 },
						(_, index) => `new body line ${index + 1}`,
					),
				].join("\n"),
			},
			{
				operation: "create",
				recordId: "source-tui-test",
				recordType: "source",
				title: "Terminal interaction evidence",
				relativePath: "records/source-tui-test.md",
				beforeMarkdown: null,
				proposedMarkdown:
					"---\ntitle: Terminal interaction evidence\n---\n# Terminal interaction evidence\nExact Markdown\n",
			},
		],
	};
}

test("TUI uses /observer as a workbench while preserving non-TUI commands", () => {
	assert.equal(observerCommandPresentation("", "tui"), "control");
	assert.equal(observerCommandPresentation("settings", "tui"), "control");
	assert.equal(observerCommandPresentation("status", "tui"), "status");
	assert.equal(observerCommandPresentation("memo", "tui"), "command");
	assert.equal(observerCommandPresentation("", "rpc"), "command");
});

test("control items progressively disclose only legal work", () => {
	assert.deepEqual(
		observerControlItems(statusView()).map((item) => item.id),
		["notebook", "language", "activation", "processing", "status"],
	);
	const setupLanguage = observerControlItems(statusView()).find(
		(item) => item.id === "language",
	);
	assert.equal(setupLanguage?.label, "Default output language");
	assert.equal(setupLanguage?.currentValue, "en");
	assert.match(setupLanguage?.description ?? "", /Memo and Zettel Markdown/u);
	assert.match(setupLanguage?.description ?? "", /does not change the UI/u);
	assert.match(observerNextStep(statusView()), /Connect a Notebook/u);

	const activeItems = observerControlItems(openView());
	assert.deepEqual(
		activeItems.map((item) => item.id),
		[
			"activation",
			"processing",
			"add-hypothesis",
			"memo",
			"review",
			"notebook-status",
			"language",
			"observe-material",
			"status",
		],
	);
	assert.equal(
		activeItems.find((item) => item.id === "language")?.currentValue,
		"ko",
	);
	assert.match(observerNextStep(openView()), /Keep working normally/u);
	assert.equal(
		activeItems.find((item) => item.id === "processing")?.currentValue,
		"Piggyback",
	);
	assert.match(
		activeItems.find((item) => item.id === "processing")?.description ?? "",
		/no separate inference request/u,
	);
	assert.equal(
		activeItems.find((item) => item.id === "add-hypothesis")?.label,
		"Add a hypothesis",
	);
	assert.equal(
		activeItems.find((item) => item.id === "review")?.label,
		"Review",
	);
	const offItems = observerControlItems(openView("off"));
	assert.equal(
		offItems.find((item) => item.id === "observe-material")?.label,
		"Observe material",
	);
	const pendingMaterialBase = openView("off");
	const pendingMaterial = {
		...pendingMaterialBase,
		control: { ...pendingMaterialBase.control, canReview: false },
		pendingMaterialReview: {
			requestId: "material-review-00000000-0000-4000-8000-000000000701",
			material: "retrieved-tool-results" as const,
			phase: "Awaiting retrieval" as const,
			candidateCount: 0,
			sourceReadCount: 0,
			observationCount: 0,
			runState: "Suspended" as const,
			recovery:
				"Run /observer material retry to resume, or /observer material cancel.",
		},
	};
	const pendingItems = observerControlItems(pendingMaterial);
	assert.equal(
		pendingItems.some((item) => item.id === "retry-material"),
		true,
	);
	assert.equal(
		pendingItems.some((item) => item.id === "cancel-material"),
		true,
	);
	assert.equal(
		pendingItems.some((item) => item.id === "observe-material"),
		false,
	);
	assert.equal(
		pendingItems.some((item) => item.id === "review"),
		false,
	);
	assert.match(observerNextStep(pendingMaterial), /Retry the exact request/u);
	assert.equal(
		offItems.some((item) => item.id === "material-review"),
		false,
	);
	assert.equal(OBSERVER_HYPOTHESIS_DRAFT, "/observer add-hypothesis ");
	assert.equal(OBSERVER_OBSERVE_MATERIAL_DRAFT, "/observer material ");

	const reviewingBase = openView("off");
	const reviewing: ObserverStatusView = {
		...reviewingBase,
		episode: "Ready to save",
		control: {
			...reviewingBase.control,
			episode: "reviewing-save",
			canMemo: false,
			canReview: false,
			canSave: true,
		},
	};
	const reviewingItems = observerControlItems(reviewing);
	assert.equal(
		reviewingItems.some(
			(item) => item.id === "add-hypothesis" || item.id === "observe-material",
		),
		false,
	);
	assert.equal(
		reviewingItems.find((item) => item.id === "save")?.currentValue,
		"Inspect · approve or discard",
	);

	const pendingReview: ObserverStatusView = {
		...openView("off"),
		pendingHypothesisReviews: 1,
		control: {
			...openView("off").control,
			canMemo: false,
			canReview: false,
		},
	};
	assert.equal(
		observerControlItems(pendingReview).some((item) => item.id === "memo"),
		false,
	);
	assert.match(observerNextStep(pendingReview), /added hypothesis/u);
});

test("control surface keeps adding a hypothesis distinct from observing material", async () => {
	async function choose(row: number): Promise<unknown> {
		const ctx = {
			ui: {
				async custom(factory: TestComponentFactory) {
					let selected: unknown;
					const component = await factory(
						{ requestRender() {} },
						theme,
						{},
						(value) => {
							selected = value;
						},
					);
					for (let index = 0; index < row; index += 1)
						component.handleInput("\u001b[B");
					component.handleInput("\r");
					return selected;
				},
			},
		};
		return showObserverControl(ctx as never, openView("off"));
	}

	assert.deepEqual(await choose(2), { kind: "add-hypothesis" });
	assert.deepEqual(await choose(7), { kind: "observe-material" });
});

test("control surface dispatches Notebook setup from the first row", async () => {
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory) {
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					{},
					(value) => {
						selected = value;
					},
				);
				component.handleInput("\r");
				return selected;
			},
		},
	};

	assert.deepEqual(await showObserverControl(ctx as never, statusView()), {
		kind: "setup",
	});
});

test("activation and language update in place without closing the control surface", async () => {
	const trace: string[] = [];
	let doneCalls = 0;
	let afterActivation = "";
	let languageChoices = "";
	let afterLanguage = "";
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory) {
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					{},
					(value) => {
						doneCalls += 1;
						selected = value;
					},
				);

				component.handleInput("\r");
				await new Promise<void>((resolve) => setImmediate(resolve));
				afterActivation = component.render(90).join("\n");
				assert.equal(doneCalls, 0);

				for (let index = 0; index < 6; index += 1)
					component.handleInput("\u001b[B");
				component.handleInput("\r");
				languageChoices = component.render(90).join("\n");
				assert.equal(doneCalls, 0);
				component.handleInput("\u001b[A");
				component.handleInput("\r");
				await new Promise<void>((resolve) => setImmediate(resolve));
				afterLanguage = component.render(90).join("\n");
				assert.equal(doneCalls, 0);

				component.handleInput("\u001b");
				return selected;
			},
		},
	};

	assert.equal(
		await showObserverControl(ctx as never, openView("off"), "ko", {
			async applyActivation(enabled) {
				trace.push(`activation:${enabled}`);
				return openView(enabled ? "on" : "off");
			},
			async applyLanguage(language) {
				trace.push(`language:${language}`);
				const next = openView("on");
				return {
					...next,
					outputLanguage: language,
					control: {
						...next.control,
						notebookDefaultLanguage: language,
					},
				};
			},
			onError(error) {
				assert.fail(String(error));
			},
		}),
		undefined,
	);
	assert.deepEqual(trace, ["activation:true", "language:en"]);
	assert.equal(doneCalls, 1);
	assert.match(afterActivation, /Observer\s+On/u);
	assert.match(languageChoices, /Choose default output language/u);
	assert.match(languageChoices, /English \(en\)/u);
	assert.match(languageChoices, /Korean \(ko\)/u);
	assert.match(afterLanguage, /Default output language\s+en/u);
});

test("control surface returns a canonical activation action", async () => {
	let rendered = "";
	let customOptions: unknown;
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customOptions = options;
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					{},
					(value) => {
						selected = value;
					},
				);
				rendered = component.render(78).join("\n");
				component.handleInput("\u001b[B");
				component.handleInput("\u001b[B");
				component.handleInput("\r");
				return selected;
			},
		},
	};

	assert.deepEqual(await showObserverControl(ctx as never, statusView()), {
		kind: "activation",
		enabled: true,
	});
	assert.equal(customOptions, undefined);
	assert.match(rendered, /◆ Observer/);
	assert.match(rendered, /Notebook\s+Setup required/);
	assert.match(rendered, /Observer\s+Off/);
	assert.doesNotMatch(rendered, /Add a hypothesis|Observe material/);
	assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 78));
});

test("save proposal review is bounded, inspectable, and safe by default", () => {
	let decision: string | undefined;
	let renders = 0;
	const surface = new SaveProposalReviewSurface({
		review: proposalReview(),
		theme,
		keybindings,
		done(value) {
			decision = value;
		},
		requestRender() {
			renders += 1;
		},
	});

	const overview = surface.render(72, 20);
	assert.equal(overview.length, 20);
	assert.ok(overview.every((line) => visibleWidth(line) <= 72));
	assert.match(overview.join("\n"), /Validated/u);
	assert.match(overview.join("\n"), /␛\[31m/u);
	assert.doesNotMatch(overview.join("\n"), /\u001b\[31m/u);
	assert.equal(decision, undefined);

	surface.handleInput("\r");
	const diff = surface.render(72, 20).join("\n");
	assert.match(diff, /records\/inquiry-tui-test\.md/u);
	assert.match(diff, /\[Diff\]/u);
	assert.match(diff, /- .*Old title/u);
	assert.match(diff, /\+ .*Bounded review surfaces/u);
	assert.equal(
		decision,
		undefined,
		"Enter inspects the first record; it does not save",
	);

	surface.handleInput("\u001b[6~");
	const paged = surface.render(72, 20).join("\n");
	assert.notEqual(paged, diff);
	surface.handleInput("\r");
	assert.match(surface.render(72, 20).join("\n"), /\[Final Markdown\]/u);
	surface.handleInput("\u001b");
	assert.match(surface.render(72, 20).join("\n"), /keep this proposal ready/u);
	surface.handleInput("\u001b");
	assert.equal(decision, "back");
	assert.ok(renders >= 4);
});

test("save proposal review requires explicit navigation to batch approval", () => {
	const decisions: string[] = [];
	const surface = new SaveProposalReviewSurface({
		review: proposalReview(),
		theme,
		keybindings,
		done(value) {
			decisions.push(value);
		},
		requestRender() {},
	});
	for (let index = 0; index < 4; index += 1) surface.handleInput("\u001b[B");
	surface.handleInput("\r");
	assert.deepEqual(decisions, ["approve"]);
});

test("status and widget expose bounded material review recovery", () => {
	const base = openView("off");
	const view: ObserverStatusView = {
		...base,
		control: { ...base.control, canReview: false },
		pendingMaterialReview: {
			requestId: "material-review-00000000-0000-4000-8000-000000000702",
			material: "retrieved-tool-results",
			phase: "SourceRead required",
			candidateCount: 2,
			sourceReadCount: 1,
			observationCount: 0,
			runState: "Suspended",
			recovery:
				"Run /observer material retry to resume the exact request, or /observer material cancel to discard it.",
		},
	};
	const panel = new ObserverStatusPanel(view, theme, () => {}, keybindings);
	let rendered = "";
	for (let page = 0; page < 12; page += 1) {
		const lines = panel.render(80, 24);
		assert.equal(lines.length, 24);
		assert.ok(lines.every((line) => visibleWidth(line) <= 80));
		rendered += `\n${lines.join("\n")}`;
		panel.handleInput("\u001b[6~");
	}
	assert.match(rendered, /Material review/u);
	assert.match(rendered, /material retry/u);
	assert.match(rendered, /material cancel/u);
	const widget = new ObserverWidget(view, theme).render(80).join("\n");
	assert.match(widget, /material review suspended/u);
	assert.match(widget, /material retry/u);
	assert.equal(shouldShowObserverWidget(view), true);
	assert.match(
		renderObserverChromeStatus(view, theme) ?? "",
		/material suspended/u,
	);
});

test("status panel is height-bounded, fully scrollable, and keyboard dismissible", () => {
	let closed = false;
	const view = openView();
	const panel = new ObserverStatusPanel(
		{
			...view,
			memoItems: Array.from({ length: 8 }, (_, index) => ({
				memoId: `memo-${index}`,
				title: `Memo ${index}`,
				disposition: "incubating",
				content:
					index === 0
						? Array.from(
								{ length: 12 },
								(_, line) => `Memo 0 content line ${line + 1}`,
							).join("\n")
						: `Memo ${index} content`,
			})),
			inquiryItems: Array.from({ length: 8 }, (_, index) => ({
				inquiryId: `inquiry-${index}`,
				origin: index % 2 === 0 ? "user" : "observer",
				current: `Inquiry ${index} wording`,
			})),
			preparedSave: "proposal-status-test",
			preparedSaveDetails: {
				proposalId: "proposal-status-test",
				summary: "Inspect every record before one batch approval.",
				recordCount: 4,
				createCount: 3,
				updateCount: 1,
			},
		},
		theme,
		() => {
			closed = true;
		},
		keybindings,
	);
	const seen: string[] = [];
	for (let page = 0; page < 12; page += 1) {
		const lines = panel.render(62, 18);
		seen.push(lines.join("\n"));
		assert.equal(lines.length, 18);
		assert.ok(lines.every((line) => visibleWidth(line) <= 62));
		panel.handleInput("\u001b[6~");
	}
	const output = seen.join("\n");
	assert.match(output, /Observer status/u);
	assert.match(output, /Current flow/u);
	assert.match(output, /Memo 0 content line 12/u);
	assert.match(output, /Memo 7/u);
	assert.match(output, /Inquiry 7/u);
	assert.match(output, /4 records · create 3 · update 1/u);
	assert.match(output, /Inspect every record/u);
	assert.match(output, /Recovery and persistence/u);
	panel.handleInput("\r");
	assert.equal(closed, true);
});

test("footer and widget expose only action-relevant ambient state", () => {
	assert.equal(renderObserverChromeStatus(statusView(), theme), undefined);
	assert.equal(shouldShowObserverWidget(statusView()), false);

	const idle = statusView({
		control: {
			mode: "off",
			episode: "empty",
			notebook: "ready",
			notebookRoot: "/Users/me/notes/observer",
			notebookDefaultLanguage: "ko",
			canChangeNotebook: true,
			canMemo: false,
			canReview: false,
			canSave: false,
		},
		notebook: "/Users/me/notes/observer",
		outputLanguage: "ko",
		notebookHealth: "Healthy",
	});
	assert.equal(renderObserverChromeStatus(idle, theme), undefined);
	assert.equal(shouldShowObserverWidget(idle), false);

	const dormantUnhealthy = statusView({
		control: {
			...statusView().control,
			notebook: "unhealthy",
			canChangeNotebook: true,
		},
		notebook: "Selection needs attention",
		operationalIssue: "The remembered Notebook path is unavailable.",
	});
	assert.equal(renderObserverChromeStatus(dormantUnhealthy, theme), undefined);
	assert.equal(shouldShowObserverWidget(dormantUnhealthy), false);

	const active = openView();
	assert.equal(
		renderObserverChromeStatus(active, theme),
		"observer · on · Open",
	);
	assert.equal(shouldShowObserverWidget(active), true);
	const activeLines = new ObserverWidget(active, theme).render(52);
	assert.match(activeLines.join("\n"), /Observer · on/);
	assert.match(activeLines.join("\n"), /on · ko/);
	assert.match(activeLines.join("\n"), /Memo 3 · Inquiry 2/);
	assert.ok(activeLines.every((line) => visibleWidth(line) <= 52));

	const activeUnhealthy = {
		...active,
		control: { ...active.control, notebook: "unhealthy" as const },
		operationalIssue: "The selected Notebook needs recovery.",
	};
	assert.equal(
		renderObserverChromeStatus(activeUnhealthy, theme),
		"observer · needs attention",
	);
	const recoveryWidget = new ObserverWidget(activeUnhealthy, theme)
		.render(52)
		.join("\n");
	assert.match(recoveryWidget, /Observer · needs attention/u);
	assert.match(recoveryWidget, /\/observer → Overview/u);
	assert.doesNotMatch(recoveryWidget, /\/observe(?:\s|$)/u);

	const off = openView("off");
	assert.equal(
		renderObserverChromeStatus(off, theme),
		"observer · off · Episode preserved",
	);
	assert.match(new ObserverWidget(off, theme).render(52).join("\n"), /off/);
	const pendingReview = { ...off, pendingHypothesisReviews: 1 };
	assert.match(
		new ObserverWidget(pendingReview, theme).render(62).join("\n"),
		/hypothesis context review pending/u,
	);
	const background = {
		...active,
		backgroundWork: { state: "Running" as const, queued: 1 },
	};
	assert.equal(
		renderObserverChromeStatus(background, theme),
		"observer · working in background",
	);
	assert.match(observerNextStep(background), /Keep working normally/u);
	const deferred = {
		...active,
		backgroundWork: { state: "Deferred" as const, queued: 0 },
		backgroundIssue: "invalid background proposal",
	};
	assert.equal(
		renderObserverChromeStatus(deferred, theme),
		"observer · on · Open",
	);
	assert.match(observerNextStep(deferred), /Status and health/u);
	assert.equal(
		observerControlItems(deferred).find((item) => item.id === "status")
			?.currentValue,
		"Needs attention",
	);

	const paused = {
		...active,
		automaticProcessingPause:
			"Request memo-request-test failed. Run Memo or Review explicitly to retry.",
	};
	assert.equal(
		renderObserverChromeStatus(paused, theme),
		"observer · processing paused",
	);
	assert.match(observerNextStep(paused), /paused/u);
	assert.match(
		new ObserverWidget(paused, theme).render(62).join("\n"),
		/automatic processing paused/u,
	);
});

test("workbench renders bounded responsive sections and read-only detail", () => {
	const actions: (ObserverWorkbenchAction | null)[] = [];
	let renders = 0;
	const view = workbenchView();
	const surface = new ObserverWorkbenchSurface({
		view,
		theme,
		keybindings,
		done: (action) => actions.push(action),
		requestRender: () => {
			renders += 1;
		},
	});
	assert.deepEqual(
		observerWorkbenchSections(view).map((section) => section.label),
		[
			"Overview",
			"Activity",
			"Inquiries",
			"Memos",
			"Proposal",
			"Notebook",
			"Settings",
		],
	);
	const wide = surface.render(120, 20);
	assert.equal(wide.length, 20);
	assert.ok(wide.every((line) => visibleWidth(line) <= 120));

	const ansiTheme = {
		...theme,
		bold: (text: string) => `\u001b[1m${text}\u001b[22m`,
		fg: (_color: string, text: string) => `\u001b[38;2;138;190;183m${text}\u001b[39m`,
	} as Theme;
	const colored = new ObserverWorkbenchSurface({
		view,
		theme: ansiTheme,
		keybindings,
		done: () => {},
		requestRender: () => {},
	})
		.render(120, 20)
		.join("\n");
	assert.match(colored, /\u001b\[1mCurrent inquiry\u001b\[22m/u);
	assert.doesNotMatch(colored, /␛\[/u);

	const narrow = surface.render(40, 18);
	assert.equal(narrow.length, 18);
	assert.ok(narrow.every((line) => visibleWidth(line) <= 40));

	surface.handleInput("\u001b[B");
	surface.handleInput("\r");
	assert.match(
		surface.render(72, 16).join("\n"),
		/Inspectable terminal workbench/u,
	);
	surface.handleInput("\r");
	const beforeScroll = surface.render(72, 12).join("\n");
	assert.match(beforeScroll, /Faithful summary/u);
	assert.equal(
		actions.length,
		0,
		"opening detail must not authorize an action",
	);
	surface.handleInput("\u001b[6~");
	const afterScroll = surface.render(72, 12).join("\n");
	assert.notEqual(afterScroll, beforeScroll);
	assert.ok(renders >= 4);
});

test("workbench keeps Settings secondary and requires a contextual Save key", () => {
	const actions: (ObserverWorkbenchAction | null)[] = [];
	const proposalView = workbenchView({
		status: {
			...openView(),
			control: {
				...openView().control,
				episode: "reviewing-save",
				canReview: false,
				canSave: true,
			},
			episode: "Ready to save",
		},
		proposal: {
			kind: "ready",
			proposalId: "proposal-test",
			summary: "One complete proposal",
			createCount: 1,
			updateCount: 0,
			records: [
				{
					id: "proposal:memo-test",
					kind: "proposal-record",
					label: "create memo",
					title: "Proposed Memo",
					summary: "records/memo-test.md",
					state: "create",
					blocks: [
						{ heading: "Diff", lines: ["+ # Proposed Memo"] },
						{ heading: "Proposed Markdown", lines: ["# Proposed Memo"] },
					],
				},
			],
		},
	});
	const proposalSurface = new ObserverWorkbenchSurface({
		view: proposalView,
		theme,
		keybindings,
		done: (action) => actions.push(action),
		requestRender: () => {},
	});
	for (let index = 0; index < 4; index += 1)
		proposalSurface.handleInput("\u001b[B");
	proposalSurface.handleInput("\r");
	proposalSurface.handleInput("\r");
	assert.equal(actions.length, 0, "Enter only inspects a proposal record");
	proposalSurface.handleInput("?");
	proposalSurface.handleInput("s");
	assert.equal(actions.length, 0, "help intercepts underlying Save shortcuts");
	proposalSurface.handleInput("?");
	proposalSurface.handleInput("s");
	assert.deepEqual(actions, [{ kind: "save" }]);

	const settingsActions: (ObserverWorkbenchAction | null)[] = [];
	const settingsSurface = new ObserverWorkbenchSurface({
		view: workbenchView(),
		theme,
		keybindings,
		done: (action) => settingsActions.push(action),
		requestRender: () => {},
	});
	settingsSurface.handleInput("\u001b[F");
	settingsSurface.handleInput("\r");
	assert.deepEqual(settingsActions, [{ kind: "settings" }]);
});
