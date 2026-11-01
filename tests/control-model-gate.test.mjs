import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { gateRecord } from "../core/developing-features/scripts/compile-control-model.mjs";

const exec = promisify(execFile);
const scenario = join(repositoryRoot, "core/developing-features/scenarios/job-lookup-cancel");
const compiler = join(repositoryRoot, "core/developing-features/scripts/compile-control-model.mjs");

// The scenario's golden workspace: base with the golden result on top.
function workspace(t) {
	const dir = mkdtempSync(join(tmpdir(), "control-gate-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	cpSync(join(scenario, "base"), dir, { recursive: true });
	cpSync(join(scenario, "golden"), dir, { recursive: true });
	return dir;
}
const recordIn = (dir) => JSON.parse(readFileSync(join(dir, "control-decisions.json"), "utf8"));
const gate = (dir, record = recordIn(dir)) => gateRecord(record, { recordDir: dir, root: dir });

test("the golden record passes the gate", (t) => {
	assert.deepEqual(gate(workspace(t)), []);
});

test("evidence must resolve and name what it points at: the file, the line, and the symbol on it", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.facts[0].evidence = "src/lookup.js:26";
	record.facts[1].evidence = "src/lookup.js:999";
	record.facts[2].evidence = "src/missing.js:1";
	delete record.facts[3].symbol;
	const outside = record.facts.findIndex((f) => f.answer === "outside");
	record.facts[outside].evidence = "src/lookup.js:26";
	const problems = gate(dir, record);
	assert.ok(problems.includes('facts[0]: "busy" is not on src/lookup.js line 26; cite the lines where it appears'));
	assert.ok(problems.some((p) => p.startsWith("facts[1]: src/lookup.js has") && p.endsWith("line 999 does not exist")));
	assert.ok(problems.includes("facts[2]: src/missing.js does not exist"));
	assert.ok(problems.includes('facts[3]: name the code it points at in "symbol" (an identifier or a literal on the cited lines)'));
	assert.ok(problems.includes(`facts[${outside}]: "not cancelled" is not on src/lookup.js line 26; cite the lines where it appears`));
});

test("a symbol matches a whole token, not part of a longer name", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.facts[0].symbol = "bus";
	assert.ok(gate(dir, record).includes('facts[0]: "bus" is not on src/lookup.js line 7; cite the lines where it appears'));
});

test("every rule cites code that mentions the variables it reads and writes", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.events.DEADLINE.rules[0].evidence = "src/lookup.js:33";
	delete record.events.RECHECK.rules[0].evidence;
	record.events.COMPLETED.evidence = "src/lookup.js:34";
	const problems = gate(dir, record);
	assert.ok(problems.some((p) => p.startsWith("events.DEADLINE.rules[0]: reads or writes jobKnown, but src/lookup.js line 33 mentions none of")));
	assert.ok(problems.includes('events.RECHECK.rules[0]: cite the code it copies in "evidence"'));
	assert.ok(problems.some((p) => p.startsWith("events.COMPLETED.arrives: reads or writes busy")));
});

test("state written on a cited line must be some fact, so a rule cannot hide it", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.facts = record.facts.filter((f) => f.symbol !== "result");
	assert.ok(gate(dir, record).some((p) => p.startsWith("events.RESET.rules[0]: src/lookup.js line") && p.endsWith("writes result, which no fact covers; add it as a variable or an excluded fact")));
});

test("an input names the conditions it stands for, each with resolving evidence", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.inputs = { offered: "bool" };
	record.facts.push({ code: "canSubmit()", evidence: "src/lookup.js:14", symbol: "canSubmit", answer: "input", as: "offered" });
	assert.ok(gate(dir, record).includes('facts[18]: an input lists the conditions it stands for in "from", each with evidence and symbol'));
	record.facts[18].from = [{ code: "nothing runs", evidence: "src/lookup.js:15", symbol: "busy" }];
	assert.ok(!gate(dir, record).some((p) => p.startsWith("facts[18]")));
});

test("every computed finding is acknowledged, and no stale acknowledgement remains", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.findings = [{ id: "dead-end:busy=0,jobKnown=0,recovering=0,review=withoutId", note: "stale" }];
	const problems = gate(dir, record);
	assert.ok(problems.some((p) => p.startsWith("finding same-events:COMPLETED|FAILED is not acknowledged")));
	assert.ok(problems.includes("finding dead-end:busy=0,jobKnown=0,recovering=0,review=withoutId is in the record but no longer occurs; remove it"));
});

test("a record whose invariant the rules break fails the gate", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.events.CANCEL.rules[0].then = { busy: "false", review: '"none"' };
	assert.ok(gate(dir, record).some((p) => p.startsWith("invariants.I3: CANCEL from")));
});

test("the command passes without a record unless --require, and on the golden record", async (t) => {
	const empty = mkdtempSync(join(tmpdir(), "control-gate-empty-"));
	t.after(() => rmSync(empty, { recursive: true, force: true }));
	await exec(process.execPath, [compiler, "--gate"], { cwd: empty });
	await assert.rejects(exec(process.execPath, [compiler, "--gate", "--require"], { cwd: empty }), (error) => error.code === 1);
	const dir = workspace(t);
	await exec(process.execPath, [compiler, "--gate", "--require"], { cwd: dir });
	writeFileSync(join(dir, "control-decisions.json"), JSON.stringify({ ...recordIn(dir), findings: [] }));
	await assert.rejects(exec(process.execPath, [compiler, "--gate"], { cwd: dir }), (error) => error.code === 1);
});
