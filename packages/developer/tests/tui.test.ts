import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, visibleWidth } from "@earendil-works/pi-tui";

import {
	PROTOCOL,
	applyDeveloperEvent,
	initialState,
	type DeveloperState,
	type PendingQuestion,
} from "../extensions/state.ts";
import { inspectDeveloperWorkbench } from "../extensions/developer-workbench.ts";
import { DeveloperWorkbenchSurface } from "../extensions/developer-workbench-tui.ts";
import {
	DeveloperQuestionBriefPanel,
	DeveloperWidget,
	developerSettingItems,
	type DeveloperSettingsBinding,
	editQuestionResolutionRequest,
	pendingQuestionItems,
	promptImmediateUserQuestion,
	questionResolutionPrompt,
	renderDeveloperFooter,
	showDeveloperSettings,
	showPendingQuestionSelector,
} from "../extensions/tui.ts";

interface InteractiveTestComponent extends Component {
	handleInput(data: string): void;
}

type TestComponentFactory = (
	tui: {
		requestRender(): void;
		terminal?: { rows: number; write(data: string): void };
	},
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

const ansiTheme = {
	...theme,
	bold: (text: string) => `\u001b[1m${text}\u001b[22m`,
	fg: (_color: string, text: string) => `\u001b[38;5;7m${text}\u001b[39m`,
} as Theme;

const keybindings = {
	getKeys(binding: string): string[] {
		if (binding === "tui.select.up") return ["↑"];
		if (binding === "tui.select.down") return ["↓"];
		if (binding === "tui.select.pageUp") return ["PgUp"];
		if (binding === "tui.select.pageDown") return ["PgDn"];
		if (binding === "tui.select.confirm") return ["Enter"];
		if (binding === "tui.select.cancel") return ["Esc"];
		return [];
	},
	matches(data: string, binding: string): boolean {
		if (binding === "tui.select.up") return data === "\u001b[A";
		if (binding === "tui.select.down") return data === "\u001b[B";
		if (binding === "tui.select.pageUp") return data === "\u001b[5~";
		if (binding === "tui.select.pageDown") return data === "\u001b[6~";
		if (binding === "tui.select.confirm") return data === "\r";
		if (binding === "tui.select.cancel")
			return data === "\u001b" || data === "\u0003";
		return false;
	},
};

const openQuestion: PendingQuestion = {
	id: "question:route:earlier",
	question: "Which browser observation is still missing?",
	status: "open",
	resolutionOwner: "agent",
	gate: "none",
	resolutionCriteria: "Observe the rendered browser state.",
	sourceRouteId: "route:earlier",
};

const choiceQuestion: PendingQuestion = {
	...openQuestion,
	id: "question:product-controls",
	question: "Which controls should be exposed?",
	context: [
		"## Review scope",
		"Choose only after checking **both product constraints**:",
		"- Mobile exposure policy",
		"- Catalog icon behavior",
	].join("\n"),
	resolutionOwner: "user",
	gate: "before-implementation",
	resolutionCriteria: "The product owner selects every control policy.",
	responseSpec: {
		kind: "choice-form",
		fields: [
			{
				id: "A",
				prompt: "Choose the mobile-view policy",
				options: [
					{ value: "A1", label: "Expose all" },
					{
						value: "A2",
						label: "Expose selected components",
						detailPrompt: "List the selected component types.",
					},
				],
			},
			{
				id: "B1",
				prompt: "Expose the catalog icon control?",
				options: [
					{ value: "show", label: "Expose" },
					{ value: "hide", label: "Hide" },
				],
			},
		],
	},
};

const singleChoiceQuestion: PendingQuestion = {
	...choiceQuestion,
	id: "question:custom-policy",
	question: "Which policy should Developer use?",
	responseSpec: {
		kind: "choice-form",
		fields: [
			{
				id: "policy",
				prompt: "Choose the Developer policy",
				options: [
					{ value: "safe", label: "Use the safe default" },
					{ value: "fast", label: "Prefer the fastest path" },
				],
			},
		],
	},
};

function isOverlayRequest(options: unknown): boolean {
	return (
		options !== null &&
		typeof options === "object" &&
		"overlay" in options &&
		options.overlay === true
	);
}

function isScreenSurfaceRequest(options: unknown): boolean {
	if (!isOverlayRequest(options)) return false;
	const overlayOptions = Reflect.get(options as object, "overlayOptions");
	return Boolean(
		overlayOptions &&
			typeof overlayOptions === "object" &&
			Reflect.get(overlayOptions, "anchor") === "top-center" &&
			Reflect.get(overlayOptions, "width") === "100%" &&
			Reflect.get(overlayOptions, "maxHeight") === "100%",
	);
}

function createSettingsBinding(initial: DeveloperState): {
	binding: DeveloperSettingsBinding;
	read(): DeveloperState;
	events: boolean[];
} {
	let state = initial;
	const events: boolean[] = [];
	return {
		binding: {
			read: () => state,
			commitActivation(enabled) {
				events.push(enabled);
				state = applyDeveloperEvent(state, {
					protocol: PROTOCOL,
					kind: "activation",
					enabled,
				});
				return state;
			},
		},
		read: () => state,
		events,
	};
}

function activeState(): DeveloperState {
	const activeRoute = {
		protocol: "developer/v5" as const,
		kind: "route" as const,
		routeId: "route:active",
		question: "Does the rendered interface preserve the product invariant?",
		target: "verify",
		reason: "Unit tests do not cover the rendered state.",
		knownEvidence: ["Pure-function tests pass."],
		consideredAlternatives: [],
		availableReferences: [],
		referenceRoutes: [],
		loadedReferences: [],
		methodLocation: "/skills/verify/SKILL.md",
	};
	const earlierRoute = {
		...activeRoute,
		routeId: "route:earlier",
		question: "Is the implementation complete?",
	};
	const lastJudgment = {
		protocol: "developer/v5" as const,
		kind: "judgment" as const,
		routeId: "route:earlier",
		question: "Is the implementation complete?",
		target: "verify",
		status: "needs-evidence" as const,
		result: "A browser observation remains.",
		basis: ["Unit tests pass."],
		referenceBasis: [],
		openedQuestions: [openQuestion],
		questionUpdates: [],
		artifacts: ["pnpm check"],
		changedArtifacts: false,
	};
	return {
		enabled: true,
		activeRoute,
		lastRoute: activeRoute,
		lastJudgment,
		routeHistory: [earlierRoute, activeRoute],
		judgmentHistory: [lastJudgment],
		pendingQuestions: [openQuestion],
		rerouteRequired: false,
		implementationFramingRequired: false,
		verificationRequired: false,
	};
}

test("Developer Workbench renders responsive, bounded, read-only state", () => {
	const snapshot = inspectDeveloperWorkbench(activeState(), {
		activeTools: ["read", "bash", "developer_route_question"],
		availableSkills: ["verify", "specify"],
	});
	for (const [width, height] of [
		[40, 18],
		[80, 22],
		[120, 36],
	] as const) {
		const surface = new DeveloperWorkbenchSurface({
			snapshot,
			theme,
			keybindings: keybindings as never,
			done() {},
			requestRender() {},
		});
		const lines = surface.render(width, height);
		assert.equal(lines.length, height);
		assert.ok(lines.every((line) => visibleWidth(line) <= width));
		assert.match(lines.join("\n"), /Developer workbench/);
	}
});

test("Developer Workbench copies the focused semantic selection without viewport chrome", () => {
	const secondQuestion: PendingQuestion = {
		...openQuestion,
		id: "question:copy:user",
		question: "Which product policy should be preserved?",
		resolutionOwner: "user",
		resolutionCriteria: "The product owner identifies the preserved policy.",
	};
	const snapshot = inspectDeveloperWorkbench(
		{
			...activeState(),
			pendingQuestions: [openQuestion, secondQuestion],
		},
		{
			activeTools: [],
			availableSkills: ["verify"],
		},
	);
	const copies: string[] = [];
	const surface = new DeveloperWorkbenchSurface({
		snapshot,
		theme: ansiTheme,
		keybindings: keybindings as never,
		done() {},
		copy: (text) => copies.push(text),
		requestRender() {},
	});

	surface.handleInput("y");
	assert.match(copies[0] ?? "", /^Overview\n/u);

	surface.handleInput("\u001b[B");
	surface.handleInput("\u001b[B");
	surface.handleInput("\r");
	surface.handleInput("y");
	surface.handleInput("\u001b[B");
	surface.handleInput("y");
	surface.handleInput("\r");
	surface.render(42, 12);
	surface.handleInput("\u001b[6~");
	surface.handleInput("y");

	assert.notEqual(copies[1], copies[2]);
	assert.equal(copies[2], copies[3]);
	assert.match(copies[3] ?? "", /Resolution contract/u);
	assert.match(copies[3] ?? "", /Resolves when:/u);
	assert.doesNotMatch(copies[3] ?? "", /[│╭╮╰╯…]|\u001b\[/u);
});

test("Developer Workbench scopes question actions and help to the focused detail", () => {
	const snapshot = inspectDeveloperWorkbench(activeState(), {
		activeTools: [],
		availableSkills: ["verify"],
	});
	let result: unknown;
	const surface = new DeveloperWorkbenchSurface({
		snapshot,
		theme,
		keybindings: keybindings as never,
		done(value) {
			result = value;
		},
		requestRender() {},
	});

	surface.handleInput("\u001b[B");
	surface.handleInput("\u001b[B");
	surface.handleInput("\r");
	assert.match(surface.render(80, 22).join("\n"), /Which browser observation/);
	surface.handleInput("?");
	surface.handleInput("a");
	assert.equal(result, undefined);
	assert.match(surface.render(80, 22).join("\n"), /Contextual actions/);
	surface.handleInput("?");
	surface.handleInput("a");
	assert.deepEqual(result, {
		kind: "question",
		questionId: openQuestion.id,
	});
});

test("Developer assigns footer, widget, secondary settings, and pending lists distinct information roles", () => {
	const state = activeState();
	assert.equal(
		renderDeveloperFooter(state, theme),
		"developer · on · needs-judgment · verify",
	);

	const widgetLines = new DeveloperWidget(state, theme).render(64);
	assert.match(widgetLines[0], /^◆ route · verify/);
	assert.match(
		widgetLines[1],
		/^\? evidence · none · Which browser observation/,
	);
	assert.ok(widgetLines.every((line) => visibleWidth(line) <= 64));

	const settings = developerSettingItems(state);
	assert.deepEqual(
		settings.map((item) => item.id),
		["activation"],
	);
	assert.equal(settings[0]?.currentValue, "On");

	const questions = pendingQuestionItems(state.pendingQuestions);
	assert.equal(questions[0]?.value, openQuestion.id);
	assert.equal(questions[0]?.label, openQuestion.question);
	assert.match(questions[0]?.description ?? "", /open · agent · none/);
	assert.match(questions[0]?.description ?? "", /ask Pi to investigate/);
});

test("Developer settings expose activation without duplicating Workbench objects", () => {
	const offState = {
		...activeState(),
		enabled: false,
		activeRoute: undefined,
		judgmentHistory: [],
		pendingQuestions: [],
	};
	assert.deepEqual(
		developerSettingItems(offState).map((item) => [item.id, item.currentValue]),
		[["activation", "Off"]],
	);
	assert.deepEqual(
		developerSettingItems(activeState()).map((item) => item.id),
		["activation"],
	);
});

test("implementation framing is rendered as an implementation gate rather than a next-step prediction", () => {
	const state = { ...activeState(), implementationFramingRequired: true };
	const widgetLines = new DeveloperWidget(state, theme).render(100);

	assert.ok(
		widgetLines.includes(
			"◇ gate · frame implementation before mutation (sketch or signal)",
		),
	);
	assert.equal(
		widgetLines.some((line) => line.includes("next · sketch")),
		false,
	);
});

test("pending question UI distinguishes agent evidence from required user answers", () => {
	const userQuestion: PendingQuestion = {
		...openQuestion,
		id: "question:user-decision",
		question: "Should empty mean absent or cleared?",
		context: "Choose one:\n- A1: absent\n- A2: explicitly cleared",
		resolutionOwner: "user",
		gate: "before-implementation",
		resolutionCriteria: "The product owner chooses absent or cleared.",
	};
	const description =
		pendingQuestionItems([userQuestion])[0]?.description ?? "";
	assert.match(description, /user · before-implementation/);
	assert.match(description, /required answer/);
	const prompt = questionResolutionPrompt(userQuestion);
	assert.match(
		prompt,
		/Decision or evidence context:\nChoose one:\n- A1: absent\n- A2: explicitly cleared/,
	);
	assert.match(prompt, /Required answer or product decision:/);
	assert.match(prompt, /Gate: before-implementation/);
});

test("decision brief keeps legacy context and actions sticky while detail pages", () => {
	let selected: string | undefined;
	const panel = new DeveloperQuestionBriefPanel(
		{ ...choiceQuestion, context: undefined },
		theme,
		keybindings as never,
		(action) => {
			selected = action;
		},
	);
	const initial = panel.render(88).join("\n");

	assert.match(initial, /No additional context was recorded/);
	assert.match(initial, /Continue to answer/);
	assert.match(initial, /Leave open/);
	assert.doesNotMatch(initial, /A1 · Expose all/);

	panel.handleInput("\u001b[6~");
	const later = panel.render(88).join("\n");
	assert.match(later, /A1 · Expose all/);
	assert.match(later, /show · Expose/);
	assert.match(later, /Continue to answer/);
	assert.match(later, /Leave open/);

	panel.handleInput("\u001b[<65;12;8M");
	panel.handleInput("\r");
	assert.equal(selected, "continue");
});

test("decision brief renders Markdown context for a nonmandatory open question", () => {
	const panel = new DeveloperQuestionBriefPanel(
		{
			...openQuestion,
			context: [
				"## Investigation context",
				"Inspect **both observations** before routing:",
				"- DOM state",
				"- Browser selection",
			].join("\n"),
		},
		theme,
		keybindings as never,
		() => {},
	);
	const output = panel.render(88).join("\n");

	assert.match(output, /Investigation context/);
	assert.match(output, /both observations/);
	assert.match(output, /DOM state/);
	assert.match(output, /Browser selection/);
	assert.doesNotMatch(output, /## Investigation context/);
	assert.doesNotMatch(output, /\*\*both observations\*\*/);
});

test("a new blocking user question explains the decision before answer controls", async () => {
	let briefRendered = "";
	let editorInitial = "";
	let customOptions: unknown;
	const writes: string[] = [];
	const question: PendingQuestion = {
		...openQuestion,
		question: "Should empty mean absent or cleared?",
		context: [
			"## Empty-state contract",
			"Choose one after reviewing the **serialization consequence**:",
			"- A1: absent",
			"- A2: explicitly cleared",
			"> Existing saved values must remain distinguishable.",
			"```ts",
			"value: undefined | null",
			"```",
		].join("\n"),
		resolutionOwner: "user",
		gate: "before-implementation",
	};
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customOptions = options;
				let selected: unknown;
				const component = await factory(
					{
						requestRender() {},
						terminal: { rows: 24, write: (data: string) => writes.push(data) },
					},
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				briefRendered = component.render(88).join("\n");
				component.handleInput("\r");
				return selected;
			},
			async editor(_title: string, initial: string) {
				editorInitial = initial;
				return `${initial}\nA1: absent`;
			},
			notify() {},
		},
	};

	const disposition = await promptImmediateUserQuestion(ctx as never, question);

	assert.equal(disposition.kind, "answer");
	assert.match(
		disposition.kind === "answer" ? disposition.request : "",
		/A1: absent$/,
	);
	assert.match(editorInitial, /Decision or evidence context:\n## Empty-state/);
	assert.match(briefRendered, /Why this decision is required/);
	assert.match(briefRendered, /Empty-state contract/);
	assert.match(briefRendered, /serialization consequence/);
	assert.match(briefRendered, /A1: absent/);
	assert.match(briefRendered, /Existing saved values/);
	assert.match(briefRendered, /value: undefined \| null/);
	assert.doesNotMatch(briefRendered, /## Empty-state contract/);
	assert.doesNotMatch(briefRendered, /\*\*serialization consequence\*\*/);
	assert.match(briefRendered, /Continue to answer/);
	assert.match(briefRendered, /Leave open/);
	assert.doesNotMatch(briefRendered, /Choice preview/);
	assert.equal(briefRendered.split("\n").length, 19);
	assert.ok(
		briefRendered.indexOf("Empty-state contract") <
			briefRendered.indexOf("Continue to answer"),
	);
	assert.equal(isOverlayRequest(customOptions), true);
	assert.deepEqual(writes, []);
});

test("choice response specs render field controls and submit exact structured answers", async () => {
	let customCall = 0;
	let editorInitial = "";
	const customOptions: unknown[] = [];
	const renderedControls: string[] = [];
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customCall += 1;
				customOptions.push(options);
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					keybindings,
					(value) => {
						selected = value;
					},
				);
				renderedControls.push(component.render(100).join("\n"));
				if (customCall === 2) component.handleInput("\u001b[B");
				component.handleInput("\r");
				return selected;
			},
			async editor(_title: string, initial: string) {
				editorInitial = initial;
				return `${initial}\n카드그룹__타일, 특장점__슬라이드_탭`;
			},
			notify() {},
		},
	};

	const disposition = await promptImmediateUserQuestion(
		ctx as never,
		choiceQuestion,
	);

	assert.equal(customCall, 4);
	assert.equal(isOverlayRequest(customOptions[0]), true);
	assert.ok(customOptions.slice(1).every(isScreenSurfaceRequest));
	assert.match(renderedControls[0] ?? "", /Why this decision is required/);
	assert.match(renderedControls[0] ?? "", /Review scope/);
	assert.match(renderedControls[0] ?? "", /both product constraints/);
	assert.match(renderedControls[0] ?? "", /Mobile exposure policy/);
	assert.match(renderedControls[0] ?? "", /Catalog icon behavior/);
	assert.doesNotMatch(renderedControls[0] ?? "", /## Review scope/);
	assert.doesNotMatch(
		renderedControls[0] ?? "",
		/\*\*both product constraints\*\*/,
	);
	assert.match(renderedControls[0] ?? "", /Continue to answer/);
	assert.match(renderedControls[0] ?? "", /Leave open/);
	assert.doesNotMatch(renderedControls[0] ?? "", /Choice preview/);
	assert.match(renderedControls[1] ?? "", /A1 · Expose all/);
	assert.match(renderedControls[1] ?? "", /A2 · Expose selected components/);
	assert.match(renderedControls[2] ?? "", /show · Expose/);
	assert.match(
		renderedControls[3] ?? "",
		/A · A2 — Expose selected components/,
	);
	assert.match(editorInitial, /List the selected component types/);
	assert.equal(disposition.kind, "answer");
	const request = disposition.kind === "answer" ? disposition.request : "";
	assert.match(request, /Structured answer:/);
	assert.match(request, /- A: A2 — Expose selected components/);
	assert.match(request, /Detail: 카드그룹__타일, 특장점__슬라이드_탭/);
	assert.match(request, /- B1: show — Expose/);
	assert.doesNotMatch(request, /question:product-controls/);
});

test("long choice details page inside a sticky brief before native choice surfaces", async () => {
	const writes: string[] = [];
	const customOptions: unknown[] = [];
	const briefPages: string[] = [];
	const renderedControls: string[] = [];
	let customCall = 0;
	const manyFieldQuestion: PendingQuestion = {
		...choiceQuestion,
		id: "question:many-fields",
		responseSpec: {
			kind: "choice-form",
			fields: Array.from({ length: 15 }, (_, fieldIndex) => ({
				id: `field-${fieldIndex}`,
				prompt: `Choose field ${fieldIndex}`,
				options: Array.from(
					{ length: fieldIndex === 0 ? 15 : 2 },
					(_, optionIndex) => ({
						value: `option-${fieldIndex}-${optionIndex}`,
						label: `Option ${fieldIndex}/${optionIndex}`,
					}),
				),
			})),
		},
	};
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customCall += 1;
				customOptions.push(options);
				let selected: unknown;
				const component = await factory(
					{
						requestRender() {},
						terminal: { rows: 24, write: (data: string) => writes.push(data) },
					},
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				if (customCall === 1) {
					for (let page = 0; page < 20; page += 1) {
						const rendered = component.render(100).join("\n");
						briefPages.push(rendered);
						if (rendered.includes("field 15/15 · field-14")) break;
						component.handleInput("\u001b[6~");
					}
				} else {
					renderedControls.push(component.render(100).join("\n"));
				}
				component.handleInput("\r");
				return selected;
			},
			notify() {},
		},
	};

	const request = await editQuestionResolutionRequest(
		ctx as never,
		manyFieldQuestion,
	);

	assert.equal(customCall, 17);
	assert.equal(isOverlayRequest(customOptions[0]), true);
	assert.ok(customOptions.slice(1).every(isScreenSurfaceRequest));
	assert.match(briefPages[0] ?? "", /Why this decision is required/);
	assert.match(briefPages[0] ?? "", /Review scope/);
	assert.ok(
		briefPages.every(
			(page) =>
				page.includes("Continue to answer") && page.includes("Leave open"),
		),
	);
	const completeBrief = briefPages.join("\n");
	assert.match(completeBrief, /Option 0\/0/);
	assert.match(completeBrief, /Option 0\/14/);
	assert.match(completeBrief, /field 15\/15 · field-14/);
	assert.match(renderedControls[0] ?? "", /Write another answer…/);
	assert.match(renderedControls.at(-1) ?? "", /field-0 · option-0-0/);
	assert.match(renderedControls.at(-1) ?? "", /field-14 · option-14-0/);
	assert.match(renderedControls.at(-1) ?? "", /PgUp\/PgDn page · ↑↓ select/u);
	assert.match(request ?? "", /- field-14: option-14-0 — Option 14\/0/);
	assert.deepEqual(writes, []);
});

test("choice response specs offer a final custom answer and preserve it through review", async () => {
	let customCall = 0;
	let editorInitial = "";
	let renderedBrief = "";
	let renderedField = "";
	let renderedReview = "";
	const customOptions: unknown[] = [];
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customCall += 1;
				customOptions.push(options);
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					keybindings,
					(value) => {
						selected = value;
					},
				);
				if (customCall === 1) {
					renderedBrief = component.render(100).join("\n");
				} else if (customCall === 2) {
					renderedField = component.render(100).join("\n");
					component.handleInput("\u001b[B");
					component.handleInput("\u001b[B");
				} else {
					renderedReview = component.render(100).join("\n");
				}
				component.handleInput("\r");
				return selected;
			},
			async editor(_title: string, initial: string) {
				editorInitial = initial;
				return `${initial}Keep status visible before pending questions.`;
			},
			notify() {},
		},
	};

	const request = await editQuestionResolutionRequest(
		ctx as never,
		singleChoiceQuestion,
	);

	assert.equal(customCall, 3);
	assert.equal(isOverlayRequest(customOptions[0]), true);
	assert.ok(customOptions.slice(1).every(isScreenSurfaceRequest));
	assert.match(renderedBrief, /Review scope/);
	assert.doesNotMatch(renderedBrief, /## Review scope/);
	assert.match(renderedField, /Write another answer…/);
	assert.match(editorInitial, /Choose the Developer policy/);
	assert.match(renderedReview, /policy · custom — Keep status visible/);
	assert.match(
		request ?? "",
		/- policy: custom — user wrote: Keep status visible before pending questions\./,
	);
	assert.doesNotMatch(request ?? "", /__custom__/);
});

test("escape from the first choice field returns to the explanation brief", async () => {
	const selections: Array<string | undefined> = [
		"continue",
		undefined,
		"defer",
	];
	let customCalls = 0;
	const ctx = {
		ui: {
			async custom() {
				customCalls += 1;
				return selections.shift();
			},
			notify() {},
		},
	};

	assert.equal(
		await editQuestionResolutionRequest(ctx as never, singleChoiceQuestion),
		undefined,
	);
	assert.equal(customCalls, 3);
});

test("escape from custom answer input returns to the same choice field", async () => {
	const selections = ["continue", "__custom__", "safe", "submit"];
	let customCalls = 0;
	let editorCalls = 0;
	const ctx = {
		ui: {
			async custom() {
				customCalls += 1;
				return selections.shift();
			},
			async editor() {
				editorCalls += 1;
				return undefined;
			},
			notify() {},
		},
	};

	const request = await editQuestionResolutionRequest(
		ctx as never,
		singleChoiceQuestion,
	);

	assert.equal(customCalls, 4);
	assert.equal(editorCalls, 1);
	assert.match(request ?? "", /- policy: safe — Use the safe default/);
});

test("custom answers reject blank and oversized text before accepting a valid response", async () => {
	const selections = ["continue", "__custom__", "submit"];
	const notifications: string[] = [];
	let editorCalls = 0;
	let prefix = "";
	const ctx = {
		ui: {
			async custom() {
				return selections.shift();
			},
			async editor(_title: string, initial: string) {
				editorCalls += 1;
				if (editorCalls === 1) {
					prefix = initial;
					return `${initial}   `;
				}
				if (editorCalls === 2) return `${initial}${"x".repeat(100_000)}`;
				return `${prefix}Use a separately reviewed policy.`;
			},
			notify(message: string) {
				notifications.push(message);
			},
		},
	};

	const request = await editQuestionResolutionRequest(
		ctx as never,
		singleChoiceQuestion,
	);

	assert.equal(editorCalls, 3);
	assert.match(notifications[0] ?? "", /non-empty answer/);
	assert.match(notifications[1] ?? "", /Custom answer is too large/);
	assert.match(
		request ?? "",
		/- policy: custom — user wrote: Use a separately reviewed policy\./,
	);
});

test("structured answer navigation backs through fields, detail, review, and edits", async () => {
	const selections: Array<string | undefined> = [
		"continue",
		"A1",
		undefined,
		"A2",
		"A2",
		"hide",
		"edit:0",
		"A1",
		undefined,
		"show",
		"submit",
	];
	let customCalls = 0;
	let editorCalls = 0;
	const ctx = {
		ui: {
			async custom() {
				customCalls += 1;
				return selections.shift();
			},
			async editor(_title: string, initial: string) {
				editorCalls += 1;
				if (editorCalls === 1) return undefined;
				return `${initial}\n카드그룹__타일`;
			},
			getEditorText() {
				throw new Error(
					"structured forms must not consume the freeform editor draft",
				);
			},
			notify() {},
		},
	};

	const request = await editQuestionResolutionRequest(
		ctx as never,
		choiceQuestion,
	);

	assert.equal(customCalls, 11);
	assert.equal(editorCalls, 2);
	assert.match(request ?? "", /- A: A1 — Expose all/);
	assert.match(request ?? "", /- B1: show — Expose/);
	assert.doesNotMatch(request ?? "", /Detail:/);
});

test("escape from the immediate answer editor returns to the explanation brief", async () => {
	const selections = ["continue", "defer"];
	let customCalls = 0;
	let editorCalls = 0;
	const question: PendingQuestion = {
		...openQuestion,
		resolutionOwner: "user",
		gate: "before-implementation",
	};
	const ctx = {
		ui: {
			async custom() {
				customCalls += 1;
				return selections.shift();
			},
			async editor() {
				editorCalls += 1;
				return undefined;
			},
			notify() {},
		},
	};

	assert.deepEqual(await promptImmediateUserQuestion(ctx as never, question), {
		kind: "defer",
	});
	assert.equal(customCalls, 2);
	assert.equal(editorCalls, 1);
});

test("Developer Settings is a non-overlay secondary activation surface", async () => {
	let rendered = "";
	let overlayOptions: unknown;
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				overlayOptions = options;
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				rendered = component.render(78).join("\n");
				component.handleInput("\u001b");
				return selected;
			},
		},
	};

	const { binding } = createSettingsBinding(activeState());
	await showDeveloperSettings(ctx as never, binding);
	assert.match(rendered, /◆ Developer/);
	assert.match(rendered, /Developer\s+On/);
	assert.match(rendered, /Activation settings/);
	assert.doesNotMatch(rendered, /Status\s+needs-judgment/);
	assert.doesNotMatch(rendered, /History\s+1/);
	assert.doesNotMatch(rendered, /Open questions\s+1/);
	assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 78));
	assert.equal(overlayOptions, undefined);
});

test("Developer settings renders canonical activation changes on the same surface", async () => {
	const session = createSettingsBinding(initialState());
	let before = "";
	let afterOn = "";
	let afterOff = "";
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				assert.equal(options, undefined);
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				before = component.render(78).join("\n");
				component.handleInput("\r");
				afterOn = component.render(78).join("\n");
				component.handleInput("\r");
				afterOff = component.render(78).join("\n");
				component.handleInput("\u001b");
				return selected;
			},
			notify() {},
		},
	};

	assert.equal(
		await showDeveloperSettings(ctx as never, session.binding),
		undefined,
	);
	assert.match(before, /Developer\s+Off/);
	assert.match(afterOn, /Developer\s+On/);
	assert.match(afterOff, /Developer\s+Off/);
	assert.deepEqual(session.events, [true, false]);
	assert.equal(session.read().enabled, false);
});

test("destructive activation is commit-after-confirm with canonical rollback", async () => {
	const run = async (confirm: boolean) => {
		const session = createSettingsBinding(activeState());
		let renderedAfterDecision = "";
		const overlayOptions: unknown[] = [];
		const ctx = {
			ui: {
				async custom(factory: TestComponentFactory, options: unknown) {
					let selected: unknown;
					const component = await factory(
						{
							requestRender() {},
							terminal: { rows: 40, write() {} },
						},
						theme,
						keybindings,
						(value: unknown) => {
							selected = value;
						},
					);
					if (isOverlayRequest(options)) {
						overlayOptions.push(options);
						if (confirm) {
							component.handleInput("\u001b[B");
							component.handleInput("\r");
						} else {
							component.handleInput("\u001b");
						}
						return selected;
					}

					component.handleInput("\r");
					await new Promise((resolve) => setTimeout(resolve, 0));
					renderedAfterDecision = component.render(78).join("\n");
					component.handleInput("\u001b");
					return selected;
				},
				notify() {},
			},
		};

		await showDeveloperSettings(ctx as never, session.binding);
		return {
			state: session.read(),
			events: session.events,
			renderedAfterDecision,
			overlayOptions,
		};
	};

	const cancelled = await run(false);
	assert.deepEqual(cancelled.events, []);
	assert.equal(cancelled.state.enabled, true);
	assert.match(cancelled.renderedAfterDecision, /Developer\s+On/);
	assert.doesNotMatch(cancelled.renderedAfterDecision, /Open questions/);
	assert.equal(cancelled.overlayOptions.length, 1);

	const confirmed = await run(true);
	assert.deepEqual(confirmed.events, [false]);
	assert.equal(confirmed.state.enabled, false);
	assert.equal(confirmed.state.activeRoute, undefined);
	assert.deepEqual(confirmed.state.pendingQuestions, []);
	assert.match(confirmed.renderedAfterDecision, /Developer\s+Off/);
	assert.doesNotMatch(confirmed.renderedAfterDecision, /Open questions/);
	assert.equal(confirmed.overlayOptions.length, 1);
});

test("screen-relative pending selection wraps the question and returns its exact protocol ID", async () => {
	let rendered = "";
	let customOptions: unknown;
	const longQuestion: PendingQuestion = {
		...openQuestion,
		question:
			"Which browser observation is still missing after the narrow checkout modal wraps onto the next terminal line?",
	};
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customOptions = options;
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					ansiTheme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				rendered = component.render(52).join("\n");
				component.handleInput("\r");
				return selected;
			},
		},
	};
	assert.equal(
		await showPendingQuestionSelector(ctx as never, [longQuestion]),
		longQuestion.id,
	);
	assert.match(rendered, /terminal line\?/);
	assert.match(rendered, /agent · none/);
	assert.match(rendered, /ask Pi to/);
	assert.match(rendered, /investigate/);
	assert.doesNotMatch(rendered, /…/);
	assert.equal(rendered.match(/Which browser observation/g)?.length, 1);
	assert.doesNotMatch(rendered, /question:route:earlier/);
	assert.doesNotMatch(rendered, /^╭.*╮$/m);
	assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 52));
	assert.equal(isScreenSurfaceRequest(customOptions), true);
});

test("question surface owns a bounded viewport while wheel packets never change selection", async () => {
	const writes: string[] = [];
	let beforeWheel = "";
	let afterWheel = "";
	let customOptions: unknown;
	const questions = Array.from(
		{ length: 15 },
		(_, index): PendingQuestion => ({
			...openQuestion,
			id: `question:${index}`,
			question: `Question ${index}`,
		}),
	);
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customOptions = options;
				let selected: unknown;
				const component = await factory(
					{
						requestRender() {},
						terminal: { rows: 40, write: (data: string) => writes.push(data) },
					},
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				beforeWheel = component.render(78).join("\n");
				component.handleInput("\u001b[<65;12;8M");
				afterWheel = component.render(78).join("\n");
				component.handleInput("\r");
				return selected;
			},
		},
	};

	assert.equal(
		await showPendingQuestionSelector(ctx as never, questions),
		"question:0",
	);
	assert.match(beforeWheel, /Question 0/);
	assert.match(beforeWheel, /Question 14/);
	assert.match(beforeWheel, /PgUp\/PgDn page · ↑↓ select/u);
	assert.doesNotMatch(beforeWheel, /mouse wheel scroll/u);
	assert.equal(afterWheel, beforeWheel);
	assert.equal(isScreenSurfaceRequest(customOptions), true);
	assert.deepEqual(writes, []);
});

test("question screen keeps its title and help while paging a bounded viewport", async () => {
	const questions = Array.from(
		{ length: 15 },
		(_, index): PendingQuestion => ({
			...openQuestion,
			id: `question:viewport:${index}`,
			question: `Viewport question ${index}`,
		}),
	);
	let firstPage = "";
	let lastPage = "";
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				assert.equal(isScreenSurfaceRequest(options), true);
				let selected: unknown;
				const component = await factory(
					{ requestRender() {}, terminal: { rows: 14, write() {} } },
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				firstPage = component.render(52).join("\n");
				component.handleInput("\u001b[6~");
				lastPage = component.render(52).join("\n");
				component.handleInput("\r");
				return selected;
			},
		},
	};

	assert.equal(
		await showPendingQuestionSelector(ctx as never, questions),
		"question:viewport:14",
	);
	assert.equal(firstPage.split("\n").length, 14);
	assert.equal(lastPage.split("\n").length, 14);
	for (const page of [firstPage, lastPage]) {
		assert.match(page, /Resolve an open Developer question/u);
		assert.match(page, /PgUp\/PgDn page/u);
	}
	assert.match(firstPage, /Viewport question 0/u);
	assert.doesNotMatch(firstPage, /Viewport question 14/u);
	assert.match(lastPage, /Viewport question 14/u);
});

test("Developer surfaces do not paint full-panel backgrounds", async () => {
	let backgroundCalls = 0;
	const transparentTheme = {
		...theme,
		bg: (_color: string, text: string) => {
			backgroundCalls += 1;
			return text;
		},
	} as Theme;
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory) {
				const component = await factory(
					{ requestRender() {} },
					transparentTheme,
					keybindings,
					() => {},
				);
				component.render(78);
				return null;
			},
		},
	};

	const state = activeState();
	const { binding } = createSettingsBinding(state);
	await showDeveloperSettings(ctx as never, binding);
	new DeveloperWorkbenchSurface({
		snapshot: inspectDeveloperWorkbench(state, {
			activeTools: [],
			availableSkills: [],
		}),
		theme: transparentTheme,
		keybindings: keybindings as never,
		done() {},
		requestRender() {},
	}).render(78, 22);
	assert.equal(backgroundCalls, 0);
});

test("question resolution explains legacy context before opening the editor", async () => {
	let briefRendered = "";
	let editorInitial = "";
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				assert.equal(isOverlayRequest(options), true);
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					keybindings,
					(value: unknown) => {
						selected = value;
					},
				);
				briefRendered = component.render(88).join("\n");
				component.handleInput("\r");
				return selected;
			},
			getEditorText: () => "Existing draft",
			async editor(_title: string, initial: string) {
				editorInitial = initial;
				return `${initial}\nThe browser preserves the selected value.`;
			},
		},
	};
	const request = await editQuestionResolutionRequest(
		ctx as never,
		openQuestion,
	);
	assert.match(briefRendered, /No additional context was recorded/);
	assert.ok(
		briefRendered.indexOf("No additional context was recorded") <
			briefRendered.indexOf("Continue to answer"),
	);
	assert.match(
		editorInitial,
		/^Existing draft\n\nResolve this open Developer question\./,
	);
	assert.match(editorInitial, /Resolution owner: agent/);
	assert.match(editorInitial, /Evidence or investigation request for Pi:/);
	assert.match(request ?? "", /The browser preserves the selected value/);
	assert.doesNotMatch(request ?? "", /question:route:earlier/);
	assert.doesNotMatch(
		questionResolutionPrompt(openQuestion),
		/question:route:earlier/,
	);
	assert.doesNotMatch(
		questionResolutionPrompt(openQuestion),
		/Decision or evidence context:/,
	);
});
