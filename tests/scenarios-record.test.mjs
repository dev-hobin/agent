import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { outsideProject } from "../core/developing-features/scripts/scenarios.mjs";

test("a scenario command may not name a home path or an existing file outside the project", (t) => {
	const project = mkdtempSync(join(tmpdir(), "scenario-project-"));
	t.after(() => rmSync(project, { recursive: true, force: true }));
	const outside = join(repositoryRoot, "package.json");
	assert.deepEqual(outsideProject(`node ${outside} --gate`, project), [outside]);
	assert.deepEqual(outsideProject("node ~/tools/check.mjs", project), ["~/tools/check.mjs"]);
	assert.deepEqual(outsideProject(`node ${join(project, "check.mjs")}`, project), []);
	assert.deepEqual(outsideProject("node --test --test-name-pattern '^S1 ' test/a.test.js", project), []);
	assert.deepEqual(outsideProject("grep /S1/ out.txt && /usr/bin/env node a.js", project), []);
});
