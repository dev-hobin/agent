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

test("TUI uses /observe as a control center while preserving non-TUI commands", () => {
	assert.equal(observerCommandPresentation("", "tui"), "control");
	assert.equal(observerCommandPresentation("settings", "tui"), "control");
	assert.equal(observerCommandPresentation("status", "tui"), "status");
	assert.equal(observerCommandPresentation("memo", "tui"), "command");
	assert.equal(observerCommandPresentation("", "rpc"), "command");
});

test("control items progressively disclose only legal work", () => {
	assert.deepEqual(
		observerControlItems(statusView()).map((item) => item.id),
		["notebook", "language", "activation", "status"],
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
	assert.equal(
		offItems.some((item) => item.id === "material-review"),
		false,
	);
	assert.equal(OBSERVER_HYPOTHESIS_DRAFT, "/observe add-hypothesis ");
	assert.equal(OBSERVER_OBSERVE_MATERIAL_DRAFT, "/observe material ");

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
		"Inspect and approve",
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

	assert.deepEqual(await choose(1), { kind: "add-hypothesis" });
	assert.deepEqual(await choose(6), { kind: "observe-material" });
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

				for (let index = 0; index < 5; index += 1)
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
