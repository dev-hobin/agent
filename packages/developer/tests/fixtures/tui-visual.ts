import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import {
	PROTOCOL,
	applyDeveloperEvent,
	type ActivationEvent,
	type DeveloperState,
	type JudgmentEvent,
	type PendingQuestion,
	type RouteEvent,
} from "../../extensions/state.ts";
import {
	developerHistoryEntries,
	editQuestionResolutionRequest,
	promptImmediateUserQuestion,
	showDeveloperHistoryDetail,
	showDeveloperHistorySelector,
	showDeveloperSettings,
	showDeveloperStatus,
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
		context: options.context,
		status,
		resolutionOwner:
			options.owner ?? (status === "blocked" ? "environment" : "agent"),
		gate: options.gate ?? (status === "blocked" ? "before-completion" : "none"),
		resolutionCriteria:
			"Observe the requested behavior in the real Ghostty scenario.",
		sourceRouteId: "route:visual:active",
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
		sourceRouteId: "route:visual:active",
	};
}

export function createQaQuestions(): PendingQuestion[] {
	return [
		customAnswerQuestion(),
		visualQuestion(
			"question:visual:narrow-question",
			"Does the non-overlay question surface wrap this long observation onto narrow terminal lines without clipping its final words?",
		),
		visualQuestion(
			"question:visual:ghostty-background",
			"Do Settings, Status, and Questions leave Ghostty's Catppuccin background untouched outside their rendered rows?",
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
			"Does Status stay compact and scroll predictably instead of expanding into mostly empty space?",
		),
	];
}

function qaRoute(routeId: string, question: string): RouteEvent {
	return {
		protocol: PROTOCOL,
		kind: "route",
		routeId,
		question,
		target: "verify",
		reason:
			"Deterministic tests cannot observe the user's Ghostty renderer, font fallback, focus, or IME.",
		knownEvidence: [
			"The deterministic TUI suite covers canonical activation and narrow widths.",
		],
		consideredAlternatives: [],
		methodLocation: "/skills/verify/SKILL.md",
	};
}

export function createRichQaState(): DeveloperState {
	const questions = createQaQuestions();
	const earlierRoute = qaRoute(
		"route:visual:earlier",
		"Was the previous Developer surface acceptable in Ghostty?",
	);
	const activeRoute = qaRoute(
		"route:visual:active",
		"Do Developer Settings, Status, Questions, and compact decisions preserve truthful state, focus depth, alignment, and bounded footprint in Ghostty?",
	);
	const lastJudgment: JudgmentEvent = {
		protocol: PROTOCOL,
		kind: "judgment",
		routeId: earlierRoute.routeId,
		question: earlierRoute.question,
		target: earlierRoute.target,
		status: "needs-evidence",
		result:
			"Real-terminal activation, focus, IME, resize, glyph, and compact-overlay evidence remains necessary.",
		basis: ["The prior static fixture rendered stale activation state."],
		openedQuestions: questions,
		questionUpdates: [],
		artifacts: ["pnpm --filter @hobin/developer check"],
		changedArtifacts: false,
	};
	return {
		enabled: true,
		activeRoute,
		lastRoute: activeRoute,
		lastJudgment,
		routeHistory: [earlierRoute, activeRoute],
		judgmentHistory: [lastJudgment],
		pendingQuestions: questions,
		focusedQuestionId: undefined,
		rerouteRequired: false,
		implementationFramingRequired: false,
		verificationRequired: true,
	};
}

export function createLongQaState(): DeveloperState {
	const base = createRichQaState();
	const historicalRoutes = Array.from({ length: 10 }, (_, index) =>
		qaRoute(
			`route:visual:history:${index + 1}`,
			`Does historical QA observation ${index + 1} remain readable after resize?`,
		),
	);
	const historicalJudgments: JudgmentEvent[] = historicalRoutes.map(
		(route, index) => ({
			protocol: PROTOCOL,
			kind: "judgment",
			routeId: route.routeId,
			question: route.question,
			target: route.target,
			status: index % 3 === 0 ? "needs-evidence" : "resolved",
			result: `Historical observation ${index + 1} includes ◆ → ↑↓ · … 한글 for alignment checks.`,
			basis: [`Synthetic visual fixture evidence ${index + 1}.`],
			openedQuestions: [],
			questionUpdates: [],
			artifacts: [],
			changedArtifacts: false,
		}),
	);
	return {
		...base,
		routeHistory: [...historicalRoutes, ...base.routeHistory],
		judgmentHistory: [...historicalJudgments, ...base.judgmentHistory],
	};
}

export class FixtureSettingsBinding implements DeveloperSettingsBinding {
	readonly events: ActivationEvent[] = [];
	private state: DeveloperState;

	constructor(initialState: DeveloperState) {
		this.state = initialState;
	}

	read(): DeveloperState {
		return this.state;
	}

	commitActivation(enabled: boolean): DeveloperState {
		const event: ActivationEvent = {
			protocol: PROTOCOL,
			kind: "activation",
			enabled,
		};
		this.events.push(event);
		this.state = applyDeveloperEvent(this.state, event);
		return this.state;
	}
}

async function inspectQuestions(
	ctx: ExtensionCommandContext,
	questions: PendingQuestion[],
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

async function inspectHistory(
	ctx: ExtensionCommandContext,
	state: DeveloperState,
): Promise<void> {
	let selectedRouteId: string | undefined;
	while (true) {
		const routeId = await showDeveloperHistorySelector(
			ctx,
			state,
			selectedRouteId,
		);
		if (!routeId) return;
		selectedRouteId = routeId;
		const entry = developerHistoryEntries(state).find(
			(candidate) => candidate.id === routeId,
		);
		if (entry) await showDeveloperHistoryDetail(ctx, entry);
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
		const navigation = await showDeveloperSettings(ctx, binding);
		if (!navigation) return;
		if (navigation.kind === "status") {
			await showDeveloperStatus(ctx, {
				state: binding.read(),
				activeTools: [
					"read",
					"bash",
					"edit",
					"write",
					"developer_route_question",
				],
				availableSkills: ["verify", "specify", "model", "sketch", "signal"],
			});
			continue;
		}
		if (navigation.kind === "history") {
			await inspectHistory(ctx, binding.read());
			continue;
		}
		await inspectQuestions(ctx, binding.read().pendingQuestions);
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
	const state = createLongQaState();
	await showDeveloperStatus(ctx, {
		state,
		activeTools: ["read", "bash", "developer_route_question"],
		availableSkills: [
			"verify",
			"specify",
			"model",
			"sketch",
			"signal",
			"visualize",
		],
	});
	await inspectHistory(ctx, state);
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
			label: "Settings / Status / History / Questions",
			description:
				"Exercise one-level Escape, history detail, drag-copy, and parent focus restoration",
			run: runNavigationScenario,
		},
		{
			id: "answer-ime",
			label: "Questions / choices / review / Korean IME",
			description:
				"Wheel-scroll and drag-copy without changing selection, then exercise custom input, review, edit, and Escape",
			run: runAnswerImeScenario,
		},
		{
			id: "resize-scroll",
			label: "Resize / scroll / mouse cleanup",
			description:
				"Resize long Status and History documents; inspect native wheel scrollback and drag-copy",
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
		description: "Open the Developer v5 Ghostty QA scenarios",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify(
					"/developer-tui-qa requires interactive TUI mode",
					"error",
				);
				return;
			}

			ctx.ui.setTitle("Developer v5 · Ghostty QA");
			try {
				while (true) {
					const scenarios = createQaScenarios();
					const selectedLabel = await ctx.ui.select(
						"Developer v5 Ghostty QA · choose an independent scenario",
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
