import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedSkills = [
	"abstraction-review", "adversarial-eval", "convention-judgment", "doctor",
	"information-loss-judgment", "model", "module-judgment", "naming-judgment",
	"process-judgment", "schedule", "signal", "sketch", "specify",
	"task-protocol-judgment", "variation-judgment", "verify", "visualize",
];

test("manifest ships canonical Skills and an optional Pi adapter without runtime dependencies", async () => {
	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	assert.equal(manifest.version, "0.2.0");
	assert.equal(manifest.private, undefined);
	assert.equal(manifest.license, "MIT");
	assert.deepEqual(manifest.publishConfig, { access: "public" });
	assert.deepEqual(manifest.files, [
		"adapters", "skills", "README.md", "README.ko.md", "LICENSE",
	]);
	assert.deepEqual(manifest.pi, {
		extensions: ["./adapters/pi/skill-references/index.js"], skills: ["./skills"],
	});
	assert.equal(manifest.dependencies, undefined);
	assert.equal(manifest.peerDependencies, undefined);
	assert.equal(JSON.stringify(manifest).includes("stately"), false);
	assert.equal(JSON.stringify(manifest).includes("xstate"), false);
	assert.equal(JSON.stringify(manifest).includes("zod"), false);
});

test("the canonical catalog contains all 17 retained Skills without a host loader", async () => {
	const entries = await readdir(join(packageRoot, "skills"), { withFileTypes: true });
	assert.deepEqual(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(), expectedSkills);
});

test("npm pack includes Skills and the optional adapter but excludes tests and removed runtime code", async () => {
	const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"],
		{ cwd: packageRoot, maxBuffer: 2 * 1024 * 1024 });
	const [pack] = JSON.parse(stdout);
	const paths = pack.files.map((file) => file.path);
	assert.equal(paths.includes("adapters/pi/skill-references/index.js"), true);
	assert.equal(paths.includes("LICENSE"), true);
	assert.equal(paths.includes("README.ko.md"), true);
	assert.equal(paths.filter((path) => path.endsWith("/SKILL.md")).length, 17);
	assert.equal(paths.some((path) => path.startsWith("test/")), false);
	assert.equal(paths.some((path) => path.startsWith("runtime/")), false);
	assert.equal(paths.some((path) => path.includes("model-protocol")), false);
});
