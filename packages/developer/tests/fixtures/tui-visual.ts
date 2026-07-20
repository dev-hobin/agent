import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type {
	DeveloperState,
	PendingQuestion,
} from "../../extensions/state.ts";
import {
	showDeveloperActionSelector,
	showDeveloperStatus,
	showPendingQuestionSelector,
} from "../../extensions/tui.ts";

const visualQuestion = (
	id: string,
	question: string,
	status: "open" | "blocked" = "open",
): PendingQuestion => ({
	id,
	question,
	status,
	resolutionOwner: status === "blocked" ? "environment" : "agent",
	gate: status === "blocked" ? "before-completion" : "none",
	resolutionCriteria: "Observe the requested behavior in the real Ghostty fixture.",
	sourceRouteId: status === "blocked" ? "route:visual:earlier" : "route:visual:active",
});

const questions: PendingQuestion[] = [
	visualQuestion(
		"question:visual:narrow-checkout",
		"Which browser observation is still missing after the narrow checkout modal wraps onto the next terminal line without clipping its final words?",
	),
	visualQuestion(
		"question:visual:ghostty-background",
		"Does the modal remain visually separate without painting a large custom-message background over Ghostty's Catppuccin terminal surface?",
	),
	visualQuestion(
		"question:visual:blocked",
		"Is the right border still aligned after repeatedly resizing the Ghostty window between wide and narrow layouts?",
		"blocked",
	),
	visualQuestion(
		"question:visual:unicode",
		"Do ◆, →, ↑↓, ·, … and 한글 remain aligned with the surrounding text?",
	),
	visualQuestion(
		"question:visual:height",
		"Does the status panel stay compact instead of expanding into a mostly empty scrolling region?",
	),
];

const activeRoute = {
	protocol: "developer/v4" as const,
	kind: "route" as const,
	routeId: "route:visual:active",
	question:
		"Does the Developer modal preserve complete readable text, aligned borders, and compact height across wide and narrow Ghostty windows?",
	owner: "verify",
	reason:
		"Unit tests cover ANSI-aware widths, but final acceptance still needs observation in the real Ghostty renderer with the user's font fallback and Catppuccin theme.",
	knownEvidence: [
		"The deterministic TUI suite passes at 52 columns.",
		"No full-panel background call remains in the Developer overlays.",
	],
	consideredAlternatives: [],
	methodLocation: "/skills/verify/SKILL.md",
};

const lastJudgment = {
	protocol: "developer/v4" as const,
	kind: "judgment" as const,
	routeId: "route:visual:earlier",
	question: "Is the previous modal patch acceptable?",
	owner: "verify",
	status: "needs-evidence" as const,
	result:
		"The previous patch still clipped list text and introduced an oversized detail area, so real-terminal visual evidence remains necessary.",
	basis: ["The issue was reproduced in the installed package."],
	openedQuestions: questions,
	questionUpdates: [],
	artifacts: ["pnpm --filter @hobin/developer check"],
	changedArtifacts: true,
};

const earlierRoute = {
	...activeRoute,
	routeId: "route:visual:earlier",
	question: lastJudgment.question,
};

const state: DeveloperState = {
	mode: "strict",
	activeRoute,
	lastRoute: activeRoute,
	lastJudgment,
	routeHistory: [earlierRoute, activeRoute],
	judgmentHistory: [lastJudgment],
	pendingQuestions: questions,
	rerouteRequired: false,
	implementationFramingRequired: false,
	verificationRequired: true,
};

export default function developerTuiVisualFixture(pi: ExtensionAPI): void {
	pi.registerCommand("developer-tui-qa", {
		description: "Open the Developer modal visual QA loop",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify(
					"/developer-tui-qa requires interactive TUI mode",
					"error",
				);
				return;
			}

			ctx.ui.setTitle("Developer TUI · Ghostty QA");
			ctx.ui.notify(
				"Ghostty QA: resize the window while each modal is open. Choose Inspect status or Revisit an open question; Esc on this menu exits.",
				"info",
			);

			while (true) {
				const action = await showDeveloperActionSelector(ctx, state);
				if (!action) break;

				if (action === "status") {
					await showDeveloperStatus(ctx, {
						state,
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

				if (action === "questions") {
					const selectedId = await showPendingQuestionSelector(ctx, questions);
					const selected = questions.find(
						(question) => question.id === selectedId,
					);
					if (selected)
						ctx.ui.notify(`Selected QA question: ${selected.question}`, "info");
					continue;
				}

				ctx.ui.notify(
					`${action} selected; the visual fixture does not mutate Developer state.`,
					"info",
				);
			}

			ctx.ui.setTitle("pi");
			ctx.ui.notify("Developer Ghostty QA closed", "info");
		},
	});
}
