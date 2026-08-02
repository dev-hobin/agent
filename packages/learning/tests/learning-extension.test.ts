import assert from "node:assert/strict";
import test from "node:test";

import learning from "../extensions/learning.ts";

test("Learning registers only its self-contained chooser command", () => {
	let command: any;
	let toolCount = 0;
	learning({
		registerCommand(name: string, definition: unknown) {
			assert.equal(name, "learning");
			command = definition;
		},
		registerTool() {
			toolCount += 1;
		},
	} as never);

	assert.equal(toolCount, 0);
	assert.match(command.description, /independent Learning approach/);
	assert.deepEqual(command.getArgumentCompletions("pat"), [
		{ value: "patternize", label: "patternize" },
	]);
});

test("Learning command reports bounded usage for an unknown skill name", async () => {
	let command: any;
	const notifications: Array<{ message: string; level: string }> = [];
	learning({
		registerCommand(_name: string, definition: unknown) {
			command = definition;
		},
	} as never);

	await command.handler("validate", {
		mode: "tui",
		ui: {
			notify(message: string, level: string) {
				notifications.push({ message, level });
			},
		},
	});

	assert.deepEqual(notifications, [
		{
			message:
				"Usage: /learning technical-reading | opensource-reading | conceptualize | patternize | exercise",
			level: "warning",
		},
	]);
});

test("Learning command prepares a selected skill in the editor", async () => {
	let command: any;
	let editor = "Compare these three cases.";
	const notifications: Array<{ message: string; level: string }> = [];
	learning({
		registerCommand(_name: string, definition: unknown) {
			command = definition;
		},
	} as never);

	await command.handler("conceptualize", {
		mode: "tui",
		ui: {
			getEditorText: () => editor,
			setEditorText(value: string) {
				editor = value;
			},
			notify(message: string, level: string) {
				notifications.push({ message, level });
			},
		},
	});

	assert.equal(editor, "/skill:conceptualize Compare these three cases.");
	assert.deepEqual(notifications, [
		{ message: "conceptualize prepared in the editor.", level: "info" },
	]);
});
