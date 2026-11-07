// hookSession (core/shared/scripts/session-registry.mjs): the session lifecycle every hook shares —
// the start directory, the files an edit tool wrote on each host, SessionStart/UserPromptSubmit/
// SessionEnd/Stop, and the session's state in the plugin data directory. The hooks' own tests
// (feature-stop-hook, result-hooks-registry) drive the same code through the shipped hooks.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { tempRoot } from "./temp-root.mjs";

const temp = tempRoot(import.meta.url);
const { hookSession, registryPath } = await import(pathToFileURL(join(repositoryRoot, "core/shared/scripts/session-registry.mjs")).href);

const NAME = ".probe";
const workspace = () => temp.dir("hook-session");
let counter = 0;
const newId = () => `s-${process.pid}-${counter++}`;
const EIGHT_DAYS_AGO = Date.now() / 1000 - 8 * 24 * 3600;

// One hook call: the host's input and the hook's environment (plugin data per host).
function call(host, data, input, extra = {}) {
	const env = host === "claude" ? { CLAUDE_PLUGIN_DATA: data, ...extra } : { PLUGIN_DATA: data, ...extra };
	return hookSession(input, { name: NAME, host, env });
}

for (const host of ["claude", "codex"]) test(`${host}: the start directory is the SessionStart cwd, and a later event's cwd never moves it`, () => {
	const data = workspace();
	const start = workspace();
	const other = workspace();
	const id = newId();
	const first = call(host, data, { session_id: id, cwd: start, hook_event_name: "SessionStart" });
	assert.equal(first.begin(), registryPath({ name: NAME, sessionId: id, startDir: start }));
	assert.equal(readFileSync(join(start, NAME, ".gitignore"), "utf8"), "*\n");
	for (const event of ["UserPromptSubmit", "PostToolUse", "Stop"]) {
		const later = call(host, data, { session_id: id, cwd: other, hook_event_name: event }, { CLAUDE_PROJECT_DIR: other });
		assert.equal(later.start(), start, event);
	}
	assert.equal(existsSync(join(other, NAME)), false);
});

test("claude: a missed SessionStart falls back to CLAUDE_PROJECT_DIR, remembered from then on", () => {
	const data = workspace();
	const project = workspace();
	const id = newId();
	const sub = join(project, "sub");
	mkdirSync(sub);
	const prompt = call("claude", data, { session_id: id, cwd: sub, hook_event_name: "UserPromptSubmit" }, { CLAUDE_PROJECT_DIR: project });
	assert.equal(prompt.start(), project);
	prompt.ensure();
	assert.ok(existsSync(registryPath({ name: NAME, sessionId: id, startDir: project })));
	assert.equal(existsSync(join(sub, NAME)), false);
	const later = call("claude", data, { session_id: id, cwd: workspace(), hook_event_name: "Stop" }, { CLAUDE_PROJECT_DIR: workspace() });
	assert.equal(later.start(), project, "remembered, not the next event's project directory or cwd");
});

test("codex: a missed SessionStart falls back to the event cwd (never CLAUDE_PROJECT_DIR), remembered from then on", () => {
	const data = workspace();
	const cwd = workspace();
	const id = newId();
	const prompt = call("codex", data, { session_id: id, cwd, hook_event_name: "UserPromptSubmit" }, { CLAUDE_PROJECT_DIR: workspace() });
	assert.equal(prompt.start(), cwd);
	assert.equal(call("codex", data, { session_id: id, cwd: workspace(), hook_event_name: "Stop" }).start(), cwd);
});

test("without a session id: the project directory, no state, no registry", () => {
	const data = workspace();
	const cwd = workspace();
	const s = call("claude", data, { cwd, hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "a.md" } });
	assert.equal(s.id, undefined);
	assert.equal(s.start(), cwd);
	assert.deepEqual(s.registered(), []);
	s.registerFiles([join(cwd, "a.md")]);
	assert.deepEqual(readdirSync(data), []);
	assert.equal(existsSync(join(cwd, NAME)), false);
});

test("claude edit tools: Write, Edit and MultiEdit tool_input.file_path, resolved against the event cwd; other tools nothing", () => {
	const cwd = workspace();
	const edited = (tool_name, tool_input) => call("claude", cwd, { session_id: newId(), cwd, hook_event_name: "PostToolUse", tool_name, tool_input }).editedFiles();
	assert.deepEqual(edited("Write", { file_path: "docs/a.md" }), [join(cwd, "docs/a.md")]);
	assert.deepEqual(edited("Edit", { file_path: "/abs/b.md" }), ["/abs/b.md"]);
	assert.deepEqual(edited("MultiEdit", { file_path: "c.md", edits: [] }), [join(cwd, "c.md")]);
	assert.deepEqual(edited("Write", { file_path: "" }), []);
	assert.deepEqual(edited("Write", {}), []);
	assert.deepEqual(edited("Bash", { command: "echo > d.md", file_path: "d.md" }), []);
	assert.deepEqual(edited("Read", { file_path: "e.md" }), []);
});

test("codex apply_patch: Add File, Update File and Move to paths (string or argv command), once each; not Delete File or other tools", () => {
	const cwd = workspace();
	const patch = [
		"*** Begin Patch",
		"*** Add File: new.md", "+x",
		"*** Update File: docs/old.md", "*** Move to: docs/moved.md", "@@", "-a", "+b",
		"*** Update File: new.md", "@@", "+y",
		"*** Delete File: gone.md",
		"*** End Patch", "",
	].join("\n");
	const edited = (tool_name, command) => call("codex", cwd, { session_id: newId(), cwd, hook_event_name: "PostToolUse", tool_name, tool_input: { command } }).editedFiles();
	const expected = [join(cwd, "new.md"), join(cwd, "docs/old.md"), join(cwd, "docs/moved.md")];
	assert.deepEqual(edited("apply_patch", patch), expected);
	assert.deepEqual(edited("apply_patch", ["apply_patch", patch]), expected);
	assert.deepEqual(edited("shell", ["bash", "-lc", patch]), [], "only apply_patch is an edit tool");
	assert.deepEqual(edited("apply_patch", undefined), []);
});

for (const host of ["claude", "codex"]) test(`${host} lifecycle: begin, ensure never truncates, registerFiles, blocks, end clears the registry and state kinds`, () => {
	const data = workspace();
	const start = workspace();
	const id = newId();
	const at = (event, extra = {}) => call(host, data, { session_id: id, cwd: start, hook_event_name: event, ...extra });
	at("SessionStart").begin();
	const registry = registryPath({ name: NAME, sessionId: id, startDir: start });
	at("PostToolUse").registerFiles([join(start, "a.md"), join(start, "b.md")]);
	at("UserPromptSubmit").ensure();
	assert.deepEqual(at("Stop").registered(), [join(start, "a.md"), join(start, "b.md")]);
	at("PostToolUse").registerFiles([]);
	assert.equal(readFileSync(registry, "utf8").split("\n").filter(Boolean).length, 2);

	const stop = at("Stop");
	assert.equal(stop.blocks(), 0);
	stop.block();
	stop.block();
	assert.equal(at("Stop").blocks(), 2, "the counter outlives one hook call");
	at("Stop").unblock();
	assert.equal(at("Stop").blocks(), 0);
	at("Stop").block();
	writeFileSync(at("PostToolUse").statePath("extra"), "{}");
	const stateDir = join(data, "probe-sessions");
	assert.deepEqual(readdirSync(stateDir).sort(), [`extra-${id}`, `start-${id}`, `stop-${id}`]);

	at("SessionEnd", { cwd: workspace() }).end("extra");
	assert.equal(existsSync(registry), false, "removed from the remembered start directory, not the event cwd");
	assert.deepEqual(readdirSync(stateDir), []);
});

test("end without a remembered start directory removes no registry and creates no state", () => {
	const data = workspace();
	const cwd = workspace();
	const id = newId();
	const s = call("claude", data, { session_id: id, cwd, hook_event_name: "SessionEnd" }, { CLAUDE_PROJECT_DIR: cwd });
	s.end();
	assert.equal(existsSync(join(data, "probe-sessions", `start-${id}`)), false);
	assert.equal(existsSync(join(cwd, NAME)), false);
});

test("prune removes week-old state and registries in the start directory and keeps fresh ones; pruneState leaves registries", () => {
	const data = workspace();
	const start = workspace();
	const id = newId();
	call("codex", data, { session_id: id, cwd: start, hook_event_name: "SessionStart" }).begin();
	const stateDir = join(data, "probe-sessions");
	const sessions = join(start, NAME, "sessions");
	const put = (dir, file, stale) => { const path = join(dir, file); writeFileSync(path, ""); if (stale) utimesSync(path, EIGHT_DAYS_AGO, EIGHT_DAYS_AGO); return path; };
	const staleState = put(stateDir, "start-stale", true);
	const freshState = put(stateDir, "start-fresh", false);
	const staleRegistry = put(sessions, "stale.jsonl", true);
	const freshRegistry = put(sessions, "fresh.jsonl", false);

	call("codex", data, { session_id: id, cwd: start, hook_event_name: "SessionEnd" }).pruneState();
	assert.equal(existsSync(staleState), false);
	assert.ok(existsSync(staleRegistry), "pruneState touches no registry");
	const again = put(stateDir, "stop-stale", true);

	call("codex", data, { session_id: id, cwd: workspace(), hook_event_name: "Stop" }).prune();
	assert.equal(existsSync(again), false);
	assert.equal(existsSync(staleRegistry), false, "pruned in the remembered start directory");
	for (const path of [freshState, freshRegistry, registryPath({ name: NAME, sessionId: id, startDir: start })]) assert.ok(existsSync(path), path);
});

test("state lives in CLAUDE_PLUGIN_DATA, else PLUGIN_DATA, else the OS temp directory, under <name without its dot>-sessions", () => {
	const claude = workspace();
	const codex = workspace();
	const cwd = workspace();
	const id = newId();
	const input = { session_id: id, cwd, hook_event_name: "SessionStart" };
	assert.equal(hookSession(input, { name: NAME, host: "codex", env: { CLAUDE_PLUGIN_DATA: claude, PLUGIN_DATA: codex } }).statePath("start"), join(claude, "probe-sessions", `start-${id}`));
	assert.equal(hookSession(input, { name: NAME, host: "codex", env: { PLUGIN_DATA: codex } }).statePath("start"), join(codex, "probe-sessions", `start-${id}`));
	assert.equal(hookSession(input, { name: NAME, host: "claude", env: {} }).statePath("start"), join(tmpdir(), "probe-sessions", `start-${id}`));
	rmSync(join(tmpdir(), "probe-sessions"), { recursive: true, force: true });
});
