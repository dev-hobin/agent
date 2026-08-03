import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	captureWorkspaceSnapshot,
	compareWorkspaceSnapshots,
} from "../extensions/workspace-observation.ts";

function runGit(input: {
	readonly cwd: string;
	readonly args: readonly string[];
}): void {
	execFileSync("git", ["-C", input.cwd, ...input.args], {
		stdio: "ignore",
	});
}

function repository(): string {
	const root = mkdtempSync(join(tmpdir(), "developer-workspace-observation-"));
	runGit({ cwd: root, args: ["init", "--quiet"] });
	runGit({
		cwd: root,
		args: ["config", "user.email", "developer@example.invalid"],
	});
	runGit({ cwd: root, args: ["config", "user.name", "Developer Test"] });
	writeFileSync(join(root, "tracked.txt"), "committed\n");
	runGit({ cwd: root, args: ["add", "tracked.txt"] });
	runGit({ cwd: root, args: ["commit", "--quiet", "-m", "fixture"] });
	return root;
}

test("workspace observation distinguishes pre-existing dirt from authorized delta", (context) => {
	const root = repository();
	context.after(() => rmSync(root, { force: true, recursive: true }));
	writeFileSync(join(root, "tracked.txt"), "pre-existing\n");
	writeFileSync(join(root, "pre-existing.txt"), "untouched dirt\n");
	const baseline = captureWorkspaceSnapshot(root);
	if (baseline.kind !== "git") assert.fail(baseline.reason);
	assert.deepEqual(baseline.dirtyPaths, ["pre-existing.txt", "tracked.txt"]);

	writeFileSync(join(root, "tracked.txt"), "authorized change\n");
	writeFileSync(join(root, "new.txt"), "new change\n");
	const current = captureWorkspaceSnapshot(root);
	const delta = compareWorkspaceSnapshots({ baseline, current });
	assert.equal(delta.kind, "observed");
	assert.deepEqual(delta.changedPaths, ["new.txt", "tracked.txt"]);
	assert.equal(delta.changedPaths.includes("pre-existing.txt"), false);
});

test("workspace observation fails closed when no Git identity is available", (context) => {
	const root = mkdtempSync(join(tmpdir(), "developer-workspace-unavailable-"));
	context.after(() => rmSync(root, { force: true, recursive: true }));
	const snapshot = captureWorkspaceSnapshot(root);
	assert.equal(snapshot.kind, "unavailable");
	const delta = compareWorkspaceSnapshots({
		baseline: snapshot,
		current: snapshot,
	});
	assert.equal(delta.kind, "unavailable");
	assert.match(delta.reason ?? "", /workspace observation unavailable/iu);
});
