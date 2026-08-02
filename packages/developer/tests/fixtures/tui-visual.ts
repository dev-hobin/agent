import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import {
	activationChanged,
	judgmentConcluded,
	judgmentOpened,
	type ActivationChanged,
	type PendingQuestion,
} from "../../src/protocol.ts";
import {
	applyDeveloperEvent,
	initialDeveloperState,
	type DeveloperState,
} from "../../src/transition.ts";
import { inspectDeveloperWorkbench } from "../../extensions/developer-workbench.ts";
import { showDeveloperWorkbench } from "../../extensions/developer-workbench-tui.ts";
import {
	editQuestionResolutionRequest,
	promptImmediateUserQuestion,
	showDeveloperSettings,
	showPendingQuestionSelector,
	type DeveloperSettingsBinding,
} from "../../extensions/tui.ts";

export type QaScenarioId =
	| "activation"
	| "navigation"
	| "answer-ime"
	| "resize-scroll"
	| "unicode-footprint";

export interface QaScenario {
	id: QaScenarioId;
	label: string;
	description: string;
	run(ctx: ExtensionCommandContext): Promise<void>;
}

const VISUAL_JUDGMENT_ID = "judgment:visual:earlier";
function visualQuestion(
	id: string,
	question: string,
	options: {
		status?: "open" | "blocked";
		owner?: PendingQuestion["resolutionOwner"];
		gate?: PendingQuestion["gate"];
		context?: string;
	} = {},
): PendingQuestion {
	const status = options.status ?? "open";
	return {
		id,
		question,
		...(options.context ? { context: options.context } : {}),
		status,
		resolutionOwner:
			options.owner ?? (status === "blocked" ? "environment" : "agent"),
		gate: options.gate ?? (status === "blocked" ? "before-completion" : "none"),
		resolutionCriteria:
			"Observe the requested behavior in the real Ghostty scenario.",
		sourceWorkId: VISUAL_JUDGMENT_ID,
	};
}

function customAnswerQuestion(
	id = "question:visual:custom-answer-ime",
	question = "Can Ghostty compose and review a custom Korean answer without clipping, losing text, or corrupting preset/custom provenance?",
): PendingQuestion {
	return {
		id,
		question,
		context: [
			"## Why this observation is required",
			"The result must preserve **both interaction and provenance**:",
			"- Choose `Write another answer…`.",
			"- Enter Korean text with IME.",
			"- Exercise Escape and review/edit before submitting or cancelling.",
			"",
			"> A preset must never be recorded when the user wrote a custom answer.",
			"",
			"```text",
			"expected provenance: custom",
			"```",
		].join("\n"),
		responseSpec: {
			kind: "choice-form",
			fields: [
				{
					id: "ghostty-result",
					prompt: "Record the Ghostty observation",
					options: [
						{ value: "pass", label: "Pass · 정상" },
						{
							value: "fail",
							label: "Fail · 재현 가능",
							detailPrompt:
								"Describe the exact keys, visible result, terminal size, and failure point.",
						},
					],
				},
			],
		},
		status: "open",
		resolutionOwner: "user",
		gate: "before-completion",
		resolutionCriteria:
			"Ghostty custom-answer and Korean IME behavior is reported as Pass or reproducible Fail.",
		sourceWorkId: VISUAL_JUDGMENT_ID,
	};
}

export function createQaQuestions(): PendingQuestion[] {
	return [
		customAnswerQuestion(),
		visualQuestion(
			"question:visual:narrow-question",
			"Does the screen-relative question surface keep its title and controls visible while wrapping this long observation onto narrow terminal lines?",
		),
		visualQuestion(
			"question:visual:ghostty-background",
			"Do the Workbench, Settings, and Question surfaces leave Ghostty's Catppuccin background untouched outside their rendered rows?",
		),
		visualQuestion(
			"question:visual:compact-decision",
			"Does the preset/custom decision overlay remain content-bounded instead of covering a large terminal rectangle?",
		),
		visualQuestion(
			"question:visual:blocked-resize",
			"Do borders and selected rows stay aligned after repeatedly resizing Ghostty between wide and narrow layouts?",
			{ status: "blocked" },
		),
		visualQuestion(
			"question:visual:unicode",
			"Do ◆, →, ↑↓, ·, … and 한글 remain aligned with the surrounding text?",
		),
		visualQuestion(
			"question:visual:height",
			"Does Workbench detail stay bounded and scroll predictably instead of expanding into mostly empty space?",
		),
	];
}

function openedVisualJudgment(id: string, question: string) {
	return judgmentOpened({
		kind: "active-judgment",
		judgmentId: id,
		question,
		skill: { name: "verify", location: "/skills/verify/SKILL.md" },
		reason:
			"Deterministic tests cannot observe the user's Ghostty renderer, font fallback, focus, or IME.",
		knownEvidence: [
			"The deterministic TUI suite covers canonical activation and narrow widths.",
		],
		consideredMethods: [],
	});
}

export function createRichQaState(): DeveloperState {
	const questions = createQaQuestions();
	let state = applyDeveloperEvent(
		initialDeveloperState(),
		activationChanged(true),
	);
	state = applyDeveloperEvent(
		state,
		openedVisualJudgment(
			VISUAL_JUDGMENT_ID,
			"Was the previous Developer surface acceptable in Ghostty?",
		),
	);
	state = applyDeveloperEvent(
		state,
		judgmentConcluded({
			kind: "judgment-not-applicable",
			judgmentId: VISUAL_JUDGMENT_ID,
			reason:
				"Static evidence cannot settle renderer-specific behavior; explicit questions remain.",
			basis: ["The prior static fixture rendered stale activation state."],
			producedArtifacts: ["pnpm --filter @hobin/developer check"],
			openedQuestions: questions,
			questionUpdates: [],
		}),
	);
	state = applyDeveloperEvent(
		state,
		openedVisualJudgment(
			"judgment:visual:active",
			"Do the Developer Workbench, Settings, Questions, and compact decisions preserve truthful state, focus depth, alignment, and bounded footprint in Ghostty?",
		),
	);
	return Object.freeze({
		...state,
		obligations: Object.freeze({
			...state.obligations,
			verificationRequired: true,
		}),
	});
}

export function createLongQaState(): DeveloperState {
	const base = createRichQaState();
	const template = base.judgments[0];
	if (!template) return base;
	const history = Array.from({ length: 10 }, (_, index) =>
		Object.freeze({
			judgment: Object.freeze({
				...template.judgment,
				judgmentId: `judgment:visual:history:${index + 1}`,
				question: `Does historical QA observation ${index + 1} remain readable after resize?`,
			}),
			conclusion: Object.freeze({
				...template.conclusion,
				judgmentId: `judgment:visual:history:${index + 1}`,
				reason: `Historical observation ${index + 1} includes ◆ → ↑↓ · … 한글 for alignment checks.`,
				openedQuestions: Object.freeze([]),
			}),
		}),
	);
	return Object.freeze({
		...base,
		judgments: Object.freeze([...history, ...base.judgments]),
	});
}

export class FixtureSettingsBinding implements DeveloperSettingsBinding {
	readonly events: ActivationChanged[] = [];
	private state: DeveloperState;

	constructor(initialState: DeveloperState) {
		this.state = initialState;
	}

	read(): DeveloperState {
		return this.state;
	}

	commitActivation(enabled: boolean): DeveloperState {
		const event = activationChanged(enabled);
		this.events.push(event);
		this.state = applyDeveloperEvent(this.state, event);
		return this.state;
	}
}

async function inspectQuestions(
	ctx: ExtensionCommandContext,
	questions: readonly PendingQuestion[],
): Promise<void> {
	while (true) {
		const selectedId = await showPendingQuestionSelector(ctx, questions);
		if (!selectedId) return;
		const selected = questions.find((question) => question.id === selectedId);
		if (!selected) return;
		const request = await editQuestionResolutionRequest(ctx, selected);
		if (request === undefined) continue;
		ctx.ui.notify(
			`Prepared ${request.length} characters for visual inspection; no state or model message was written.`,
			"info",
		);
		return;
	}
}

async function runActivationScenario(
	ctx: ExtensionCommandContext,
): Promise<void> {
	const binding = new FixtureSettingsBinding(createRichQaState());
	await showDeveloperSettings(ctx, binding);
	ctx.ui.notify(
		`Activation scenario closed · state ${binding.read().enabled ? "On" : "Off"} · committed events ${binding.events.length}.`,
		"info",
	);
}

async function runNavigationScenario(
	ctx: ExtensionCommandContext,
): Promise<void> {
	const binding = new FixtureSettingsBinding(createRichQaState());
	while (true) {
		const action = await showDeveloperWorkbench(
			ctx,
			inspectDeveloperWorkbench(binding.read(), {
				activeTools: ["read", "bash", "developer_conclude_judgment"],
				availableSkills: ["verify", "specify", "model", "sketch", "signal"],
			}),
		);
		if (!action) return;
		if (action.kind === "settings") {
			await showDeveloperSettings(ctx, binding);
			continue;
		}
		const question = binding
			.read()
			.pendingQuestions.find((candidate) => candidate.id === action.questionId);
		if (!question) continue;
		const request = await editQuestionResolutionRequest(ctx, question);
		if (request === undefined) continue;
		ctx.ui.notify(
			`Prepared ${request.length} characters for visual inspection; no state or model message was written.`,
			"info",
		);
		return;
	}
}

async function runAnswerImeScenario(
	ctx: ExtensionCommandContext,
): Promise<void> {
	await inspectQuestions(ctx, [
		customAnswerQuestion(),
		visualQuestion(
			"question:visual:ime-control",
			"Does Escape return from answer review to the selected question without losing 한글?",
			{
				owner: "user",
				gate: "before-completion",
				context:
					"Review the custom-answer flow, preserve the composed Korean text, and use Escape one level at a time.",
			},
		),
	]);
}

async function runResizeScenario(ctx: ExtensionCommandContext): Promise<void> {
	await showDeveloperWorkbench(
		ctx,
		inspectDeveloperWorkbench(createLongQaState(), {
			activeTools: ["read", "bash", "developer_conclude_judgment"],
			availableSkills: [
				"verify",
				"specify",
				"model",
				"sketch",
				"signal",
				"visualize",
			],
		}),
	);
}

async function runUnicodeFootprintScenario(
	ctx: ExtensionCommandContext,
): Promise<void> {
	const disposition = await promptImmediateUserQuestion(
		ctx,
		customAnswerQuestion(
			"question:visual:unicode-footprint",
			"Do ◆ → ↑↓ · … 한글 align correctly while the preset/custom decision remains content-bounded?",
		),
	);
	ctx.ui.notify(
		disposition.kind === "answer"
			? `Prepared ${disposition.request.length} characters; no answer was submitted.`
			: "Unicode/footprint scenario deferred without changing state.",
		"info",
	);
}

export function createQaScenarios(): QaScenario[] {
	return [
		{
			id: "activation",
			label: "Activation + confirm/cancel",
			description:
				"Toggle On/Off and verify canonical value, clear, and rollback",
			run: runActivationScenario,
		},
		{
			id: "navigation",
			label: "Workbench / Settings / Questions",
			description:
				"Exercise one-level Escape, history detail, y semantic copy without pane chrome, and parent focus restoration",
			run: runNavigationScenario,
		},
		{
			id: "answer-ime",
			label: "Questions / choices / review / Korean IME",
			description:
				"Page through sticky Markdown detail while actions remain visible, then exercise semantic copy, custom input, review, edit, and Escape",
			run: runAnswerImeScenario,
		},
		{
			id: "resize-scroll",
			label: "Resize / focused viewport / mouse cleanup",
			description:
				"Resize long Workbench history detail; verify its frame stays visible, keyboard scrolling stays focused, and y copies the complete record without pane chrome",
			run: runResizeScenario,
		},
		{
			id: "unicode-footprint",
			label: "Unicode + compact overlay footprint",
			description:
				"Inspect glyph alignment and background outside decision overlays",
			run: runUnicodeFootprintScenario,
		},
	];
}

export default function developerTuiVisualFixture(pi: ExtensionAPI): void {
	pi.registerCommand("developer-tui-qa", {
		description: "Open the Developer v7 Ghostty QA scenarios",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify(
					"/developer-tui-qa requires interactive TUI mode",
					"error",
				);
				return;
			}

			ctx.ui.setTitle("Developer v7 · Ghostty QA");
			try {
				while (true) {
					const scenarios = createQaScenarios();
					const selectedLabel = await ctx.ui.select(
						"Developer v7 Ghostty QA · choose an independent scenario",
						scenarios.map((scenario) => scenario.label),
					);
					if (!selectedLabel) return;
					const scenario = scenarios.find(
						(candidate) => candidate.label === selectedLabel,
					);
					if (!scenario) continue;
					ctx.ui.notify(scenario.description, "info");
					await scenario.run(ctx);
				}
			} finally {
				ctx.ui.setTitle("pi");
				ctx.ui.notify("Developer Ghostty QA closed", "info");
			}
		},
	});
}
