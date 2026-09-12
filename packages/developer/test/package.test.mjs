import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
	DefaultResourceLoader,
	loadSkillsFromDir,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedSkills = [
	"abstraction-review",
	"adversarial-eval",
	"convention-judgment",
	"doctor",
	"information-loss-judgment",
	"model",
	"module-judgment",
	"naming-judgment",
	"process-judgment",
	"schedule",
	"signal",
	"sketch",
	"specify",
	"task-protocol-judgment",
	"variation-judgment",
	"verify",
	"visualize",
];

test("manifest exposes only the Skill library and passive Skill References Extension", async () => {
	const manifest = JSON.parse(
		await readFile(join(packageRoot, "package.json"), "utf8"),
	);

	assert.equal(manifest.version, "0.1.20");
	assert.equal(manifest.private, undefined);
	assert.equal(manifest.license, "MIT");
	assert.deepEqual(manifest.publishConfig, { access: "public" });
	assert.deepEqual(manifest.files, [
		"extensions",
		"skills",
		"README.md",
		"README.ko.md",
		"LICENSE",
	]);
	assert.deepEqual(manifest.pi, {
		extensions: ["./extensions/skill-references/index.js"],
		skills: ["./skills"],
	});
	assert.equal(manifest.dependencies, undefined);
	assert.equal(manifest.peerDependencies, undefined);
	assert.equal(JSON.stringify(manifest).includes("stately"), false);
	assert.equal(JSON.stringify(manifest).includes("xstate"), false);
	assert.equal(JSON.stringify(manifest).includes("zod"), false);
});

test("Pi discovers all 17 retained Skills", () => {
	const result = loadSkillsFromDir({
		dir: join(packageRoot, "skills"),
		source: "developer-package-test",
	});
	const names = result.skills.map((skill) => skill.name).sort();

	assert.deepEqual(names, expectedSkills);
	assert.equal(
		result.diagnostics.some((diagnostic) =>
			diagnostic.message.includes("description is required")
		),
		false,
	);
});

test("npm pack contains the runtime surface but excludes tests and removed runtime code", async () => {
	const { stdout } = await execFileAsync(
		"npm",
		["pack", "--dry-run", "--json", "--ignore-scripts"],
		{ cwd: packageRoot, maxBuffer: 2 * 1024 * 1024 },
	);
	const [pack] = JSON.parse(stdout);
	const paths = pack.files.map((file) => file.path);

	assert.equal(paths.includes("extensions/skill-references/index.js"), true);
	assert.equal(paths.includes("LICENSE"), true);
	assert.equal(paths.includes("README.ko.md"), true);
	assert.equal(paths.filter((path) => path.endsWith("/SKILL.md")).length, 17);
	assert.equal(paths.some((path) => path.startsWith("test/")), false);
	assert.equal(paths.some((path) => path.startsWith("runtime/")), false);
	assert.equal(paths.some((path) => path.includes("model-protocol")), false);
});

test("Pi loads the Skills and passive Extension from the actual packed package", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "developer-packed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const packDir = join(root, "pack");
	const agentDir = join(root, "agent");
	const cwd = join(root, "workspace");
	await Promise.all([
		mkdir(packDir, { recursive: true }),
		mkdir(agentDir, { recursive: true }),
		mkdir(cwd, { recursive: true }),
	]);

	const { stdout } = await execFileAsync(
		"npm",
		[
			"pack",
			"--json",
			"--ignore-scripts",
			"--pack-destination",
			packDir,
		],
		{ cwd: packageRoot, maxBuffer: 2 * 1024 * 1024 },
	);
	const [pack] = JSON.parse(stdout);
	await execFileAsync(
		"tar",
		["-xzf", join(packDir, pack.filename), "-C", root],
	);
	const packedRoot = join(root, "package");
	await writeFile(
		join(agentDir, "settings.json"),
		JSON.stringify({ packages: [packedRoot] }),
	);

	const settingsManager = SettingsManager.create(cwd, agentDir);
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
	});
	await loader.reload();

	const packedSkills = loader
		.getSkills()
		.skills.filter((skill) => skill.filePath.startsWith(packedRoot));
	assert.deepEqual(
		packedSkills.map((skill) => skill.name).sort(),
		expectedSkills,
	);

	const extensions = loader.getExtensions();
	assert.deepEqual(extensions.errors, []);
	const packedExtension = extensions.extensions.find((extension) =>
		extension.resolvedPath.startsWith(packedRoot),
	);
	assert.ok(packedExtension);
	assert.deepEqual([...packedExtension.handlers.keys()].sort(), [
		"before_agent_start",
		"tool_result",
	]);
	assert.equal(packedExtension.tools.size, 0);
	assert.equal(packedExtension.commands.size, 0);
});
