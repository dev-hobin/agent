// The review scenarios' finds-* regexes read a finding the way check-report.mjs does: from its
// `[P…]` line to the next `[P` line or the end, blank lines included. A report check-report.mjs
// accepts must not fail a finds-* check because the defect is named after a blank line.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { checkScenario } from "../.agents/skills/implementing-core/scripts/scenario-check.mjs";
import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { tempRoot } from "./temp-root.mjs";

const temp = tempRoot(import.meta.url);
// The reviewed tree: base with change.patch applied (as check.mjs builds it).
function changedTree(scenario, dir) {
	cpSync(join(scenario, "base"), dir, { recursive: true });
	const git = (...args) => execFileSync("git", ["-c", "user.name=check", "-c", "user.email=check@example.invalid", ...args], { cwd: dir, stdio: "pipe" });
	git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "base");
	git("apply", join(scenario, "change.patch"));
	rmSync(join(dir, ".git"), { recursive: true, force: true });
}

test("a valid review whose findings name the defect after a blank line passes report-format and finds-*", (t) => {
	const scenario = join(repositoryRoot, "core/review/scenarios/queue-worker-ack");
	const dir = temp.dir("review-scenario");
	const [baseline, workspace] = [join(dir, "baseline"), join(dir, "workspace")];
	changedTree(scenario, baseline);
	cpSync(baseline, workspace, { recursive: true });
	cpSync(join(repositoryRoot, "tests/fixtures/review/queue-worker-ack-blank-lines.md"), join(workspace, "REVIEW.md"));
	const results = checkScenario(join(scenario, "scenario.yaml"), workspace, baseline);
	assert.deepEqual(results.filter((r) => /^finds-|^report-format$/.test(r.id)).map((r) => r.id).sort(),
		["finds-early-ack", "finds-retry-double-credit", "report-format"]);
	assert.deepEqual(results.filter((r) => !r.passed).map((r) => r.id), []);
});
