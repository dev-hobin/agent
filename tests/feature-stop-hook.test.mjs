// The hobin-feature hook gates the records this session registered and, once the session started
// developing-features, asks for one. Nothing is inferred from shell text or the file tree: the
// obligation comes from fixed identifiers (Claude's Skill tool and slash prompt, a Codex
// $developing-features prompt or a read of this plugin's SKILL.md), registration from the record
// scripts themselves (session id from CLAUDE_CODE_SESSION_ID / CODEX_THREAD_ID) and from edit tools'
// exact file paths. Each test is named after the acceptance scenario it checks
// (docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json) and runs on both hosts' inputs:
// Claude edit tools carry tool_input.file_path, Codex edits arrive as apply_patch text, and a
// shell command arrives as tool_input.command (a string on Claude, an argv array here for Codex).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { SESSION_ENV, runMarkerPath } from "../core/developing-features/scripts/records.mjs";

const HOSTS = ["claude", "codex"];
const pluginRoot = (host) => join(repositoryRoot, host === "claude" ? "claude/plugins" : "codex/plugins", "hobin-feature");
const coreScripts = join(repositoryRoot, "core/developing-features/scripts");
const TEMPLATE = join(repositoryRoot, "core/developing-features/assets/acceptance-scenarios.json");
const COMPLETE = join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json");
const CONTROL = join(repositoryRoot, "core/developing-features/scenarios/job-lookup-cancel");
const SESSION_VAR = { claude: "CLAUDE_CODE_SESSION_ID", codex: "CODEX_THREAD_ID" };

const workspace = () => mkdtempSync(join(tmpdir(), "feature-hook-"));
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

// The environment without any host session id: these tests run inside agent sessions, and a script
// that saw the real id would register fixtures into that session's ledger.
function cleanEnv(extra = {}) {
	const env = { ...process.env };
	for (const name of SESSION_ENV) delete env[name];
	delete env.CLAUDE_PROJECT_DIR;
	return { ...env, ...extra };
}

// A record script run as a command in a session would run it (`session` given) or outside any session.
const script = (name, args, cwd, sessionEnv = {}) =>
	spawnSync("node", [join(coreScripts, name), ...args], { cwd, encoding: "utf8", env: cleanEnv(sessionEnv) });

// One session as the host would drive the hook: JSON on stdin, the plugin root in the environment.
function session(host, cwd, tag = "s") {
	const id = newSession(`${host}-${tag}`);
	const root = pluginRoot(host);
	const run = (input) => {
		const result = spawnSync("node", [join(root, "scripts/scenarios-stop-hook.mjs")], {
			input: JSON.stringify({ session_id: id, cwd, ...input }),
			encoding: "utf8", env: cleanEnv({ CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root }),
		});
		return { status: result.status, stderr: result.stderr };
	};
	const env = { [SESSION_VAR[host]]: id };
	return {
		id, run, env,
		stop: (extra = {}) => run({ hook_event_name: "Stop", ...extra }),
		prompt: (prompt) => run({ hook_event_name: "UserPromptSubmit", prompt }),
		skill: (skill) => run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill } }),
		// A shell command the host reports to PostToolUse (Codex hooks every tool there).
		shellPost: (command) => run({ hook_event_name: "PostToolUse", tool_name: host === "claude" ? "Bash" : "shell",
			tool_input: { command: host === "claude" ? command : ["bash", "-lc", command] } }),
		// The host's way of starting developing-features in this session.
		start: () => host === "claude"
			? run({ hook_event_name: "PostToolUse", tool_name: "Skill", tool_input: { skill: "hobin-feature:developing-features" } })
			: run({ hook_event_name: "UserPromptSubmit", prompt: "$developing-features add quiet hours" }),
		// A record script run as a command inside this session (the host passes the session id).
		script: (name, args, dir = cwd) => script(name, args, dir, env),
		// A shell command inside this session; the hook does not look at it.
		sh: (command, dir = cwd) => spawnSync("bash", ["-c", command], { cwd: dir, encoding: "utf8", env: cleanEnv(env) }),
		wrote: (file) => run(host === "claude"
			? { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: join(cwd, file) } }
			: { hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } }),
		patch: (text) => run({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: text } }),
		edited: (file, tool = "Edit") => run({ hook_event_name: "PostToolUse", tool_name: tool, tool_input: { file_path: join(cwd, file) } }),
	};
}

// The job-lookup-cancel golden project. `plans` moves the control decision record and its
// baseline into a planning folder, so evidence paths (src/lookup.js:10) resolve only against the
// project root, not against the record's own folder.
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


for (const host of HOSTS) test(`F5 ${host}: a record another session registers is not this session's`, () => {
	const cwd = workspace();
	const mine = session(host, cwd, "mine");
	const other = session(host, cwd, "other");
	assert.equal(other.script("scenarios.mjs", ["init", "docs/acceptance-scenarios.json"]).status, 0);
	const result = mine.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
	assert.equal(other.stop().status, 2, "the other session's own Stop gates it");
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

for (const host of HOSTS) test(`F7 ${host}: a record created by scenarios.mjs init after a cd out of the hook cwd is registered and gated`, () => {
	const cwd = workspace();
	const elsewhere = workspace();
	const s = session(host, cwd);
	const init = s.sh(`cd "${elsewhere}" && node "${join(coreScripts, "scenarios.mjs")}" init docs/plans/acceptance-scenarios-z.json`);
	assert.equal(init.status, 0, init.stderr);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.ok(result.stderr.includes(`${join(elsewhere, "docs/plans/acceptance-scenarios-z.json")}: Scenario S1`), result.stderr);
});

for (const host of HOSTS) test(`F8 ${host}: init refuses to overwrite, and a file name that is not a record`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, "acceptance-scenarios.json", COMPLETE);
	const again = s.script("scenarios.mjs", ["init", "acceptance-scenarios.json"]);
	assert.equal(again.status, 1);
	assert.match(again.stderr, /already exists; init never overwrites/);
	assert.equal(readFileSync(join(cwd, "acceptance-scenarios.json"), "utf8"), readFileSync(COMPLETE, "utf8"));
	assert.equal(s.script("scenarios.mjs", ["init", "notes.json"]).status, 2);
	assert.equal(existsSync(join(cwd, "notes.json")), false);
});

for (const host of HOSTS) test(`F9 ${host}: run and check register the record they are given, and only that one`, () => {
	const cwd = workspace();
	put(cwd, "a/acceptance-scenarios.json", TEMPLATE);
	put(cwd, "b/acceptance-scenarios.json", TEMPLATE);
	const s = session(host, cwd);
	s.script("scenarios.mjs", ["check", "a/acceptance-scenarios.json"]);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /\/a\/acceptance-scenarios\.json: Scenario S1/);
	assert.doesNotMatch(result.stderr, /\/b\/acceptance-scenarios\.json/);

	const t = session(host, cwd, "walk");
	t.script("scenarios.mjs", ["check"]);
	assert.equal(t.stop().status, 0, "a walk without a record path registers nothing");
});

for (const host of HOSTS) test(`F15 ${host}: without a session id the record scripts register nothing`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	assert.equal(script("scenarios.mjs", ["init", "acceptance-scenarios.json"], cwd).status, 0);
	assert.equal(s.stop().status, 0);
	const declined = script("scenarios.mjs", ["decline", "--reason", "copy fix"], cwd);
	assert.equal(declined.status, 1);
	assert.match(declined.stderr, /No session id \(CLAUDE_CODE_SESSION_ID or CODEX_THREAD_ID\)/);
});

for (const host of HOSTS) test(`F17 ${host}: compile-control-model.mjs with a record path registers the control decision record`, () => {
	const parent = workspace();
	const child = join(parent, "child");
	mkdirSync(join(child, ".git"), { recursive: true });
	controlProject(child, { gatePasses: false });
	const s = session(host, parent);
	s.script("compile-control-model.mjs", ["--gate", "control-decisions.json"], child);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /control-decisions\.json: .*finding same-events:COMPLETED\|FAILED is not acknowledged/);
});

for (const host of HOSTS) test(`F20 ${host}: a check run by scenarios.mjs run does not register what it touches`, () => {
	const cwd = workspace();
	const record = JSON.parse(readFileSync(COMPLETE, "utf8"));
	record.scenarios = [{ ...record.scenarios[0], check: `node scripts/init-fixture.mjs` }];
	record.verification = { ...record.verification, existing_tests: "true" };
	put(cwd, "acceptance-scenarios.json", JSON.stringify(record));
	put(cwd, "scripts/init-fixture.mjs", `import { spawnSync } from "node:child_process";\nprocess.exit(spawnSync("node", [${JSON.stringify(join(coreScripts, "scenarios.mjs"))}, "init", "fixture/acceptance-scenarios-f.json"]).status);\n`);
	const s = session(host, cwd);
	const run = s.script("scenarios.mjs", ["run", "acceptance-scenarios.json"]);
	assert.equal(run.status, 0, run.stderr);
	assert.ok(existsSync(join(cwd, "fixture/acceptance-scenarios-f.json")), "the check ran");
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
});

for (const host of HOSTS) test(`F22 ${host}: after the skill starts, a record written only by a shell program does not count; Stop asks for one`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	s.sh(`mkdir -p docs && cp "${COMPLETE}" docs/acceptance-scenarios.json`);
	s.shellPost(`mkdir -p docs && cp "${COMPLETE}" docs/acceptance-scenarios.json`);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /developing-features started in this session \(.+\) but no acceptance-scenario record is registered/);
	assert.match(result.stderr, /scenarios\.mjs" init <path>\/acceptance-scenarios-<name>\.json/);
	assert.match(result.stderr, /decline --reason/);

	assert.equal(s.script("scenarios.mjs", ["check", "docs/acceptance-scenarios.json"]).status, 0);
	assert.equal(s.stop().status, 0, "registering the record releases the obligation");
});

for (const host of HOSTS) test(`F23 ${host}: a decline with a reason releases the obligation and reports the reason; an empty reason is rejected`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	for (const args of [["decline"], ["decline", "--reason"], ["decline", "--reason", "   "]]) {
		const rejected = s.script("scenarios.mjs", args);
		assert.equal(rejected.status, 2, args.join(" "));
		assert.match(rejected.stderr, /Usage: scenarios\.mjs decline --reason/);
	}
	assert.equal(s.stop().status, 2, "no decline was recorded");
	const declined = s.script("scenarios.mjs", ["decline", "--reason", "one-line copy fix, no behavior to scenario"]);
	assert.equal(declined.status, 0, declined.stderr);
	const result = s.stop();
	assert.equal(result.status, 0);
	assert.match(result.stderr, /declined an acceptance-scenario record: one-line copy fix, no behavior to scenario/);
});

for (const host of HOSTS) test(`F24 ${host}: a decline does not exempt a record the session registered`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.start();
	s.script("scenarios.mjs", ["init", "acceptance-scenarios.json"]);
	s.script("scenarios.mjs", ["decline", "--reason", "changed my mind"]);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /acceptance-scenarios\.json: Scenario S1/);
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

test("F18 hooks: UserPromptSubmit, PostToolUse (edit tools; Skill on Claude) and Stop run the same shipped script on both hosts", () => {
	for (const host of HOSTS) {
		const root = pluginRoot(host);
		const hooks = JSON.parse(readFileSync(join(root, "hooks/hooks.json"), "utf8")).hooks;
		assert.deepEqual(Object.keys(hooks).sort(), ["PostToolUse", "Stop", "UserPromptSubmit"], host);
		for (const [event, groups] of Object.entries(hooks)) {
			assert.equal(groups.length, 1, `${host} ${event}`);
			const [hook] = groups[0].hooks;
			assert.match(hook.command, /\/scripts\/scenarios-stop-hook\.mjs"$/, `${host} ${event}`);
		}
		const matcher = hooks.PostToolUse[0].matcher;
		if (host === "claude") {
			assert.deepEqual(matcher.split("|").sort(), ["Edit", "MultiEdit", "Skill", "Write"], "no shell command is watched on Claude");
		} else {
			// Codex's shell tool name is not documented; the script decides by the input's shape.
			assert.equal(matcher, undefined);
		}
		assert.ok(existsSync(join(root, "skills/developing-features/scripts/records.mjs")), `${host} ships records.mjs`);
	}
	assert.equal(readFileSync(join(pluginRoot("claude"), "scripts/scenarios-stop-hook.mjs"), "utf8"), readFileSync(join(pluginRoot("codex"), "scripts/scenarios-stop-hook.mjs"), "utf8"));
	const hook = readFileSync(join(pluginRoot("claude"), "scripts/scenarios-stop-hook.mjs"), "utf8");
	assert.doesNotMatch(hook, /PreToolUse|findFiles|statSync|mtime|spawnSync/, "no shell, tree or git inference is left in the hook");
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

for (const host of HOSTS) test(`F29 ${host}: Stop tells a run still in progress from an interrupted one`, () => {
	const cwd = workspace();
	const record = JSON.parse(readFileSync(COMPLETE, "utf8"));
	for (const scenario of record.scenarios) scenario.status = "running";
	const path = put(cwd, "acceptance-scenarios.json", JSON.stringify(record));
	const marker = runMarkerPath(path);
	const s = session(host, cwd);
	s.wrote("acceptance-scenarios.json");
	try {
		writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: "2026-11-06T00:00:00.000Z" }));
		const live = s.stop();
		assert.equal(live.status, 2, "a running record still blocks");
		assert.match(live.stderr, new RegExp(`scenarios\\.mjs run is still running \\(pid ${process.pid}, started 2026-11-06T00:00:00\\.000Z\\); wait for it to finish, do not start another`));

		const gone = spawnSync("node", ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
		writeFileSync(marker, JSON.stringify({ pid: Number(gone.stdout), startedAt: "2026-11-06T00:00:00.000Z" }));
		const dead = s.stop();
		assert.equal(dead.status, 2);
		assert.match(dead.stderr, /a scenarios\.mjs run on this record was interrupted before it finished; run it again/);
		assert.doesNotMatch(dead.stderr, /still running/);

		rmSync(marker, { force: true });
		assert.match(s.stop().stderr, /was interrupted before it finished/, "no marker at all reads as interrupted");
	} finally {
		rmSync(marker, { force: true });
	}
});
