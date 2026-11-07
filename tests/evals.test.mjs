// Model-free checks of the hosts' eval suites, so that `claude plugin eval` and Codex
// `plugin-eval` only spend money on well-formed cases. Core scenarios are proven by check.mjs.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, constants, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";

const exec = promisify(execFile);
// Field and option names from the Claude Code "Test plugins with evals" reference.
const promptFields = new Set(["schema_version", "name", "description", "tags", "plugins", "runs", "expected_outcome",
	"model", "max_turns", "timeout_seconds", "allowed_tools", "append_system_prompt", "env"]);
const graderOptions = {
	regex: ["pattern", "flags", "match", "target"], tool_used: ["tool", "input_match", "min", "max"],
	tool_order: ["before", "after"], file_exists: ["path", "exists"],
};

function frontmatter(source, path) {
	const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	assert.ok(match, `${path}: missing frontmatter`);
	return { data: parse(match[1]) ?? {}, body: match[2] };
}

async function cases() {
	const found = [];
	async function walk(dir) {
		const entries = await readdir(dir, { withFileTypes: true });
		if (entries.some((e) => e.name === "prompt.md")) return void found.push(dir);
		for (const e of entries) if (e.isDirectory() && !["results", "base", "hidden"].includes(e.name)) await walk(join(dir, e.name));
	}
	for (const plugin of await readdir(join(repositoryRoot, "claude/plugins"))) {
		const root = join(repositoryRoot, "claude/plugins", plugin, "evals");
		if (await stat(root).catch(() => null)) await walk(root);
	}
	return found;
}

test("every Claude eval case uses documented fields and deterministic graders only", async () => {
	const all = await cases();
	assert.ok(all.length > 0);
	for (const dir of all) {
		const prompt = frontmatter(await readFile(join(dir, "prompt.md"), "utf8"), dir);
		for (const key of Object.keys(prompt.data)) assert.ok(promptFields.has(key), `${dir}: unknown prompt.md field ${key}`);
		assert.ok(prompt.body.trim(), `${dir}: empty prompt`);
		const graders = (await readdir(join(dir, "graders"))).filter((file) => file.endsWith(".md"));
		assert.ok(graders.length > 0, `${dir}: at least one grader`);
		for (const file of graders) {
			const { data } = frontmatter(await readFile(join(dir, "graders", file), "utf8"), `${dir}/${file}`);
			assert.ok(data.type in graderOptions, `${dir}/${file}: graders must be deterministic, got ${data.type}`);
			for (const key of Object.keys(data)) assert.ok(["type", "weight", "arm", ...graderOptions[data.type]].includes(key), `${dir}/${file}: unknown option ${key}`);
			if (data.type === "regex") new RegExp(data.pattern, data.flags ?? "");
			if (data.input_match) new RegExp(data.input_match);
		}
	}
});

test("scaffolded Claude eval cases build their workspace", async (t) => {
	for (const dir of await cases()) {
		const yamlPath = join(dir, "case.yaml");
		if (!(await stat(yamlPath).catch(() => null))) continue;
		const data = parse(await readFile(yamlPath, "utf8"));
		assert.equal(data.schema_version, "1.1", `${dir}: schema_version`);
		if (!data.context?.scaffold_script) continue;
		const script = join(dir, data.context.scaffold_script);
		await access(script, constants.X_OK);
		const workspace = await mkdtemp(join(tmpdir(), "claude-eval-"));
		t.after(() => rm(workspace, { recursive: true, force: true }));
		await exec("bash", [script], { cwd: workspace });
		assert.ok((await readdir(workspace)).length > 0, `${dir}: scaffold produced files`);
	}
});

// What plugin-eval's normalizeConfig requires of a benchmark config, and the paths its
// "workspace-plugin-marketplace" provisioning adds to the workspace (openai/plugins
// plugins/plugin-eval src/core/benchmark.js and benchmark-workspace.js at 0722921).
const pluginEvalSchemaVersion = 2;
const provisionedPaths = ["plugins/", ".agents/plugins/"];

test("every Codex benchmark config is one plugin-eval accepts and verifies outside provisioned paths", async () => {
	const root = join(repositoryRoot, "codex/evals");
	const configs = [];
	for (const plugin of await readdir(root, { withFileTypes: true })) {
		if (!plugin.isDirectory()) continue;
		for (const scenario of await readdir(join(root, plugin.name))) configs.push([plugin.name, scenario]);
	}
	assert.ok(configs.length > 0);
	for (const [plugin, scenario] of configs) {
		const where = `codex/evals/${plugin}/${scenario}/benchmark.json`;
		const config = JSON.parse(await readFile(join(repositoryRoot, where), "utf8"));
		assert.equal(config.kind, "plugin-eval-benchmark", where);
		assert.equal(config.schemaVersion, pluginEvalSchemaVersion, `${where}: schemaVersion`);
		assert.equal(config.targetName, plugin, where);
		assert.equal(config.runner?.type, "codex-cli", where);
		assert.equal(config.workspace?.sourcePath, `codex/evals/${plugin}/${scenario}/workspace`, where);
		assert.equal(config.targetProvisioning?.mode, "workspace-plugin-marketplace", where);
		assert.ok(config.scenarios?.length > 0 && config.scenarios.every((s) => s.userInput?.trim()), `${where}: scenarios with userInput`);
		assert.ok(config.verifiers?.commands?.length > 0, `${where}: a verifier command`);
		for (const command of config.verifiers.commands) {
			for (const path of provisionedPaths) assert.ok(command.includes(`--ignore ${path}`), `${where}: verifier must ignore ${path}`);
			await exec("sh", ["-n", "-c", command]).catch((error) => assert.fail(`${where}: verifier is not valid shell: ${error.stderr}`));
			const scenario = /\$HOBIN_AGENT_ROOT\/(core\/[^"]+\/scenario\.yaml)/.exec(command)?.[1];
			assert.ok(scenario, `${where}: verifier names a core scenario`);
			await access(join(repositoryRoot, scenario), constants.R_OK);
		}
	}
});

// Code-based scenario checks reach Claude's graders through the eval verify plugin.
const codeKinds = ["command_passes", "script_passes", "output_contract"];
const verifyTemplate = join(repositoryRoot, "claude/eval-support/verify");

async function tree(dir, base = dir) {
	const out = {};
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) Object.assign(out, await tree(path, base));
		else out[path.slice(base.length)] = await readFile(path, "utf8");
	}
	return out;
}

test("every Claude regression case loads the verify plugin and grades each code-based check", async () => {
	const template = await tree(verifyTemplate);
	const regression = [];
	for (const dir of await cases()) {
		const prompt = frontmatter(await readFile(join(dir, "prompt.md"), "utf8"), dir).data;
		if (!(prompt.tags ?? []).includes("regression")) continue;
		regression.push(dir);
		assert.deepEqual(prompt.plugins, ["../..", "verify"], `${dir}: plugins`);
		assert.deepEqual(await tree(join(dir, "verify")), template, `${dir}: verify/ must match claude/eval-support/verify`);
		const scenario = prompt.env?.EVAL_SCENARIO;
		assert.ok(scenario, `${dir}: env.EVAL_SCENARIO`);
		const checks = parse(await readFile(join(repositoryRoot, scenario), "utf8")).expect;
		for (const check of checks.filter((c) => codeKinds.some((k) => k in c))) {
			const { data } = frontmatter(await readFile(join(dir, "graders", `${check.id}.md`), "utf8"), `${dir}/${check.id}`);
			assert.equal(data.target?.path, "SCENARIO_CHECK.txt", `${dir}/${check.id}`);
			assert.equal(data.pattern, `^pass ${check.id}$`, `${dir}/${check.id}`);
		}
	}
	assert.ok(regression.length >= 13);
});

// A host case grades the checks its core scenario has: a grader or checklist entry for a check
// the scenario no longer has would keep grading a removed standard.
test("every host eval case names only checks its core scenario has", async () => {
	const checkIds = async (scenario) => parse(await readFile(join(repositoryRoot, scenario), "utf8")).expect
		.flatMap((c) => ("unchanged" in c || "unchanged_except" in c ? [c.id, `${c.id}-write`, `${c.id}-edit`] : [c.id]));
	for (const dir of await cases()) {
		const scenario = frontmatter(await readFile(join(dir, "prompt.md"), "utf8"), dir).data.env?.EVAL_SCENARIO;
		if (!scenario) continue;
		const ids = await checkIds(scenario);
		for (const file of (await readdir(join(dir, "graders"))).filter((f) => f.endsWith(".md"))) {
			assert.ok(ids.includes(file.slice(0, -3)), `${dir}/graders/${file}: ${scenario} has no check ${file.slice(0, -3)}; remove the grader`);
		}
	}
	const root = join(repositoryRoot, "codex/evals");
	for (const plugin of await readdir(root, { withFileTypes: true })) {
		if (!plugin.isDirectory()) continue;
		for (const name of await readdir(join(root, plugin.name))) {
			const where = `codex/evals/${plugin.name}/${name}/benchmark.json`;
			const config = JSON.parse(await readFile(join(repositoryRoot, where), "utf8"));
			const scenario = /\$HOBIN_AGENT_ROOT\/(core\/[^"]+\/scenario\.yaml)/.exec(config.verifiers.commands[0])?.[1];
			const ids = await checkIds(scenario);
			for (const id of config.scenarios.flatMap((s) => s.successChecklist ?? [])) {
				assert.ok(ids.includes(id), `${where}: ${scenario} has no check ${id}; remove it from successChecklist`);
			}
		}
	}
});
