// Model-free proof that the hooks enforce what each IMPLEMENTS.json says they enforce: every
// hook points at a script the plugin ships, a correct result passes, a wrong one is sent back to
// the model (exit 2), and unrelated files are left alone (exit 0). Claude hooks live in skill
// frontmatter and get `tool_input.file_path`; Codex hooks live in the plugin's hooks/hooks.json
// and get an apply_patch command.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
function runHook(plugin, script, input, host = "claude") {
	const root = join(host === "claude" ? plugins : codexPlugins, plugin);
	const result = spawnSync("node", [join(root, "scripts", script)], {
		input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root },
	});
	return { status: result.status, stderr: result.stderr };
}
const claudeWrote = (cwd, file) => ({ hook_event_name: "PostToolUse", tool_name: "Write", cwd, tool_input: { file_path: join(cwd, file) } });
const codexWrote = (cwd, file) => ({ hook_event_name: "PostToolUse", tool_name: "apply_patch", cwd,
	tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } });
const hosts = [["claude", claudeWrote], ["codex", codexWrote]];

test("every skill hook command runs a script the plugin ships", () => {
	let count = 0;
	for (const plugin of readdirSync(plugins)) {
		const skills = join(plugins, plugin, "skills");
		if (!existsSync(skills)) continue;
		for (const skill of readdirSync(skills)) {
			const hooks = frontmatter(join(skills, skill, "SKILL.md")).hooks ?? {};
			for (const groups of Object.values(hooks)) for (const group of groups) for (const hook of group.hooks) {
				const script = /"\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)"/.exec(hook.command)?.[1];
				assert.ok(script, `${plugin}/${skill}: hook commands use "\${CLAUDE_PLUGIN_ROOT}/…" (CLAUDE_SKILL_DIR is not set for hooks)`);
				assert.ok(existsSync(join(plugins, plugin, script)), `${plugin}/${skill}: ${script} is missing`);
				count++;
			}
		}
	}
	assert.ok(count >= 8);
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
	assert.equal(count, 7);
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

test("claude feature Stop hook: blocks while the record is incomplete, at most three times in a row", () => {
	const done = workspace();
	cpSync(join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json"), join(done, "acceptance-scenarios.json"));
	const stop = (cwd, session) => runHook("hobin-feature", "scenarios-stop-hook.mjs", { hook_event_name: "Stop", cwd, session_id: session });
	assert.equal(stop(done, `done-${process.pid}`).status, 0);

	const open = workspace();
	cpSync(join(repositoryRoot, "core/developing-features/assets/acceptance-scenarios.json"), join(open, "acceptance-scenarios.json"));
	const session = `open-${process.pid}-${Date.now()}`;
	const first = stop(open, session);
	assert.equal(first.status, 2);
	assert.match(first.stderr, /scenarios\.mjs check/);
	assert.equal(stop(open, session).status, 2);
	assert.equal(stop(open, session).status, 2);
	assert.equal(stop(open, session).status, 0, "the fourth stop is let through");

	const empty = workspace();
	assert.equal(stop(empty, `empty-${process.pid}-${Date.now()}`).status, 2, "no record at all is incomplete");
});

test("codex feature Stop hook: acts only on a record written in this session, then blocks at most three times", async () => {
	const open = workspace();
	const older = join(workspace(), "older.jsonl");
	writeFileSync(older, "");
	await new Promise((r) => setTimeout(r, 20));
	cpSync(join(repositoryRoot, "core/developing-features/assets/acceptance-scenarios.json"), join(open, "acceptance-scenarios.json"));
	await new Promise((r) => setTimeout(r, 20));
	const newer = join(workspace(), "newer.jsonl");
	writeFileSync(newer, "");
	const stop = (cwd, session, path) => runHook("hobin-feature", "scenarios-stop-hook.mjs", { hook_event_name: "Stop", cwd, session_id: session, transcript_path: path }, "codex");

	assert.equal(stop(open, `old-${process.pid}-${Date.now()}`, newer).status, 0, "a record from before the session is not this session's");
	const session = `new-${process.pid}-${Date.now()}`;
	assert.equal(stop(open, session, older).status, 2);
	assert.equal(stop(open, session, older).status, 2);
	assert.equal(stop(open, session, older).status, 2);
	assert.equal(stop(open, session, older).status, 0, "the fourth stop is let through");

	const done = workspace();
	cpSync(join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json"), join(done, "acceptance-scenarios.json"));
	assert.equal(stop(done, `done-${process.pid}-${Date.now()}`, older).status, 0);
	assert.equal(stop(workspace(), `none-${process.pid}-${Date.now()}`, older).status, 0, "a session without a record is left alone");
});

test("result hooks are the same scripts on both hosts", () => {
	const shared = {
		"hobin-review": ["hook-input.mjs", "report-hook.mjs"],
		"hobin-stances": ["hook-input.mjs", "stances-hook.mjs"],
		"hobin-learning": ["hook-input.mjs", "output-contract-hook.mjs"],
	};
	for (const [plugin, scripts] of Object.entries(shared)) for (const script of scripts) {
		assert.equal(readFileSync(join(plugins, plugin, "scripts", script), "utf8"), readFileSync(join(codexPlugins, plugin, "scripts", script), "utf8"), `${plugin}/scripts/${script}`);
	}
});

// Stop checks every result changed in the session, however it was written (here: plain file
// writes, as a shell command would do), and ignores files from before the session.
for (const host of ["claude", "codex"]) test(`${host} result Stop hooks catch results written by a shell command`, async () => {
	const cwd = workspace();
	mkdirSync(join(cwd, "src"));
	writeFileSync(join(cwd, "src/x.js"), "a\nb\nc\n");
	writeFileSync(join(cwd, "OLD.md"), "[P1] stale — src/x.js:99\n");
	await new Promise((r) => setTimeout(r, 20));
	const transcript = join(workspace(), "transcript.jsonl");
	writeFileSync(transcript, "");
	await new Promise((r) => setTimeout(r, 20));
	const stop = (plugin, script, session) => runHook(plugin, script, { hook_event_name: "Stop", cwd, session_id: session, transcript_path: transcript }, host);
	const session = `${host}-${process.pid}-${Date.now()}`;

	assert.equal(stop("hobin-review", "report-hook.mjs", `${session}-a`).status, 0, "a report from before the session is not checked");
	writeFileSync(join(cwd, "REVIEW.md"), "[P1] wrong total — src/x.js:99\n");
	const first = stop("hobin-review", "report-hook.mjs", `${session}-b`);
	assert.equal(first.status, 2);
	assert.match(first.stderr, /line 99 does not exist/);
	assert.equal(stop("hobin-review", "report-hook.mjs", `${session}-b`).status, 2);
	assert.equal(stop("hobin-review", "report-hook.mjs", `${session}-b`).status, 2);
	assert.equal(stop("hobin-review", "report-hook.mjs", `${session}-b`).status, 0, "the fourth stop is let through");
	writeFileSync(join(cwd, "REVIEW.md"), "[P1] wrong total — src/x.js:2\n  Scenario: s\n  Evidence: e\n");
	assert.equal(stop("hobin-review", "report-hook.mjs", `${session}-c`).status, 0);

	const contract = JSON.parse(readFileSync(join(repositoryRoot, "core/conceptualize/assets/output-contract.json"), "utf8"));
	writeFileSync(join(cwd, "concept.md"), `<!-- output-contract: ${contract.id} -->\n\n${contract.skeleton}`);
	assert.equal(stop("hobin-learning", "output-contract-hook.mjs", `${session}-d`).status, 2);

	const golden = readFileSync(join(repositoryRoot, "core/applying-stances/scenarios/agents-md-overlap/golden/PROPOSAL.md"), "utf8");
	writeFileSync(join(cwd, "PROPOSAL.md"), golden.replace("+<!-- /hobin-stances -->", "+- Always use tabs.\n+<!-- /hobin-stances -->"));
	assert.equal(stop("hobin-stances", "stances-hook.mjs", `${session}-e`).status, 2);
	assert.equal(stop("hobin-stances", "stances-hook.mjs", `${session}-f`).status, 2);

	const noTranscript = runHook("hobin-review", "report-hook.mjs", { hook_event_name: "Stop", cwd, session_id: `${session}-g` }, host);
	assert.equal(noTranscript.status, 0, "without a session start nothing is checked");
});
