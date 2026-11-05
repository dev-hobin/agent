// Finds record files (acceptance-scenarios*.json, control-decisions*.json) under a directory.
// Shared by scenarios.mjs, compile-control-model.mjs, and the plugin hooks so every caller sees
// the same set. Symbolic links are not followed: a link to an ancestor would never end (ELOOP)
// and a dangling one cannot be read (ENOENT). An entry that cannot be read is skipped, so one
// unreadable directory never hides the records elsewhere. Dot directories are searched (records
// often live in planning folders such as .plans/); node_modules and .git* are not.
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
