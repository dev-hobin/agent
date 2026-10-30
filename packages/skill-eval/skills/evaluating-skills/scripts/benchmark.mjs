#!/usr/bin/env node
// Hidden-test benchmark for a Skill, SWE-bench style. Node 22+ built-ins only.
// `claude plugin eval` cannot run a command after a run, so outcomes that need hidden tests
// are measured here: the agent works in a copy of workspace/, then hidden/ is copied in and
// each check command runs; its exit code is the verdict. No model grades anything.
// Dry run by default; model calls happen only with --execute.
//
//   node benchmark.mjs <plugin-root> [--task <id>] [--models sonnet,opus] [--runs 3]
//        [--conditions skill,none,control] [--max-budget-usd 3] [--out <dir>] [--execute]
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: opts, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		task: { type: "string" }, models: { type: "string", default: "sonnet" }, runs: { type: "string", default: "3" },
		conditions: { type: "string", default: "skill,none,control" }, "max-budget-usd": { type: "string", default: "3" },
		out: { type: "string" }, execute: { type: "boolean", default: false },
	},
});
assert.equal(positionals.length, 1, "Usage: benchmark.mjs <plugin-root> [--execute]");
const pluginDir = resolve(positionals[0]);
const pluginName = JSON.parse(readFileSync(join(pluginDir, "plugin.json"), "utf8")).name;
const tasksDir = join(pluginDir, "benchmarks");
const tasks = readdirSync(tasksDir).filter((id) => !opts.task || id === opts.task)
	.map((id) => ({ dir: join(tasksDir, id), ...JSON.parse(readFileSync(join(tasksDir, id, "task.json"), "utf8")) }));
const models = opts.models.split(","), conditions = opts.conditions.split(","), runs = Number(opts.runs);
const out = resolve(opts.out ?? join(tasksDir, "results", new Date().toISOString().replace(/[:.]/g, "-")));

const matrix = tasks.flatMap((task) => conditions.flatMap((condition) => models.flatMap((model) =>
	Array.from({ length: runs }, (_, i) => ({ task, condition, model, n: i + 1 })))));
console.log(`${matrix.length} runs: ${tasks.length} tasks × ${conditions.join("/")} × ${models.join("/")} × ${runs}; budget cap $${opts["max-budget-usd"]} per run`);
if (!opts.execute) {
	console.log("Dry run. Add --execute to call models.");
	process.exit(0);
}

// The control keeps each Skill's name, description, and length but replaces its method with
// generic advice, so a gain over it comes from content rather than from prompt length.
const CONTROL = "Work carefully and methodically. Read the relevant files before changing them. "
	+ "Keep changes focused on the request, explain your reasoning briefly, and check your work. ";
function controlPlugin() {
	const dir = mkdtempSync(join(tmpdir(), "bench-control-"));
	cpSync(pluginDir, dir, { recursive: true });
	for (const name of readdirSync(join(dir, "skills"))) {
		const skill = join(dir, "skills", name);
		const [, front, body] = readFileSync(join(skill, "SKILL.md"), "utf8").match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
		for (const extra of readdirSync(skill)) if (extra !== "SKILL.md") rmSync(join(skill, extra), { recursive: true });
		writeFileSync(join(skill, "SKILL.md"), front + "\n" + CONTROL.repeat(Math.ceil(body.length / CONTROL.length)).slice(0, body.length) + "\n");
	}
	return dir;
}

function run(item, plugins) {
	const ws = mkdtempSync(join(tmpdir(), "bench-ws-"));
	cpSync(join(item.task.dir, "workspace"), ws, { recursive: true });
	const prompt = `Use the ${item.task.skill} skill for this.\n\n${item.task.prompt}`;
	const args = ["-p", prompt, "--model", item.model, "--output-format", "stream-json", "--verbose", "--no-session-persistence",
		"--setting-sources", "project", "--max-budget-usd", opts["max-budget-usd"], "--permission-mode", "acceptEdits",
		"--allowedTools", "Bash(node *)", "Bash(npm *)", "Bash(ls *)", "Bash(cat *)", "Read", "Edit", "Write", "Grep", "Glob", "Agent", "Skill"];
	for (const plugin of plugins) args.push("--plugin-dir", plugin);
	const started = Date.now();
	const child = spawnSync("claude", args, { cwd: ws, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60_000 });
	const events = child.stdout.split("\n").filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
	const init = events.find((e) => e.type === "system" && e.subtype === "init") ?? {};
	const loaded = (init.plugins ?? []).filter((p) => p.path !== "builtin").map((p) => p.name);
	assert.deepEqual(loaded, plugins.length ? [pluginName] : [], `Unexpected plugins loaded: ${loaded.join(", ")}`);
	const result = events.findLast((e) => e.type === "result") ?? {};
	cpSync(join(item.task.dir, "hidden"), join(ws, "hidden"), { recursive: true });
	const checks = item.task.checks.map((check) => {
		const r = spawnSync("sh", ["-c", check.command], { cwd: ws, encoding: "utf8", timeout: 10 * 60_000 });
		return { id: check.id, passed: r.status === 0, output: (r.stdout + r.stderr).slice(-3000) };
	});
	const skillFired = events.some((e) => e.type === "assistant" && (e.message?.content ?? []).some((c) =>
		c.type === "tool_use" && c.name === "Skill" && String(c.input?.skill ?? "").split(":").pop() === item.task.skill));
	rmSync(ws, { recursive: true, force: true });
	return { task: item.task.id, condition: item.condition, model: item.model, run: item.n, skillFired, checks,
		cost: result.total_cost_usd ?? 0, ms: Date.now() - started, events };
}

mkdirSync(out, { recursive: true });
const control = conditions.includes("control") ? controlPlugin() : null;
const records = [];
for (const item of matrix) {
	const r = run(item, { skill: [pluginDir], control: control ? [control] : [], none: [] }[item.condition]);
	const dir = join(out, r.task, r.condition, r.model, `run-${r.run}`);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "transcript.jsonl"), r.events.map((e) => JSON.stringify(e)).join("\n"));
	delete r.events;
	writeFileSync(join(dir, "record.json"), JSON.stringify(r, null, 2));
	records.push(r);
	console.log(`${r.task} ${r.condition} ${r.model} #${r.run}: ${r.checks.filter((c) => c.passed).length}/${r.checks.length} checks, skill fired: ${r.skillFired}, $${r.cost.toFixed(2)}`);
}
if (control) rmSync(control, { recursive: true, force: true });

const summary = {};
for (const r of records) {
	const s = (summary[`${r.task}|${r.condition}|${r.model}`] ??= { runs: 0, allChecksPassed: 0, cost: 0 });
	s.runs++; s.cost += r.cost; s.allChecksPassed += r.checks.every((c) => c.passed) ? 1 : 0;
}
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.table(Object.fromEntries(Object.entries(summary).map(([k, s]) => [k, { pass: `${s.allChecksPassed}/${s.runs}`, cost: s.cost.toFixed(2) }])));
console.log(`Results: ${out}`);
