import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";

import {
	learningSkillItems,
	prepareLearningSkill,
	showLearningSkillSelector,
} from "../extensions/tui.ts";

const theme = {
	bold: (text: string) => text,
	fg: (_color: string, text: string) => text,
} as Theme;

test("Learning presents five independent thinking outcomes", () => {
	const items = learningSkillItems();
	assert.deepEqual(
		items.map((item) => item.value),
		[
			"technical-reading",
			"opensource-reading",
			"conceptualize",
			"patternize",
			"exercise",
		],
	);
	assert.match(items[0]?.description ?? "", /source-grounded insights/);
	assert.match(items[2]?.label ?? "", /cross-source concept/);
	assert.match(items[3]?.description ?? "", /recurring context/);
});

test("Learning selector uses a descriptive SelectList overlay", async () => {
	let rendered = "";
	let overlayOptions: unknown;
	const ctx = {
		ui: {
			async custom(factory: any, options: unknown) {
				overlayOptions = options;
				let selected: unknown;
				const component = await factory(
					{ requestRender() {} },
					theme,
					{},
					(value: unknown) => {
						selected = value;
					},
				);
				rendered = component.render(78).join("\n");
				component.handleInput("\u001b[B");
				component.handleInput("\r");
				return selected;
			},
		},
	};

	assert.equal(
		await showLearningSkillSelector(ctx as never),
		"opensource-reading",
	);
	assert.match(rendered, /Choose a Learning approach/);
	assert.match(rendered, /Study open-source code/);
	assert.match(rendered, /does not impose a workflow order/);
	assert.deepEqual(overlayOptions, {
		overlay: true,
		overlayOptions: { anchor: "center", width: 78, maxHeight: 12, margin: 1 },
	});
});

test("Learning skill preparation preserves a draft and replaces only its Learning skill command", () => {
	let editor = "Explain how this parser recovers after malformed input.";
	const ctx = {
		ui: {
			getEditorText: () => editor,
			setEditorText(value: string) {
				editor = value;
			},
		},
	};

	prepareLearningSkill(ctx as never, "opensource-reading");
	assert.equal(
		editor,
		"/skill:opensource-reading Explain how this parser recovers after malformed input.",
	);

	prepareLearningSkill(ctx as never, "exercise");
	assert.equal(
		editor,
		"/skill:exercise Explain how this parser recovers after malformed input.",
	);

	prepareLearningSkill(ctx as never, "patternize");
	assert.equal(
		editor,
		"/skill:patternize Explain how this parser recovers after malformed input.",
	);
});

test("Learning skill preparation preserves unrelated slash commands", () => {
	let editor = "/other:command keep this draft";
	const ctx = {
		ui: {
			getEditorText: () => editor,
			setEditorText(value: string) {
				editor = value;
			},
		},
	};

	prepareLearningSkill(ctx as never, "technical-reading");
	assert.equal(
		editor,
		"/skill:technical-reading /other:command keep this draft",
	);
});
