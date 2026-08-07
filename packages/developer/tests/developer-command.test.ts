import assert from "node:assert/strict";
import test from "node:test";

import {
	completeDeveloperArgs,
	parseDeveloperCommand,
} from "../extensions/developer-command.ts";

test("Developer command parser accepts only the canonical action grammar", () => {
	assert.deepEqual(parseDeveloperCommand(""), {
		ok: true,
		command: { kind: "workbench" },
	});
	assert.deepEqual(parseDeveloperCommand(" status "), {
		ok: true,
		command: { kind: "status" },
	});
	for (const action of [
		"settings",
		"pause",
		"wait",
		"block",
		"resume",
		"on",
		"off",
	] as const) {
		assert.deepEqual(parseDeveloperCommand(action), {
			ok: true,
			command: { kind: action },
		});
	}
	for (const invalid of [
		":on",
		"status now",
		"settings extra",
		"develop",
		"history",
		"questions",
	])
		assert.deepEqual(parseDeveloperCommand(invalid), { ok: false });
});

test("Developer argument completion exposes only canonical focused actions", () => {
	assert.equal(completeDeveloperArgs("qu"), null);
	assert.deepEqual(completeDeveloperArgs("s"), [
		{ value: "status", label: "status" },
		{ value: "settings", label: "settings" },
	]);
	assert.deepEqual(completeDeveloperArgs("p"), [
		{ value: "pause", label: "pause" },
	]);
	assert.deepEqual(completeDeveloperArgs("r"), [
		{ value: "resume", label: "resume" },
	]);
	assert.deepEqual(completeDeveloperArgs("w"), [
		{ value: "wait", label: "wait" },
	]);
	assert.deepEqual(completeDeveloperArgs("b"), [
		{ value: "block", label: "block" },
	]);
	assert.equal(completeDeveloperArgs(":"), null);
	assert.equal(completeDeveloperArgs("develop"), null);
});
