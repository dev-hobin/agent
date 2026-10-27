import {
	DynamicBorder,
	type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	type SelectItem,
	SelectList,
	Text,
} from "@earendil-works/pi-tui";

export const LEARNING_SKILL_NAMES = [
	"technical-reading",
	"opensource-reading",
	"conceptualize",
	"patternize",
	"exercise",
] as const;

export type LearningSkillName = (typeof LEARNING_SKILL_NAMES)[number];

function stripLearningSkill(value: string): string {
	for (const skillName of LEARNING_SKILL_NAMES) {
		const command = `/skill:${skillName}`;
		if (value === command) return "";
		const separator = value.slice(command.length, command.length + 1);
		if (value.startsWith(command) && separator && separator.trim() === "") {
			return value.slice(command.length).trimStart();
		}
	}
	return value;
}

export function parseLearningSkillName(
	value: string,
): LearningSkillName | undefined {
	return LEARNING_SKILL_NAMES.find((skillName) => skillName === value);
}

export function learningSkillItems(): SelectItem[] {
	return [
		{
			value: "technical-reading",
			label: "Read technical material",
			description:
				"Recover source intent and organize source-grounded insights",
		},
		{
			value: "opensource-reading",
			label: "Study open-source code",
			description:
				"Trace one evidence-backed repository slice through docs, tests, and code",
		},
		{
			value: "conceptualize",
			label: "Form a cross-source concept",
			description:
				"Find and test one transferable concept across materials or cases",
		},
		{
			value: "patternize",
			label: "Discover an operational pattern",
			description:
				"Find recurring context, forces, moves, and checks across cases",
		},
		{
			value: "exercise",
			label: "Design deliberate practice",
			description:
				"Create prediction, diagnosis, repair, transfer, and mastery evidence",
		},
	];
}

export async function showLearningSkillSelector(
	ctx: ExtensionCommandContext,
): Promise<LearningSkillName | undefined> {
	const result = await ctx.ui.custom<string | null>(
		(tui, theme, _keybindings, done) => {
			const container = new Container();
			const title = new Text("", 1, 0);
			const subtitle = new Text("", 1, 0);
			const hint = new Text("", 1, 0);
			const updateText = () => {
				title.setText(
					theme.fg("accent", theme.bold("Choose a Learning approach")),
				);
				subtitle.setText(
					theme.fg(
						"muted",
						"Selection prepares the editor; it does not impose a workflow order",
					),
				);
				hint.setText(
					theme.fg("dim", "↑↓ navigate · enter select · esc cancel"),
				);
			};
			updateText();

			const list = new SelectList(learningSkillItems(), 5, {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			list.onSelect = (item) => done(item.value);
			list.onCancel = () => done(null);

			container.addChild(
				new DynamicBorder((text) => theme.fg("borderAccent", text)),
			);
			container.addChild(title);
			container.addChild(subtitle);
			container.addChild(list);
			container.addChild(hint);
			container.addChild(
				new DynamicBorder((text) => theme.fg("borderAccent", text)),
			);

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					updateText();
					container.invalidate();
				},
				handleInput(data: string) {
					list.handleInput(data);
					tui.requestRender();
				},
			};
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "center",
				width: 78,
				maxHeight: 12,
				margin: 1,
			},
		},
	);
	return result ? parseLearningSkillName(result) : undefined;
}

export function prepareLearningSkill(
	ctx: ExtensionCommandContext,
	skillName: LearningSkillName,
): string {
	const current = ctx.ui.getEditorText();
	const body = stripLearningSkill(current).trimStart();
	const next = body ? `/skill:${skillName} ${body}` : `/skill:${skillName} `;
	ctx.ui.setEditorText(next);
	return next;
}
