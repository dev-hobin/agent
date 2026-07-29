import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, visibleWidth } from "@earendil-works/pi-tui";

import { observerCommandPresentation } from "../extensions/observer.ts";
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

interface InteractiveTestComponent extends Component {
	handleInput(data: string): void;
}

type TestComponentFactory = (
	tui: { requestRender(): void },
	theme: Theme,
	keybindings: unknown,
	done: (value: unknown) => void,
) => InteractiveTestComponent | Promise<InteractiveTestComponent>;

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
		pendingHypothesisReviews: 0,
		openInquiries: "Not counted yet",
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
			canSave: true,
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
			"review-save",
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
		activeItems.find((item) => item.id === "review-save")?.label,
		"Review & Save",
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
		episode: "Save review",
		control: {
			...reviewingBase.control,
			episode: "reviewing-save",
			canMemo: false,
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
		reviewingItems.find((item) => item.id === "review-save")?.currentValue,
		"Review proposal",
	);

	const pendingReview: ObserverStatusView = {
		...openView("off"),
		pendingHypothesisReviews: 1,
		control: { ...openView("off").control, canMemo: false },
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

test("status panel is complete, width-bounded, and keyboard dismissible", () => {
	let closed = false;
	const panel = new ObserverStatusPanel(openView(), theme, () => {
		closed = true;
	});
	const lines = panel.render(62);
	const output = lines.join("\n");
	assert.match(output, /Observer status/);
	assert.match(output, /Current flow/);
	assert.match(output, /Notebook/);
	assert.match(output, /Working set/);
	assert.match(output, /Recovery and persistence/);
	assert.match(output, /Pending Memo · 3/);
	assert.match(output, /Keep working normally/);
	assert.ok(lines.every((line) => visibleWidth(line) <= 62));
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
});
