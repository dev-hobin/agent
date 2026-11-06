// Finds record files (acceptance-scenarios*.json, control-decisions*.json) under a directory.
// Shared by scenarios.mjs, compile-control-model.mjs, and the plugin hooks so every caller sees
// the same set. Symbolic links are not followed: a link to an ancestor would never end (ELOOP)
// and a dangling one cannot be read (ENOENT). An entry that cannot be read is skipped, so one
// unreadable directory never hides the records elsewhere. Dot directories are searched (records
// often live in planning folders such as .plans/); node_modules and .git* are not.
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

// Output protocol. The record tools print one line per record they handled and the reason of a
// decline; the plugin hook reads these lines from the tool output it is given (PostToolUse
// tool_response) and keeps its own ledger. Nothing is shared between the command and the hook but
// that output: no environment variable, no file in a common temp directory.
export const RECORD_MARKER = "hobin-feature-record:";
export const DECLINE_MARKER = "hobin-feature-decline:";
const MARKER_LINE = /^hobin-feature-(record|decline): (.*\S)\s*$/gm;

export const recordLine = (recordPath) => `${RECORD_MARKER} ${resolve(recordPath)}`;
// A reason is one line: a newline would end the marker.
export const declineLine = (reason) => `${DECLINE_MARKER} ${String(reason).replace(/\s+/g, " ").trim()}`;

// The marker lines in `text`: absolute record paths and decline reasons, in order. A marker must
// start its line; the hook further checks that a path exists and names a record file.
export function parseMarkers(text) {
	const records = [];
	const declines = [];
	for (const [, kind, value] of String(text ?? "").matchAll(MARKER_LINE)) (kind === "record" ? records : declines).push(value.trim());
	return { records, declines };
}

// Output of a command run by `scenarios.mjs run`, made safe to re-print: its marker lines no longer
// start a line, so fixtures a check creates are never registered as the session's records.
export const neutralizeMarkers = (text) => String(text ?? "").replace(/^(hobin-feature-(?:record|decline):)/gm, "(from a check) $1");

// The hook's own session state, in the hook process's temp directory; only the hook reads and
// writes it: the ledger of registered records, the obligation (developing-features started) and
// the decline reason.
const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
export const sessionStatePath = (kind, session) => join(tmpdir(), `hobin-feature-${kind}-${safe(session)}`);

export function registerRecord(recordPath, session) {
	appendFileSync(sessionStatePath("ledger", session), `${resolve(recordPath)}\n`);
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
