// Record files (acceptance-scenarios*.json, control-decisions*.json) and the plugin hook's session
// state. findFiles finds records under a directory for scenarios.mjs and
// compile-control-model.mjs, so both see the same set. Symbolic links are not followed: a link to an ancestor would never end (ELOOP)
// and a dangling one cannot be read (ENOENT). An entry that cannot be read is skipped, so one
// unreadable directory never hides the records elsewhere. Dot directories are searched (records
// often live in planning folders such as .plans/); node_modules and .git* are not.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const SCENARIO_RECORD = /^acceptance-scenarios.*\.json$/;
export const CONTROL_RECORD = /^control-decisions.*\.json$/;
export const RECORD = /^(acceptance-scenarios|control-decisions).*\.json$/;

const skipped = (name) => name === "node_modules" || name.startsWith(".git");

// Paths (joined onto `dir`) of the regular files under `dir` whose name matches `pattern`.
export function findFiles(pattern, dir = ".") {
	let entries;
	try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
	return entries.flatMap((entry) => {
		if (skipped(entry.name) || entry.isSymbolicLink()) return [];
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return findFiles(pattern, path);
		if (!pattern.test(entry.name)) return [];
		if (entry.isFile()) return [path];
		// Some file systems report no type; ask once, without following a link.
		try { return lstatSync(path).isFile() ? [path] : []; } catch { return []; }
	});
}

// The nearest ancestor of `dir` (itself included) that holds .git, or undefined. A record is
// checked against its repository: evidence paths such as src/lookup.js:10 resolve there.
export function gitRoot(dir) {
	for (let d = resolve(dir); ; d = dirname(d)) {
		if (existsSync(join(d, ".git"))) return d;
		if (d === dirname(d)) return undefined;
	}
}

// The plugin hook's session state: the session's start directory, the obligation
// (developing-features started) and the Stop block counter. Only the hook reads and writes it, in the
// host's persistent plugin data directory (CLAUDE_PLUGIN_DATA on Claude Code; PLUGIN_DATA or
// CLAUDE_PLUGIN_DATA on Codex), or the OS temp directory when the host gives none (tests, older hosts).
const KINDS = ["start", "obligation", "stop"];
const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
export const stateDir = (env = process.env) =>
	join(env.CLAUDE_PLUGIN_DATA || env.PLUGIN_DATA || tmpdir(), "hobin-feature-sessions");
export function sessionStatePath(kind, session) {
	mkdirSync(stateDir(), { recursive: true });
	return join(stateDir(), `${kind}-${safe(session)}`);
}

export function rememberStart(session, dir) {
	writeFileSync(sessionStatePath("start", session), resolve(dir));
}
export function readStart(session) {
	try { return readFileSync(sessionStatePath("start", session), "utf8").trim() || undefined; } catch { return undefined; }
}

export function startObligation(session, source) {
	writeFileSync(sessionStatePath("obligation", session), JSON.stringify({ source, at: new Date().toISOString() }));
}

const readJson = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } };
export const readObligation = (session) => readJson(sessionStatePath("obligation", session));

// SessionEnd: the session's state is no longer needed.
export function clearSession(session) {
	for (const kind of KINDS) rmSync(sessionStatePath(kind, session), { force: true });
}

// State of sessions that never sent SessionEnd (killed, crashed) is removed after a week.
export function pruneSessions(maxAgeMs = 7 * 24 * 60 * 60 * 1000, now = Date.now()) {
	let names;
	try { names = readdirSync(stateDir()); } catch { return; }
	for (const name of names) {
		const path = join(stateDir(), name);
		try { if (now - statSync(path).mtimeMs > maxAgeMs) rmSync(path, { force: true }); } catch {}
	}
}
