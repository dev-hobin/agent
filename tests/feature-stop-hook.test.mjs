// The hobin-feature hook decides which records are the session's from the session's own tool
// calls (a ledger), checks only those on Stop, and never crashes on the file tree. Each test is
// named after the acceptance scenario it checks
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

const HOSTS = ["claude", "codex"];
const pluginRoot = (host) => join(repositoryRoot, host === "claude" ? "claude/plugins" : "codex/plugins", "hobin-feature");
const coreScripts = join(repositoryRoot, "core/developing-features/scripts");
const TEMPLATE = join(repositoryRoot, "core/developing-features/assets/acceptance-scenarios.json");
const COMPLETE = join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json");
const CONTROL = join(repositoryRoot, "core/developing-features/scenarios/job-lookup-cancel");

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

// One session as the host would drive the hook: JSON on stdin, the plugin root in the environment.
function session(host, cwd, tag = "s") {
	const id = newSession(`${host}-${tag}`);
	const transcript = join(workspace(), "transcript.jsonl");
	writeFileSync(transcript, "");
	let call = 0;
	const run = (input) => {
		const { CLAUDE_PROJECT_DIR: _, ...env } = process.env;
		const root = pluginRoot(host);
		const result = spawnSync("node", [join(root, "scripts/scenarios-stop-hook.mjs")], {
			input: JSON.stringify({ session_id: id, transcript_path: transcript, cwd, ...input }),
			encoding: "utf8", env: { ...env, CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root },
		});
		return { status: result.status, stderr: result.stderr };
	};
	const shellInput = (command, id_) => ({
		tool_name: host === "claude" ? "Bash" : "shell", ...(id_ && { tool_use_id: id_ }),
		tool_input: { command: host === "claude" ? command : ["bash", "-lc", command] },
	});
	return {
		id, run,
		stop: (extra = {}) => run({ hook_event_name: "Stop", ...extra }),
		wrote: (file) => run(host === "claude"
			? { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: join(cwd, file) } }
			: { hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } }),
		patch: (text) => run({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: text } }),
		edited: (file, tool = "Edit") => run({ hook_event_name: "PostToolUse", tool_name: tool, tool_input: { file_path: join(cwd, file) } }),
		// The stamp file a PreToolUse leaves for call `useId` (the hook's temp naming).
		stampFile: (useId) => join(tmpdir(), `hobin-feature-pre-${id.replace(/[^\w-]/g, "")}-${useId}`),
		// A shell command: PreToolUse, the command itself (or `during`), PostToolUse.
		// Claude reports a command that exited non-zero as PostToolUseFailure.
		shell: (command, { pre = true, during, withId = true } = {}) => {
			const useId = withId ? `toolu_${call++}` : undefined;
			if (pre) run({ hook_event_name: "PreToolUse", ...shellInput(command, useId) });
			const failed = during ? (during(), false) : spawnSync("bash", ["-c", command], { cwd, encoding: "utf8" }).status !== 0;
			const event = failed && host === "claude" ? "PostToolUseFailure" : "PostToolUse";
			return run({ hook_event_name: event, ...shellInput(command, useId) });
		},
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

const script = (name, args, cwd) => spawnSync("node", [join(coreScripts, name), ...args], { cwd, encoding: "utf8" });

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

for (const host of HOSTS) test(`F5 ${host}: a record another session changed during this session is not this session's`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	put(cwd, "other-repo/docs/acceptance-scenarios.json", TEMPLATE);
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stderr, "");
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

for (const host of HOSTS) test(`F7 ${host}: a record copied by a shell command is the session's, even after a cd`, () => {
	const cwd = workspace();
	const s = session(host, cwd);
	s.shell(`mkdir -p docs/plans && cp "${TEMPLATE}" docs/plans/acceptance-scenarios-x.json`);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /docs\/plans\/acceptance-scenarios-x\.json: Scenario S1/);
	assert.doesNotMatch(result.stderr, /assets\/acceptance-scenarios\.json/, "the template outside the project is not the session's");

	const other = workspace();
	mkdirSync(join(other, "docs/plans"), { recursive: true });
	const t = session(host, other);
	t.shell(`cd docs && cp "${TEMPLATE}" plans/acceptance-scenarios-y.json`);
	const moved = t.stop();
	assert.equal(moved.status, 2);
	assert.match(moved.stderr, /docs\/plans\/acceptance-scenarios-y\.json: Scenario S1/);
});

for (const host of HOSTS) test(`F8 ${host}: a record a shell command only reads is not the session's`, () => {
	const cwd = workspace();
	age(put(cwd, "docs/acceptance-scenarios.json", TEMPLATE));
	const s = session(host, cwd);
	s.shell("cat docs/acceptance-scenarios.json > /dev/null");
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`F9 ${host}: scenarios.mjs run without a path adds only the records it rewrote`, () => {
	const cwd = workspace();
	age(put(cwd, "a/acceptance-scenarios.json", TEMPLATE));
	age(put(cwd, "b/acceptance-scenarios.json", TEMPLATE));
	const s = session(host, cwd);
	s.shell(`cd a && node "${join(coreScripts, "scenarios.mjs")}" run`);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /\/a\/acceptance-scenarios\.json: Scenario S1/);
	assert.doesNotMatch(result.stderr, /\/b\/acceptance-scenarios\.json/);
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

for (const host of HOSTS) test(`F15 ${host}: a shell command that names no record adds nothing, whatever changes meanwhile`, () => {
	const cwd = workspace();
	age(put(cwd, "acceptance-scenarios.json", COMPLETE));
	const s = session(host, cwd);
	s.shell("ls", { during: () => cpSync(TEMPLATE, join(cwd, "acceptance-scenarios.json")) });
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`F16 ${host}: no session id, or no ledger, leaves Stop alone`, () => {
	const cwd = workspace();
	put(cwd, "acceptance-scenarios.json", TEMPLATE);
	const s = session(host, cwd);
	assert.equal(s.stop({ session_id: undefined }).status, 0);
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`F17 ${host}: without a PreToolUse stamp only named records changed in the session count`, () => {
	const cwd = workspace();
	age(put(cwd, "old/acceptance-scenarios.json", TEMPLATE));
	const s = session(host, cwd);
	put(cwd, "new/acceptance-scenarios.json", TEMPLATE);
	s.shell("cat old/acceptance-scenarios.json new/acceptance-scenarios.json > /dev/null", { pre: false });
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /\/new\/acceptance-scenarios\.json/);
	assert.doesNotMatch(result.stderr, /\/old\/acceptance-scenarios\.json/);
});

test("F18 hooks: PreToolUse (shell), PostToolUse (edit tools and shell), PostToolUseFailure (Claude) and Stop run the same shipped script on both hosts", () => {
	for (const host of HOSTS) {
		const root = pluginRoot(host);
		const hooks = JSON.parse(readFileSync(join(root, "hooks/hooks.json"), "utf8")).hooks;
		// Codex documents no PostToolUseFailure; Claude sends a failed command there, not to PostToolUse.
		const events = host === "claude" ? ["PostToolUse", "PostToolUseFailure", "PreToolUse", "Stop"] : ["PostToolUse", "PreToolUse", "Stop"];
		assert.deepEqual(Object.keys(hooks).sort(), events, host);
		for (const [event, groups] of Object.entries(hooks)) {
			assert.equal(groups.length, 1, `${host} ${event}`);
			const [hook] = groups[0].hooks;
			assert.match(hook.command, /\/scripts\/scenarios-stop-hook\.mjs"$/, `${host} ${event}`);
		}
		const matcher = (event) => hooks[event][0].matcher;
		if (host === "claude") {
			assert.match(matcher("PreToolUse"), /\bBash\b/);
			assert.match(matcher("PostToolUseFailure"), /\bBash\b/);
			for (const tool of ["Write", "Edit", "MultiEdit", "Bash"]) assert.ok(matcher("PostToolUse").split("|").includes(tool), `claude PostToolUse matches ${tool}`);
		} else {
			// Codex's shell tool name is not documented; the script decides by the input's shape.
			assert.equal(matcher("PreToolUse"), undefined);
			assert.equal(matcher("PostToolUse"), undefined);
		}
		assert.ok(existsSync(join(root, "skills/developing-features/scripts/records.mjs")), `${host} ships records.mjs`);
	}
	assert.equal(readFileSync(join(pluginRoot("claude"), "scripts/scenarios-stop-hook.mjs"), "utf8"), readFileSync(join(pluginRoot("codex"), "scripts/scenarios-stop-hook.mjs"), "utf8"));
});

for (const host of HOSTS) test(`F20 ${host}: a shell command that rewrites a record and then fails still adds it`, () => {
	const cwd = workspace();
	age(put(cwd, "docs/acceptance-scenarios.json", COMPLETE));
	const s = session(host, cwd);
	// scenarios.mjs run records a failing check and exits 1.
	const broken = JSON.parse(readFileSync(COMPLETE, "utf8"));
	broken.scenarios[0].check = "exit 3";
	writeFileSync(join(cwd, "docs/acceptance-scenarios.json"), JSON.stringify(broken));
	age(join(cwd, "docs/acceptance-scenarios.json"));
	const post = s.shell(`node "${join(coreScripts, "scenarios.mjs")}" run docs/acceptance-scenarios.json`);
	assert.equal(post.status, 0);
	const result = s.stop();
	assert.equal(result.status, 2);
	assert.match(result.stderr, /docs\/acceptance-scenarios\.json: Scenario \S+: status is "fail"/);
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

for (const host of HOSTS) test(`F22 ${host}: an unreadable stamp, or a call without an id, falls back to named records only`, () => {
	// An empty stamp file (a partial write) is no stamp: no walk, and an old named record does not count.
	const cwd = workspace();
	age(put(cwd, "old/acceptance-scenarios.json", TEMPLATE));
	const s = session(host, cwd);
	writeFileSync(s.stampFile("toolu_0"), "");
	s.shell("cat old/acceptance-scenarios.json > /dev/null", { pre: false, during: () => put(cwd, "other/acceptance-scenarios.json", TEMPLATE) });
	const empty = s.stop();
	assert.equal(empty.status, 0, empty.stderr);

	// Without tool_use_id no stamp is written or read, so a record another session changes meanwhile
	// under the cwd is not this call's.
	const other = workspace();
	const t = session(host, other);
	t.shell("node scenarios.mjs check --help > /dev/null 2>&1", { withId: false, during: () => put(other, "theirs/acceptance-scenarios.json", TEMPLATE) });
	const noId = t.stop();
	assert.equal(noId.status, 0, noId.stderr);
});

test("F19 skill: every scenarios.mjs run/check and --gate the procedure names passes the record path", () => {
	for (const host of HOSTS) {
		const text = readFileSync(join(pluginRoot(host), "skills/developing-features/SKILL.md"), "utf8");
		const commands = [...text.matchAll(/scenarios\.mjs (?:run|check)[^`\n]*|compile-control-model\.mjs --gate[^`\n]*/g)].map((m) => m[0]);
		assert.ok(commands.length >= 3, `${host}: ${commands}`);
		for (const command of commands) assert.match(command, / <record>$/, `${host}: ${command}`);
	}
});
