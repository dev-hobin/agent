import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { initialState } from "../extensions/machine.ts";
import { PROTOCOL } from "../extensions/state.ts";
import {
	FixtureSettingsBinding,
	createQaQuestions,
	createQaScenarios,
	createRichQaState,
} from "./fixtures/tui-visual.ts";

test("the visual fixture commits activation through the production reducer contract", () => {
	const binding = new FixtureSettingsBinding(createRichQaState());

	const disabled = binding.commitActivation(false);
	assert.deepEqual(disabled, initialState());
	assert.deepEqual(binding.events, [
		{ protocol: PROTOCOL, kind: "activation", enabled: false },
	]);

	const enabled = binding.commitActivation(true);
	assert.equal(enabled.enabled, true);
	assert.equal(enabled.activeRoute, undefined);
	assert.deepEqual(enabled.pendingQuestions, []);
	assert.deepEqual(binding.events, [
		{ protocol: PROTOCOL, kind: "activation", enabled: false },
		{ protocol: PROTOCOL, kind: "activation", enabled: true },
	]);
});

test("every fixture model factory returns independent state and question graphs", () => {
	const first = createRichQaState();
	const second = createRichQaState();
	const firstQuestions = createQaQuestions();
	const secondQuestions = createQaQuestions();

	assert.notStrictEqual(first, second);
	assert.notStrictEqual(first.pendingQuestions, second.pendingQuestions);
	assert.notStrictEqual(first.pendingQuestions[0], second.pendingQuestions[0]);
	assert.notStrictEqual(firstQuestions, secondQuestions);
	assert.notStrictEqual(firstQuestions[0], secondQuestions[0]);

	new FixtureSettingsBinding(first).commitActivation(false);
	assert.equal(second.enabled, true);
	assert.ok(second.activeRoute);
	assert.equal(second.pendingQuestions.length, 7);
});

test("Ghostty QA scenarios are finite, unique, and ordered by the documented workflow", () => {
	const scenarios = createQaScenarios();
	const ids = scenarios.map((scenario) => scenario.id);

	assert.deepEqual(ids, [
		"activation",
		"navigation",
		"answer-ime",
		"resize-scroll",
		"unicode-footprint",
	]);
	assert.equal(new Set(ids).size, ids.length);
	assert.ok(
		scenarios.every(
			(scenario) =>
				scenario.label.length > 0 && scenario.description.length > 0,
		),
	);
});

test("the visual fixture has no persistence, tool, session, or model side effects", async () => {
	const source = await readFile(
		new URL("./fixtures/tui-visual.ts", import.meta.url),
		"utf8",
	);
	for (const forbiddenCall of [
		"appendEntry(",
		"sendUserMessage(",
		"registerTool(",
		"setActiveTools(",
		"pi.on(",
	]) {
		assert.equal(
			source.includes(forbiddenCall),
			false,
			`fixture must not call ${forbiddenCall}`,
		);
	}
	assert.match(source, /applyDeveloperEvent\(this\.state, event\)/);
});
