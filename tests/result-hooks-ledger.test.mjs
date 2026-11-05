// The result hooks (review, stances, learning) share hook-input.mjs. They decide which results are
// the session's from the session's own tool calls (a ledger) and check only those on Stop. Each
// test is named after the acceptance scenario it checks
// (docs/plans/acceptance-scenarios-result-hooks-ledger.json) and runs on both hosts' inputs, and
// for every plugin where the scenario is about results in general.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";

const HOSTS = ["claude", "codex"];
const pluginRoot = (host, plugin) => join(repositoryRoot, host === "claude" ? "claude/plugins" : "codex/plugins", plugin);
const workspace = () => mkdtempSync(join(tmpdir(), "result-hook-"));
const HOUR_AGO = Date.now() / 1000 - 3600;
const age = (path) => utimesSync(path, HOUR_AGO, HOUR_AGO);
let counter = 0;

const contract = JSON.parse(readFileSync(join(repositoryRoot, "core/conceptualize/assets/output-contract.json"), "utf8"));
const marker = `<!-- output-contract: ${contract.id} -->`;
const stancesGolden = readFileSync(join(repositoryRoot, "core/applying-stances/scenarios/agents-md-overlap/golden/PROPOSAL.md"), "utf8");
const conceptGolden = readFileSync(join(repositoryRoot, "core/conceptualize/scenarios/retry-notes/golden/out/concept.md"), "utf8");

// Each plugin's result: a valid and an invalid text, and what its problem looks like.
const PLUGINS = [
	{ plugin: "hobin-review", script: "report-hook.mjs", file: "REVIEW.md",
		good: "[P1] wrong total — src/x.js:2\n  Scenario: s\n  Evidence: e\n", bad: "[P1] wrong total — src/x.js:99\n", problem: /line 99 does not exist/ },
	{ plugin: "hobin-stances", script: "stances-hook.mjs", file: "PROPOSAL.md",
		good: stancesGolden, bad: stancesGolden.replace("+<!-- /hobin-stances -->", "+- Always use tabs.\n+<!-- /hobin-stances -->"), problem: /Not a stance from assets\/stances\.md/ },
	{ plugin: "hobin-learning", script: "output-contract-hook.mjs", file: "concept.md",
		good: `${marker}\n\n${conceptGolden}`, bad: `${marker}\n\n${contract.skeleton}`, problem: /does not meet the .* output contract/ },
];
const [REVIEW] = PLUGINS;

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
// A file outside the project to copy from, so the command names only the target as Markdown.
function source(text) {
	const path = join(workspace(), "source.txt");
	writeFileSync(path, text);
	return path;
}

// One session of one plugin's hook as the host drives it.
function session(host, kind, cwd, { scriptPath } = {}) {
	const id = `${host}-${kind.plugin}-${process.pid}-${Date.now()}-${counter++}`;
	const transcript = join(workspace(), "transcript.jsonl");
	writeFileSync(transcript, "");
	let call = 0;
	const run = (input) => {
		const { CLAUDE_PROJECT_DIR: _, ...env } = process.env;
		const root = pluginRoot(host, kind.plugin);
		const result = spawnSync("node", [scriptPath ?? join(root, "scripts", kind.script)], {
			input: JSON.stringify({ session_id: id, transcript_path: transcript, cwd, ...input }),
			encoding: "utf8", env: { ...env, CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root },
		});
		return { status: result.status, stderr: result.stderr };
	};
	const shellInput = (command, useId) => ({
		tool_name: host === "claude" ? "Bash" : "shell", ...(useId && { tool_use_id: useId }),
		tool_input: { command: host === "claude" ? command : ["bash", "-lc", command] },
	});
	return {
		id, run,
		stop: (extra = {}) => run({ hook_event_name: "Stop", ...extra }),
		wrote: (file, tool = "Write") => run(host === "claude"
			? { hook_event_name: "PostToolUse", tool_name: tool, tool_input: { file_path: join(cwd, file) } }
			: { hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+...\n*** End Patch\n` } }),
		patch: (text) => run({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { command: text } }),
		stampFile: (useId) => join(tmpdir(), `hobin-${kind.name ?? kind.plugin.replace(/^hobin-/, "").replace("learning", "output-contract")}-pre-${id.replace(/[^\w-]/g, "")}-${useId}`),
		// PreToolUse, the command (or `during`), then PostToolUse, or PostToolUseFailure on Claude
		// when the command exits non-zero.
		shell: (command, { pre = true, during, withId = true } = {}) => {
			const useId = withId ? `toolu_${call++}` : undefined;
			if (pre) run({ hook_event_name: "PreToolUse", ...shellInput(command, useId) });
			const failed = during ? (during(), false) : spawnSync("bash", ["-c", command], { cwd, encoding: "utf8" }).status !== 0;
			return run({ hook_event_name: failed && host === "claude" ? "PostToolUseFailure" : "PostToolUse", ...shellInput(command, useId) });
		},
	};
}

for (const host of HOSTS) test(`R1 ${host}: results that appear without a tool call of the session (a checkout) are not checked`, () => {
	for (const kind of PLUGINS) {
		const cwd = project();
		const s = session(host, kind, cwd);
		put(cwd, `fixtures/golden/${kind.file}`, kind.bad);
		put(cwd, "core/SPEC.md", kind.bad);
		const result = s.stop();
		assert.equal(result.status, 0, `${kind.plugin}: ${result.stderr}`);
	}
});

for (const host of HOSTS) test(`R2 ${host}: another session's invalid report under the same folder is not this session's`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	put(cwd, "mine/REVIEW.md", REVIEW.good);
	s.wrote("mine/REVIEW.md");
	put(cwd, "theirs/REVIEW.md", REVIEW.bad);
	const result = s.stop();
	assert.equal(result.status, 0, result.stderr);
});

for (const host of HOSTS) test(`R3 ${host}: an invalid result written by an edit tool is sent back on PostToolUse and on Stop`, () => {
	for (const kind of PLUGINS) {
		const cwd = project();
		const s = session(host, kind, cwd);
		put(cwd, kind.file, kind.bad);
		const post = s.wrote(kind.file);
		assert.equal(post.status, 2, kind.plugin);
		assert.match(post.stderr, kind.problem);
		const stop = s.stop();
		assert.equal(stop.status, 2, kind.plugin);
		assert.match(stop.stderr, kind.problem);
	}
	// Every edit form: Claude Edit and MultiEdit; Codex Update File and Move to.
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	put(cwd, "a/REVIEW.md", REVIEW.bad);
	put(cwd, "b/REVIEW.md", REVIEW.bad);
	if (host === "claude") { s.wrote("a/REVIEW.md", "Edit"); s.wrote("b/REVIEW.md", "MultiEdit"); }
	else s.patch("*** Begin Patch\n*** Update File: a/REVIEW.md\n@@\n-x\n+y\n*** Update File: draft.md\n*** Move to: b/REVIEW.md\n@@\n-x\n+y\n*** End Patch\n");
	const stop = s.stop();
	assert.equal(stop.status, 2);
	assert.match(stop.stderr, /\/a\/REVIEW\.md:/);
	assert.match(stop.stderr, /\/b\/REVIEW\.md:/);
});

for (const host of HOSTS) test(`R4 ${host}: an invalid result written by a shell command is sent back on PostToolUse and on Stop`, () => {
	for (const kind of PLUGINS) {
		const cwd = project();
		const s = session(host, kind, cwd);
		const post = s.shell(`cp "${source(kind.bad)}" ${kind.file}`);
		assert.equal(post.status, 2, `${kind.plugin}: ${post.stderr}`);
		assert.match(post.stderr, kind.problem);
		const stop = s.stop();
		assert.equal(stop.status, 2, kind.plugin);
		assert.match(stop.stderr, kind.problem);
	}
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	s.shell("cat > REVIEW.md <<'EOF'\n[P1] wrong total — src/x.js:99\nEOF");
	assert.equal(s.stop().status, 2, "a here-document");
});

for (const host of HOSTS) test(`R5 ${host}: a report written after a cd is found by its call's walk`, () => {
	const cwd = project();
	mkdirSync(join(cwd, "docs"));
	const s = session(host, REVIEW, cwd);
	s.shell(`cd docs && cp "${source(REVIEW.bad)}" REVIEW.md`);
	const stop = s.stop();
	assert.equal(stop.status, 2);
	assert.match(stop.stderr, /\/docs\/REVIEW\.md:/);
});

for (const host of HOSTS) test(`R6 ${host}: a shell command that names no Markdown file is not inspected`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	const post = s.shell("ls", { during: () => put(cwd, "REVIEW.md", REVIEW.bad) });
	assert.equal(post.status, 0);
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`R7 ${host}: a report a shell command only reads is not the session's`, () => {
	const cwd = project();
	age(put(cwd, "REVIEW.md", REVIEW.bad));
	const s = session(host, REVIEW, cwd);
	assert.equal(s.shell("cat REVIEW.md > /dev/null").status, 0);
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`R8 ${host}: a dangling link or a locked folder no longer turns the check off`, { skip: process.getuid?.() === 0 && "root reads every directory" }, (t) => {
	const cwd = project();
	symlinkSync(join(cwd, "missing.md"), join(cwd, "dangling.md"));
	mkdirSync(join(cwd, "locked/inner"), { recursive: true });
	chmodSync(join(cwd, "locked"), 0o000);
	t.after(() => chmodSync(join(cwd, "locked"), 0o755));
	const s = session(host, REVIEW, cwd);
	assert.equal(s.shell(`cp "${source(REVIEW.bad)}" REVIEW.md`).status, 2);
	const stop = s.stop();
	assert.equal(stop.status, 2);
	assert.match(stop.stderr, REVIEW.problem);
});

for (const host of HOSTS) test(`R9 ${host}: at most three blocks in a row; a fixed report passes and the count starts over`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	put(cwd, "REVIEW.md", REVIEW.bad);
	s.wrote("REVIEW.md");
	assert.deepEqual([s.stop().status, s.stop().status, s.stop().status, s.stop().status], [2, 2, 2, 0]);
	writeFileSync(join(cwd, "REVIEW.md"), REVIEW.good);
	assert.equal(s.stop().status, 0);
	writeFileSync(join(cwd, "REVIEW.md"), REVIEW.bad);
	assert.equal(s.stop().status, 2);
});

for (const host of HOSTS) test(`R10 ${host}: without a usable stamp only named reports changed in the session count`, () => {
	const cases = [
		["no PreToolUse", (s, cmd, during) => s.shell(cmd, { pre: false, during })],
		["an empty stamp", (s, cmd, during) => { writeFileSync(s.stampFile("toolu_0"), ""); return s.shell(cmd, { pre: false, during }); }],
		["no tool_use_id", (s, cmd, during) => s.shell(cmd, { withId: false, during })],
	];
	for (const [name, call] of cases) {
		const cwd = project();
		age(put(cwd, "old/REVIEW.md", REVIEW.bad));
		const s = session(host, REVIEW, cwd);
		put(cwd, "new/REVIEW.md", REVIEW.bad);
		call(s, "cat old/REVIEW.md new/REVIEW.md > /dev/null", () => put(cwd, "theirs/REVIEW.md", REVIEW.bad));
		const stop = s.stop();
		assert.equal(stop.status, 2, name);
		assert.match(stop.stderr, /\/new\/REVIEW\.md:/, name);
		assert.doesNotMatch(stop.stderr, /\/old\/REVIEW\.md:|\/theirs\/REVIEW\.md:/, name);
	}
});

for (const host of HOSTS) test(`R11 ${host}: a recorded report that was deleted is dropped`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	put(cwd, "REVIEW.md", REVIEW.bad);
	s.wrote("REVIEW.md");
	rmSync(join(cwd, "REVIEW.md"));
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`R12 ${host}: a non-result is not recorded until a later write makes it a result`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	put(cwd, "notes.md", "hello\n");
	assert.equal(s.wrote("notes.md").status, 0);
	assert.equal(s.stop().status, 0);
	assert.equal(s.shell(`cp "${source(REVIEW.bad)}" notes.md`).status, 2);
	const stop = s.stop();
	assert.equal(stop.status, 2);
	assert.match(stop.stderr, /notes\.md:/);
});

for (const host of HOSTS) test(`R13 ${host}: a check that throws exits 1, never 2`, () => {
	const cwd = project();
	const hookInput = join(pluginRoot(host, "hobin-review"), "scripts/hook-input.mjs");
	const scriptPath = join(workspace(), "throw-hook.mjs");
	writeFileSync(scriptPath, `import { runHook } from ${JSON.stringify(pathToFileURL(hookInput).href)};\nawait runHook("throwtest", (file, text) => { if (text.includes("BOOM")) throw new Error("checker broke"); return null; });\n`);
	const s = session(host, { plugin: "hobin-review", name: "throwtest" }, cwd, { scriptPath });
	put(cwd, "x.md", "BOOM\n");
	const post = s.wrote("x.md");
	assert.equal(post.status, 1);
	assert.match(post.stderr, /internal error \(not a problem in the result/);
});

for (const host of HOSTS) test(`R14 ${host}: without a session id the written file is still checked; Stop exits 0`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	put(cwd, "REVIEW.md", REVIEW.bad);
	const post = s.run(host === "claude"
		? { hook_event_name: "PostToolUse", session_id: undefined, tool_name: "Write", tool_input: { file_path: join(cwd, "REVIEW.md") } }
		: { hook_event_name: "PostToolUse", session_id: undefined, tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Add File: REVIEW.md\n+x\n*** End Patch\n" } });
	assert.equal(post.status, 2);
	assert.equal(s.stop({ session_id: undefined }).status, 0);
});

for (const host of HOSTS) test(`R15 ${host}: a shell command that writes a report and then fails still records it`, () => {
	const cwd = project();
	const s = session(host, REVIEW, cwd);
	s.shell(`cp "${source(REVIEW.bad)}" REVIEW.md && exit 1`);
	const stop = s.stop();
	assert.equal(stop.status, 2);
	assert.match(stop.stderr, REVIEW.problem);
});

// Commits a checkout brings in were made before the session: date the fixtures' commit an hour back.
const PAST = { GIT_AUTHOR_DATE: new Date(Date.now() - 3600_000).toISOString(), GIT_COMMITTER_DATE: new Date(Date.now() - 3600_000).toISOString() };

// A git repository whose committed tree holds an invalid review fixture, as this repository's
// core/review/scenarios/*/golden/REVIEW.md look to the review check.
function gitProject() {
	const dir = project();
	put(dir, "core/review/scenarios/a/golden/REVIEW.md", REVIEW.bad);
	put(dir, "README.md", "readme\n");
	const git = (...args) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "init.defaultBranch=main", ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, ...PAST } });
	git("init", "-q");
	git("add", ".");
	git("commit", "-q", "-m", "fixtures");
	return dir;
}

for (const host of HOSTS) test(`R17 ${host}: the session's own checkout or worktree command records nothing it checked out`, () => {
	for (const command of ["git worktree add -q wt -b side && cat wt/README.md", "git checkout -q -b other && cat core/review/scenarios/a/golden/REVIEW.md > /dev/null"]) {
		const cwd = gitProject();
		const s = session(host, REVIEW, cwd);
		const post = s.shell(command);
		assert.equal(post.status, 0, `${command}: ${post.stderr}`);
		const stop = s.stop();
		assert.equal(stop.status, 0, `${command}: ${stop.stderr}`);
	}
});

for (const host of HOSTS) test(`R18 ${host}: a command naming one Markdown file does not claim another session's unnamed file`, () => {
	const cwd = project();
	age(put(cwd, "notes.md", "hello\n"));
	const s = session(host, REVIEW, cwd);
	const post = s.shell("cat notes.md > /dev/null", { during: () => put(cwd, "theirs/REVIEW.md", REVIEW.bad) });
	assert.equal(post.status, 0, post.stderr);
	assert.equal(s.stop().status, 0);
});

for (const host of HOSTS) test(`R19 ${host}: git words in a command's text do not exempt the result it writes`, () => {
	for (const command of [
		"cat > REVIEW.md <<'EOF'\n[P1] wrong total — src/x.js:99\n  Scenario: after git reset the total is stale\nEOF",
		`${"git -c user.email=t@example.com -c user.name=t"} commit -q --allow-empty -m "I am done" && cat > REVIEW.md <<'EOF'\n[P1] wrong total — src/x.js:99\nEOF`,
	]) {
		const cwd = gitProject();
		const s = session(host, REVIEW, cwd);
		assert.equal(s.shell(command).status, 2, command);
		assert.equal(s.stop().status, 2, command);
	}
});

for (const host of HOSTS) test(`R20 ${host}: a result written in the same command as a checkout is checked`, () => {
	const cwd = gitProject();
	const s = session(host, REVIEW, cwd);
	assert.equal(s.shell("git switch -q -c review && cat > REVIEW.md <<'EOF'\n[P1] wrong total — src/x.js:99\nEOF").status, 2, "a new file");
	const stop = s.stop();
	assert.equal(stop.status, 2);
	assert.match(stop.stderr, /\/REVIEW\.md:/);

	const other = gitProject();
	const t = session(host, REVIEW, other);
	const fixture = "core/review/scenarios/a/golden/REVIEW.md";
	assert.equal(t.shell(`git switch -q -c edit && cp "${source("[P1] other total — src/x.js:98\n")}" ${fixture}`).status, 2, "a tracked file the command changed");
	assert.equal(t.stop().status, 2);
});

for (const host of HOSTS) test(`R21 ${host}: a result written and committed in the same command is checked`, () => {
	const cwd = gitProject();
	const s = session(host, REVIEW, cwd);
	const post = s.shell("cat > REVIEW.md <<'EOF'\n[P1] wrong total — src/x.js:99\nEOF\ngit add REVIEW.md && git -c user.email=t@example.com -c user.name=t commit -qm review");
	assert.equal(post.status, 2, post.stderr);
	assert.equal(s.stop().status, 2);
});

test("R16 hooks: every result plugin registers the ledger events and runs its own script; hook-input.mjs is one file", () => {
	const shared = readFileSync(join(pluginRoot("claude", "hobin-review"), "scripts/hook-input.mjs"), "utf8");
	for (const host of HOSTS) for (const kind of PLUGINS) {
		const root = pluginRoot(host, kind.plugin);
		assert.equal(readFileSync(join(root, "scripts/hook-input.mjs"), "utf8"), shared, `${host} ${kind.plugin}`);
		const hooks = JSON.parse(readFileSync(join(root, "hooks/hooks.json"), "utf8")).hooks;
		const events = host === "claude" ? ["PostToolUse", "PostToolUseFailure", "PreToolUse", "Stop"] : ["PostToolUse", "PreToolUse", "Stop"];
		assert.deepEqual(Object.keys(hooks).sort(), events, `${host} ${kind.plugin}`);
		for (const [event, groups] of Object.entries(hooks)) {
			assert.equal(groups.length, 1);
			assert.ok(groups[0].hooks[0].command.endsWith(`/scripts/${kind.script}"`), `${host} ${kind.plugin} ${event}`);
		}
		const matcher = (event) => hooks[event][0].matcher;
		if (host === "claude") {
			assert.equal(matcher("PreToolUse"), "Bash");
			assert.equal(matcher("PostToolUse"), "Write|Edit|MultiEdit|Bash");
			assert.equal(matcher("PostToolUseFailure"), "Bash");
		} else {
			assert.equal(matcher("PreToolUse"), undefined);
			assert.equal(matcher("PostToolUse"), undefined);
		}
	}
});
