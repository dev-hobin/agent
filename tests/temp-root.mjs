// One temporary root per test file. Every directory the file's tests make lives inside it
// (temp.dir), and so does TMPDIR for the rest of the process and the commands it starts, so
// code under test that calls os.tmpdir() writes there too. The root is removed when the file's
// tests finish, also when they fail. tests/temp-root.test.mjs keeps test files from calling
// mkdtemp on the OS temp directory directly.
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { after } from "node:test";
import { fileURLToPath } from "node:url";

export function tempRoot(moduleUrl) {
	// Real path: a command's cwd is resolved through links (/var is /private/var on macOS).
	const root = realpathSync(mkdtempSync(join(tmpdir(), `${basename(fileURLToPath(moduleUrl), ".test.mjs")}-`)));
	process.env.TMPDIR = root;
	after(() => rmSync(root, { recursive: true, force: true }));
	return { root, dir: (prefix = "dir") => mkdtempSync(join(root, `${prefix}-`)) };
}
