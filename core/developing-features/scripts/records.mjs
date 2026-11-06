// Finds record files (acceptance-scenarios*.json, control-decisions*.json) under a directory.
// Shared by scenarios.mjs, compile-control-model.mjs, and the plugin hooks so every caller sees
// the same set. Symbolic links are not followed: a link to an ancestor would never end (ELOOP)
// and a dangling one cannot be read (ENOENT). An entry that cannot be read is skipped, so one
// unreadable directory never hides the records elsewhere. Dot directories are searched (records
// often live in planning folders such as .plans/); node_modules and .git* are not.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
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
