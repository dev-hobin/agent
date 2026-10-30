// Model-free checks of the Claude implementations' eval suites, so that `claude plugin eval`
// only spends money on well-formed cases. Core scenarios themselves are proven by check.mjs.
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
