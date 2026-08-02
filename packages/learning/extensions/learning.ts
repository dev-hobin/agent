import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	LEARNING_SKILL_NAMES,
	parseLearningSkillName,
	prepareLearningSkill,
	showLearningSkillSelector,
} from "./tui.ts";

export default function learning(pi: ExtensionAPI) {
	pi.registerCommand("learning", {
		description: "Choose an independent Learning approach",
		getArgumentCompletions(prefix) {
			const matches = LEARNING_SKILL_NAMES.filter((skillName) =>
				skillName.startsWith(prefix.trim()),
			);
			if (matches.length === 0) return null;
			return matches.map((skillName) => ({
				value: skillName,
				label: skillName,
			}));
		},
		handler: async (args, ctx) => {
			let requestedName = args.trim();
			if (!requestedName && ctx.mode === "tui") {
				requestedName = (await showLearningSkillSelector(ctx)) ?? "";
				if (!requestedName) return;
			}
			const skillName = parseLearningSkillName(requestedName);
			if (!skillName) {
				ctx.ui.notify(
					`Usage: /learning ${LEARNING_SKILL_NAMES.join(" | ")}`,
					requestedName ? "warning" : "info",
				);
				return;
			}

			prepareLearningSkill(ctx, skillName);
			ctx.ui.notify(`${skillName} prepared in the editor.`, "info");
		},
	});
}
