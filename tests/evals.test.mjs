import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { packageNames, readJson, repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { syncSources, targets } from "../scripts/sync-sources.mjs";

const exec = promisify(execFile);
const evalsRoot = join(repositoryRoot, "evals");
const runner = join(repositoryRoot, "packages/skill-eval/skills/evaluating-skills/scripts/run-evals.mjs");

async function skillOwners() {
	const owners = new Map();
	for (const name of packageNames) {
		const { name: plugin } = await readJson(join(repositoryRoot, "packages", name, "plugin.json"));
		for (const skill of await readdir(join(repositoryRoot, "packages", name, "skills"))) owners.set(skill, { plugin, root: join(repositoryRoot, "packages", name) });
	}
	return owners;
}

async function evalDirectories() {
	const entries = await readdir(evalsRoot, { withFileTypes: true });
	return entries.filter((entry) => entry.isDirectory() && entry.name !== "results").map((entry) => entry.name).sort();
}

async function temporaryDirectory(t) {
	const directory = await mkdtemp(join(tmpdir(), "agent-evals-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return directory;
}

test("every evaluated Skill exists and names its owning plugin", async () => {
	const owners = await skillOwners();
	const directories = await evalDirectories();
	assert.ok(directories.length > 0);
	for (const skill of directories) {
		assert.ok(owners.has(skill), `evals/${skill} has no shipped Skill`);
		for (const file of ["triggers.json", "evals.json"]) {
			const data = await readJson(join(evalsRoot, skill, file)).catch(() => null);
			if (!data) continue;
			assert.equal(data.skill, skill, `${skill}/${file}: skill`);
			assert.equal(data.plugin, owners.get(skill).plugin, `${skill}/${file}: plugin`);
		}
	}
});

test("trigger sets have 20 unique queries with both positives and near misses", async () => {
	for (const skill of await evalDirectories()) {
		const data = await readJson(join(evalsRoot, skill, "triggers.json")).catch(() => null);
		if (!data) continue;
		assert.equal(data.queries.length, 20, `${skill}: 20 queries`);
		assert.equal(new Set(data.queries.map((q) => q.id)).size, 20, `${skill}: unique ids`);
		assert.equal(new Set(data.queries.map((q) => q.query)).size, 20, `${skill}: unique queries`);
		const positives = data.queries.filter((q) => q.should_trigger === true).length;
		assert.ok(positives >= 8 && 20 - positives >= 8, `${skill}: balanced positives and negatives`);
		assert.ok(data.queries.every((q) => typeof q.query === "string" && q.query.trim() && typeof q.should_trigger === "boolean"));
	}
});

test("outcome tasks have workspaces, discriminating assertions, and applicable patches", async (t) => {
	for (const skill of await evalDirectories()) {
		const data = await readJson(join(evalsRoot, skill, "evals.json")).catch(() => null);
		if (!data) continue;
		assert.equal(new Set(data.tasks.map((task) => task.id)).size, data.tasks.length, `${skill}: unique task ids`);
		for (const task of data.tasks) {
			const fixture = join(evalsRoot, skill, task.fixture);
			assert.ok((await stat(join(fixture, "workspace"))).isDirectory(), `${skill}/${task.id}: workspace`);
			assert.ok(task.prompt.trim() && task.assertions.length > 0, `${skill}/${task.id}: prompt and assertions`);
			assert.equal(new Set(task.assertions.map((a) => a.id)).size, task.assertions.length, `${skill}/${task.id}: assertion ids`);
			if ((task.checks ?? []).some((check) => check.command.includes("hidden"))) assert.ok((await stat(join(fixture, "hidden"))).isDirectory(), `${skill}/${task.id}: hidden checks`);
			const patch = join(fixture, "change.patch");
			if (await stat(patch).catch(() => null)) {
				const copy = await temporaryDirectory(t);
				await cp(join(fixture, "workspace"), copy, { recursive: true });
				await exec("git", ["init", "-q"], { cwd: copy });
				await exec("git", ["apply", "--check", patch], { cwd: copy });
			}
		}
	}
});

test("the eval runner is a dry run unless --execute is given", async (t) => {
	const skill = (await evalDirectories()).find(Boolean);
	const { root } = (await skillOwners()).get(skill);
	const out = join(await temporaryDirectory(t), "results");
	const mode = await readJson(join(evalsRoot, skill, "evals.json")).then(() => "outcomes", () => "triggers");
	const { stdout } = await exec("node", [runner, mode, "--evals", join(evalsRoot, skill), "--plugin-dir", root, "--out", out]);
	assert.match(stdout, /Dry run/);
	await assert.rejects(stat(out), { code: "ENOENT" });
});

test("shared lens copies cannot drift from their source", async (t) => {
	await syncSources({ check: true });
	const root = await temporaryDirectory(t);
	await cp(join(repositoryRoot, "sources"), join(root, "sources"), { recursive: true });
	for (const { destination } of targets) await cp(join(repositoryRoot, destination), join(root, destination), { recursive: true });
	const [name] = (await readdir(join(root, "sources/lenses"))).filter((file) => file.endsWith(".md"));
	await writeFile(join(root, targets[0].destination, name), "edited copy\n");
	await assert.rejects(syncSources({ check: true, root }), /Shared source drift/);
	await syncSources({ root });
	await syncSources({ check: true, root });
	assert.equal(await readFile(join(root, targets[0].destination, name), "utf8"),
		await readFile(join(repositoryRoot, targets[0].destination, name), "utf8"));
});
