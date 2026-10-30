// Model-free checks of the evaluation suites, so that `claude plugin eval` and the hidden-test
// benchmark only ever spend money on well-formed cases with working graders and fixtures.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, constants, cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { buildTriggerCases } from "../scripts/build-trigger-cases.mjs";
import { packageNames, repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { syncSources, targets } from "../scripts/sync-sources.mjs";

const exec = promisify(execFile);
// Child test runs must not inherit this runner's test context, or node --test reports to it.
const { NODE_TEST_CONTEXT: _, ...childEnv } = process.env;
const benchmark = join(repositoryRoot, "packages/skill-eval/skills/evaluating-skills/scripts/benchmark.mjs");

// Field and option names from the Claude Code "Test plugins with evals" reference.
const promptFields = new Set(["schema_version", "name", "description", "tags", "plugins", "runs", "expected_outcome",
	"model", "max_turns", "timeout_seconds", "allowed_tools", "append_system_prompt", "env"]);
const graderOptions = {
	regex: ["pattern", "flags", "match", "target"], tool_used: ["tool", "input_match", "min", "max"],
	tool_order: ["before", "after"], file_exists: ["path", "exists"], llm: ["criteria", "focus"], baseline: ["baseline_file", "criteria"],
};
const deterministic = new Set(["regex", "tool_used", "tool_order", "file_exists"]);

function frontmatter(source, path) {
	const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	assert.ok(match, `${path}: missing frontmatter`);
	return { data: parse(match[1]) ?? {}, body: match[2] };
}

async function cases() {
	const found = [];
	async function walk(dir, pkg) {
		const entries = await readdir(dir, { withFileTypes: true });
		if (entries.some((e) => e.name === "prompt.md" || e.name === "case.yaml")) return void found.push({ dir, pkg });
		for (const e of entries) if (e.isDirectory() && e.name !== "results") await walk(join(dir, e.name), pkg);
	}
	for (const pkg of packageNames) {
		const root = join(repositoryRoot, "packages", pkg, "evals");
		if (await stat(root).catch(() => null)) await walk(root, pkg);
	}
	for (const plugin of await readdir(join(repositoryRoot, "dist/claude"))) {
		const root = join(repositoryRoot, "dist/claude", plugin, "evals");
		if (await stat(root).catch(() => null)) await walk(root, plugin);
	}
	return found;
}

async function skillsOf(pkg) {
	return readdir(join(repositoryRoot, "packages", pkg, "skills"));
}

async function temporaryDirectory(t) {
	const directory = await mkdtemp(join(tmpdir(), "agent-evals-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return directory;
}

test("every eval case uses only documented fields and deterministic graders", async () => {
	const all = await cases();
	assert.ok(all.length >= 100, "trigger and regression cases are present");
	for (const { dir } of all) {
		const prompt = frontmatter(await readFile(join(dir, "prompt.md"), "utf8"), dir);
		for (const key of Object.keys(prompt.data)) assert.ok(promptFields.has(key), `${dir}: unknown prompt.md field ${key}`);
		assert.ok(prompt.body.trim(), `${dir}: empty prompt`);
		const tags = prompt.data.tags ?? [];
		if (dir.includes("/dist/claude/")) assert.ok(tags.includes("regression"), `${dir}: generated contract case`);
		assert.ok(tags.includes("trigger") || tags.includes("regression"), `${dir}: tag trigger or regression`);
		const graders = (await readdir(join(dir, "graders"))).filter((file) => file.endsWith(".md"));
		assert.ok(graders.length > 0, `${dir}: at least one grader`);
		for (const file of graders) {
			const { data } = frontmatter(await readFile(join(dir, "graders", file), "utf8"), `${dir}/${file}`);
			assert.ok(deterministic.has(data.type), `${dir}/${file}: regression and trigger graders must be deterministic, got ${data.type}`);
			for (const key of Object.keys(data)) {
				assert.ok(["type", "weight", "arm", ...graderOptions[data.type]].includes(key), `${dir}/${file}: unknown option ${key}`);
			}
			if (data.type === "regex") new RegExp(data.pattern, data.flags ?? "");
			if (data.input_match) new RegExp(data.input_match);
		}
	}
});

test("scaffolded cases declare a working scaffold script", async (t) => {
	for (const { dir } of await cases()) {
		const yamlPath = join(dir, "case.yaml");
		if (!(await stat(yamlPath).catch(() => null))) continue;
		const data = parse(await readFile(yamlPath, "utf8"));
		assert.equal(data.schema_version, "1.1", `${dir}: schema_version`);
		assert.equal(data.name, dir.split("/").pop(), `${dir}: name matches directory`);
		const script = join(dir, data.context.scaffold_script);
		await access(script, constants.X_OK);
		const workspace = await temporaryDirectory(t);
		await exec("bash", [script], { cwd: workspace });
		assert.ok((await readdir(workspace)).length > 0, `${dir}: scaffold produced files`);
	}
});

test("trigger cases are generated from balanced 20-query sources without drift", async () => {
	await buildTriggerCases({ check: true });
	for (const pkg of packageNames) {
		const dir = join(repositoryRoot, "packages", pkg, "evals", "triggers");
		if (!(await stat(dir).catch(() => null))) continue;
		for (const file of (await readdir(dir)).filter((name) => name.endsWith(".json"))) {
			const { skill, queries } = JSON.parse(await readFile(join(dir, file), "utf8"));
			assert.ok((await skillsOf(pkg)).includes(skill), `${pkg}/${file}: ${skill} is not shipped by this package`);
			assert.equal(queries.length, 20);
			assert.equal(new Set(queries.map((q) => q.id)).size, 20);
			const positives = queries.filter((q) => q.should_trigger).length;
			assert.ok(positives >= 8 && 20 - positives >= 8, `${file}: balanced positives and near misses`);
		}
	}
});

test("benchmark hidden checks fail on the workspace and pass on the reference", async (t) => {
	for (const pkg of packageNames) {
		const root = join(repositoryRoot, "packages", pkg, "benchmarks");
		if (!(await stat(root).catch(() => null))) continue;
		for (const id of (await readdir(root)).filter((name) => name !== "results")) {
			const task = JSON.parse(await readFile(join(root, id, "task.json"), "utf8"));
			assert.equal(task.id, id);
			assert.ok((await skillsOf(pkg)).includes(task.skill), `${id}: ${task.skill} is not shipped by ${pkg}`);
			const hidden = task.checks.find((check) => check.command.includes("hidden"));
			assert.ok(hidden, `${id}: a hidden check`);
			const before = await temporaryDirectory(t);
			await cp(join(root, id, "workspace"), before, { recursive: true });
			await cp(join(root, id, "hidden"), join(before, "hidden"), { recursive: true });
			await assert.rejects(exec("sh", ["-c", hidden.command], { cwd: before, env: childEnv }),
				`${id}: hidden check must fail on the untouched workspace`);
			const after = await temporaryDirectory(t);
			await cp(join(root, id, "workspace"), after, { recursive: true });
			await cp(join(root, id, "reference"), after, { recursive: true });
			await cp(join(root, id, "hidden"), join(after, "hidden"), { recursive: true });
			for (const check of task.checks) {
				await exec("sh", ["-c", check.command], { cwd: after, env: childEnv });
			}
		}
	}
});

test("the benchmark runner is a dry run unless --execute is given", async (t) => {
	const out = join(await temporaryDirectory(t), "results");
	const { stdout } = await exec("node", [benchmark, join(repositoryRoot, "packages/feature"), "--out", out]);
	assert.match(stdout, /Dry run/);
	await assert.rejects(stat(out), { code: "ENOENT" });
});

test("shared lens copies cannot drift from their source", async (t) => {
	await syncSources({ check: true });
	const root = await temporaryDirectory(t);
	await cp(join(repositoryRoot, "sources"), join(root, "sources"), { recursive: true });
	for (const { destination } of targets) await cp(join(repositoryRoot, destination), join(root, destination), { recursive: true });
	const [name] = (await readdir(join(root, "sources/lenses"))).filter((file) => file.endsWith(".md"));
	await (await import("node:fs/promises")).writeFile(join(root, targets[0].destination, name), "edited copy\n");
	await assert.rejects(syncSources({ check: true, root }), /Shared source drift/);
});

test("core contract expectations accept the golden result and reject wrong ones", async (t) => {
	const { checkCase } = await import("../scripts/contract-check.mjs");
	const contracts = join(repositoryRoot, "core/review/contract");
	for (const id of await readdir(contracts)) {
		const caseFile = join(contracts, id, "case.yaml");
		const untouched = await temporaryDirectory(t);
		await cp(join(contracts, id, "workspace"), untouched, { recursive: true });
		assert.ok(checkCase(caseFile, untouched).some((r) => !r.passed), `${id}: untouched workspace must fail`);
		const golden = await temporaryDirectory(t);
		await cp(join(contracts, id, "workspace"), golden, { recursive: true });
		await cp(join(contracts, id, "golden"), golden, { recursive: true });
		const results = checkCase(caseFile, golden);
		assert.deepEqual(results.filter((r) => !r.passed).map((r) => r.id), [], `${id}: golden result must pass`);
		const spec = parse(await readFile(caseFile, "utf8"));
		for (const e of spec.expect.filter((x) => x.file_lacks)) {
			const wrong = await temporaryDirectory(t);
			await cp(golden, wrong, { recursive: true });
			const flagged = e.file_lacks.pattern.replace(/\\\[P\[01\]\\\]\[\^\\n\]\*/, "");
			await (await import("node:fs/promises")).appendFile(join(wrong, e.file_lacks.path), `[P1] ${flagged.replace(/[\\()|]/g, " ")} is wrong — src/x.js:1\n`);
			assert.equal(checkCase(caseFile, wrong).find((r) => r.id === e.id).passed, false, `${id}: ${e.id} must reject a flagged non-defect`);
		}
		await (await import("node:fs/promises")).writeFile(join(golden, "package.json"), "{}\n");
		assert.equal(checkCase(caseFile, golden).find((r) => r.id === "no-other-changes").passed, false, `${id}: edits to other files must fail`);
	}
});
