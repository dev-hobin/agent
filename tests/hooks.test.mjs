// Model-free proof that the hooks enforce what each IMPLEMENTS.json says they enforce: every
// hook points at a script the plugin ships, a correct result passes, a wrong one is sent back to
// the model (exit 2), and unrelated files are left alone (exit 0). Hooks live in each plugin's
// hooks/hooks.json on both hosts, so they run however a skill was started. Claude hooks get
// `tool_input.file_path`; Codex hooks get an apply_patch command.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";

const plugins = join(repositoryRoot, "claude/plugins");
const codexPlugins = join(repositoryRoot, "codex/plugins");
const workspace = () => mkdtempSync(join(tmpdir(), "claude-hook-"));

function frontmatter(path) {
	return parse(/^---\n([\s\S]*?)\n---\n/.exec(readFileSync(path, "utf8"))[1]);
}

// Run a plugin script as the host runs a hook: JSON on stdin, the plugin root in the environment.
// The project is input.cwd: an inherited CLAUDE_PROJECT_DIR would point the hook elsewhere.
function runHook(plugin, script, input, host = "claude") {
	const root = join(host === "claude" ? plugins : codexPlugins, plugin);
	const { CLAUDE_PROJECT_DIR: _, ...env } = process.env;
	const result = spawnSync("node", [join(root, "scripts", script)], {
		input: JSON.stringify(input), encoding: "utf8", env: { ...env, CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root },
	});
	return { status: result.status, stderr: result.stderr };
}
const claudeWrote = (cwd, file) => ({ hook_event_name: "PostToolUse", tool_name: "Write", cwd, tool_input: { file_path: join(cwd, file) } });
const codexWrote = (cwd, file) => ({ hook_event_name: "PostToolUse", tool_name: "apply_patch", cwd,
	tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } });
const hosts = [["claude", claudeWrote], ["codex", codexWrote]];

test("every Claude plugin hook runs a script the plugin ships, and no skill registers its own", () => {
	let count = 0;
	for (const plugin of readdirSync(plugins)) {
		const skills = join(plugins, plugin, "skills");
		if (existsSync(skills)) for (const skill of readdirSync(skills)) {
			// A skill-frontmatter hook runs only after the skill is invoked, and twice next to the plugin hook.
			assert.equal(frontmatter(join(skills, skill, "SKILL.md")).hooks, undefined, `${plugin}/${skill}: register hooks in hooks/hooks.json`);
		}
		const file = join(plugins, plugin, "hooks/hooks.json");
		if (!existsSync(file)) continue;
		for (const groups of Object.values(JSON.parse(readFileSync(file, "utf8")).hooks)) for (const group of groups) for (const hook of group.hooks) {
			const script = /"\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)"/.exec(hook.command)?.[1];
			assert.ok(script, `${plugin}: hook commands use "\${CLAUDE_PLUGIN_ROOT}/…"`);
			assert.ok(existsSync(join(plugins, plugin, script)), `${plugin}: ${script} is missing`);
			count++;
		}
	}
	// hobin-feature: UserPromptSubmit, PreToolUse (allow its record tools), PostToolUse (edit tools,
	// Skill, its records server), Stop, SessionEnd.
	assert.equal(count, 17);
});

test("every Codex plugin hook runs a script the plugin ships", () => {
	let count = 0;
	for (const plugin of readdirSync(codexPlugins)) {
		const file = join(codexPlugins, plugin, "hooks/hooks.json");
		if (!existsSync(file)) continue;
		// Codex 0.166 loads plugin hooks only from .codex-plugin/plugin.json (see checkCodexPlugin).
		const manifest = JSON.parse(readFileSync(join(codexPlugins, plugin, ".codex-plugin/plugin.json"), "utf8"));
		assert.equal(manifest.hooks, "./hooks/hooks.json", `${plugin}: .codex-plugin/plugin.json hooks`);
		for (const groups of Object.values(JSON.parse(readFileSync(file, "utf8")).hooks)) for (const group of groups) for (const hook of group.hooks) {
			const script = /"\$PLUGIN_ROOT\/([^"]+)"/.exec(hook.command)?.[1];
			assert.ok(script, `${plugin}: hook commands use "$PLUGIN_ROOT/…"`);
			assert.ok(existsSync(join(codexPlugins, plugin, script)), `${plugin}: ${script} is missing`);
			count++;
		}
	}
	// hobin-feature: UserPromptSubmit, PostToolUse, Stop, SessionEnd.
	assert.equal(count, 13);
});

for (const [host, wrote] of hosts) test(`${host} review report hook: a valid report passes, a wrong one goes back to the model`, () => {
	const cwd = workspace();
	mkdirSync(join(cwd, "src"));
	writeFileSync(join(cwd, "src/x.js"), "a\nb\nc\n");
	writeFileSync(join(cwd, "GOOD.md"), "[P1] wrong total — src/x.js:2\n  Scenario: s\n  Evidence: e\n");
	writeFileSync(join(cwd, "BAD.md"), "[P1] wrong total — src/x.js:9\n  Scenario: s\n");
	writeFileSync(join(cwd, "notes.md"), "hello\n");
	assert.equal(runHook("hobin-review", "report-hook.mjs", wrote(cwd, "GOOD.md"), host).status, 0);
	const bad = runHook("hobin-review", "report-hook.mjs", wrote(cwd, "BAD.md"), host);
	assert.equal(bad.status, 2);
	assert.match(bad.stderr, /line 9 does not exist/);
	assert.match(bad.stderr, /Evidence:/);
	assert.equal(runHook("hobin-review", "report-hook.mjs", wrote(cwd, "notes.md"), host).status, 0);
});

for (const [host, wrote] of hosts) test(`${host} learning output-contract hook: a complete result passes, the bare skeleton goes back`, () => {
	const cwd = workspace();
	const contract = JSON.parse(readFileSync(join(repositoryRoot, "core/conceptualize/assets/output-contract.json"), "utf8"));
	const marker = `<!-- output-contract: ${contract.id} -->`;
	const golden = readFileSync(join(repositoryRoot, "core/conceptualize/scenarios/retry-notes/golden/out/concept.md"), "utf8");
	writeFileSync(join(cwd, "concept.md"), `${marker}\n\n${golden}`);
	writeFileSync(join(cwd, "skeleton.md"), `${marker}\n\n${contract.skeleton}`);
	assert.equal(runHook("hobin-learning", "output-contract-hook.mjs", wrote(cwd, "concept.md"), host).status, 0);
	assert.equal(runHook("hobin-learning", "output-contract-hook.mjs", wrote(cwd, "skeleton.md"), host).status, 2);
});

for (const [host, wrote] of hosts) test(`${host} stances hook: the golden proposal passes, an invented stance goes back`, () => {
	const cwd = workspace();
	const golden = readFileSync(join(repositoryRoot, "core/applying-stances/scenarios/agents-md-overlap/golden/PROPOSAL.md"), "utf8");
	writeFileSync(join(cwd, "PROPOSAL.md"), golden);
	writeFileSync(join(cwd, "WRONG.md"), golden.replace("+<!-- /hobin-stances -->", "+- Always use tabs.\n+<!-- /hobin-stances -->"));
	assert.equal(runHook("hobin-stances", "stances-hook.mjs", wrote(cwd, "PROPOSAL.md"), host).status, 0);
	const wrong = runHook("hobin-stances", "stances-hook.mjs", wrote(cwd, "WRONG.md"), host);
	assert.equal(wrong.status, 2);
	assert.match(wrong.stderr, /Not a stance from assets\/stances\.md/);
});

// The hobin-feature hook (ledger attribution, Stop checks, the gate, at most three blocks) is proven
// scenario by scenario in feature-stop-hook.test.mjs.

test("result hooks are the same scripts on both hosts", () => {
	const shared = {
		"hobin-review": ["hook-input.mjs", "report-hook.mjs"],
		"hobin-stances": ["hook-input.mjs", "stances-hook.mjs"],
		"hobin-learning": ["hook-input.mjs", "output-contract-hook.mjs"],
		"hobin-feature": ["scenarios-stop-hook.mjs"],
	};
	for (const [plugin, scripts] of Object.entries(shared)) for (const script of scripts) {
		assert.equal(readFileSync(join(plugins, plugin, "scripts", script), "utf8"), readFileSync(join(codexPlugins, plugin, "scripts", script), "utf8"), `${plugin}/scripts/${script}`);
	}
});

// Which results are the session's (edit tools, shell commands, Stop) is proven scenario by scenario
// in result-hooks-ledger.test.mjs.
