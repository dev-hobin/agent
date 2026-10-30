#!/usr/bin/env node
// Skill eval runner for Claude Code. Node 22+ built-ins only.
// Dry run by default: it prints the run matrix. Model calls happen only with --execute.
//
//   node run-evals.mjs triggers --evals <dir> --plugin-dir <plugin> [options]
//   node run-evals.mjs outcomes --evals <dir> --plugin-dir <plugin> [options]
//
// Options: --models haiku,sonnet,opus  --runs 3  --conditions skill,none,control
//          --task <id>  --grader-model sonnet  --max-budget-usd 2  --out <dir>  --execute
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: opts, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		evals: { type: "string" }, "plugin-dir": { type: "string" }, task: { type: "string" },
		models: { type: "string", default: "haiku,sonnet,opus" }, runs: { type: "string" },
		conditions: { type: "string" }, "grader-model": { type: "string", default: "sonnet" },
		"max-budget-usd": { type: "string", default: "2" }, out: { type: "string" },
		execute: { type: "boolean", default: false },
	},
});
const mode = positionals[0];
if (!["triggers", "outcomes"].includes(mode) || !opts.evals || !opts["plugin-dir"]) {
	console.error("Usage: run-evals.mjs <triggers|outcomes> --evals <dir> --plugin-dir <plugin> [--execute]");
	process.exit(2);
}
const evalsDir = resolve(opts.evals);
const pluginDir = resolve(opts["plugin-dir"]);
const models = opts.models.split(",");
const runs = Number(opts.runs ?? 3);
const conditions = (opts.conditions ?? (mode === "triggers" ? "skill" : "skill,none,control")).split(",");
const out = resolve(opts.out ?? join(evalsDir, "results", new Date().toISOString().replace(/[:.]/g, "-")));
const pluginName = JSON.parse(readFileSync(join(pluginDir, "plugin.json"), "utf8")).name;

function load(name) {
	const data = JSON.parse(readFileSync(join(evalsDir, name), "utf8"));
	assert.ok(data.skill && data.plugin === pluginName, `${name}: plugin must be ${pluginName}`);
	return data;
}

// The control keeps each Skill's name, description, and length but replaces its method
// with generic advice, so any gain over it comes from content rather than prompt length.
const CONTROL = "Work carefully and methodically. Read the relevant files before changing them. "
	+ "Keep changes focused on the request, explain your reasoning briefly, and check your work. ";
function controlPlugin() {
	const dir = mkdtempSync(join(tmpdir(), "skill-eval-control-"));
	cpSync(pluginDir, dir, { recursive: true });
	for (const name of readdirSync(join(dir, "skills"))) {
		const skill = join(dir, "skills", name);
		const source = readFileSync(join(skill, "SKILL.md"), "utf8");
		const [, front, body] = source.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
		for (const extra of readdirSync(skill)) if (extra !== "SKILL.md") rmSync(join(skill, extra), { recursive: true });
		writeFileSync(join(skill, "SKILL.md"), front + "\n" + CONTROL.repeat(Math.ceil(body.length / CONTROL.length)).slice(0, body.length) + "\n");
	}
	return dir;
}

function workspace(task) {
	const dir = mkdtempSync(join(tmpdir(), "skill-eval-ws-"));
	const git = (...args) => execFileSync("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.invalid", ...args], { cwd: dir, stdio: "pipe" });
	if (task) cpSync(join(evalsDir, task.fixture, "workspace"), dir, { recursive: true });
	git("init", "-q", "-b", "main");
	git("add", "-A");
	git("commit", "-q", "--allow-empty", "-m", "base");
	const patch = task && join(evalsDir, task.fixture, "change.patch");
	if (patch && existsSync(patch)) {
		git("switch", "-q", "-c", "feature");
		git("apply", patch);
		git("add", "-A");
		git("commit", "-q", "-m", "change");
	}
	return dir;
}

function claude(prompt, cwd, model, plugins, extraArgs = []) {
	const args = ["-p", prompt, "--model", model, "--output-format", "stream-json", "--verbose",
		"--setting-sources", "project", "--max-budget-usd", opts["max-budget-usd"], ...extraArgs];
	for (const plugin of plugins) args.push("--plugin-dir", plugin);
	const started = Date.now();
	const child = spawnSync("claude", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60_000 });
	const events = child.stdout.split("\n").filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
	const init = events.find((e) => e.type === "system" && e.subtype === "init") ?? {};
	const result = events.findLast((e) => e.type === "result") ?? {};
	return { events, init, result, ms: Date.now() - started, stderr: child.stderr?.slice(-4000) };
}

// Abort rather than report numbers from a contaminated environment.
function assertIsolated(init, expected) {
	if (!Array.isArray(init.plugins)) return "init event did not list plugins; isolation unverified";
	const names = init.plugins.map((p) => p.name ?? p);
	const unexpected = names.filter((name) => !expected.includes(name));
	assert.deepEqual(unexpected, [], `Unexpected plugins loaded: ${unexpected.join(", ")}. Disable user plugins or use a clean config.`);
	return null;
}

function usedSkill(events, skill) {
	return events.some((e) => e.type === "assistant" && (e.message?.content ?? []).some((c) => c.type === "tool_use"
		&& ((c.name === "Skill" && String(c.input?.skill ?? "").split(":").pop() === skill)
			|| (c.name === "Read" && String(c.input?.file_path ?? "").includes(`/skills/${skill}/SKILL.md`)))));
}

function grade(task, ws, answer) {
	const checks = (task.checks ?? []).map((check) => {
		const hidden = join(evalsDir, task.fixture, "hidden");
		if (existsSync(hidden)) cpSync(hidden, join(ws, "hidden"), { recursive: true });
		const run = spawnSync("sh", ["-c", check.command], { cwd: ws, encoding: "utf8", timeout: 10 * 60_000 });
		return { id: check.id, passed: run.status === 0, output: (run.stdout + run.stderr).slice(-3000) };
	});
	const diff = spawnSync("sh", ["-c", "git add -A -- . ':!hidden' && git diff --cached HEAD"], { cwd: ws, encoding: "utf8" }).stdout;
	const prompt = `Grade an AI agent's work. For each assertion decide passed true/false using only the evidence below; when evidence is missing, it fails.
Return only JSON: {"results":[{"id":"...","passed":true,"evidence":"short quote or reason"}]}

ASSERTIONS:
${task.assertions.map((a) => `- ${a.id}: ${a.text}`).join("\n")}

FINAL ANSWER:
${answer.slice(0, 40_000)}

WORKSPACE DIFF:
${diff.slice(0, 60_000)}`;
	const graded = claude(prompt, ws, opts["grader-model"], [], ["--tools", ""]);
	let assertions;
	try { assertions = JSON.parse(String(graded.result.result).match(/\{[\s\S]*\}/)[0]).results; }
	catch { assertions = task.assertions.map((a) => ({ id: a.id, passed: false, evidence: "grader output unparseable" })); }
	return { checks, assertions, graderCost: graded.result.total_cost_usd ?? 0 };
}

const matrix = [];
if (mode === "triggers") {
	const { skill, queries } = load("triggers.json");
	for (const q of queries) for (const model of models) for (let n = 1; n <= runs; n++) matrix.push({ skill, q, model, n, condition: "skill" });
} else {
	const { skill, tasks } = load("evals.json");
	for (const task of tasks.filter((t) => !opts.task || t.id === opts.task))
		for (const condition of conditions) for (const model of models) for (let n = 1; n <= runs; n++) matrix.push({ skill, task, condition, model, n });
}
console.log(`${mode}: ${matrix.length} runs (${models.join("/")} × ${runs} runs${mode === "outcomes" ? ` × ${conditions.join("/")}` : ""}), budget cap $${opts["max-budget-usd"]} per run`);
if (!opts.execute) {
	console.log("Dry run. Add --execute to call models.");
	process.exit(0);
}

mkdirSync(out, { recursive: true });
const control = conditions.includes("control") ? controlPlugin() : null;
const records = [];
for (const item of matrix) {
	const ws = workspace(item.task);
	const plugins = { skill: [pluginDir], control: control ? [control] : [], none: [] }[item.condition];
	const prompt = item.q ? item.q.query : item.condition === "none" ? item.task.prompt : `/${pluginName}:${item.skill} ${item.task.prompt}`;
	const tools = item.q ? [] : ["--permission-mode", "acceptEdits", "--allowedTools", "Bash(node *)", "Bash(npm *)", "Bash(git *)", "Read", "Edit", "Write", "Grep", "Glob", "Agent", "Skill"];
	const run = claude(prompt, ws, item.model, plugins, tools);
	const warning = assertIsolated(run.init, item.condition === "none" ? [] : [pluginName]);
	const record = { mode, skill: item.skill, id: item.q?.id ?? item.task.id, condition: item.condition, model: item.model, run: item.n,
		cost: run.result.total_cost_usd ?? 0, ms: run.ms, usage: run.result.usage ?? null, warning, triggered: usedSkill(run.events, item.skill) };
	if (item.q) record.expected = item.q.should_trigger;
	else Object.assign(record, grade(item.task, ws, String(run.result.result ?? "")));
	const dir = join(out, record.id, item.condition, item.model, `run-${item.n}`);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "transcript.jsonl"), run.events.map((e) => JSON.stringify(e)).join("\n"));
	writeFileSync(join(dir, "record.json"), JSON.stringify(record, null, 2));
	records.push(record);
	rmSync(ws, { recursive: true, force: true });
	console.log(`${record.id} ${record.condition} ${record.model} #${record.run}: ${mode === "triggers" ? `triggered=${record.triggered}` : `${record.assertions.filter((a) => a.passed).length}/${record.assertions.length} assertions, ${record.checks.filter((c) => c.passed).length}/${record.checks.length} checks`}`);
}

// Summaries: trigger rate per query (threshold 0.5); outcome pass rates per condition and model.
const summary = {};
for (const r of records) {
	const key = mode === "triggers" ? `${r.id}|${r.model}` : `${r.condition}|${r.model}`;
	const s = (summary[key] ??= { runs: 0, cost: 0, ms: 0, triggered: 0, expected: r.expected, assertions: [0, 0], checks: [0, 0] });
	s.runs++; s.cost += r.cost; s.ms += r.ms; s.triggered += r.triggered ? 1 : 0;
	if (r.assertions) { s.assertions[0] += r.assertions.filter((a) => a.passed).length; s.assertions[1] += r.assertions.length; }
	if (r.checks) { s.checks[0] += r.checks.filter((c) => c.passed).length; s.checks[1] += r.checks.length; }
}
if (mode === "triggers") for (const s of Object.values(summary)) s.correct = (s.triggered / s.runs >= 0.5) === s.expected;
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
if (control) rmSync(control, { recursive: true, force: true });
console.log(`Results: ${out}`);
