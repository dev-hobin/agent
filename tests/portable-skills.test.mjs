import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { canonicalSkillDirectories, checkSkillResources } from "../scripts/skill-resources.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const standardChecker = join(root, "scripts/check-agent-skills.py");
const schemaUrl = "https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-references-v0.1.schema.json";

async function temporaryDirectory(t) {
	const directory = await mkdtemp(join(tmpdir(), "agent-portable-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return directory;
}

async function fixture(t, policy) {
	const directory = await temporaryDirectory(t);
	const skill = join(directory, "fixture");
	await mkdir(skill);
	await writeFile(join(skill, "SKILL.md"),
		"---\nname: fixture\ndescription: A reference fixture\n---\n\n# Fixture\n\nComplete core method.\n");
	if (policy !== undefined) {
		await writeFile(join(skill, "references.json"), JSON.stringify(policy));
	}
	return skill;
}

function referencePolicy(path = "references/material.md") {
	return { $schema: schemaUrl, when: ["A material distinction is missing"],
		unless: ["The method does not own this question"], references: [
			{ path, when: ["This material can change the result"] },
		] };
}

test("the standards register and installed-check requirements share one upstream pin", async () => {
	const requirements = await readFile(join(root, "requirements-skills.txt"), "utf8");
	const pin = requirements.match(/agentskills\.git@([0-9a-f]{40})#subdirectory=skills-ref/);
	assert.ok(pin);
	assert.ok((await readFile(join(root, "docs/standards.md"), "utf8")).includes(pin[1]));
});

test("a reference validator from a different upstream commit cannot pass", async (t) => {
	const directory = await temporaryDirectory(t);
	const scripts = join(directory, "scripts");
	await mkdir(scripts);
	await cp(standardChecker, join(scripts, "check-agent-skills.py"));
	const requirements = await readFile(join(root, "requirements-skills.txt"), "utf8");
	await writeFile(join(directory, "requirements-skills.txt"),
		requirements.replace(/@[0-9a-f]{40}#/, `@${"0".repeat(40)}#`));
	await assert.rejects(exec("python", [join(scripts, "check-agent-skills.py"), await fixture(t)]),
		(error) => error.code === 1 && /does not match the pinned upstream source/.test(error.stderr));
});

test("all 26 canonical Skills have contained and consistent supporting resources", async () => {
	const directories = await canonicalSkillDirectories();
	assert.equal(directories.length, 26);
	for (const directory of directories) await checkSkillResources(directory);
});

test("a core method can have no prepared reference metadata", async (t) => {
	await checkSkillResources(await fixture(t));
});

test("reference policies and their bodies are checked without host injection", async (t) => {
	const skill = await fixture(t, referencePolicy());
	await mkdir(join(skill, "references"));
	await writeFile(join(skill, "references/material.md"), "# Supporting distinction\n");
	await checkSkillResources(skill);
});

test("malformed, missing, and structurally invalid packaged metadata fail authoring checks", async (t) => {
	const skill = await fixture(t, { when: ["Only a partial policy"] });
	await assert.rejects(checkSkillResources(skill), /Invalid Skill References/);
	await writeFile(join(skill, "references.json"), "{broken");
	await assert.rejects(checkSkillResources(skill), SyntaxError);
	await rm(join(skill, "references.json"));
	await writeFile(join(skill, "SKILL.md"), "Read [metadata](references.json).\n");
	await assert.rejects(checkSkillResources(skill), /ENOENT/);
});

test("missing reference bodies, traversal, and physical escape cannot pass", async (t) => {
	const skill = await fixture(t, referencePolicy());
	await assert.rejects(checkSkillResources(skill), /ENOENT/);
	await writeFile(join(skill, "references.json"), JSON.stringify(referencePolicy("../outside.md")));
	await assert.rejects(checkSkillResources(skill), /Invalid Skill References/);
	const outside = join(skill, "..", "outside.md");
	await writeFile(outside, "outside\n");
	await mkdir(join(skill, "references"));
	await symlink(outside, join(skill, "references/material.md"));
	await writeFile(join(skill, "references.json"), JSON.stringify(referencePolicy()));
	await assert.rejects(checkSkillResources(skill), /escapes Skill directory/);
});

test("local entry-point links are resolved from the Skill rather than the process cwd", async (t) => {
	const skill = await fixture(t);
	await writeFile(join(skill, "SKILL.md"), "Read [guidance](references/missing.md).\n");
	await assert.rejects(checkSkillResources(skill), /ENOENT/);
	await mkdir(join(skill, "references"));
	await writeFile(join(skill, "references/missing.md"), "# Material\n");
	await checkSkillResources(skill);
});

test("stale generated Learning directions cannot pass", async (t) => {
	const target = join(await temporaryDirectory(t), "technical-reading");
	await cp(join(root, "packages/learning/skills/technical-reading"), target, { recursive: true });
	await checkSkillResources(target);
	const path = join(target, "SKILL.md");
	const source = await readFile(path, "utf8");
	await writeFile(path, source.replace("## Context Directions", "## Stale Directions"));
	await assert.rejects(checkSkillResources(target), /Context Directions drift/);
});

test("the actual upstream checker rejects a name-directory mismatch", async (t) => {
	const skill = await fixture(t);
	await exec("python", [standardChecker, skill], { cwd: tmpdir() });
	await writeFile(join(skill, "SKILL.md"), "---\nname: other\ndescription: Fixture\n---\n");
	await assert.rejects(exec("python", [standardChecker, skill], { cwd: tmpdir() }),
		(error) => error.code === 1 && /must match skill name/.test(error.stderr));
});

for (const [name, count] of [["developer", 17], ["learning", 5]]) {
	test(`${name}: packed Skills work as standalone relocated bundles without a manifest or adapter`, async (t) => {
		const directory = await temporaryDirectory(t);
		const packageRoot = join(root, "packages", name);
		const { stdout } = await exec("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", directory],
			{ cwd: packageRoot, maxBuffer: 2 * 1024 * 1024 });
		const [pack] = JSON.parse(stdout);
		await exec("tar", ["-xzf", join(directory, pack.filename), "-C", directory]);
		const neutralRoot = join(directory, "consumer", "skills");
		await cp(join(directory, "package", "skills"), neutralRoot, { recursive: true });
		const entries = await readdir(neutralRoot, { withFileTypes: true });
		assert.equal(entries.length, count);
		assert.ok(entries.every((entry) => entry.isDirectory()));
		const paths = entries.map((entry) => join(neutralRoot, entry.name));
		for (const path of paths) {
			await checkSkillResources(path);
			assert.equal(await readFile(join(path, "SKILL.md"), "utf8"),
				await readFile(join(packageRoot, "skills", basename(path), "SKILL.md"), "utf8"));
		}
		await exec("python", [standardChecker, ...paths], { cwd: directory });
	});
}
