// The result hooks (review, stances, learning) share hook-input.mjs and check exactly the files in
// the session registry, <start dir>/.hobin-<name>/sessions/<session_id>.jsonl. The hook creates it at
// SessionStart (UserPromptSubmit when missing) and remembers the start directory; the skills' scripts
// (check-report.mjs new|check, stances.mjs check, output-contract.mjs new|check) find it from their
// working directory upward with the agent session id the host gives shell commands and append the
// file, or stop when there is none; edit tools register the results they write. Nothing is inferred
// from shell text, command output, file times or transcripts. Each test is named after the acceptance
// scenario it checks (docs/plans/acceptance-scenarios-result-hooks-ledger.json) and runs on both
// hosts' inputs, for every plugin where the scenario is about results in general.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";

const HOSTS = ["claude", "codex"];
const SESSION_VAR = { claude: "CLAUDE_CODE_SESSION_ID", codex: "CODEX_SESSION_ID" };
const pluginRoot = (host, plugin) => join(repositoryRoot, host === "claude" ? "claude/plugins" : "codex/plugins", plugin);
// Real paths: a command's cwd is resolved through links (/var is /private/var on macOS).
const workspace = () => realpathSync(mkdtempSync(join(tmpdir(), "result-hook-")));
const DATA = workspace();
test.after(() => rmSync(DATA, { recursive: true, force: true }));
let counter = 0;
const lines = (path) => readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));

const contract = JSON.parse(readFileSync(join(repositoryRoot, "core/conceptualize/assets/output-contract.json"), "utf8"));
const marker = `<!-- output-contract: ${contract.id} -->`;
const stancesGolden = readFileSync(join(repositoryRoot, "core/applying-stances/scenarios/agents-md-overlap/golden/PROPOSAL.md"), "utf8");
const conceptGolden = readFileSync(join(repositoryRoot, "core/conceptualize/scenarios/retry-notes/golden/out/concept.md"), "utf8");

// Each plugin: its hook, the script that registers results (and the arguments that make or check
// one), a valid and an invalid result, and what its problem looks like.
const PLUGINS = [
	{ plugin: "hobin-review", name: "review", hook: "report-hook.mjs", file: "REVIEW.md",
		script: (root) => join(root, "skills/reviewing-code/scripts/check-report.mjs"),
		make: (root, file) => ["new", file], check: (root, file) => [file],
		good: "[P1] wrong total — src/x.js:2\n  Scenario: s\n  Evidence: e\n", bad: "[P1] wrong total — src/x.js:99\n", problem: /line 99 does not exist/ },
	{ plugin: "hobin-stances", name: "stances", hook: "stances-hook.mjs", file: "PROPOSAL.md",
		script: (root) => join(root, "skills/applying-stances/scripts/stances.mjs"),
		make: null, check: (root, file) => ["check", file],
		good: stancesGolden, bad: stancesGolden.replace("+<!-- /hobin-stances -->", "+- Always use tabs.\n+<!-- /hobin-stances -->"), problem: /Not a stance from assets\/stances\.md/ },
	{ plugin: "hobin-learning", name: "learning", hook: "output-contract-hook.mjs", file: "concept.md",
		script: (root) => [join(root, "scripts/output-contract.mjs"), join(root, "skills/conceptualize/scripts/output-contract.mjs")].find(existsSync),
		make: (root, file) => ["new", join(root, "skills/conceptualize/assets/output-contract.json"), file],
		check: (root, file) => ["check", join(root, "skills/conceptualize/assets/output-contract.json"), file],
		good: `${marker}\n\n${conceptGolden}`, bad: `${marker}\n\n${contract.skeleton}`, problem: /does not meet the .* output contract/ },
];
const [REVIEW, STANCES, LEARNING] = PLUGINS;
const NO_REGISTRY = (kind) => new RegExp(`^No ${kind.plugin} registry for this agent session above \\S+\\. .*pass --no-gate`, "m");

// A project the review hook can check: its reports cite src/x.js (three lines).
function project() {
	const dir = workspace();
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src/x.js"), "a\nb\nc\n");
	return dir;
}
function put(dir, file, text) {
	mkdirSync(join(dir, file, ".."), { recursive: true });
	writeFileSync(join(dir, file), text);
	return join(dir, file);
}

// The environment without this test run's own agent session (the suite may run inside one).
function cleanEnv(extra = {}) {
	const env = { ...process.env };
	for (const name of ["CLAUDE_PROJECT_DIR", "CLAUDE_PLUGIN_DATA", "PLUGIN_DATA", "NODE_TEST_CONTEXT", ...Object.values(SESSION_VAR)]) delete env[name];
	return { ...env, ...extra };
}

// One session of one plugin as the host drives it, started in `start` (SessionStart unless
// `started: false`): hook calls get JSON on stdin with the plugin root and data directory in the
// environment and the host on the command line, as hooks.json does; scripts run in the session's
// shell get the host's session variable. TMPDIR changes on every hook call.
function session(host, kind, start, { started = true, hookPath, hookEnv = {} } = {}) {
	const id = `${host}-${kind.name}-${process.pid}-${Date.now()}-${counter++}`;
	const root = pluginRoot(host, kind.plugin);
	const data = host === "claude" ? { CLAUDE_PLUGIN_DATA: DATA } : { PLUGIN_DATA: DATA, CLAUDE_PLUGIN_DATA: DATA };
	const run = (input) => {
		const result = spawnSync("node", [hookPath ?? join(root, "scripts", kind.hook), host], {
			input: JSON.stringify({ session_id: id, cwd: start, ...input }),
			encoding: "utf8", env: cleanEnv({ CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root, ...data, TMPDIR: workspace(), ...hookEnv }),
		});
		return { status: result.status, stderr: result.stderr };
	};
	// The plugin's registering script run in this session's shell, from `cwd`.
	const scriptIn = (cwd, args, env = { [SESSION_VAR[host]]: id }) =>
		spawnSync("node", [kind.script(root), ...args], { cwd, encoding: "utf8", env: cleanEnv(env) });
	if (started) run({ hook_event_name: "SessionStart", source: "startup" });
	return {
		id, root, run, scriptIn,
		registry: join(start, `.hobin-${kind.name}`, "sessions", `${id}.jsonl`),
		stop: (extra = {}) => run({ hook_event_name: "Stop", ...extra }),
		end: () => run({ hook_event_name: "SessionEnd", reason: "exit" }),
		prompt: (extra = {}) => run({ hook_event_name: "UserPromptSubmit", prompt: "hello", ...extra }),
		// The plugin's starter (or, for stances, check of a written proposal) from `cwd`.
		make: (cwd, file, text = kind.bad) => {
			if (kind.make) return scriptIn(cwd, kind.make(root, file));
			mkdirSync(dirname(resolve(cwd, file)), { recursive: true });
			writeFileSync(resolve(cwd, file), text);
			return scriptIn(cwd, kind.check(root, file));
		},
		check: (cwd, file) => scriptIn(cwd, kind.check(root, file)),
		// An edit tool wrote `file` (relative to the session's cwd).
		wrote: (file, tool = "Write") => run(host === "claude"
			? { hook_event_name: "PostToolUse", tool_name: tool, tool_input: { file_path: join(start, file) } }
			: { hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } }),
		patch: (text) => run({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: text } }),
		shell: (command) => {
			spawnSync("bash", ["-c", command], { cwd: start, encoding: "utf8", env: cleanEnv({ [SESSION_VAR[host]]: id }) });
			return run({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command } });
		},
	};
}

for (const host of HOSTS) test(`R1 ${host}: SessionStart creates each plugin's registry in the start directory; UserPromptSubmit creates it when SessionStart was missed`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start);
		assert.equal(readFileSync(s.registry, "utf8"), "", kind.plugin);
		assert.equal(readFileSync(join(start, `.hobin-${kind.name}/.gitignore`), "utf8"), "*\n");

		const late = project();
		const elsewhere = project();
		const t = session(host, kind, late, { started: false, hookEnv: host === "claude" ? { CLAUDE_PROJECT_DIR: late } : {} });
		assert.equal(existsSync(t.registry), false);
		// Claude reports the model's current directory as the event cwd; the project directory wins.
		t.prompt(host === "claude" ? { cwd: elsewhere } : {});
		assert.equal(existsSync(t.registry), true, `${kind.plugin}: UserPromptSubmit`);
		assert.equal(existsSync(join(elsewhere, `.hobin-${kind.name}`)), false);
	}
});

for (const host of HOSTS) test(`R2 ${host}: the start directory is remembered; a later hook cwd (after cd) never moves the registry`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start);
		assert.equal(s.make(start, kind.file).status, kind.make ? 0 : 1, kind.plugin);
		const stop = s.stop({ cwd: join(start, "src") });
		assert.equal(stop.status, 2, `${kind.plugin}: ${stop.stderr}`);
		assert.equal(existsSync(join(start, "src", `.hobin-${kind.name}`)), false);
	}
});

for (const host of HOSTS) test(`R3 ${host}: the scripts register the result they make or check (from a subdirectory, in another directory too) and Stop blocks until it passes`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const other = join(workspace(), "elsewhere", kind.file);
		const s = session(host, kind, start);
		const made = s.make(join(start, "src"), join(start, kind.file));
		assert.match(made.stdout + made.stderr, /Registered for this session's Stop gate\./, kind.plugin);
		s.make(join(start, "src"), other);
		assert.deepEqual(lines(s.registry).map((l) => l.file), [join(start, kind.file), other], kind.plugin);
		assert.ok(lines(s.registry).every((l) => typeof l.at === "string"));
		const stop = s.stop();
		assert.equal(stop.status, 2, kind.plugin);
		assert.ok(stop.stderr.includes(`${join(start, kind.file)}:`) && stop.stderr.includes(`${other}:`), stop.stderr);
		writeFileSync(join(start, kind.file), kind.good);
		writeFileSync(other, kind.good);
		const done = s.stop();
		assert.equal(done.status, 0, `${kind.plugin}: ${done.stderr}`);
		// Checking a registered result again adds a line, never a second entry for Stop.
		assert.equal(s.check(start, join(start, kind.file)).status, 0, kind.plugin);
		assert.equal(new Set(lines(s.registry).map((l) => l.file)).size, 2);
	}
});

for (const host of HOSTS) test(`R4 ${host}: with a session id and no registry the scripts stop (exit 2), write and register nothing, and say why`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start, { started: false });
		const made = s.scriptIn(start, kind.make ? kind.make(s.root, "NEW.md") : kind.check(s.root, "NEW.md"));
		assert.equal(made.status, 2, kind.plugin);
		assert.match(made.stderr, NO_REGISTRY(kind));
		assert.equal(existsSync(join(start, "NEW.md")), false);
		put(start, kind.file, kind.good);
		const checked = s.check(start, kind.file);
		assert.equal(checked.status, 2, kind.plugin);
		assert.doesNotMatch(checked.stdout, /follows|valid|meets/);
		// A started session's registry is not found from outside its start directory.
		const t = session(host, kind, start);
		const away = workspace();
		assert.equal(t.scriptIn(away, kind.check(t.root, join(start, kind.file))).status, 2);
		assert.equal(readFileSync(t.registry, "utf8"), "");
	}
});

for (const host of HOSTS) test(`R5 ${host}: a person proceeds unregistered; --no-gate proceeds only where no registry is found and is refused where one is`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start);
		put(start, kind.file, kind.good);
		const person = s.scriptIn(start, kind.check(s.root, kind.file), {});
		assert.equal(person.status, 0, `${kind.plugin}: ${person.stderr}`);
		assert.equal(readFileSync(s.registry, "utf8"), "");
		const refused = s.scriptIn(start, [...(kind.make ? kind.make(s.root, "GATED.md") : kind.check(s.root, kind.file)), "--no-gate"]);
		assert.equal(refused.status, 2, kind.plugin);
		assert.match(refused.stderr, /--no-gate is refused: this session's .* hooks are active/);
		assert.equal(existsSync(join(start, "GATED.md")), false);
		assert.equal(readFileSync(s.registry, "utf8"), "");

		const t = session(host, kind, project(), { started: false });
		const ungated = t.scriptIn(start, [...kind.check(t.root, kind.file), "--no-gate"]);
		assert.equal(ungated.status, 0, `${kind.plugin}: ${ungated.stderr}`);
		assert.match(ungated.stdout, /--no-gate: no Stop gate covers this/);
		// Every session variable present is tried: Codex started from a Claude Code shell.
		const both = s.scriptIn(start, kind.check(s.root, kind.file), { CLAUDE_CODE_SESSION_ID: "outer-session", CODEX_SESSION_ID: s.id, [SESSION_VAR[host]]: s.id });
		assert.equal(both.status, 0, both.stderr);
		assert.equal(lines(s.registry).length, 1);
	}
});

for (const host of HOSTS) test(`R6 ${host}: edit tools register the results they write, check them at once, and leave other files out`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start);
		put(start, kind.file, kind.bad);
		const post = s.wrote(kind.file);
		assert.equal(post.status, 2, kind.plugin);
		assert.match(post.stderr, kind.problem);
		put(start, "notes.md", "hello\n");
		assert.equal(s.wrote("notes.md").status, 0);
		assert.deepEqual(lines(s.registry).map((l) => l.file), [join(start, kind.file)], kind.plugin);
	}
	// Every edit form: Claude Edit and MultiEdit; Codex Update File and Move to (not the source).
	const start = project();
	const s = session(host, REVIEW, start);
	put(start, "a/REVIEW.md", REVIEW.bad);
	put(start, "b/REVIEW.md", REVIEW.bad);
	put(start, "draft.md", REVIEW.bad);
	if (host === "claude") { s.wrote("a/REVIEW.md", "Edit"); s.wrote("b/REVIEW.md", "MultiEdit"); }
	else s.patch("*** Begin Patch\n*** Update File: a/REVIEW.md\n@@\n-x\n+y\n*** Update File: draft.md\n*** Move to: b/REVIEW.md\n@@\n-x\n+y\n*** End Patch\n");
	const files = lines(s.registry).map((l) => l.file);
	assert.ok(files.includes(join(start, "a/REVIEW.md")) && files.includes(join(start, "b/REVIEW.md")), files.join(", "));
	// A later write that makes a non-result a result registers it then.
	put(start, "notes.md", "hello\n");
	s.wrote("notes.md");
	writeFileSync(join(start, "notes.md"), REVIEW.bad);
	assert.equal(s.wrote("notes.md").status, 2);
	assert.ok(lines(s.registry).some((l) => l.file === join(start, "notes.md")));
});

for (const host of HOSTS) test(`R7 ${host}: Stop checks only this session's registry: unregistered results and another session's registry never gate`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const mine = session(host, kind, start);
		const theirs = session(host, kind, start);
		put(start, `fixtures/golden/${kind.file}`, kind.bad);
		put(start, `core/${kind.file}`, kind.bad);
		theirs.make(start, join(start, `theirs/${kind.file}`));
		assert.equal(theirs.stop().status, 2, kind.plugin);
		const stop = mine.stop();
		assert.equal(stop.status, 0, `${kind.plugin}: ${stop.stderr}`);
	}
});

for (const host of HOSTS) test(`R8 ${host}: a registered result that no longer exists is reported`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start);
		s.make(start, join(start, kind.file));
		rmSync(join(start, kind.file));
		const stop = s.stop();
		assert.equal(stop.status, 2, kind.plugin);
		assert.match(stop.stderr, /registered it as a result, but it no longer exists/);
	}
});

for (const host of HOSTS) test(`R9 ${host}: at most three blocks in a row; a fixed result passes and the count starts over`, () => {
	const start = project();
	const s = session(host, REVIEW, start);
	s.make(start, join(start, "REVIEW.md"));
	assert.deepEqual([s.stop().status, s.stop().status, s.stop().status, s.stop().status], [2, 2, 2, 0]);
	writeFileSync(join(start, "REVIEW.md"), REVIEW.good);
	assert.equal(s.stop().status, 0);
	writeFileSync(join(start, "REVIEW.md"), REVIEW.bad);
	assert.equal(s.stop().status, 2);
});

for (const host of HOSTS) test(`R10 ${host}: a check that throws exits 1, never 2`, () => {
	const start = project();
	const hookInput = join(pluginRoot(host, "hobin-review"), "scripts/hook-input.mjs");
	const hookPath = join(pluginRoot(host, "hobin-review"), "scripts", `throw-hook-${process.pid}-${counter++}.mjs`);
	writeFileSync(hookPath, `import { runHook } from ${JSON.stringify(pathToFileURL(hookInput).href)};\nawait runHook("throwtest", (file, text) => { if (text.includes("BOOM")) throw new Error("checker broke"); return null; });\n`);
	try {
		const s = session(host, { ...REVIEW, name: "throwtest" }, start, { hookPath });
		put(start, "x.md", "BOOM\n");
		const post = s.wrote("x.md");
		assert.equal(post.status, 1);
		assert.match(post.stderr, /internal error \(not a problem in the result/);
	} finally {
		rmSync(hookPath, { force: true });
	}
});

for (const host of HOSTS) test(`R11 ${host}: without a session id a written result is still checked, nothing is registered, and Stop exits 0`, () => {
	const start = project();
	const s = session(host, REVIEW, start, { started: false });
	put(start, "REVIEW.md", REVIEW.bad);
	const post = s.run(host === "claude"
		? { hook_event_name: "PostToolUse", session_id: undefined, tool_name: "Write", tool_input: { file_path: join(start, "REVIEW.md") } }
		: { hook_event_name: "PostToolUse", session_id: undefined, tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Add File: REVIEW.md\n+x\n*** End Patch\n" } });
	assert.equal(post.status, 2);
	assert.equal(existsSync(join(start, ".hobin-review")), false);
	assert.equal(s.stop({ session_id: undefined }).status, 0);
});

for (const host of HOSTS) test(`R12 ${host}: SessionEnd removes the registry and state; Stop prunes week-old registries and keeps fresh ones`, () => {
	for (const kind of PLUGINS) {
		const start = project();
		const s = session(host, kind, start);
		s.make(start, join(start, kind.file));
		s.stop();
		const state = join(DATA, `hobin-${kind.name}-sessions`);
		assert.ok(readdirSync(state).some((f) => f.endsWith(s.id.replace(/[^\w-]/g, ""))));
		s.end();
		assert.equal(existsSync(s.registry), false, kind.plugin);
		assert.equal(readdirSync(state).some((f) => f.endsWith(s.id.replace(/[^\w-]/g, ""))), false);

		const t = session(host, kind, start);
		const sessions = join(start, `.hobin-${kind.name}/sessions`);
		const old = put(sessions, "old-session.jsonl", "");
		const fresh = put(sessions, "fresh-session.jsonl", "");
		const weekAgo = Date.now() / 1000 - 8 * 24 * 3600;
		utimesSync(old, weekAgo, weekAgo);
		t.stop();
		assert.equal(existsSync(old), false, kind.plugin);
		assert.equal(existsSync(fresh), true);
		assert.equal(existsSync(t.registry), true);
	}
});

for (const host of HOSTS) test(`R13 ${host}: a result written only by a shell command, without the skill's script or an edit tool, is not inferred`, () => {
	const start = project();
	const s = session(host, REVIEW, start);
	const post = s.shell("cat > REVIEW.md <<'EOF'\n[P1] wrong total — src/x.js:99\nEOF");
	assert.equal(post.status, 0);
	assert.equal(readFileSync(s.registry, "utf8"), "");
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`R14 ${host}: stances.mjs block writes and registers nothing; the target is checked once step 5 runs check`, () => {
	const start = project();
	const s = session(host, STANCES, start);
	put(start, "AGENTS.md", "# Project\n");
	const block = s.scriptIn(start, ["block", "AGENTS.md"]);
	assert.equal(block.status, 0, block.stderr);
	assert.equal(readFileSync(join(start, "AGENTS.md"), "utf8"), "# Project\n");
	assert.equal(readFileSync(s.registry, "utf8"), "");
	assert.equal(s.stop().status, 0);
});

test("R15 hooks: every result plugin registers SessionStart, UserPromptSubmit, PostToolUse, Stop and SessionEnd with its own script and host; hook-input.mjs is one file; each plugin ships the registry module", () => {
	const shared = readFileSync(join(pluginRoot("claude", "hobin-review"), "scripts/hook-input.mjs"), "utf8");
	const registry = readFileSync(join(repositoryRoot, "core/shared/scripts/session-registry.mjs"), "utf8");
	for (const host of HOSTS) for (const kind of PLUGINS) {
		const root = pluginRoot(host, kind.plugin);
		assert.equal(readFileSync(join(root, "scripts/hook-input.mjs"), "utf8"), shared, `${host} ${kind.plugin}`);
		assert.equal(readFileSync(join(kind.script(root), "../session-registry.mjs"), "utf8"), registry, `${host} ${kind.plugin}`);
		const hooks = JSON.parse(readFileSync(join(root, "hooks/hooks.json"), "utf8")).hooks;
		assert.deepEqual(Object.keys(hooks).sort(), ["PostToolUse", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit"], `${host} ${kind.plugin}`);
		for (const [event, groups] of Object.entries(hooks)) {
			assert.equal(groups.length, 1);
			assert.ok(groups[0].hooks[0].command.endsWith(`/scripts/${kind.hook}" ${host}`), `${host} ${kind.plugin} ${event}`);
		}
		assert.equal(hooks.PostToolUse[0].matcher, host === "claude" ? "Write|Edit|MultiEdit" : undefined);
	}
	assert.doesNotMatch(shared, /PreToolUse|transcript_path|tool_use_id|git log|NAMED|ledger/);
});

test("R16 skills: the procedures start results from the scripts and never mention --no-gate", () => {
	for (const host of HOSTS) {
		const skill = (plugin, name) => readFileSync(join(pluginRoot(host, plugin), "skills", name, "SKILL.md"), "utf8");
		assert.match(skill("hobin-review", "reviewing-code"), /check-report\.mjs new <file>/);
		assert.match(skill("hobin-stances", "applying-stances"), /stances\.mjs check <proposal file>/);
		for (const name of ["conceptualize", "exercise", "opensource-reading", "patternize", "technical-reading"]) assert.match(skill("hobin-learning", name), /output-contract\.mjs new /);
		for (const [plugin, names] of [["hobin-review", ["reviewing-code"]], ["hobin-stances", ["applying-stances"]], ["hobin-learning", ["conceptualize", "exercise", "opensource-reading", "patternize", "technical-reading"]]]) {
			for (const name of names) assert.doesNotMatch(skill(plugin, name), /--no-gate/, `${host} ${plugin}/${name}`);
		}
	}
});

test("R17 scenario checks run the capability scripts without the agent session, so they never register or need a registry", () => {
	const dir = project();
	put(dir, "REVIEW.md", REVIEW.good);
	// A capability tree like core/review: scenarios/<id>/scenario.yaml and scripts/check-report.mjs.
	const capability = workspace();
	put(capability, "scenarios/probe/scenario.yaml", "id: probe\nexpect:\n  - id: report-format\n    script_passes:\n      script: scripts/check-report.mjs\n      args: [REVIEW.md]\n");
	for (const file of ["review/scripts/check-report.mjs", "shared/scripts/session-registry.mjs"]) {
		put(capability, `scripts/${file.split("/").pop()}`, readFileSync(join(repositoryRoot, "core", file), "utf8"));
	}
	const checker = join(repositoryRoot, ".agents/skills/implementing-core/scripts/scenario-check.mjs");
	const result = spawnSync("node", [checker, join(capability, "scenarios/probe/scenario.yaml"), dir, dir], { encoding: "utf8", env: cleanEnv({ CLAUDE_CODE_SESSION_ID: "a-session-without-registry" }) });
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /^pass report-format$/m);
	assert.equal(existsSync(join(dir, ".hobin-review")), false);
});
