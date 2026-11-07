import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { checkRecord, outsideProject } from "../core/developing-features/scripts/scenarios.mjs";

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
const { NODE_TEST_CONTEXT: _, CLAUDE_CODE_SESSION_ID: _c, CODEX_SESSION_ID: _x, ...env } = process.env;
const RUN_WORDING = /^a scenarios\.mjs run started at (\S+) \(last progress (\S+)\) has not finished; if it is still running wait for it, do not start another; if it stopped, run it again\.$/;
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

test("a run that is killed midway leaves verification.run and running results, never the earlier passes", async (t) => {
	const project = mkdtempSync(join(tmpdir(), "scenario-run-"));
	const path = passedRecord(project, { slow: true });
	t.after(() => rmSync(project, { recursive: true, force: true }));
	const child = spawn("node", [SCENARIOS, "run", path], { cwd: project, stdio: "ignore", env });
	const deadline = Date.now() + 10_000;
	while (!JSON.parse(readFileSync(path, "utf8")).verification.run) {
		assert.ok(Date.now() < deadline, "the run records itself before it starts the first check");
		await new Promise((done) => setTimeout(done, 50));
	}
	const exited = new Promise((done) => child.on("exit", done));
	child.kill("SIGKILL");
	await exited;

	const record = JSON.parse(readFileSync(path, "utf8"));
	assert.deepEqual(record.scenarios.map((s) => s.status), ["running", "running"]);
	assert.equal(record.verification.existing_tests_status, "running");
	const { startedAt, lastProgressAt } = record.verification.run;
	assert.ok(!Number.isNaN(Date.parse(startedAt)) && !Number.isNaN(Date.parse(lastProgressAt)), JSON.stringify(record.verification.run));
	const problems = checkRecord(record);
	assert.ok(problems.some((p) => /S1: status is "running"; the run that set it has not finished/.test(p)), problems.join("\n"));
	assert.ok(problems.some((p) => /Existing tests status is "running"/.test(p)));
	const wording = problems.map((p) => p.match(RUN_WORDING)).find(Boolean);
	assert.deepEqual(wording?.slice(1), [startedAt, lastProgressAt], problems.join("\n"));
	assert.ok(problems.every((p) => !/pid|alive|process/.test(p)), "no liveness claim");
});

test("a run that finishes saves every result, records progress and removes verification.run", (t) => {
	const project = mkdtempSync(join(tmpdir(), "scenario-run-"));
	const path = passedRecord(project);
	t.after(() => rmSync(project, { recursive: true, force: true }));
	const result = spawnSync("node", [SCENARIOS, "run", path], { cwd: project, encoding: "utf8", env });
	assert.equal(result.status, 0, result.stderr);
	const record = JSON.parse(readFileSync(path, "utf8"));
	assert.deepEqual(record.scenarios.map((s) => s.status), ["pass", "pass"]);
	assert.equal(record.verification.existing_tests_status, "pass");
	assert.equal("run" in record.verification, false);
	assert.deepEqual(checkRecord(record), []);
});

test("a run that fails, or throws, still removes verification.run", (t) => {
	const project = mkdtempSync(join(tmpdir(), "scenario-run-"));
	const path = passedRecord(project);
	t.after(() => rmSync(project, { recursive: true, force: true }));
	const record = JSON.parse(readFileSync(path, "utf8"));
	record.scenarios[0].check = "exit 3";
	writeFileSync(path, JSON.stringify(record));
	const result = spawnSync("node", [SCENARIOS, "run", path], { cwd: project, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.equal("run" in JSON.parse(readFileSync(path, "utf8")).verification, false);

	writeFileSync(path, JSON.stringify({ ...record, scenarios: "not a list" }));
	const thrown = spawnSync("node", [SCENARIOS, "run", path], { cwd: project, encoding: "utf8", env });
	assert.notEqual(thrown.status, 0);
	assert.match(thrown.stderr, /TypeError/, "the run threw");
	assert.equal("run" in JSON.parse(readFileSync(path, "utf8")).verification, false);
});
