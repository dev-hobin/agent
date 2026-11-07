// Test files make temporary directories only inside their per-run root (tests/temp-root.mjs),
// which is removed when the file's tests finish; a direct mkdtemp on the OS temp directory is
// left behind whenever a test forgets, or fails before, its cleanup.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { tempRoot } from "./temp-root.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("test files make temporary directories only through tempRoot", () => {
	const offenders = readdirSync(here).filter((f) => f.endsWith(".test.mjs"))
		.filter((f) => /\bmkdtemp(Sync)?\s*\(/.test(readFileSync(join(here, f), "utf8")));
	assert.deepEqual(offenders, [], "make temporary directories with tempRoot(import.meta.url).dir() from tests/temp-root.mjs, not mkdtemp/mkdtempSync, so the file's root removes them");
});

test("tempRoot puts directories and TMPDIR inside one root", () => {
	const temp = tempRoot(import.meta.url);
	const dir = temp.dir("probe");
	assert.ok(dir.startsWith(`${temp.root}/`) && existsSync(dir));
	assert.equal(process.env.TMPDIR, temp.root);
});
