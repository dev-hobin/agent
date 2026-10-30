#!/usr/bin/env node
// Structure layer for the commit-message eval set. Model-free; run from the repository
// root on every change to the skill or to these evals: node evals/commit-message/check-structure.mjs
// Proves each case's checks reject the untouched workspace and accept the reference.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const words = (text) => text.split(/\s+/).filter(Boolean).length;

// The skill under test is well-formed.
const skill = readFileSync(join(root, "skills/commit-message/SKILL.md"), "utf8");
const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? "";
assert.match(front, /^name: commit-message$/m, "skill name");
assert.match(front, /Use\s+when/, "description says when to use it");
assert.match(front, /Not\s+for/, "description says what it is not for");

function check(workspace, c) {
	const [kind, value] = Object.entries(c).find(([key]) => key !== "id");
	if (kind === "file_exists") return existsSync(join(workspace, value));
	const path = join(workspace, value.path);
	if (!existsSync(path)) return false;
	const found = new RegExp(value.pattern, value.flags ?? "").test(readFileSync(path, "utf8"));
	if (kind === "file_matches") return found;
	if (kind === "file_lacks") return !found;
	throw new Error(`unknown check kind ${kind}`);
}

// Every regression case is complete, its workspace builds, and its checks are proven.
const cases = readdirSync(join(here, "cases")).sort();
assert.ok(cases.length >= 2, "at least two regression cases");
for (const id of cases) {
	const dir = join(here, "cases", id);
	const spec = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
	assert.equal(spec.id, id, `${id}: id matches directory`);
	assert.ok(spec.request && spec.checks?.length, `${id}: request and checks`);
	for (const c of spec.checks) if (c.file_matches || c.file_lacks) new RegExp((c.file_matches ?? c.file_lacks).pattern);
	const workspace = mkdtempSync(join(tmpdir(), `eval-${id}-`));
	try {
		execFileSync("sh", [join(dir, spec.setup)], { cwd: workspace, stdio: "pipe" });
		const staged = execFileSync("git", ["diff", "--staged", "--name-only"], { cwd: workspace, encoding: "utf8" });
		assert.ok(staged.trim(), `${id}: setup stages a change`);
		assert.ok(spec.checks.some((c) => !check(workspace, c)), `${id}: the untouched workspace must fail`);
		cpSync(join(dir, spec.reference), workspace, { recursive: true });
		const failing = spec.checks.filter((c) => !check(workspace, c)).map((c) => c.id);
		assert.deepEqual(failing, [], `${id}: the reference must pass`);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

// The trigger set has 10 queries that should select the skill and 10 near misses.
const triggers = JSON.parse(readFileSync(join(here, "triggers.json"), "utf8"));
assert.equal(new Set(triggers.queries.map((q) => q.id)).size, triggers.queries.length, "unique trigger ids");
assert.equal(triggers.queries.filter((q) => q.should_trigger === true).length, 10, "10 should trigger");
assert.equal(triggers.queries.filter((q) => q.should_trigger === false).length, 10, "10 near misses");

// The control is about as long as the skill, so a gain is not just more context.
const ratio = words(readFileSync(join(here, "benchmark/control.md"), "utf8")) / words(skill);
assert.ok(ratio > 0.8 && ratio < 1.2, `control length ratio ${ratio.toFixed(2)} is within 20%`);
const plan = JSON.parse(readFileSync(join(here, "benchmark/plan.json"), "utf8"));
assert.deepEqual(plan.tasks.filter((t) => !cases.includes(t)), [], "benchmark tasks are regression cases");

console.log(`structure ok: ${cases.length} cases, ${triggers.queries.length} trigger queries, control ratio ${ratio.toFixed(2)}`);
