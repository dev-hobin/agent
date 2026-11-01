import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { canonicalize, checkModel } from "../core/developing-features/scripts/check-control-model.mjs";
import { compileDecisions } from "../core/developing-features/scripts/compile-control-model.mjs";

const fixtures = join(repositoryRoot, "tests/fixtures/control-model");
const load = async (name) => JSON.parse(await readFile(join(fixtures, name), "utf8"));
const decisions = async () => structuredClone(await load("external-job-lookup.decisions.json"));
const compiled = async (record) => {
	const { errors, model } = compileDecisions(record ?? (await decisions()));
	assert.deepEqual(errors, []);
	return model;
};

test("the decision record compiles to the same behavior as the hand-written model", async () => {
	const model = await compiled();
	const canonical = JSON.stringify(canonicalize(model));
	assert.equal(canonical, JSON.stringify(canonicalize(await load("external-job-lookup.json"))));
});

test("the compiled model passes the checker's own checks and keeps the dead ends as findings", async () => {
	const { errors, findings } = checkModel(await compiled());
	assert.deepEqual(errors, []);
	assert.deepEqual(findings.map((f) => f.id).filter((id) => id.includes("dead-end:")), [
		"dead-end:busy=0,failure=reviewNoId,recovering=0,result=0",
		"embedded:dead-end:busy=0,failure=none,recovering=0,result=1",
		"embedded:dead-end:busy=0,failure=reviewNoId,recovering=0,result=0",
	]);
});

test("compiling is deterministic and ignores the order the record is written in", async () => {
	const record = await decisions();
	const reversed = {
		...record,
		facts: [...record.facts].reverse(),
		variables: Object.fromEntries(Object.entries(record.variables).reverse()),
		events: Object.fromEntries(Object.entries(record.events).reverse()),
	};
	assert.deepEqual(await compiled(reversed), await compiled(record));
});

test("every code fact needs evidence and a closed answer, and every declaration rests on a fact", async () => {
	const record = await decisions();
	delete record.facts[0].evidence;
	record.facts[1].answer = "maybe";
	record.facts = record.facts.filter((f) => f.as !== "RECHECK_ERROR");
	record.facts.push({ code: "progress text", evidence: "LookupPanel.tsx:300", answer: "excluded", reason: "cosmetic" });
	const { errors } = compileDecisions(record);
	assert.ok(errors.includes("facts[0]: needs the code it names and file:line evidence"));
	assert.ok(errors.some((e) => e.startsWith("facts[1]: answer must be one of")));
	assert.ok(errors.includes('events.RECHECK_ERROR: no code fact is answered "event" with as: "RECHECK_ERROR"'));
	assert.ok(errors.some((e) => e.endsWith("reason must be one of display, derived, owned, unbounded, server")));
});

test("rules must cover every reachable combination exactly once and stay inside the variables' values", async () => {
	const overlap = await decisions();
	overlap.events.RECHECK.rules[1].when = "true";
	assert.ok(compileDecisions(overlap).errors.some((e) => e === "events.RECHECK in busy=0,failure=review,recovering=0,result=0: more than one rule holds"));
	const gap = await decisions();
	gap.events.RECHECK.rules[1].when = "busy";
	assert.ok(compileDecisions(gap).errors.some((e) => e.endsWith("no rule holds")));
	const outOfRange = await decisions();
	outOfRange.events.DEADLINE.rules[0].then.failure = '"lost"';
	assert.ok(compileDecisions(outOfRange).errors.some((e) => e.includes('sets failure to "lost"')));
	const refused = await decisions();
	refused.events.DEADLINE.rules[0] = { refuse: "guarantee" };
	assert.ok(compileDecisions(refused).errors.includes("events.DEADLINE.rules[0]: only a control can be refused"));
});

test("inputs another owner keeps become declared guards on the events whose rules read them", () => {
	const { errors, model } = compileDecisions({
		facts: [
			{ code: "running", evidence: "a.ts:1", answer: "variable", as: "running" },
			{ code: "ready prop", evidence: "a.ts:2", answer: "input", as: "ready" },
			{ code: "start()", evidence: "a.ts:3", answer: "event", as: "START" },
			{ code: "done", evidence: "a.ts:4", answer: "event", as: "DONE" },
		],
		variables: { running: "bool" },
		inputs: { ready: "bool" },
		initial: { running: false },
		events: {
			START: { source: "control", rules: [{ when: "!running && ready", then: { running: "true" } }, { when: "running || !ready", refuse: "guarantee" }] },
			DONE: { source: "response", arrives: "running", rules: [{ then: { running: "false" } }] },
		},
	});
	assert.deepEqual(errors, []);
	assert.deepEqual(model.guards, { START: { "ready=0": "!ready", "ready=1": "ready" } });
	assert.deepEqual(model.cells["running=0"].START, [
		{ guard: "ready=0", forbid: "guarantee" },
		{ guard: "ready=1", to: "running=1" },
	]);
	assert.deepEqual(model.cells["running=1"].START, { forbid: "guarantee" });
	assert.deepEqual(checkModel(model).errors, []);
});

test("the shipped decision template compiles to a model the checker accepts", async () => {
	const record = JSON.parse(await readFile(join(repositoryRoot, "core/developing-features/assets/control-decisions.json"), "utf8"));
	const { errors, warnings } = checkModel(await compiled(record));
	assert.deepEqual(errors, []);
	assert.deepEqual(warnings, []);
});
