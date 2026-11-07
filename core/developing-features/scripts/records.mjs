// Record files (acceptance-scenarios*.json, control-decisions*.json). findFiles finds records under
// a directory for scenarios.mjs and compile-control-model.mjs, so both see the same set. Symbolic links are not followed: a link to an ancestor would never end (ELOOP)
// and a dangling one cannot be read (ENOENT). An entry that cannot be read is skipped, so one
// unreadable directory never hides the records elsewhere. Dot directories are searched (records
// often live in planning folders such as .plans/); node_modules and .git* are not.
import { existsSync, lstatSync, readdirSync } from "node:fs";
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
