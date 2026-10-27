import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { DefaultResourceLoader, loadSkillsFromDir, SettingsManager } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const entries = await readdir(join(packageRoot, "skills"), { withFileTypes: true });
const expectedSkills = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

test("Pi discovers the canonical Skill catalog without diagnostics", () => {
	const result = loadSkillsFromDir({ dir: join(packageRoot, "skills"), source: "developer-package-test" });
	assert.deepEqual(result.skills.map((skill) => skill.name).sort(), expectedSkills);
	assert.deepEqual(result.diagnostics, []);
});

test("Pi loads canonical Skills and the passive adapter from the actual packed package", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "developer-packed-"));
	const previousHome = process.env.HOME;
	// The explicit agentDir does not disable Pi's ~/.agents/skills discovery.
	// This test file runs in its own process; isolate home without editing user settings.
	process.env.HOME = root;
	t.after(async () => {
		if (previousHome === undefined) delete process.env.HOME;
		else process.env.HOME = previousHome;
		await rm(root, { recursive: true, force: true });
	});
	const packDir = join(root, "pack");
	const agentDir = join(root, "agent");
	const cwd = join(root, "workspace");
	await Promise.all([packDir, agentDir, cwd].map((path) => mkdir(path, { recursive: true })));

	const { stdout } = await execFileAsync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", packDir],
		{ cwd: packageRoot, maxBuffer: 2 * 1024 * 1024 });
	const [pack] = JSON.parse(stdout);
	await execFileAsync("tar", ["-xzf", join(packDir, pack.filename), "-C", root]);
	const packedRoot = join(root, "package");
	await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [packedRoot] }));

	const settingsManager = SettingsManager.create(cwd, agentDir);
	const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager,
		noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await loader.reload();
	assert.deepEqual(loader.getSkills().diagnostics, []);
	const packedSkills = loader.getSkills().skills.filter((skill) => skill.filePath.startsWith(packedRoot));
	assert.deepEqual(packedSkills.map((skill) => skill.name).sort(), expectedSkills);
	const extensions = loader.getExtensions();
	assert.deepEqual(extensions.errors, []);
	const adapter = extensions.extensions.find((extension) => extension.resolvedPath.startsWith(packedRoot));
	assert.ok(adapter);
	assert.deepEqual([...adapter.handlers.keys()].sort(), ["before_agent_start", "tool_result"]);
	assert.equal(adapter.tools.size, 0);
	assert.equal(adapter.commands.size, 0);
});
