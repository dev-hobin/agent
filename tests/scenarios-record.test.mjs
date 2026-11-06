import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { checkRecord, outsideProject } from "../core/developing-features/scripts/scenarios.mjs";
import { SESSION_ENV, readRunMarker, runMarkerPath } from "../core/developing-features/scripts/records.mjs";

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

const SCENARIOS = join(repositoryRoot, "core/developing-features/scripts/scenarios.mjs");
// Without the host session id: these tests run inside agent sessions, and the script would
// otherwise register its fixture into that session's ledger.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !SESSION_ENV.includes(name)));
// A complete record whose results all passed in an earlier run; `slow` makes S1's check take a while.
function passedRecord(project, { slow = false } = {}) {
	const record = {
		feature: "run state", request: "keep results honest while a run is in progress",
		scenarios: [
			{ id: "S1", given: "a record", when: "run", then: "passes", check: slow ? "sleep 30" : "true", status: "pass", covers: [] },
			{ id: "S2", given: "a record", when: "run", then: "passes", check: "true", status: "pass", covers: [] },
		],
		decisions: [],
		verification: { existing_tests: "true", existing_tests_status: "pass", rounds: [] },
	};
	const path = join(project, "acceptance-scenarios.json");
	writeFileSync(path, JSON.stringify(record));
	return path;
}

test("a run that is killed midway leaves running results and a dead marker, never the earlier passes", async (t) => {
	const project = mkdtempSync(join(tmpdir(), "scenario-run-"));
	const path = passedRecord(project, { slow: true });
	t.after(() => { rmSync(project, { recursive: true, force: true }); rmSync(runMarkerPath(path), { force: true }); });
	const child = spawn("node", [SCENARIOS, "run", path], { cwd: project, stdio: "ignore", env });
	const deadline = Date.now() + 10_000;
	while (!readFileSync(path, "utf8").includes('"running"')) {
		assert.ok(Date.now() < deadline, "the run marks results running before it starts the first check");
		await new Promise((done) => setTimeout(done, 50));
	}
	const marker = readRunMarker(path);
	assert.equal(marker?.pid, child.pid);
	assert.equal(marker.alive, true);
	const exited = new Promise((done) => child.on("exit", done));
	child.kill("SIGKILL");
	await exited;

	const record = JSON.parse(readFileSync(path, "utf8"));
	assert.deepEqual(record.scenarios.map((s) => s.status), ["running", "running"]);
	assert.equal(record.verification.existing_tests_status, "running");
	const problems = checkRecord(record);
	assert.ok(problems.some((p) => /S1: status is "running"; a scenarios\.mjs run is still going or was interrupted/.test(p)), problems.join("\n"));
	assert.ok(problems.some((p) => /Existing tests status is "running"/.test(p)));
	assert.equal(readRunMarker(path)?.alive, false, "the killed run's marker names a process that no longer exists");
});

test("a run that finishes saves every result and removes its marker", (t) => {
	const project = mkdtempSync(join(tmpdir(), "scenario-run-"));
	const path = passedRecord(project);
	t.after(() => rmSync(project, { recursive: true, force: true }));
	const result = spawnSync("node", [SCENARIOS, "run", path], { cwd: project, encoding: "utf8", env });
	assert.equal(result.status, 0, result.stderr);
	const record = JSON.parse(readFileSync(path, "utf8"));
	assert.deepEqual(record.scenarios.map((s) => s.status), ["pass", "pass"]);
	assert.equal(record.verification.existing_tests_status, "pass");
	assert.equal(existsSync(runMarkerPath(path)), false);
	assert.deepEqual(checkRecord(record), []);
});
