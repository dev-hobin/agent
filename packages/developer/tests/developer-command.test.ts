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
	for (const action of ["questions", "settings", "on", "off"] as const) {
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
	])
		assert.deepEqual(parseDeveloperCommand(invalid), { ok: false });
});

test("Developer argument completion exposes only canonical focused actions", () => {
	assert.deepEqual(completeDeveloperArgs("qu"), [
		{ value: "questions", label: "questions" },
	]);
	assert.deepEqual(completeDeveloperArgs("s"), [
		{ value: "status", label: "status" },
		{ value: "settings", label: "settings" },
	]);
	assert.equal(completeDeveloperArgs(":"), null);
	assert.equal(completeDeveloperArgs("develop"), null);
});
