// Finds record files (acceptance-scenarios*.json, control-decisions*.json) under a directory.
// Shared by scenarios.mjs, compile-control-model.mjs, and the plugin hooks so every caller sees
// the same set. Symbolic links are not followed: a link to an ancestor would never end (ELOOP)
// and a dangling one cannot be read (ENOENT). An entry that cannot be read is skipped, so one
// unreadable directory never hides the records elsewhere. Dot directories are searched (records
// often live in planning folders such as .plans/); node_modules and .git* are not.
import { createHash } from "node:crypto";
import { appendFileSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

// While `scenarios.mjs run` works on a record it leaves a marker in the temp directory, keyed by the
// record's absolute path: {pid, startedAt}. The run removes it when it ends; a run killed before
// that leaves the marker of a process that no longer exists. Hooks read it to tell a run still in
// progress from an interrupted one.
export function runMarkerPath(recordPath) {
	const key = createHash("sha256").update(resolve(recordPath)).digest("hex").slice(0, 16);
	return join(tmpdir(), `hobin-feature-run-${key}.json`);
}

function processAlive(pid) {
	try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

// The marker of the run on `recordPath`, with whether its process is still alive; null without one.
export function readRunMarker(recordPath) {
	let marker;
	try { marker = JSON.parse(readFileSync(runMarkerPath(recordPath), "utf8")); } catch { return null; }
	const pid = Number(marker?.pid);
	if (!Number.isInteger(pid) || pid <= 0) return null;
	return { pid, startedAt: String(marker.startedAt ?? ""), alive: processAlive(pid) };
}

// Session state shared by the plugin hook and the record scripts, all in the temp directory and
// named by the host's session id (the hook's `session_id`, which the host also gives commands as
// CLAUDE_CODE_SESSION_ID on Claude Code and CODEX_THREAD_ID on Codex):
// - ledger: the absolute paths of the records this session registered, one per line;
// - obligation: the session started developing-features (the hook writes it);
// - decline: the session declined writing a record, with the reason (scenarios.mjs decline).
export const SESSION_ENV = ["CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID"];
const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
export const sessionStatePath = (kind, session) => join(tmpdir(), `hobin-feature-${kind}-${safe(session)}`);

// The session id the host gave this command, read at call time; undefined outside a session.
export function sessionFromEnv(env = process.env) {
	for (const name of SESSION_ENV) if (typeof env[name] === "string" && env[name].trim()) return env[name].trim();
	return undefined;
}

// Adds `recordPath` to the session's ledger. Without a session id this is a no-op.
export function registerRecord(recordPath, session = sessionFromEnv()) {
	if (!session) return false;
	appendFileSync(sessionStatePath("ledger", session), `${resolve(recordPath)}\n`);
	return true;
}

export function readLedger(session) {
	try {
		return [...new Set(readFileSync(sessionStatePath("ledger", session), "utf8").split("\n").filter(Boolean))];
	} catch { return []; }
}

export function startObligation(session, source) {
	writeFileSync(sessionStatePath("obligation", session), JSON.stringify({ source, at: new Date().toISOString() }));
}

const readJson = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } };
export const readObligation = (session) => readJson(sessionStatePath("obligation", session));

export function recordDecline(session, reason) {
	writeFileSync(sessionStatePath("decline", session), JSON.stringify({ reason, at: new Date().toISOString() }));
}

// The session's decline, or null. A decline without a non-empty reason is not one.
export function readDecline(session) {
	const decline = readJson(sessionStatePath("decline", session));
	return typeof decline?.reason === "string" && decline.reason.trim() ? decline : null;
}
