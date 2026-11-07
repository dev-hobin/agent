// The hobin-feature hook gates the records in the session registry,
// <start dir>/.hobin-feature/sessions/<session_id>.jsonl. The hook creates it at SessionStart (or
// UserPromptSubmit when missing) and remembers the start directory; scenarios.mjs init, register,
// run and decline find it from their working directory upward, with the agent session id the host
// gives shell commands (CLAUDE_CODE_SESSION_ID, CODEX_SESSION_ID), and append the record's absolute
// path, or stop when there is none; edit tools register the record files they write. Stop gates
// exactly the registry's records and, once the session started developing-features, asks for one.
// Nothing searches directories or reads shell text, command output or transcripts. Each test is
// named after the acceptance scenario it checks
// (docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json) and runs on both hosts' inputs.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { tempRoot } from "./temp-root.mjs";

const temp = tempRoot(import.meta.url);
const HOSTS = ["claude", "codex"];
const SESSION_VAR = { claude: "CLAUDE_CODE_SESSION_ID", codex: "CODEX_SESSION_ID" };
const pluginRoot = (host) => join(repositoryRoot, host === "claude" ? "claude/plugins" : "codex/plugins", "hobin-feature");
const coreScripts = join(repositoryRoot, "core/developing-features/scripts");
const pluginScripts = (host) => join(pluginRoot(host), "skills/developing-features/scripts");
const TEMPLATE = join(repositoryRoot, "core/developing-features/assets/acceptance-scenarios.json");
const COMPLETE = join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json");
const CONTROL = join(repositoryRoot, "core/developing-features/scenarios/job-lookup-cancel");
const NO_REGISTRY = /^No hobin-feature registry for this agent session above (\S+)\. Run scenarios\.mjs from the directory the session started in and pass the record's absolute path\. If the hobin-feature hooks are not active in this session \(Codex: trust them in \/hooks; evaluations that do not install the plugin\), pass --no-gate: nothing will stop the session for this record\.$/m;

// Real paths: a command's cwd is resolved through links (/var is /private/var on macOS).
const workspace = () => temp.dir("feature-hook");
// A git work tree (only .git is needed for its top level to be found).
const repository = () => { const dir = workspace(); mkdirSync(join(dir, ".git")); return dir; };
// The hook's state lives in the host's plugin data directory; each test file gets its own.
const DATA = workspace();
const stateDir = join(DATA, "hobin-feature-sessions");
let counter = 0;
const newSession = (tag) => `${tag}-${process.pid}-${Date.now()}-${counter++}`;
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const registryOf = (start, id) => join(start, ".hobin-feature/sessions", `${id}.jsonl`);
const lines = (path) => readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
function put(dir, file, source) {
	mkdirSync(join(dir, file, ".."), { recursive: true });
	if (typeof source === "string" && existsSync(source)) cpSync(source, join(dir, file));
	else writeFileSync(join(dir, file), typeof source === "string" ? source : JSON.stringify(source));
	return join(dir, file);
}

// The environment without this test run's own agent session (the suite may run inside one).
function cleanEnv(extra = {}) {
	const env = { ...process.env };
	for (const name of ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "PLUGIN_DATA", "NODE_TEST_CONTEXT", ...Object.values(SESSION_VAR)]) delete env[name];
	return { ...env, ...extra };
}

// A record script run by a person (no agent session id).
const script = (name, args, cwd) => spawnSync("node", [join(coreScripts, name), ...args], { cwd, encoding: "utf8", env: cleanEnv() });

// One session as the host drives it, started in `start` (SessionStart unless `started: false`):
// hook calls get JSON on stdin with the plugin root and data directory in the environment, the host
// named on the command line as hooks.json does; shell commands get the host's session variable.
// TMPDIR changes on every hook call.
function session(host, start, { tag = "s", started = true, hookEnv = {} } = {}) {
	const id = newSession(`${host}-${tag}`);
	const root = pluginRoot(host);
	const data = host === "claude" ? { CLAUDE_PLUGIN_DATA: DATA } : { PLUGIN_DATA: DATA, CLAUDE_PLUGIN_DATA: DATA };
	const run = (input) => {
		const result = spawnSync("node", [join(root, "scripts/scenarios-stop-hook.mjs"), host], {
			input: JSON.stringify({ session_id: id, cwd: start, ...input }),
			encoding: "utf8", env: cleanEnv({ CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root, ...data, TMPDIR: workspace(), ...hookEnv }),
		});
		return { status: result.status, stderr: result.stderr, stdout: result.stdout };
	};
	// scenarios.mjs (the installed plugin's copy) run in this session's shell, from `cwd`.
	const scenariosIn = (cwd, ...args) => spawnSync("node", [join(pluginScripts(host), "scenarios.mjs"), ...args], { cwd, encoding: "utf8", env: cleanEnv({ [SESSION_VAR[host]]: id }) });
	if (started) run({ hook_event_name: "SessionStart", source: "startup" });
	return {
		id, run, scenariosIn,
		registry: registryOf(start, id),
		scenarios: (...args) => scenariosIn(start, ...args),
		stop: (extra = {}) => run({ hook_event_name: "Stop", ...extra }),
		end: () => run({ hook_event_name: "SessionEnd", reason: "exit" }),
		prompt: (prompt, extra = {}) => run({ hook_event_name: "UserPromptSubmit", prompt, ...extra }),
		skill: (skill) => run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill } }),
		// A shell command reported to the hook (Codex hooks every tool there).
		shellPost: (text) => run({ hook_event_name: "PostToolUse", tool_name: host === "claude" ? "Bash" : "shell",
			tool_input: { command: host === "claude" ? text : ["bash", "-lc", text] } }),
		// A shell command run in this session, then reported to the hook with its output.
		command: (text) => {
			const result = spawnSync("bash", ["-c", text], { cwd: start, encoding: "utf8", env: cleanEnv({ [SESSION_VAR[host]]: id }) });
			run(host === "claude"
				? { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: text }, tool_response: { stdout: result.stdout, stderr: result.stderr, interrupted: false } }
				: { hook_event_name: "PostToolUse", tool_name: "shell", tool_input: { command: ["bash", "-lc", text] }, tool_response: JSON.stringify({ output: `${result.stdout}${result.stderr}` }) });
			return result;
		},
		edit: (tool, tool_input, extra = {}) => run({ hook_event_name: "PostToolUse", tool_name: tool, tool_input, ...extra }),
		patch: (text, extra = {}) => run({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: text }, ...extra }),
		// The host's way of starting developing-features in this session.
		start: () => host === "claude"
			? run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill: "hobin-feature:developing-features" } })
			: run({ hook_event_name: "UserPromptSubmit", prompt: "$developing-features add quiet hours" }),
	};
}

function controlProject(dir, { gatePasses = true, plans = "" } = {}) {
	cpSync(join(CONTROL, "base"), dir, { recursive: true });
	cpSync(join(CONTROL, "golden"), dir, { recursive: true });
	const record = json(join(dir, "control-decisions.json"));
	const baseline = readFileSync(join(dir, "control-baseline.json"), "utf8");
	if (plans) {
		rmSync(join(dir, "control-decisions.json"));
		rmSync(join(dir, "control-baseline.json"));
		mkdirSync(join(dir, plans), { recursive: true });
		writeFileSync(join(dir, plans, "control-baseline.json"), baseline);
	}
	writeFileSync(join(dir, plans, "control-decisions.json"), JSON.stringify(gatePasses ? record : { ...record, findings: [] }));
	return join(dir, plans, "control-decisions.json");
}

test("F2 scripts: a directory link to an ancestor ends the walk and each record is found once", () => {
	const cwd = workspace();
	controlProject(cwd);
	mkdirSync(join(cwd, "nested"));
	symlinkSync("..", join(cwd, "nested/up"));
	symlinkSync(join(cwd, "missing/target"), join(cwd, "dangling"));
	const check = script("scenarios.mjs", ["check"], cwd);
	assert.equal(check.status, 0, check.stderr);
	assert.equal(check.stdout.match(/acceptance-scenarios\.json/g)?.length, 1, check.stdout);
	const gate = script("compile-control-model.mjs", ["--gate"], cwd);
	assert.equal(gate.status, 0, gate.stderr);
	assert.equal(gate.stdout.match(/control-decisions\.json/g)?.length, 1, gate.stdout);
});

test("F3 scripts: an unreadable directory is skipped and the records elsewhere are found", { skip: process.getuid?.() === 0 && "root reads every directory" }, (t) => {
	const cwd = workspace();
	put(cwd, "plans/acceptance-scenarios.json", COMPLETE);
	mkdirSync(join(cwd, "locked/inner"), { recursive: true });
	chmodSync(join(cwd, "locked"), 0o000);
	t.after(() => chmodSync(join(cwd, "locked"), 0o755));
	const check = script("scenarios.mjs", ["check"], cwd);
	assert.equal(check.status, 0, check.stderr);
	assert.match(check.stdout, /plans\/acceptance-scenarios\.json: every scenario/);
	assert.doesNotMatch(check.stderr, /EACCES/);
});

test("F4 scripts: check without a path finds a record inside a dot directory", () => {
	const cwd = workspace();
	put(cwd, ".plans/feature/acceptance-scenarios.json", TEMPLATE);
	const check = script("scenarios.mjs", ["check"], cwd);
	assert.equal(check.status, 1);
	assert.match(check.stderr, /\.plans\/feature\/acceptance-scenarios\.json: Scenario S1/);
});

for (const host of HOSTS) test(`F5 ${host}: another session's registry never gates this session`, () => {
	const cwd = repository();
	const mine = session(host, cwd, { tag: "mine" });
	const other = session(host, cwd, { tag: "other" });
	assert.equal(other.scenarios("init", join(cwd, "docs/acceptance-scenarios.json")).status, 0);
	const result = mine.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	assert.equal(other.stop().status, 2, "the other session's own Stop gates it");
	mine.start();
	const obliged = mine.stop();
	assert.equal(obliged.status, 2);
	assert.match(obliged.stderr, /its registry lists no record/, "another session's record does not satisfy this one");
});

for (const host of HOSTS) test(`F6 ${host}: failing records the session never registered are not checked`, () => {
	const cwd = repository();
	put(cwd, "old/acceptance-scenarios-old.json", TEMPLATE);
	put(cwd, "control-decisions.json", { facts: 5 });
	const s = session(host, cwd);
	const done = put(cwd, "new/acceptance-scenarios-new.json", COMPLETE);
	assert.equal(s.scenarios("register", done).status, 0);
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
});

for (const host of HOSTS) test(`F7 ${host}: with a session id and no registry, init stops (exit 2, nothing written); without an id or with --no-gate it proceeds unregistered`, () => {
	const cwd = repository();
	const s = session(host, cwd, { started: false });
	const path = join(cwd, "docs/acceptance-scenarios-i.json");
	const refused = s.scenarios("init", path);
	assert.equal(refused.status, 2);
	assert.equal(refused.stderr.match(NO_REGISTRY)?.[1], cwd, refused.stderr);
	assert.equal(existsSync(path), false, "no record without a registry");
	assert.equal(existsSync(join(cwd, ".hobin-feature")), false, "the script never creates a registry");

	const byHand = script("scenarios.mjs", ["init", path], cwd);
	assert.equal(byHand.status, 0, byHand.stderr);
	assert.deepEqual(json(path), json(TEMPLATE), "records carry no session data");
	const ungated = join(cwd, "docs/acceptance-scenarios-ungated.json");
	const noGate = s.scenarios("init", ungated, "--no-gate");
	assert.equal(noGate.status, 0, noGate.stderr);
	assert.match(noGate.stdout, /--no-gate: no Stop gate covers this record/);
	assert.ok(existsSync(ungated));

	const t = session(host, cwd, { tag: "started" });
	t.start();
	assert.match(t.stop().stderr, /its registry lists no record/, "unregistered records are no session's");
	const again = t.scenarios("init", path);
	assert.equal(again.status, 1);
	assert.match(again.stderr, /already exists; init never overwrites/);
	assert.equal(t.scenarios("init", join(cwd, "notes.json")).status, 2);
	assert.equal(existsSync(join(cwd, "notes.json")), false);
	assert.deepEqual(lines(t.registry), [], "refused calls register nothing");
});

for (const host of HOSTS) test(`F8 ${host}: register finds the registry from a subdirectory, registers a record in another repository, and refuses what is not a record`, () => {
	const cwd = repository();
	mkdirSync(join(cwd, "packages/app"), { recursive: true });
	const s = session(host, cwd);
	const elsewhere = repository();
	const theirs = put(elsewhere, "docs/acceptance-scenarios.json", TEMPLATE);
	const result = s.scenariosIn(join(cwd, "packages/app"), "register", theirs);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(lines(s.registry).map((line) => line.file), [theirs]);
	const stopped = s.stop();
	assert.equal(stopped.status, 2);
	assert.ok(stopped.stderr.includes(`${theirs}: Scenario S1`), stopped.stderr);

	put(cwd, "bad/acceptance-scenarios.json", "{ not json");
	put(cwd, "list/acceptance-scenarios.json", "[]");
	put(cwd, "notes.json", "{}");
	for (const [path, pattern] of [[join(cwd, "missing/acceptance-scenarios.json"), /no such record file/], [join(cwd, "notes.json"), /file name must match/],
		[join(cwd, "bad/acceptance-scenarios.json"), /not valid JSON/], [join(cwd, "list/acceptance-scenarios.json"), /a record is a JSON object/]]) {
		const refused = s.scenarios("register", path);
		assert.equal(refused.status, 1, path);
		assert.match(refused.stderr, pattern);
	}
	assert.equal(lines(s.registry).length, 1, "refused calls register nothing");
	const outside = s.scenariosIn(workspace(), "register", theirs);
	assert.equal(outside.status, 2, "outside the start directory there is no registry above the cwd");
	assert.match(outside.stderr, NO_REGISTRY);
});

for (const host of HOSTS) test(`F9 ${host}: the registry is append-only JSON lines with absolute paths; a path registered twice is checked once`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	const path = put(cwd, "acceptance-scenarios.json", TEMPLATE);
	s.scenarios("register", "acceptance-scenarios.json");
	s.scenarios("register", path);
	const registered = lines(s.registry);
	assert.equal(registered.length, 2);
	for (const line of registered) {
		assert.deepEqual(Object.keys(line).sort(), ["at", "file"]);
		assert.equal(line.file, path, "relative paths are registered absolute");
		assert.ok(!Number.isNaN(Date.parse(line.at)));
	}
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.equal(result.stderr.split(`${path}: Scenario S1: fill "given"`).length - 1, 1, result.stderr);
});

for (const host of HOSTS) test(`F10 ${host}: SessionStart creates the registry and an ignore-all .gitignore; UserPromptSubmit creates it when missing`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	assert.equal(readFileSync(s.registry, "utf8"), "");
	assert.equal(readFileSync(join(cwd, ".hobin-feature/.gitignore"), "utf8"), "*\n");
	s.scenarios("init", join(cwd, "acceptance-scenarios.json"));
	s.run({ hook_event_name: "SessionStart", source: "resume" });
	assert.equal(lines(s.registry).length, 1, "a second SessionStart never truncates the registry");

	const project = repository();
	const missed = session(host, project, { started: false, hookEnv: host === "claude" ? { CLAUDE_PROJECT_DIR: project } : {} });
	missed.prompt("hello", host === "claude" ? { cwd: join(project, "sub") } : {});
	assert.ok(existsSync(registryOf(project, missed.id)), "created in the project directory");
	assert.equal(existsSync(join(project, "sub/.hobin-feature")), false);
});

for (const host of HOSTS) test(`F11 ${host}: the start directory is remembered; hook events from another cwd neither move nor duplicate the registry`, () => {
	const cwd = repository();
	mkdirSync(join(cwd, "sub"));
	const s = session(host, cwd);
	s.start();
	s.scenarios("init", join(cwd, "acceptance-scenarios.json"));
	const elsewhere = { cwd: join(cwd, "sub") };
	s.prompt("continue", elsewhere);
	s.run({ hook_event_name: "PostToolUse", tool_name: host === "claude" ? "Bash" : "shell", tool_input: { command: "ls" }, ...elsewhere });
	assert.equal(existsSync(join(cwd, "sub/.hobin-feature")), false);
	const result = s.stop(elsewhere);
	assert.equal(result.status, 2);
	assert.match(result.stderr, /acceptance-scenarios\.json: Scenario S1/, "the record registered under the start directory is gated");
	assert.ok(result.stderr.includes(`from ${cwd},`) || result.stderr.includes(`from ${cwd} `), result.stderr);
});

for (const host of HOSTS) test(`F12 ${host}: a checker that throws is the hook's error: exit 1, never 2`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	const path = put(cwd, "control-decisions.json", { facts: 5 });
	assert.equal(s.scenarios("register", path).status, 0);
	for (let i = 0; i < 4; i++) {
		const result = s.stop();
		assert.equal(result.status, 1);
		assert.match(result.stderr, /internal error \(not a problem in the record/);
	}
});

for (const host of HOSTS) test(`F13 ${host}: at most three blocks in a row; a fixed record passes and resets the count`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	const path = join(cwd, "acceptance-scenarios.json");
	s.scenarios("init", path);
	assert.deepEqual([s.stop().status, s.stop().status, s.stop().status, s.stop().status], [2, 2, 2, 0]);
	cpSync(COMPLETE, path);
	assert.equal(s.stop().status, 0);
	cpSync(TEMPLATE, path);
	assert.equal(s.stop().status, 2, "the count started again after the pass");
});

for (const host of HOSTS) test(`F14 ${host}: the gate reads evidence relative to the record's repository`, () => {
	const parent = workspace();
	const child = join(parent, "child");
	mkdirSync(join(child, ".git"), { recursive: true });
	const s = session(host, parent);
	s.scenarios("register", controlProject(child, { plans: "docs/plans" }));
	const passing = s.stop();
	assert.equal(passing.status, 0, passing.stderr);

	const badParent = workspace();
	const badChild = join(badParent, "child");
	mkdirSync(join(badChild, ".git"), { recursive: true });
	const t = session(host, badParent);
	t.scenarios("register", controlProject(badChild, { gatePasses: false, plans: "docs/plans" }));
	const failing = t.stop();
	assert.equal(failing.status, 2);
	assert.match(failing.stderr, /control-decisions\.json: .*finding same-events:COMPLETED\|FAILED is not acknowledged/);
	assert.ok(failing.stderr.includes(`${join(pluginScripts(host), "compile-control-model.mjs")}" --gate <record>`), failing.stderr);
});

test("F15 claude: Write, Edit and MultiEdit register the record file they wrote; other files and tools register nothing", () => {
	const cwd = repository();
	const s = session("claude", cwd);
	const written = put(cwd, "docs/acceptance-scenarios-written.json", TEMPLATE);
	const edited = put(cwd, "docs/acceptance-scenarios-edited.json", TEMPLATE);
	const multi = put(cwd, "docs/control-decisions-multi.json", { facts: [] });
	put(cwd, "notes.md", "x");
	put(cwd, "docs/acceptance-scenarios-read.json", TEMPLATE);
	s.edit("Write", { file_path: written });
	s.edit("Edit", { file_path: "docs/acceptance-scenarios-edited.json" });
	s.edit("MultiEdit", { file_path: multi });
	s.edit("Write", { file_path: join(cwd, "notes.md") });
	s.edit("Write", { file_path: join(cwd, "docs/acceptance-scenarios-gone.json") });
	s.edit("Read", { file_path: join(cwd, "docs/acceptance-scenarios-read.json") });
	s.edit("NotebookEdit", { notebook_path: join(cwd, "docs/acceptance-scenarios-read.json") });
	assert.deepEqual(lines(s.registry).map((line) => line.file), [written, edited, multi]);
});

test("F15 codex: apply_patch registers the record files it added, updated or moved to; not a move's source or a deletion", () => {
	const cwd = repository();
	const s = session("codex", cwd);
	const added = put(cwd, "docs/acceptance-scenarios-added.json", TEMPLATE);
	const updated = put(cwd, "docs/acceptance-scenarios-updated.json", TEMPLATE);
	const moved = put(cwd, "docs/acceptance-scenarios-moved.json", TEMPLATE);
	put(cwd, "notes.md", "hi");
	s.patch(["*** Begin Patch", "*** Add File: docs/acceptance-scenarios-added.json", "+{}",
		`*** Update File: ${updated}`, "@@", "-a", "+b",
		"*** Update File: docs/acceptance-scenarios-draft.json", "*** Move to: docs/acceptance-scenarios-moved.json", "@@", "-a", "+b",
		"*** Update File: notes.md", "@@", "-hello", "+hi",
		"*** Delete File: docs/acceptance-scenarios-deleted.json", "*** End Patch", ""].join("\n"));
	assert.deepEqual(lines(s.registry).map((line) => line.file), [added, updated, moved]);
	s.shellPost(`echo '*** Add File: ${added}'`);
	assert.equal(lines(s.registry).length, 3, "shell text registers nothing");
});

for (const host of HOSTS) test(`F16 ${host}: no session id leaves Stop alone`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	s.scenarios("init", join(cwd, "acceptance-scenarios.json"));
	s.start();
	assert.equal(s.stop({ session_id: undefined }).status, 0);
});

test("F18 hooks: per-host wiring, the same shipped hook script, and no MCP server or permission hook", () => {
	const expected = ["PostToolUse", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit"];
	for (const host of HOSTS) {
		const root = pluginRoot(host);
		const hooks = json(join(root, "hooks/hooks.json")).hooks;
		assert.deepEqual(Object.keys(hooks).sort(), expected, host);
		for (const [event, groups] of Object.entries(hooks)) {
			assert.equal(groups.length, 1, `${host} ${event}`);
			assert.match(groups[0].hooks[0].command, new RegExp(`/scripts/scenarios-stop-hook\\.mjs" ${host}$`), `${host} ${event}`);
		}
		for (const gone of [".mcp.json", "scripts/records-mcp-server.mjs", "skills/developing-features/scripts/record-tools.mjs"]) {
			assert.equal(existsSync(join(root, gone)), false, `${host}: ${gone} is removed`);
		}
	}
	assert.equal(json(join(pluginRoot("claude"), "hooks/hooks.json")).hooks.PostToolUse[0].matcher, "Write|Edit|MultiEdit|Skill");
	// Codex hooks every tool: its shell tool name is not documented; the script decides.
	assert.equal(json(join(pluginRoot("codex"), "hooks/hooks.json")).hooks.PostToolUse[0].matcher, undefined);
	assert.equal(json(join(pluginRoot("codex"), ".codex-plugin/plugin.json")).mcpServers, undefined);
	assert.equal(existsSync(join(coreScripts, "record-tools.mjs")), false);

	const hook = readFileSync(join(pluginRoot("claude"), "scripts/scenarios-stop-hook.mjs"), "utf8");
	assert.equal(hook, readFileSync(join(pluginRoot("codex"), "scripts/scenarios-stop-hook.mjs"), "utf8"));
	assert.doesNotMatch(hook, /spawnSync|execSync|child_process|transcript_path|tool_response|mcp__|permissionDecision|findFiles|readdirSync/, "no search, shell, output, transcript or MCP inference in the hook");
	// The registry lives in one shared module with nothing of this plugin in it; the hook and the
	// scripts only call it.
	const shared = readFileSync(join(repositoryRoot, "core/shared/scripts/session-registry.mjs"), "utf8");
	assert.doesNotMatch(shared, /hobin|feature|acceptance|scenario/i);
	for (const host of HOSTS) assert.equal(readFileSync(join(pluginScripts(host), "session-registry.mjs"), "utf8"), shared, `${host} ships the shared module`);
	assert.match(hook, /from "\.\.\/skills\/developing-features\/scripts\/session-registry\.mjs"/);
	for (const file of [hook, readFileSync(join(coreScripts, "scenarios.mjs"), "utf8"), readFileSync(join(coreScripts, "records.mjs"), "utf8")]) {
		const code = file.replace(/^\s*\/\/.*$/gm, "");
		assert.doesNotMatch(code, /appendFileSync|\.jsonl|CLAUDE_CODE_SESSION_ID|CODEX_SESSION_ID/, "registry logic stays in session-registry.mjs");
	}
});

test("F19 skill: every scenarios.mjs run/check and --gate the procedure names passes the record path", () => {
	for (const host of HOSTS) {
		const text = readFileSync(join(pluginRoot(host), "skills/developing-features/SKILL.md"), "utf8");
		const commands = [...text.matchAll(/scenarios\.mjs (?:run|check)[^`\n]*|compile-control-model\.mjs --gate[^`\n]*/g)].map((m) => m[0]);
		assert.ok(commands.length >= 3, `${host}: ${commands}`);
		for (const command of commands) assert.match(command, / <record>$/, `${host}: ${command}`);
		for (const mode of ["init", "register", "decline"]) assert.match(text, new RegExp(`scenarios\\.mjs ${mode} <`), `${host}: names ${mode}`);
		assert.doesNotMatch(text, /mcp__|records tool|--no-session/, `${host}: no MCP tools`);
	}
});

for (const host of HOSTS) test(`F20 ${host}: check and the gate register nothing, whatever they print`, () => {
	const cwd = repository();
	const record = put(cwd, "acceptance-scenarios.json", TEMPLATE);
	const control = controlProject(join(cwd, "control"), { gatePasses: false });
	const s = session(host, cwd);
	s.command(`node "${join(pluginScripts(host), "scenarios.mjs")}" check "${record}"; node "${join(pluginScripts(host), "compile-control-model.mjs")}" --gate "${control}"; echo '{"file": "${record}"}'`);
	assert.deepEqual(lines(s.registry), []);
	assert.deepEqual(json(record), json(TEMPLATE));
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
});

for (const host of HOSTS) test(`F21 ${host}: a registered record that no longer exists is reported`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	const path = join(cwd, "docs/acceptance-scenarios.json");
	s.scenarios("init", path);
	rmSync(path);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.ok(result.stderr.includes(`${path}: this session registered the record, but it no longer exists`), result.stderr);
});

for (const host of HOSTS) test(`F22 ${host}: after the skill starts, Stop names the exact init, register and decline commands and the start directory; a registered complete record releases it`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	s.start();
	const path = put(cwd, "docs/acceptance-scenarios.json", COMPLETE);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /developing-features started in this session \(.+\) but its registry lists no record/);
	assert.ok(result.stderr.includes(`Run one of these from ${cwd}, the directory this session started in`), result.stderr);
	const command = `node "${join(pluginScripts(host), "scenarios.mjs")}"`;
	for (const usage of [`${command} init <absolute path>/acceptance-scenarios-<name>.json`, `${command} register <path>`,
		`${command} decline <absolute path>/acceptance-scenarios-<name>.json --reason "<why>"`]) {
		assert.ok(result.stderr.includes(usage), `${usage}\n${result.stderr}`);
	}
	assert.equal(s.scenarios("register", path).status, 0);
	assert.equal(s.stop().status, 0, "registering the record releases the obligation");
});

for (const host of HOSTS) test(`F23 ${host}: decline writes and registers a declined record that releases the obligation; empty reasons, other records and a missing registry are refused`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	s.start();
	const path = join(cwd, "docs/acceptance-scenarios-declined.json");
	for (const args of [[path], [path, "--reason"], [path, "--reason", ""], [path, "--reason", "   "], ["--reason", "why"]]) {
		const rejected = s.scenarios("decline", ...args);
		assert.equal(rejected.status, 2, JSON.stringify(args));
		assert.match(rejected.stderr, /Usage: scenarios\.mjs decline/);
	}
	assert.equal(existsSync(path), false);
	const unstarted = session(host, cwd, { tag: "unstarted", started: false });
	assert.equal(unstarted.scenarios("decline", path, "--reason", "why").status, 2, "no registry");
	assert.equal(existsSync(path), false);
	const existing = put(cwd, "docs/acceptance-scenarios.json", TEMPLATE);
	const over = s.scenarios("decline", existing, "--reason", "why");
	assert.equal(over.status, 1);
	assert.match(over.stderr, /exists and is not a declined record/);
	assert.deepEqual(json(existing), json(TEMPLATE));
	assert.equal(s.stop().status, 2, "nothing was declined yet");

	assert.equal(s.scenarios("decline", path, "--reason", "one-line copy fix, no behavior to scenario").status, 0);
	const record = json(path);
	assert.deepEqual(Object.keys(record), ["declined"]);
	assert.equal(record.declined.reason, "one-line copy fix, no behavior to scenario");
	assert.ok(!Number.isNaN(Date.parse(record.declined.at)));
	assert.deepEqual(lines(s.registry).map((line) => line.file), [path]);
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /declined an acceptance-scenario record .*: one-line copy fix, no behavior to scenario/);
	assert.equal(script("scenarios.mjs", ["check", path], cwd).status, 0);
	assert.equal(s.scenarios("decline", path, "--reason", "still nothing to scenario").status, 0, "a declined record may be declined again");
	assert.equal(json(path).declined.reason, "still nothing to scenario");

	put(cwd, "docs/acceptance-scenarios-declined.json", { ...json(path), scenarios: json(TEMPLATE).scenarios });
	const mixed = script("scenarios.mjs", ["check", path], cwd);
	assert.equal(mixed.status, 1);
	assert.match(mixed.stderr, /Declined record: it also holds scenarios/);
});

for (const host of HOSTS) test(`F24 ${host}: a decline does not exempt another record of the session`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	s.start();
	s.scenarios("init", join(cwd, "acceptance-scenarios.json"));
	s.scenarios("decline", join(cwd, "plans/acceptance-scenarios-none.json"), "--reason", "changed my mind");
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /\/acceptance-scenarios\.json: Scenario S1/);
});

for (const host of HOSTS) test(`F25 ${host}: no skill start and an empty registry leave Stop alone`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	s.prompt("explain how quiet hours work");
	s.skill("hobin-review:reviewing-code");
	s.shellPost("cat README.md");
	put(cwd, "acceptance-scenarios.json", TEMPLATE);
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
});

test("F26 claude: the Skill tool and the slash prompt start the obligation; other skills and prompts do not", () => {
	const cwd = repository();
	const starts = (drive) => { const s = session("claude", cwd); drive(s); return s.stop().status === 2; };
	assert.equal(starts((s) => s.skill("hobin-feature:developing-features")), true);
	assert.equal(starts((s) => s.skill("developing-features")), true);
	assert.equal(starts((s) => s.prompt("/developing-features add quiet hours")), true);
	assert.equal(starts((s) => s.prompt("  /hobin-feature:developing-features")), true);
	assert.equal(starts((s) => s.skill("hobin-review:reviewing-code")), false);
	assert.equal(starts((s) => s.skill("developing-features-extra")), false);
	assert.equal(starts((s) => s.prompt("please run /developing-features later")), false);
	assert.equal(starts((s) => s.prompt("/developing-featuresx")), false);
});

test("F27 codex: a $developing-features prompt and a read of this plugin's SKILL.md start the obligation; other text does not", () => {
	const cwd = repository();
	const skill = join(pluginRoot("codex"), "skills/developing-features/SKILL.md");
	const starts = (drive) => { const s = session("codex", cwd); drive(s); return s.stop().status === 2; };
	assert.equal(starts((s) => s.prompt("use $developing-features for the cancel button")), true);
	assert.equal(starts((s) => s.shellPost(`sed -n '1,200p' "${skill}"`)), true);
	assert.equal(starts((s) => s.prompt("use $developing-features-extra")), false);
	assert.equal(starts((s) => s.prompt("developing-features is a skill")), false);
	assert.equal(starts((s) => s.shellPost("cat skills/developing-features/SKILL.md")), false, "only this plugin's file, by its path");
	assert.equal(starts((s) => s.patch(`*** Begin Patch\n*** Update File: ${skill}\n@@\n-a\n+b\n*** End Patch\n`)), false, "editing is not reading");
});

for (const host of HOSTS) test(`F28 ${host}: run registers the record and hides the session id from its checks; with an id and no registry it runs nothing`, () => {
	const cwd = repository();
	const record = json(COMPLETE);
	record.scenarios = record.scenarios.map((scenario) => ({ ...scenario, check: 'touch ran && test -z "$CLAUDE_CODE_SESSION_ID$CODEX_SESSION_ID"' }));
	record.verification = { ...record.verification, existing_tests: "true" };
	const path = put(cwd, "acceptance-scenarios.json", record);
	const unstarted = session(host, cwd, { tag: "unstarted", started: false });
	const refused = unstarted.scenarios("run", path);
	assert.equal(refused.status, 2);
	assert.match(refused.stderr, NO_REGISTRY);
	assert.equal(existsSync(join(cwd, "ran")), false, "no check ran");
	assert.deepEqual(json(path), record, "the record is untouched");

	const byHand = script("scenarios.mjs", ["run", path], cwd);
	assert.equal(byHand.status, 0, byHand.stderr);
	const s = session(host, cwd);
	const run = s.scenarios("run", path);
	assert.equal(run.status, 0, `the checks saw no session id: ${run.stderr}`);
	assert.deepEqual(lines(s.registry).map((line) => line.file), [path]);
	assert.equal(s.stop().status, 0);
});

const RUN_WORDING = /a scenarios\.mjs run started at \S+ \(last progress \S+\) has not finished; if it is still running wait for it, do not start another; if it stopped, run it again\./;

for (const host of HOSTS) test(`F29 ${host}: a run killed midway leaves verification.run and running results, and Stop and check report it; a finished run clears it`, async () => {
	const cwd = repository();
	const record = json(COMPLETE);
	record.scenarios = record.scenarios.map((scenario, i) => ({ ...scenario, check: i === 0 ? "sleep 30" : "true" }));
	record.verification = { ...record.verification, existing_tests: "true" };
	const path = put(cwd, "acceptance-scenarios.json", record);
	const s = session(host, cwd);
	const child = spawn("node", [join(pluginScripts(host), "scenarios.mjs"), "run", path], { cwd, stdio: "ignore", env: cleanEnv({ [SESSION_VAR[host]]: s.id }) });
	const deadline = Date.now() + 10_000;
	while (!json(path).verification?.run) {
		assert.ok(Date.now() < deadline, "the run records itself before its first check");
		await new Promise((done) => setTimeout(done, 50));
	}
	const exited = new Promise((done) => child.on("exit", done));
	child.kill("SIGKILL");
	await exited;

	const killed = json(path);
	assert.deepEqual(lines(s.registry).map((line) => line.file), [path], "the run registered the record before its first check");
	assert.ok(killed.verification.run.startedAt && killed.verification.run.lastProgressAt, JSON.stringify(killed.verification.run));
	assert.ok(killed.scenarios.every((scenario) => scenario.status === "running"));
	const stopped = s.stop();
	assert.equal(stopped.status, 2);
	assert.match(stopped.stderr, RUN_WORDING);
	assert.ok(stopped.stderr.includes(killed.verification.run.startedAt));
	assert.doesNotMatch(stopped.stderr, /background tasks are still running/);
	if (host === "claude") {
		const busy = s.stop({ background_tasks: [{ id: "b1", command: "node scenarios.mjs run" }] });
		assert.match(busy.stderr, /background tasks are still running in this session \(1\)/);
	}
	const check = script("scenarios.mjs", ["check", path], cwd);
	assert.equal(check.status, 1);
	assert.match(check.stderr, RUN_WORDING);

	writeFileSync(path, JSON.stringify({ ...killed, scenarios: killed.scenarios.map((scenario) => ({ ...scenario, check: "true" })) }));
	const again = s.scenarios("run", path);
	assert.equal(again.status, 0, again.stderr);
	assert.equal(json(path).verification.run, undefined);
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`F30 ${host}: SessionEnd deletes the registry and the session's state; Stop prunes week-old registries and state`, () => {
	const cwd = repository();
	const s = session(host, cwd);
	s.start();
	s.scenarios("init", join(cwd, "acceptance-scenarios.json"));
	assert.equal(s.stop().status, 2);
	const mine = () => readdirSync(stateDir).filter((name) => name.endsWith(s.id));
	assert.deepEqual(mine().sort(), [`obligation-${s.id}`, `start-${s.id}`, `stop-${s.id}`]);
	s.end();
	assert.deepEqual(mine(), []);
	assert.equal(existsSync(s.registry), false);
	assert.ok(existsSync(join(cwd, "acceptance-scenarios.json")), "the record stays");

	const EIGHT_DAYS_AGO = Date.now() / 1000 - 8 * 24 * 3600;
	const staleState = put(stateDir, "obligation-stale-session", "{}");
	const freshState = put(stateDir, "obligation-fresh-session", "{}");
	const staleRegistry = put(cwd, ".hobin-feature/sessions/stale-session.jsonl", "");
	const freshRegistry = put(cwd, ".hobin-feature/sessions/fresh-session.jsonl", "");
	for (const path of [staleState, staleRegistry]) utimesSync(path, EIGHT_DAYS_AGO, EIGHT_DAYS_AGO);
	session(host, cwd, { tag: "prune" }).stop();
	assert.equal(existsSync(staleState), false);
	assert.equal(existsSync(staleRegistry), false);
	assert.ok(existsSync(freshState) && existsSync(freshRegistry));
	assert.ok(stateDir.startsWith(DATA), "state lives in the plugin data directory, not TMPDIR");
});

test("F35 scripts: with both hosts' session variables (Codex started from a Claude Code shell), the one that has a registry is used", () => {
	for (const host of ["claude", "codex"]) {
		const start = repository();
		const s = session(host, start);
		const other = host === "claude" ? "CODEX_SESSION_ID" : "CLAUDE_CODE_SESSION_ID";
		const record = join(start, "docs/acceptance-scenarios-both.json");
		const result = spawnSync("node", [join(pluginScripts(host), "scenarios.mjs"), "init", record], {
			cwd: start, encoding: "utf8", env: cleanEnv({ [other]: `foreign-${s.id}`, [SESSION_VAR[host]]: s.id }),
		});
		assert.equal(result.status, 0, `${host}: ${result.stderr}`);
		assert.deepEqual(lines(s.registry).map((line) => line.file), [record], `${host}: registered in this session's registry`);
	}
});

test("F36 scripts: --no-gate is refused where this session's registry is found, and proceeds only where none is", () => {
	for (const host of ["claude", "codex"]) {
		const start = repository();
		const s = session(host, start);
		const inside = join(start, "docs/acceptance-scenarios-nogate.json");
		const refused = s.scenarios("init", inside, "--no-gate");
		assert.equal(refused.status, 2, `${host}: ${refused.stdout}${refused.stderr}`);
		assert.match(refused.stderr, /--no-gate refused/);
		assert.equal(existsSync(inside), false, `${host}: nothing created`);
		assert.deepEqual(lines(s.registry), [], `${host}: nothing registered`);
		const away = workspace();
		const outside = join(away, "acceptance-scenarios-away.json");
		const allowed = s.scenariosIn(away, "init", outside, "--no-gate");
		assert.equal(allowed.status, 0, `${host}: ${allowed.stderr}`);
		assert.match(allowed.stdout, /no Stop gate covers this record/);
	}
});

test("F37 skill: SKILL.md never offers --no-gate", () => {
	for (const host of ["claude", "codex"]) {
		const text = readFileSync(join(pluginRoot(host), "skills/developing-features/SKILL.md"), "utf8");
		assert.doesNotMatch(text, /no-gate/, `${host}: only the scripts' refusal message mentions it`);
	}
});
