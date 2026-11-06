// The hobin-feature hook gates the records this session registered and, once the session started
// developing-features, asks for one. Nothing is inferred from shell text, command output or the
// file tree: the obligation comes from fixed identifiers (Claude's Skill tool and slash prompt, a
// Codex $developing-features prompt or a read of this plugin's SKILL.md), registration from
// successful calls of the plugin's record tools (MCP init/register/check, decline) and from edit
// tools' exact file paths. Record tool calls here go through the real records server over stdio,
// and the hook gets the host's PostToolUse input for that call: Claude names the tool
// mcp__plugin_hobin-feature_hobin_feature__<tool> and sends failures to PostToolUseFailure (which
// the hook does not receive); Codex names it mcp__hobin_feature__<tool>, hands the MCP result
// object ({content, isError}) and fires no PostToolUse for a failed call (observed live, 0.166). Each test is named after the acceptance scenario it checks
// (docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json) and runs on both hosts' inputs.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";

const HOSTS = ["claude", "codex"];
const pluginRoot = (host) => join(repositoryRoot, host === "claude" ? "claude/plugins" : "codex/plugins", "hobin-feature");
const coreScripts = join(repositoryRoot, "core/developing-features/scripts");
const TEMPLATE = join(repositoryRoot, "core/developing-features/assets/acceptance-scenarios.json");
const COMPLETE = join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json");
const CONTROL = join(repositoryRoot, "core/developing-features/scenarios/job-lookup-cancel");
const TOOL_PREFIX = { claude: "mcp__plugin_hobin-feature_hobin_feature__", codex: "mcp__hobin_feature__" };

// Real paths: a command's cwd is resolved through links (/var is /private/var on macOS).
const workspace = () => realpathSync(mkdtempSync(join(tmpdir(), "feature-hook-")));
// The hook's state lives in the host's plugin data directory; each test file gets its own.
const DATA = workspace();
test.after(() => rmSync(DATA, { recursive: true, force: true }));
const stateDir = join(DATA, "hobin-feature-sessions");
let counter = 0;
const newSession = (tag) => `${tag}-${process.pid}-${Date.now()}-${counter++}`;
const HOUR_AGO = Date.now() / 1000 - 3600;
const age = (path) => utimesSync(path, HOUR_AGO, HOUR_AGO);
function put(dir, file, source) {
	mkdirSync(join(dir, file, ".."), { recursive: true });
	if (typeof source === "string" && existsSync(source)) cpSync(source, join(dir, file));
	else writeFileSync(join(dir, file), source);
	return join(dir, file);
}

function cleanEnv(extra = {}) {
	const env = { ...process.env };
	for (const name of ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "PLUGIN_DATA", "NODE_TEST_CONTEXT"]) delete env[name];
	return { ...env, ...extra };
}

// A record script run as a shell command.
const script = (name, args, cwd) => spawnSync("node", [join(coreScripts, name), ...args], { cwd, encoding: "utf8", env: cleanEnv() });

// The records server as a host runs it: JSON-RPC lines on stdin, one reply per request.
export function serve(host, requests) {
	const lines = [
		{ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } },
		{ jsonrpc: "2.0", method: "notifications/initialized" },
		...requests.map((request, i) => ({ jsonrpc: "2.0", id: i + 1, ...request })),
	].map((line) => JSON.stringify(line)).join("\n") + "\n";
	const result = spawnSync("node", [join(pluginRoot(host), "scripts/records-mcp-server.mjs")], { input: lines, encoding: "utf8", cwd: pluginRoot(host), env: cleanEnv() });
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim().split("\n").map((line) => JSON.parse(line));
}
const callTool = (host, name, args) => serve(host, [{ method: "tools/call", params: { name, arguments: args } }])[1].result;

// One session as the host would drive the hook: JSON on stdin, the plugin root and data directory
// in the environment, the host named on the command line as hooks.json does. TMPDIR changes on
// every call: the hook's state must not depend on it.
function session(host, cwd, tag = "s") {
	const id = newSession(`${host}-${tag}`);
	const root = pluginRoot(host);
	const data = host === "claude" ? { CLAUDE_PLUGIN_DATA: DATA } : { PLUGIN_DATA: DATA, CLAUDE_PLUGIN_DATA: DATA };
	const run = (input) => {
		const result = spawnSync("node", [join(root, "scripts/scenarios-stop-hook.mjs"), host], {
			input: JSON.stringify({ session_id: id, cwd, ...input }),
			encoding: "utf8", env: cleanEnv({ CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root, ...data, TMPDIR: workspace() }),
		});
		return { status: result.status, stderr: result.stderr, stdout: result.stdout };
	};
	// A record tool call: the real server answers, then the host's post-call hook input.
	const tool = (name, args, toolName = `${TOOL_PREFIX[host]}${name}`) => {
		const result = callTool(host, name, args);
		if (host === "claude") {
			run(result.isError
				? { hook_event_name: "PostToolUseFailure", tool_name: toolName, tool_input: args, error: result.content[0].text }
				: { hook_event_name: "PostToolUse", tool_name: toolName, tool_input: args, tool_response: result.content });
		} else {
			// Codex 0.166 fires PostToolUse only for a successful MCP call, with the result object.
			if (!result.isError) run({ hook_event_name: "PostToolUse", tool_name: toolName, tool_input: args, tool_response: result });
		}
		return result;
	};
	// A shell command run in this session; the hook sees it with its output.
	const command = (text, dir = cwd) => {
		const result = spawnSync("bash", ["-c", text], { cwd: dir, encoding: "utf8", env: cleanEnv() });
		run(host === "claude"
			? { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: text }, tool_response: { stdout: result.stdout, stderr: result.stderr, interrupted: false } }
			: { hook_event_name: "PostToolUse", tool_name: "shell", tool_input: { command: ["bash", "-lc", text] }, tool_response: JSON.stringify({ output: `${result.stdout}${result.stderr}` }) });
		return result;
	};
	return {
		id, run, tool, command,
		stop: (extra = {}) => run({ hook_event_name: "Stop", ...extra }),
		end: () => run({ hook_event_name: "SessionEnd", reason: "exit" }),
		prompt: (prompt) => run({ hook_event_name: "UserPromptSubmit", prompt }),
		skill: (skill) => run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill } }),
		// A shell command reported to the hook (Codex hooks every tool there).
		shellPost: (text) => run({ hook_event_name: "PostToolUse", tool_name: host === "claude" ? "Bash" : "shell",
			tool_input: { command: host === "claude" ? text : ["bash", "-lc", text] } }),
		// The host's way of starting developing-features in this session.
		start: () => host === "claude"
			? run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill: "hobin-feature:developing-features" } })
			: run({ hook_event_name: "UserPromptSubmit", prompt: "$developing-features add quiet hours" }),
		wrote: (file) => run(host === "claude"
			? { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: join(cwd, file) } }
			: { hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } }),
		patch: (text) => run({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: text } }),
		edited: (file, tool = "Edit") => run({ hook_event_name: "PostToolUse", tool_name: tool, tool_input: { file_path: join(cwd, file) } }),
	};
}

function controlProject(dir, { gatePasses = true, plans = "" } = {}) {
	cpSync(join(CONTROL, "base"), dir, { recursive: true });
	cpSync(join(CONTROL, "golden"), dir, { recursive: true });
	const record = JSON.parse(readFileSync(join(dir, "control-decisions.json"), "utf8"));
	const baseline = readFileSync(join(dir, "control-baseline.json"), "utf8");
	if (plans) {
		rmSync(join(dir, "control-decisions.json"));
		rmSync(join(dir, "control-baseline.json"));
		mkdirSync(join(dir, plans), { recursive: true });
		writeFileSync(join(dir, plans, "control-baseline.json"), baseline);
	}
	writeFileSync(join(dir, plans, "control-decisions.json"), JSON.stringify(gatePasses ? record : { ...record, findings: [] }));
	return dir;
}

for (const host of HOSTS) test(`F1 ${host}: a broken symbolic link does not crash Stop; only the session record is reported`, () => {
	const cwd = workspace();
	symlinkSync(join(cwd, "missing/target"), join(cwd, "dangling"));
	mkdirSync(join(cwd, "bin"));
	symlinkSync("../nowhere/bcrypt", join(cwd, "bin/bcrypt"));
	const s = session(host, cwd);
	put(cwd, "docs/acceptance-scenarios-x.json", TEMPLATE);
	s.wrote("docs/acceptance-scenarios-x.json");
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /acceptance-scenarios-x\.json: Scenario S1: fill "given"/);
	assert.doesNotMatch(result.stderr, /ENOENT|ELOOP|at findRecords/);
});

for (const host of HOSTS) test(`F1 ${host}: a broken symbolic link does not crash Stop; only the session record is reported`, () => {
	const cwd = workspace();
	symlinkSync(join(cwd, "missing/target"), join(cwd, "dangling"));
	mkdirSync(join(cwd, "bin"));
	symlinkSync("../nowhere/bcrypt", join(cwd, "bin/bcrypt"));
	const s = session(host, cwd);
	put(cwd, "docs/acceptance-scenarios-x.json", TEMPLATE);
	s.wrote("docs/acceptance-scenarios-x.json");
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /acceptance-scenarios-x\.json: Scenario S1: fill "given"/);
	assert.doesNotMatch(result.stderr, /ENOENT|ELOOP|at findRecords/);
});

test("F2 scripts: a directory link to an ancestor ends the walk and each record is found once", () => {
	const cwd = controlProject(workspace());
	mkdirSync(join(cwd, "nested"));
	symlinkSync("..", join(cwd, "nested/up"));
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

for (const host of HOSTS) test(`F4 ${host}: a record inside a dot directory is found and checked`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, ".plans/feature/acceptance-scenarios.json", TEMPLATE);
	s.wrote(".plans/feature/acceptance-scenarios.json");
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /\.plans\/feature\/acceptance-scenarios\.json/);
	const check = script("scenarios.mjs", ["check"], cwd);
	assert.equal(check.status, 1);
	assert.match(check.stderr, /\.plans\/feature\/acceptance-scenarios\.json: Scenario S1/);
});

for (const host of HOSTS) test(`F6 ${host}: a failing record the session never touched is not checked`, () => {
	const cwd = workspace();
	age(put(cwd, "old/acceptance-scenarios-old.json", TEMPLATE));
	const s = session(host, cwd);
	put(cwd, "new/acceptance-scenarios-new.json", COMPLETE);
	s.wrote("new/acceptance-scenarios-new.json");
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
});

for (const host of HOSTS) test(`F25 ${host}: no skill start and no registered record leave Stop alone`, () => {
	const cwd = workspace();
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
	const cwd = workspace();
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
	const cwd = workspace();
	const skill = join(pluginRoot("codex"), "skills/developing-features/SKILL.md");
	const starts = (drive) => { const s = session("codex", cwd); drive(s); return s.stop().status === 2; };
	assert.equal(starts((s) => s.prompt("use $developing-features for the cancel button")), true);
	assert.equal(starts((s) => s.shellPost(`sed -n '1,200p' "${skill}"`)), true);
	assert.equal(starts((s) => s.prompt("use $developing-features-extra")), false);
	assert.equal(starts((s) => s.prompt("developing-features is a skill")), false);
	assert.equal(starts((s) => s.shellPost("cat skills/developing-features/SKILL.md")), false, "only this plugin's file, by its path");
	assert.equal(starts((s) => s.patch(`*** Begin Patch\n*** Update File: ${skill}\n@@\n-a\n+b\n*** End Patch\n`)), false, "editing is not reading");
});

for (const host of HOSTS) test(`F10 ${host}: edit tools (Write, Edit, MultiEdit; apply_patch Add, Update, Move to) add the record they wrote, nothing else`, () => {
	const cwd = workspace();
	age(put(cwd, "docs/acceptance-scenarios-deleted.json", TEMPLATE));
	age(put(cwd, "notes.md", "hello\n"));
	const s = session(host, cwd);
	put(cwd, "docs/acceptance-scenarios-written.json", TEMPLATE);
	put(cwd, "docs/acceptance-scenarios-updated.json", TEMPLATE);
	put(cwd, "docs/acceptance-scenarios-moved.json", TEMPLATE);
	s.wrote("docs/acceptance-scenarios-written.json");
	if (host === "claude") {
		s.edited("docs/acceptance-scenarios-updated.json", "MultiEdit");
		s.edited("docs/acceptance-scenarios-moved.json", "Edit");
		s.edited("notes.md");
	} else {
		s.patch("*** Begin Patch\n*** Update File: docs/acceptance-scenarios-updated.json\n@@\n-a\n+b\n*** Update File: docs/draft.json\n*** Move to: docs/acceptance-scenarios-moved.json\n@@\n-a\n+b\n*** Update File: notes.md\n@@\n-hello\n+hi\n*** Delete File: docs/acceptance-scenarios-deleted.json\n*** End Patch\n");
	}
	const result = s.stop();
	assert.equal(result.status, 2);
	for (const name of ["written", "updated", "moved"]) assert.match(result.stderr, new RegExp(`acceptance-scenarios-${name}\\.json: Scenario S1`));
	assert.doesNotMatch(result.stderr, /acceptance-scenarios-deleted\.json|notes\.md|draft\.json/);
});

for (const host of HOSTS) test(`F11 ${host}: a session record that is not JSON goes back to the model`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, "acceptance-scenarios.json", "{ not json");
	s.wrote("acceptance-scenarios.json");
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /acceptance-scenarios\.json: not valid JSON/);
});

for (const host of HOSTS) test(`F12 ${host}: a checker that throws is the hook's error: exit 1, never 2`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, "control-decisions.json", JSON.stringify({ facts: 5 }));
	s.wrote("control-decisions.json");
	for (let i = 0; i < 4; i++) {
		const result = s.stop();
		assert.equal(result.status, 1);
		assert.match(result.stderr, /internal error \(not a problem in the record/);
	}
});

for (const host of HOSTS) test(`F13 ${host}: at most three blocks in a row; a fixed record passes and resets the count`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, "acceptance-scenarios.json", TEMPLATE);
	s.wrote("acceptance-scenarios.json");
	assert.deepEqual([s.stop().status, s.stop().status, s.stop().status, s.stop().status], [2, 2, 2, 0]);
	cpSync(COMPLETE, join(cwd, "acceptance-scenarios.json"));
	assert.equal(s.stop().status, 0);
	cpSync(TEMPLATE, join(cwd, "acceptance-scenarios.json"));
	assert.equal(s.stop().status, 2, "the count started again after the pass");
});

for (const host of HOSTS) test(`F14 ${host}: from a parent folder, the gate reads evidence relative to the record's repository`, () => {
	const parent = workspace();
	const child = join(parent, "child");
	mkdirSync(join(child, ".git"), { recursive: true });
	const s = session(host, parent);
	controlProject(child, { plans: "docs/plans" });
	s.wrote("child/docs/plans/control-decisions.json");
	const passing = s.stop();
	assert.equal(passing.status, 0, passing.stderr);

	const badParent = workspace();
	const badChild = join(badParent, "child");
	mkdirSync(join(badChild, ".git"), { recursive: true });
	const t = session(host, badParent);
	controlProject(badChild, { gatePasses: false, plans: "docs/plans" });
	t.wrote("child/docs/plans/control-decisions.json");
	const failing = t.stop();
	assert.equal(failing.status, 2);
	assert.match(failing.stderr, /finding same-events:COMPLETED\|FAILED is not acknowledged/);
});

for (const host of HOSTS) test(`F16 ${host}: no session id, or no ledger, leaves Stop alone`, () => {
	const cwd = workspace();
	put(cwd, "acceptance-scenarios.json", TEMPLATE);
	const s = session(host, cwd);
	assert.equal(s.stop({ session_id: undefined }).status, 0);
	assert.equal(s.stop().status, 0);
});

test("F19 skill: every scenarios.mjs run/check and --gate the procedure names passes the record path", () => {
	for (const host of HOSTS) {
		const text = readFileSync(join(pluginRoot(host), "skills/developing-features/SKILL.md"), "utf8");
		const commands = [...text.matchAll(/scenarios\.mjs (?:run|check)[^`\n]*|compile-control-model\.mjs --gate[^`\n]*/g)].map((m) => m[0]);
		assert.ok(commands.length >= 3, `${host}: ${commands}`);
		for (const command of commands) assert.match(command, / <record>$/, `${host}: ${command}`);
	}
});

for (const host of HOSTS) test(`F21 ${host}: a ledger record that no longer exists is dropped`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, "docs/acceptance-scenarios.json", TEMPLATE);
	s.wrote("docs/acceptance-scenarios.json");
	rmSync(join(cwd, "docs/acceptance-scenarios.json"));
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
});

for (const host of HOSTS) test(`F5 ${host}: a record another session's tool call registers is not this session's`, () => {
	const cwd = workspace();
	const mine = session(host, cwd, "mine");
	const other = session(host, cwd, "other");
	assert.equal(other.tool("init", { path: join(cwd, "docs/acceptance-scenarios.json") }).isError, false);
	const result = mine.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	assert.equal(other.stop().status, 2, "the other session's own Stop gates it");
});

for (const host of HOSTS) test(`F7 ${host}: the init tool registers a record outside the hook cwd, with no shell involved and TMPDIR changing on every hook call`, () => {
	const cwd = workspace();
	const elsewhere = workspace();
	const s = session(host, cwd);
	const path = join(elsewhere, "docs/plans/acceptance-scenarios-z.json");
	const init = s.tool("init", { path });
	assert.equal(init.isError, false, init.content[0].text);
	assert.ok(existsSync(path));
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.ok(result.stderr.includes(`${path}: Scenario S1`), result.stderr);
});

for (const host of HOSTS) test(`F8 ${host}: init refuses to overwrite, a non-record name and a relative path; a refused call registers nothing`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	const existing = put(cwd, "acceptance-scenarios.json", TEMPLATE);
	const again = s.tool("init", { path: existing });
	assert.equal(again.isError, true);
	assert.match(again.content[0].text, /already exists; init never overwrites/);
	assert.equal(readFileSync(existing, "utf8"), readFileSync(TEMPLATE, "utf8"));
	assert.equal(s.tool("init", { path: join(cwd, "notes.json") }).isError, true);
	assert.equal(existsSync(join(cwd, "notes.json")), false);
	const relativePath = s.tool("init", { path: "docs/acceptance-scenarios-r.json" });
	assert.equal(relativePath.isError, true);
	assert.match(relativePath.content[0].text, /absolute path/);
	const result = s.stop();
	assert.equal(result.status, 0, `the refused init over an incomplete record did not register it: ${result.stderr}`);
});

for (const host of HOSTS) test(`F9 ${host}: register and check register the record they are given, and only that one; check reports without registering others`, () => {
	const cwd = workspace();
	const a = put(cwd, "a/acceptance-scenarios.json", TEMPLATE);
	put(cwd, "b/acceptance-scenarios.json", TEMPLATE);
	const s = session(host, cwd);
	const checked = s.tool("check", { path: a });
	assert.equal(checked.isError, false, "a record with problems is still a successful check");
	assert.match(checked.content[0].text, /is not complete:\n- Scenario S1/);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /\/a\/acceptance-scenarios\.json: Scenario S1/);
	assert.doesNotMatch(result.stderr, /\/b\/acceptance-scenarios\.json/);

	const t = session(host, cwd, "register");
	const done = put(cwd, "c/acceptance-scenarios.json", COMPLETE);
	assert.equal(t.tool("register", { path: done }).isError, false);
	assert.equal(t.tool("register", { path: join(cwd, "missing/acceptance-scenarios.json") }).isError, true);
	t.start();
	assert.equal(t.stop().status, 0, "the registered complete record releases the obligation");
});

for (const host of HOSTS) test(`F15 ${host}: other tool names, a bare server name, the other host's name, and missing or non-record paths register nothing`, () => {
	const cwd = workspace();
	const path = put(cwd, "docs/acceptance-scenarios.json", TEMPLATE);
	put(cwd, "notes.json", "{}");
	const s = session(host, cwd);
	const other = host === "claude" ? "codex" : "claude";
	const response = host === "claude" ? [{ type: "text", text: "ok" }] : JSON.stringify({ content: [{ type: "text", text: "ok" }], isError: false });
	for (const tool_name of [`${TOOL_PREFIX[other]}register`, "hobin_feature__register", "mcp__hobin_feature", "mcp__other__register",
		`${TOOL_PREFIX[host]}run`, `${TOOL_PREFIX[host]}register_extra`, `x${TOOL_PREFIX[host]}register`]) {
		s.run({ hook_event_name: "PostToolUse", tool_name, tool_input: { path }, tool_response: response });
	}
	for (const target of [join(cwd, "missing/acceptance-scenarios.json"), join(cwd, "notes.json"), join(cwd, "docs")]) {
		s.run({ hook_event_name: "PostToolUse", tool_name: `${TOOL_PREFIX[host]}register`, tool_input: { path: target }, tool_response: response });
	}
	s.run({ hook_event_name: "PostToolUse", tool_name: `${TOOL_PREFIX[host]}register`, tool_input: { path }, tool_response: JSON.stringify({ content: [], isError: true }) });
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
});

for (const host of HOSTS) test(`F17 ${host}: the check tool registers a control decision record and the gate reports it`, () => {
	const parent = workspace();
	const child = join(parent, "child");
	mkdirSync(join(child, ".git"), { recursive: true });
	controlProject(child, { gatePasses: false });
	const s = session(host, parent);
	const checked = s.tool("check", { path: join(child, "control-decisions.json") });
	assert.match(checked.content[0].text, /finding same-events:COMPLETED\|FAILED is not acknowledged/);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /control-decisions\.json: .*finding same-events:COMPLETED\|FAILED is not acknowledged/);
});

for (const host of HOSTS) test(`F20 ${host}: scenarios.mjs and the compiler in the shell register nothing, whatever they print`, () => {
	const cwd = workspace();
	const record = put(cwd, "acceptance-scenarios.json", TEMPLATE);
	controlProject(join(cwd, "control"), { gatePasses: false });
	const s = session(host, cwd);
	s.command(`node "${join(coreScripts, "scenarios.mjs")}" check "${record}"; node "${join(coreScripts, "compile-control-model.mjs")}" --gate control/control-decisions.json; echo "hobin-feature-record: ${record}"`);
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
});

for (const host of HOSTS) test(`F22 ${host}: after the skill starts, a record written only by a shell program does not count; Stop names this host's init, register and decline tools`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	const path = join(cwd, "docs/acceptance-scenarios.json");
	s.command(`mkdir -p docs && cp "${COMPLETE}" docs/acceptance-scenarios.json && node "${join(coreScripts, "scenarios.mjs")}" check docs/acceptance-scenarios.json`);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /developing-features started in this session \(.+\) but no acceptance-scenario record is registered/);
	for (const tool of ["init", "register", "decline"]) assert.ok(result.stderr.includes(`${TOOL_PREFIX[host]}${tool}`), `${tool}: ${result.stderr}`);
	assert.match(result.stderr, /Running scenarios\.mjs in the shell does not register a record/);

	assert.equal(s.tool("register", { path }).isError, false);
	assert.equal(s.stop().status, 0, "registering the record releases the obligation");
});

for (const host of HOSTS) test(`F23 ${host}: a decline tool call with a reason releases the obligation and reports the reason; an empty reason is rejected`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	for (const args of [{}, { reason: "" }, { reason: "   " }]) {
		const rejected = s.tool("decline", args);
		assert.equal(rejected.isError, true, JSON.stringify(args));
		assert.match(rejected.content[0].text, /reason must be a non-empty explanation/);
	}
	assert.equal(s.stop().status, 2, "no decline was recorded");
	const declined = s.tool("decline", { reason: "one-line copy fix, no behavior to scenario" });
	assert.equal(declined.isError, false);
	const result = s.stop();
	assert.equal(result.status, 0);
	assert.match(result.stderr, /declined an acceptance-scenario record: one-line copy fix, no behavior to scenario/);
	const cli = script("scenarios.mjs", ["decline", "--reason", "why"], cwd);
	assert.match(cli.stdout, /Nothing recorded: this command line belongs to no session/);
});

for (const host of HOSTS) test(`F24 ${host}: a decline does not exempt a record the session registered`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	s.tool("init", { path: join(cwd, "acceptance-scenarios.json") });
	s.tool("decline", { reason: "changed my mind" });
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /acceptance-scenarios\.json: Scenario S1/);
});

for (const host of HOSTS) test(`F30 ${host}: SessionEnd removes the session's state, and state older than seven days is pruned`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	s.tool("init", { path: join(cwd, "acceptance-scenarios.json") });
	assert.equal(s.stop().status, 2);
	const mine = () => readdirSync(stateDir).filter((name) => name.endsWith(s.id));
	assert.deepEqual(mine().sort(), [`ledger-${s.id}`, `obligation-${s.id}`, `stop-${s.id}`]);
	s.end();
	assert.deepEqual(mine(), []);
	assert.equal(s.stop().status, 0, "after SessionEnd nothing is gated");

	const stale = put(stateDir, "ledger-stale-session", `${join(cwd, "acceptance-scenarios.json")}\n`);
	const fresh = put(stateDir, "ledger-fresh-session", `${join(cwd, "acceptance-scenarios.json")}\n`);
	const EIGHT_DAYS_AGO = Date.now() / 1000 - 8 * 24 * 3600;
	utimesSync(stale, EIGHT_DAYS_AGO, EIGHT_DAYS_AGO);
	session(host, cwd, "prune").stop();
	assert.equal(existsSync(stale), false);
	assert.equal(existsSync(fresh), true);
	assert.ok(stateDir.startsWith(DATA), "state lives in the plugin data directory, not TMPDIR");
});

test("F31 server: initialize, tools/list with annotations, and each tool over a stdio round trip", () => {
	for (const host of HOSTS) {
		const cwd = workspace();
		const path = join(cwd, "plans/acceptance-scenarios-q.json");
		const [init, list, created, again, registered, checked, missing, declined, empty, unknownTool, unknownMethod] = serve(host, [
			{ method: "tools/list" },
			{ method: "tools/call", params: { name: "init", arguments: { path } } },
			{ method: "tools/call", params: { name: "init", arguments: { path } } },
			{ method: "tools/call", params: { name: "register", arguments: { path } } },
			{ method: "tools/call", params: { name: "check", arguments: { path } } },
			{ method: "tools/call", params: { name: "check", arguments: { path: join(cwd, "acceptance-scenarios-none.json") } } },
			{ method: "tools/call", params: { name: "decline", arguments: { reason: "copy fix" } } },
			{ method: "tools/call", params: { name: "decline", arguments: { reason: " " } } },
			{ method: "tools/call", params: { name: "run", arguments: { path } } },
			{ method: "resources/list" },
		]);
		assert.equal(init.result.protocolVersion, "2025-06-18");
		assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } });
		const tools = Object.fromEntries(list.result.tools.map((tool) => [tool.name, tool]));
		assert.deepEqual(Object.keys(tools).sort(), ["check", "decline", "init", "register"]);
		assert.equal(tools.check.annotations.readOnlyHint, true);
		for (const name of ["init", "register", "decline"]) {
			assert.equal(tools[name].annotations.destructiveHint, false, name);
			assert.equal(tools[name].annotations.openWorldHint, false, name);
		}
		assert.deepEqual(tools.decline.inputSchema.required, ["reason"]);
		for (const name of ["init", "register", "check"]) assert.deepEqual(tools[name].inputSchema.required, ["path"], name);
		assert.equal(created.result.isError, false);
		assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), JSON.parse(readFileSync(TEMPLATE, "utf8")));
		assert.equal(again.result.isError, true);
		assert.equal(registered.result.isError, false);
		assert.equal(checked.result.isError, false);
		assert.match(checked.result.content[0].text, /not complete/);
		assert.equal(missing.result.isError, true);
		assert.equal(declined.result.isError, false);
		assert.equal(empty.result.isError, true);
		assert.equal(unknownTool.result.isError, true);
		assert.equal(unknownMethod.error.code, -32601);
	}
});

test("F18 hooks and server: per-host wiring, the same shipped scripts, and a records server config each host loads", () => {
	const expected = { claude: ["PostToolUse", "PreToolUse", "SessionEnd", "Stop", "UserPromptSubmit"], codex: ["PostToolUse", "SessionEnd", "Stop", "UserPromptSubmit"] };
	for (const host of HOSTS) {
		const root = pluginRoot(host);
		const hooks = JSON.parse(readFileSync(join(root, "hooks/hooks.json"), "utf8")).hooks;
		assert.deepEqual(Object.keys(hooks).sort(), expected[host], host);
		for (const [event, groups] of Object.entries(hooks)) {
			assert.equal(groups.length, 1, `${host} ${event}`);
			const [hook] = groups[0].hooks;
			assert.match(hook.command, new RegExp(`/scripts/scenarios-stop-hook\\.mjs" ${host}$`), `${host} ${event}`);
		}
		assert.ok(existsSync(join(root, "skills/developing-features/scripts/record-tools.mjs")), `${host} ships record-tools.mjs`);
	}
	// Claude: the PostToolUse matcher names the edit tools, Skill and this plugin's full MCP prefix;
	// a bare server name never matches.
	const matcher = new RegExp(`^(?:${JSON.parse(readFileSync(join(pluginRoot("claude"), "hooks/hooks.json"), "utf8")).hooks.PostToolUse[0].matcher})$`);
	for (const name of ["Write", "Edit", "MultiEdit", "Skill", "mcp__plugin_hobin-feature_hobin_feature__init", "mcp__plugin_hobin-feature_hobin_feature__decline"]) assert.ok(matcher.test(name), name);
	for (const name of ["Bash", "Read", "mcp__hobin_feature__init", "mcp__plugin_other_hobin_feature__init"]) assert.ok(!matcher.test(name), name);
	// Codex hooks every tool: its shell tool name is not documented; the script decides.
	assert.equal(JSON.parse(readFileSync(join(pluginRoot("codex"), "hooks/hooks.json"), "utf8")).hooks.PostToolUse[0].matcher, undefined);

	const claudeMcp = JSON.parse(readFileSync(join(pluginRoot("claude"), ".mcp.json"), "utf8")).mcpServers;
	assert.deepEqual(claudeMcp, { hobin_feature: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/scripts/records-mcp-server.mjs"] } });
	// Codex: the manifest names .mcp.json; a relative cwd resolves against the plugin root and must
	// stay inside it; the legacy format expands no ${...}; timeouts are explicit.
	const codexRoot = pluginRoot("codex");
	const manifest = JSON.parse(readFileSync(join(codexRoot, ".codex-plugin/plugin.json"), "utf8"));
	assert.equal(manifest.mcpServers, "./.mcp.json");
	const codexMcp = JSON.parse(readFileSync(join(codexRoot, manifest.mcpServers), "utf8")).mcpServers;
	assert.deepEqual(Object.keys(codexMcp), ["hobin_feature"]);
	const server = codexMcp.hobin_feature;
	assert.doesNotMatch(JSON.stringify(server), /\$\{/);
	const cwd = isAbsolute(server.cwd) ? server.cwd : join(codexRoot, server.cwd);
	assert.ok(!relative(codexRoot, cwd).startsWith(".."), "cwd stays within the plugin root");
	assert.equal(server.command, "node");
	assert.ok(existsSync(join(cwd, server.args[0])), "the server script resolves from cwd");
	assert.equal(typeof server.startup_timeout_sec, "number");
	assert.equal(typeof server.tool_timeout_sec, "number");
	assert.equal(server.default_tools_approval_mode, "approve", "Codex never asks before these local record tools");

	for (const file of ["scenarios-stop-hook.mjs", "records-mcp-server.mjs"]) {
		assert.equal(readFileSync(join(pluginRoot("claude"), "scripts", file), "utf8"), readFileSync(join(codexRoot, "scripts", file), "utf8"), file);
	}
	const hook = readFileSync(join(pluginRoot("claude"), "scripts/scenarios-stop-hook.mjs"), "utf8");
	assert.doesNotMatch(hook, /findFiles|mtime|spawnSync|execSync|tool_response\)\s*\{|parseMarkers|hobin-feature-record/, "no shell, output, tree or git inference is left in the hook");
	for (const file of [hook, ...["records.mjs", "scenarios.mjs", "record-tools.mjs"].map((name) => readFileSync(join(coreScripts, name), "utf8"))]) {
		assert.doesNotMatch(file, /CLAUDE_CODE_SESSION_ID|CODEX_THREAD_ID|process\.pid|hobin-feature-record:/, "no session id, pid or output marker");
	}
	assert.doesNotMatch(readFileSync(join(coreScripts, "record-tools.mjs"), "utf8"), /child_process/, "the record tools execute no command");
});

test("F32 claude: PreToolUse allows exactly this plugin's four record tools without a prompt; nothing else, and nothing on Codex", () => {
	const cwd = workspace();
	const claude = session("claude", cwd);
	const preMatcher = new RegExp(`^(?:${JSON.parse(readFileSync(join(pluginRoot("claude"), "hooks/hooks.json"), "utf8")).hooks.PreToolUse[0].matcher})$`);
	for (const tool of ["init", "register", "check", "decline"]) {
		const name = `${TOOL_PREFIX.claude}${tool}`;
		assert.ok(preMatcher.test(name), name);
		const result = claude.run({ hook_event_name: "PreToolUse", tool_name: name, tool_input: { path: join(cwd, "acceptance-scenarios.json") } });
		assert.equal(result.status, 0);
		assert.deepEqual(JSON.parse(result.stdout).hookSpecificOutput, { hookEventName: "PreToolUse", permissionDecision: "allow",
			permissionDecisionReason: "hobin-feature record tool: reads or creates a record file only, runs no command" }, name);
	}
	for (const name of ["Bash", "Write", `${TOOL_PREFIX.claude}run`, `${TOOL_PREFIX.claude}init_all`, `${TOOL_PREFIX.codex}init`, "mcp__plugin_other_hobin_feature__init"]) {
		assert.ok(!preMatcher.test(name) || name.startsWith(TOOL_PREFIX.claude), name);
		const result = claude.run({ hook_event_name: "PreToolUse", tool_name: name, tool_input: {} });
		assert.equal(result.stdout, "", name);
	}
	const codex = session("codex", cwd);
	assert.equal(codex.run({ hook_event_name: "PreToolUse", tool_name: `${TOOL_PREFIX.codex}init`, tool_input: {} }).stdout, "");
	assert.equal(claude.stop().status, 0, "allowing a call registers nothing by itself");
});

const RUN_WORDING = /a scenarios\.mjs run started at \S+ \(last progress \S+\) has not finished; if it is still running wait for it, do not start another; if it stopped, run it again\./;

for (const host of HOSTS) test(`F29 ${host}: a run killed midway leaves verification.run and running results, and Stop and check report it; a finished run clears it`, async () => {
	const cwd = workspace();
	const record = JSON.parse(readFileSync(COMPLETE, "utf8"));
	record.scenarios = record.scenarios.map((scenario, i) => ({ ...scenario, check: i === 0 ? "sleep 30" : "true" }));
	record.verification = { ...record.verification, existing_tests: "true" };
	const path = put(cwd, "acceptance-scenarios.json", JSON.stringify(record));
	const s = session(host, cwd);
	s.wrote("acceptance-scenarios.json");
	const child = spawn("node", [join(coreScripts, "scenarios.mjs"), "run", path], { cwd, stdio: "ignore", env: cleanEnv() });
	const deadline = Date.now() + 10_000;
	while (!JSON.parse(readFileSync(path, "utf8")).verification?.run) {
		assert.ok(Date.now() < deadline, "the run records itself before its first check");
		await new Promise((done) => setTimeout(done, 50));
	}
	const exited = new Promise((done) => child.on("exit", done));
	child.kill("SIGKILL");
	await exited;

	const killed = JSON.parse(readFileSync(path, "utf8"));
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
	const again = script("scenarios.mjs", ["run", path], cwd);
	assert.equal(again.status, 0, again.stderr);
	assert.equal(JSON.parse(readFileSync(path, "utf8")).verification.run, undefined);
	assert.equal(s.stop().status, 0);
});
