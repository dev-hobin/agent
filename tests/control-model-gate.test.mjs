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

test("evidence must resolve: the file, the line, and the quote on that line", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.facts[0].quote = "this.busy = true; // invented";
	record.facts[1].evidence = "src/lookup.js:999";
	record.facts[2].evidence = "src/missing.js:1";
	delete record.facts[3].quote;
	const problems = gate(dir, record);
	assert.ok(problems.some((p) => p.startsWith("facts[0]: the quote is not in src/lookup.js line")));
	assert.ok(problems.some((p) => p.startsWith("facts[1]: src/lookup.js has") && p.endsWith("line 999 does not exist")));
	assert.ok(problems.includes("facts[2]: src/missing.js does not exist"));
	assert.ok(problems.includes('facts[3]: quote the cited code in "quote"'));
});

test("an input names the conditions it stands for, each with resolving evidence", (t) => {
	const dir = workspace(t);
	const record = recordIn(dir);
	record.inputs = { offered: "bool" };
	record.facts.push({ code: "canSubmit()", evidence: "src/lookup.js:14", quote: "canSubmit() {", answer: "input", as: "offered" });
	assert.ok(gate(dir, record).includes('facts[18]: an input lists the conditions it stands for in "from", each with evidence and quote'));
	record.facts[18].from = [{ code: "nothing runs", evidence: "src/lookup.js:15", quote: "return !this.busy && !this.recovering && this.review === null;" }];
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
