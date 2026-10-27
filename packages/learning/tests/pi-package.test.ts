import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";

const exec = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

test("Pi loads the five canonical Skills and optional chooser from the actual packed package", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "learning-packed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const agentDir = join(root, "agent");
	const cwd = join(root, "workspace");
	await Promise.all([agentDir, cwd].map((path) => mkdir(path, { recursive: true })));
	const { stdout } = await exec("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", root],
		{ cwd: packageRoot, maxBuffer: 2 * 1024 * 1024 });
	const [pack] = JSON.parse(stdout);
	await exec("tar", ["-xzf", join(root, pack.filename), "-C", root]);
	const packedRoot = join(root, "package");
	await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [packedRoot] }));

	const loader = new DefaultResourceLoader({
		cwd, agentDir, settingsManager: SettingsManager.create(cwd, agentDir),
		noPromptTemplates: true, noThemes: true, noContextFiles: true,
	});
	await loader.reload();
	const entries = await readdir(join(packageRoot, "skills"), { withFileTypes: true });
	const expectedSkills = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
	const skills = loader.getSkills().skills.filter((skill) => skill.filePath.startsWith(packedRoot));
	assert.equal(expectedSkills.length, 5);
	assert.deepEqual(skills.map((skill) => skill.name).sort(), expectedSkills);
	const extensions = loader.getExtensions();
	assert.deepEqual(extensions.errors, []);
	const adapter = extensions.extensions.find((extension) => extension.resolvedPath.startsWith(packedRoot));
	assert.ok(adapter);
	assert.deepEqual([...adapter.commands.keys()], ["learning"]);
	assert.equal(adapter.tools.size, 0);
});
