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
import {
	DeveloperHistoryDetailPanel,
	DeveloperQuestionBriefPanel,
	DeveloperStatusPanel,
	DeveloperWidget,
	developerHistoryEntries,
	developerSettingItems,
	type DeveloperSettingsBinding,
	editQuestionResolutionRequest,
	historySelectItems,
	pendingQuestionItems,
	promptImmediateUserQuestion,
	questionResolutionPrompt,
	renderDeveloperFooter,
	showDeveloperHistoryDetail,
	showDeveloperHistorySelector,
	showDeveloperSettings,
	showDeveloperStatus,
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

test("Developer assigns footer, widget, settings, and pending lists distinct information roles", () => {
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
		["activation", "status", "history", "questions"],
	);
	assert.equal(
		settings.find((item) => item.id === "activation")?.currentValue,
		"On",
	);
	assert.equal(
		settings.find((item) => item.id === "questions")?.currentValue,
		"1",
	);
	assert.equal(
		settings.some((item) => item.id === openQuestion.id),
		false,
	);

	const questions = pendingQuestionItems(state.pendingQuestions);
	assert.equal(questions[0]?.value, openQuestion.id);
	assert.equal(questions[0]?.label, openQuestion.question);
	assert.match(questions[0]?.description ?? "", /open · agent · none/);
	assert.match(questions[0]?.description ?? "", /ask Pi to investigate/);
});

test("Developer settings keep Status available and hide empty question lists", () => {
	const offState = {
		...activeState(),
		enabled: false,
		activeRoute: undefined,
		judgmentHistory: [],
		pendingQuestions: [],
	};
	assert.deepEqual(
		developerSettingItems(offState).map((item) => [item.id, item.currentValue]),
		[
			["activation", "Off"],
			["status", "idle"],
		],
	);

	const onWithoutQuestions = {
		...activeState(),
		pendingQuestions: [],
	};
	assert.deepEqual(
		developerSettingItems(onWithoutQuestions).map((item) => item.id),
		["activation", "status", "history"],
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

test("decision brief renders legacy fallback before controls and wheel never changes its action", () => {
	let selected: string | undefined;
	const panel = new DeveloperQuestionBriefPanel(
		{ ...choiceQuestion, context: undefined },
		theme,
		keybindings as never,
		(action) => {
			selected = action;
		},
	);
	const output = panel.render(88).join("\n");

	assert.match(output, /No additional context was recorded/);
	assert.match(output, /A1 · Expose all/);
	assert.match(output, /show · Expose/);
	assert.ok(
		output.indexOf("No additional context was recorded") <
			output.indexOf("Continue to answer"),
	);
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
	assert.match(briefRendered, /Implementation remains blocked/);
	assert.ok(
		briefRendered.indexOf("A1: absent") <
			briefRendered.indexOf("Continue to answer"),
	);
	assert.equal(customOptions, undefined);
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
	assert.deepEqual(customOptions, [undefined, undefined, undefined, undefined]);
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
	assert.match(renderedControls[0] ?? "", /A1 · Expose all/);
	assert.match(renderedControls[0] ?? "", /show · Expose/);
	assert.ok(
		(renderedControls[0] ?? "").indexOf("show · Expose") <
			(renderedControls[0] ?? "").indexOf("Continue to answer"),
	);
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

test("long choice fields and reviews render every row as native-scroll surfaces", async () => {
	const writes: string[] = [];
	const customOptions: unknown[] = [];
	const rendered: string[] = [];
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
				rendered.push(component.render(100).join("\n"));
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

	assert.equal(rendered.length, 17);
	assert.ok(customOptions.every((options) => options === undefined));
	assert.match(rendered[0] ?? "", /Why this decision is required/);
	assert.match(rendered[0] ?? "", /Option 0\/0/);
	assert.match(rendered[0] ?? "", /Option 0\/14/);
	assert.match(rendered[0] ?? "", /field 15\/15 · field-14/);
	assert.ok(
		(rendered[0] ?? "").indexOf("Option 0/14") <
			(rendered[0] ?? "").indexOf("Continue to answer"),
	);
	assert.match(rendered[1] ?? "", /Write another answer…/);
	assert.match(rendered.at(-1) ?? "", /field-0 · option-0-0/);
	assert.match(rendered.at(-1) ?? "", /field-14 · option-14-0/);
	assert.match(
		rendered.at(-1) ?? "",
		/mouse wheel scroll · drag select · Cmd\+C copy/,
	);
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
	assert.deepEqual(customOptions, [undefined, undefined, undefined]);
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

test("Developer control uses a non-overlay SettingsList with current values", async () => {
	let rendered = "";
	let renderedAfterNavigation = "";
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
				component.handleInput("\u001b[B");
				renderedAfterNavigation = component.render(78).join("\n");
				component.handleInput("\r");
				return selected;
			},
		},
	};

	const { binding } = createSettingsBinding(activeState());
	const result = await showDeveloperSettings(ctx as never, binding);
	assert.deepEqual(result, { kind: "status" });
	assert.match(rendered, /◆ Developer/);
	assert.match(rendered, /Developer\s+On/);
	assert.match(rendered, /Status\s+needs-judgment/);
	assert.match(rendered, /History\s+1/);
	assert.match(rendered, /Open questions\s+1/);
	assert.doesNotMatch(rendered, /Which browser observation is still missing\?/);
	assert.doesNotMatch(rendered, /Selected detail|scroll detail/);
	assert.doesNotMatch(rendered, /^╭.*╮$/m);
	assert.ok(rendered.split("\n").every((line) => visibleWidth(line) <= 78));
	assert.match(renderedAfterNavigation, /Inspect the current route/);
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
	assert.match(cancelled.renderedAfterDecision, /Open questions\s+1/);
	assert.equal(cancelled.overlayOptions.length, 1);

	const confirmed = await run(true);
	assert.deepEqual(confirmed.events, [false]);
	assert.equal(confirmed.state.enabled, false);
	assert.equal(confirmed.state.activeRoute, undefined);
	assert.deepEqual(confirmed.state.pendingQuestions, []);
	assert.match(confirmed.renderedAfterDecision, /Developer\s+Off/);
	assert.doesNotMatch(confirmed.renderedAfterDecision, /History/);
	assert.doesNotMatch(confirmed.renderedAfterDecision, /Open questions/);
	assert.equal(confirmed.overlayOptions.length, 1);
});

test("non-overlay pending selection wraps the question and returns its exact protocol ID", async () => {
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
	assert.equal(customOptions, undefined);
});

test("Developer history projects judgments latest-first and preserves orphan records", () => {
	const state = activeState();
	const earlierJudgment = state.judgmentHistory[0];
	assert.ok(earlierJudgment);
	const newerJudgment = {
		...earlierJudgment,
		routeId: "route:active",
		question: "Is the active route now verified?",
		status: "resolved" as const,
		result: "The active route is verified.",
	};
	const entries = developerHistoryEntries({
		...state,
		judgmentHistory: [earlierJudgment, newerJudgment],
	});

	assert.deepEqual(
		entries.map((entry) => entry.id),
		["route:active", "route:earlier"],
	);
	assert.equal(entries[0]?.route?.routeId, "route:active");
	assert.match(historySelectItems(entries)[0]?.label ?? "", /resolved/);

	const orphan = developerHistoryEntries({ ...state, routeHistory: [] });
	assert.equal(orphan.length, 1);
	assert.equal(orphan[0]?.route, undefined);
});

test("history selection preserves its route identity without enabling mouse tracking", async () => {
	const writes: string[] = [];
	let rendered = "";
	const state = activeState();
	const earlierJudgment = state.judgmentHistory[0];
	assert.ok(earlierJudgment);
	const judgments = Array.from({ length: 15 }, (_, index) => ({
		...earlierJudgment,
		routeId: `route:history:${index}`,
		question: `History judgment ${index}`,
		status: "resolved" as const,
		result: `History result ${index}`,
	}));
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				assert.equal(options, undefined);
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
				rendered = component.render(78).join("\n");
				component.handleInput("\r");
				return selected;
			},
		},
	};

	assert.equal(
		await showDeveloperHistorySelector(
			ctx as never,
			{ ...state, judgmentHistory: judgments },
			"route:history:0",
		),
		"route:history:0",
	);
	assert.match(rendered, /Developer history · 15/);
	assert.match(rendered, /History judgment 0/);
	assert.match(rendered, /History judgment 14/);
	assert.match(
		rendered,
		/mouse wheel scroll · drag select · Cmd\+C copy · ↑↓ select/,
	);
	assert.deepEqual(writes, []);
});

test("history detail renders complete scrollable evidence and tolerates a missing route", () => {
	const state = activeState();
	const judgment = state.judgmentHistory[0];
	assert.ok(judgment);
	const entry = developerHistoryEntries({
		...state,
		judgmentHistory: [
			{
				...judgment,
				result: `Start ${"long evidence ".repeat(30)}END_RESULT`,
				artifacts: ["END_ARTIFACT"],
			},
		],
	})[0];
	assert.ok(entry);
	const panel = new DeveloperHistoryDetailPanel(entry, theme, () => {});
	const document = panel.render(56).join("\n");
	assert.match(document, /Developer history detail/);
	assert.match(document, /Is the implementation complete/);
	assert.match(document, /END_RESULT/);
	assert.match(document, /END_ARTIFACT/);
	assert.match(document, /mouse wheel scroll · drag select · Cmd\+C copy/);
	assert.match(document, /back/);

	const orphan = developerHistoryEntries({ ...state, routeHistory: [] })[0];
	assert.ok(orphan);
	const orphanOutput = new DeveloperHistoryDetailPanel(orphan, theme, () => {})
		.render(88)
		.join("\n");
	assert.match(orphanOutput, /Route details unavailable/);
	assert.match(orphanOutput, /A browser observation remains/);
});

test("history detail host leaves mouse tracking disabled for drag-copy", async () => {
	const writes: string[] = [];
	let closed = false;
	const entry = developerHistoryEntries(activeState())[0];
	assert.ok(entry);
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				assert.equal(options, undefined);
				const component = await factory(
					{
						requestRender() {},
						terminal: { rows: 40, write: (data: string) => writes.push(data) },
					},
					theme,
					keybindings,
					() => {
						closed = true;
					},
				);
				component.render(88);
				component.handleInput("\u001b");
			},
		},
	};

	await showDeveloperHistoryDetail(ctx as never, entry);
	assert.equal(closed, true);
	assert.deepEqual(writes, []);
});

test("question surface renders every row while wheel packets never change selection", async () => {
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
	assert.match(
		beforeWheel,
		/mouse wheel scroll · drag select · Cmd\+C copy · ↑↓ select/,
	);
	assert.equal(afterWheel, beforeWheel);
	assert.equal(customOptions, undefined);
	assert.deepEqual(writes, []);
});

test("non-overlay status leaves mouse tracking disabled for terminal drag selection", async () => {
	const writes: string[] = [];
	let closed = false;
	let customOptions: unknown;
	const ctx = {
		ui: {
			async custom(factory: TestComponentFactory, options: unknown) {
				customOptions = options;
				const component = await factory(
					{
						requestRender() {},
						terminal: { rows: 40, write: (data: string) => writes.push(data) },
					},
					theme,
					keybindings,
					() => {
						closed = true;
					},
				);
				component.render(88);
				component.handleInput("\u001b[<65;12;8M");
				component.handleInput("\r");
			},
		},
	};

	await showDeveloperStatus(ctx as never, {
		state: activeState(),
		activeTools: ["read"],
		availableSkills: ["verify"],
	});
	assert.equal(closed, true);
	assert.equal(customOptions, undefined);
	assert.deepEqual(writes, []);
});

test("status panel is bounded, branch-grounded, and keyboard dismissible", () => {
	let closed = false;
	const panel = new DeveloperStatusPanel(
		{
			state: activeState(),
			activeTools: [
				"read",
				"developer_route_question",
				"developer_record_judgment",
			],
			availableSkills: ["verify", "specify"],
		},
		theme,
		() => {
			closed = true;
		},
	);
	const lines = panel.render(88);
	const output = lines.join("\n");
	assert.match(output, /Developer status/);
	assert.match(
		output,
		/Does the rendered interface preserve the product invariant/,
	);
	assert.match(output, /Open questions · 1/);
	assert.match(output, /Judgment history · 1/);
	assert.match(output, /A browser observation/);
	assert.match(output, /remains\./);
	assert.match(output, /2 skills · 3 active tools/);
	assert.match(
		output,
		/mouse wheel scroll · drag select · Cmd\+C copy · enter\/esc close/,
	);
	assert.ok(lines.every((line) => visibleWidth(line) <= 88));

	const narrowLines = panel.render(52);
	assert.match(
		narrowLines.join("\n"),
		/question · Does the rendered interface preserve/,
	);
	assert.match(narrowLines.join("\n"), / {13}the product invariant\?/);
	assert.ok(narrowLines.every((line) => visibleWidth(line) <= 52));
	panel.handleInput("\r");
	assert.equal(closed, true);
});

test("status renders its complete document for terminal-native wheel scrolling", () => {
	const panel = new DeveloperStatusPanel(
		{
			state: activeState(),
			activeTools: ["read"],
			availableSkills: ["verify"],
		},
		theme,
		() => {},
	);
	const document = panel.render(72);
	const output = document.join("\n");

	assert.ok(document.length > 14);
	assert.match(output, /Active route/);
	assert.match(output, /resources · 1 skills · 1 active tools/);
	assert.match(output, /mouse wheel scroll · drag select · Cmd\+C copy/);
	panel.handleInput("\u001b[<64;12;8M");
	assert.deepEqual(panel.render(72), document);
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

	const { binding } = createSettingsBinding(activeState());
	await showDeveloperSettings(ctx as never, binding);
	new DeveloperStatusPanel(
		{ state: activeState(), activeTools: [], availableSkills: [] },
		transparentTheme,
		() => {},
	).render(78);
	assert.equal(backgroundCalls, 0);
});

test("question resolution explains legacy context before opening the editor", async () => {
	let briefRendered = "";
	let editorInitial = "";
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
