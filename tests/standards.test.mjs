// The pinned Agent Skills validator must be the one the standards register names.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";

const exec = promisify(execFile);
const checker = join(repositoryRoot, "scripts/check-agent-skills.py");

async function skill(t, name = "fixture", body = "---\nname: fixture\ndescription: A fixture\n---\n\nBody.\n") {
	const dir = await mkdtemp(join(tmpdir(), "agent-standards-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	await mkdir(join(dir, name));
	await writeFile(join(dir, name, "SKILL.md"), body);
	return join(dir, name);
}

test("the standards register and the installed validator share one upstream pin", async () => {
	const requirements = await readFile(join(repositoryRoot, "requirements-skills.txt"), "utf8");
	const pin = requirements.match(/agentskills\.git@([0-9a-f]{40})#subdirectory=skills-ref/);
	assert.ok(pin);
	assert.ok((await readFile(join(repositoryRoot, "docs/standards.md"), "utf8")).includes(pin[1]));
});

test("a validator from a different upstream commit cannot pass", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "agent-standards-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	await mkdir(join(dir, "scripts"));
	await cp(checker, join(dir, "scripts/check-agent-skills.py"));
	const requirements = await readFile(join(repositoryRoot, "requirements-skills.txt"), "utf8");
	await writeFile(join(dir, "requirements-skills.txt"), requirements.replace(/@[0-9a-f]{40}#/, `@${"0".repeat(40)}#`));
	await assert.rejects(exec("python", [join(dir, "scripts/check-agent-skills.py"), await skill(t)]),
		(error) => error.code === 1 && /does not match the pinned upstream source/.test(error.stderr));
});

test("the pinned validator rejects a name-directory mismatch", async (t) => {
	await exec("python", [checker, await skill(t)], { cwd: tmpdir() });
	const bad = await skill(t, "fixture", "---\nname: other\ndescription: Fixture\n---\n");
	await assert.rejects(exec("python", [checker, bad], { cwd: tmpdir() }), (error) => error.code === 1 && /must match skill name/.test(error.stderr));
});
