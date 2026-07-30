import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
	notebookPathKindLabel,
	resolveNotebookPath,
} from "../src/notebook-path.ts";

describe("Observer Notebook path resolution", () => {
	const cwd = "/Users/test/coding/project";
	const home = "/Users/test";

	test("distinguishes absolute, cwd-relative, and home-relative input", () => {
		assert.deepEqual(resolveNotebookPath("/Volumes/notes", cwd, home), {
			ok: true,
			path: "/Volumes/notes",
			kind: "absolute",
		});
		assert.deepEqual(resolveNotebookPath("./notes/archive", cwd, home), {
			ok: true,
			path: join(cwd, "notes/archive"),
			kind: "cwd-relative",
		});
		assert.deepEqual(resolveNotebookPath("~/coding/archive", cwd, home), {
			ok: true,
			path: join(home, "coding/archive"),
			kind: "home-relative",
		});
		assert.deepEqual(resolveNotebookPath("~", cwd, home), {
			ok: true,
			path: home,
			kind: "home-relative",
		});
	});

	test("does not silently reinterpret unsupported tilde-user syntax", () => {
		const result = resolveNotebookPath("~someone/archive", cwd, home);
		assert.equal(result.ok, false);
		if (result.ok) assert.fail("Expected unsupported tilde-user syntax");
		assert.match(result.message, /~user paths are not expanded/u);
	});

	test("labels the interpretation shown before Notebook creation", () => {
		assert.equal(notebookPathKindLabel("absolute"), "Absolute path");
		assert.equal(
			notebookPathKindLabel("home-relative"),
			"Home-relative path (~)",
		);
		assert.match(
			notebookPathKindLabel("cwd-relative"),
			/relative to Pi working directory/u,
		);
	});
});
