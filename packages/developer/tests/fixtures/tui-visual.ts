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

const questions: PendingQuestion[] = [
	{
		id: "question:visual:narrow-checkout",
		question:
			"Which browser observation is still missing after the narrow checkout modal wraps onto the next terminal line without clipping its final words?",
		status: "needs-evidence",
		sourceRouteId: "route:visual:active",
	},
	{
		id: "question:visual:ghostty-background",
		question:
			"Does the modal remain visually separate without painting a large custom-message background over Ghostty's Catppuccin terminal surface?",
		status: "needs-evidence",
		sourceRouteId: "route:visual:active",
	},
	{
		id: "question:visual:blocked",
		question:
			"Is the right border still aligned after repeatedly resizing the Ghostty window between wide and narrow layouts?",
		status: "blocked",
		sourceRouteId: "route:visual:earlier",
	},
	{
		id: "question:visual:unicode",
		question:
			"Do ◆, →, ↑↓, ·, … and 한글 remain aligned with the surrounding text?",
		status: "needs-evidence",
		sourceRouteId: "route:visual:earlier",
	},
	{
		id: "question:visual:height",
		question:
			"Does the status panel stay compact instead of expanding into a mostly empty scrolling region?",
		status: "needs-evidence",
		sourceRouteId: "route:visual:earlier",
	},
];

const state: DeveloperState = {
	mode: "strict",
	activeRoute: {
		protocol: "developer/v3",
		kind: "route",
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
		methodLocation: "/skills/verify/SKILL.md",
	},
	lastJudgment: {
		protocol: "developer/v3",
		kind: "judgment",
		routeId: "route:visual:earlier",
		question: "Is the previous modal patch acceptable?",
		owner: "verify",
		status: "needs-evidence",
		result:
			"The previous patch still clipped list text and introduced an oversized detail area, so real-terminal visual evidence remains necessary.",
		basis: ["The issue was reproduced in the installed package."],
		openedQuestions: questions,
		artifacts: ["pnpm --filter @hobin/developer check"],
		changedArtifacts: true,
	},
	pendingQuestions: questions,
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
