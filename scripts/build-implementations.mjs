// Build every core capability with every implementation into dist/<implementation>/.
// `--check` fails when dist/ differs from what the implementations produce (content,
// file set, or executable bit), so the committed outputs always match core.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCapability, repositoryRoot } from "../implementations/lib.mjs";

export const implementations = ["claude", "codex", "portable"];
const distRoot = join(repositoryRoot, "dist");

async function listFiles(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
		if (entry.name === "results") continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...await listFiles(path));
		else out.push(path);
	}
	return out;
}

async function expand(path, value) {
	if (typeof value === "string") return [[path, { bytes: Buffer.from(value), mode: 0o644 }]];
	if (value.text !== undefined) return [[path, { bytes: Buffer.from(value.text), mode: value.mode ?? 0o644 }]];
	if (value.copy) return [[path, { bytes: await readFile(value.copy), mode: value.mode ?? (await stat(value.copy)).mode & 0o777 }]];
	if (value.copyDir) {
		const entries = [];
		for (const file of await listFiles(value.copyDir)) {
			entries.push([join(path, relative(value.copyDir, file)), { bytes: await readFile(file), mode: (await stat(file)).mode & 0o777 }]);
		}
		return entries;
	}
	if (value.changedTree) {
		const { base, patch, diffFile } = value.changedTree;
		const dir = await mkdtemp(join(tmpdir(), "hobin-change-"));
		try {
			await cp(base, dir, { recursive: true });
			const git = (...args) => execFileSync("git", ["-c", "user.name=build", "-c", "user.email=build@example.invalid", ...args], { cwd: dir });
			git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "base");
			git("apply", patch); git("add", "-A");
			await writeFile(join(dir, diffFile), git("diff", "--cached", "--no-color"));
			await rm(join(dir, ".git"), { recursive: true, force: true });
			return await expand(path, { copyDir: dir });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}
	throw new Error(`Unknown output for ${path}`);
}

async function pruneEmpty(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
		if (entry.isDirectory()) await pruneEmpty(join(dir, entry.name));
	}
	if (dir !== distRoot && (await readdir(dir)).length === 0) await rm(dir, { recursive: true });
}

export async function expectedOutputs() {
	const capabilities = (await readdir(join(repositoryRoot, "core"), { withFileTypes: true }))
		.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
	const expected = new Map();
	for (const name of implementations) {
		const { build, conformance } = await import(`../implementations/${name}/build.mjs`);
		for (const capName of capabilities) {
			const cap = await loadCapability(capName);
			const declared = Object.keys(conformance ?? {}).sort(), promised = (cap.guarantees ?? []).map((g) => g.id).sort();
			assert.deepEqual(declared, promised, `${name}: conformance must declare exactly the guarantees of core/${capName}`);
			for (const [id, entry] of Object.entries(conformance)) {
				assert.ok(["enforced", "instructed", "unsupported"].includes(entry.level), `${name}: ${id} level`);
			}
			expected.set(join(distRoot, name, "conformance", `${capName}.json`), { bytes: Buffer.from(JSON.stringify(
				Object.fromEntries((cap.guarantees ?? []).map((g) => [g.id, { level: g.level, means: g.means, ...conformance[g.id] }])), null, 2) + "\n"), mode: 0o644 });
			for (const [path, value] of Object.entries(build(cap))) {
				for (const [file, content] of await expand(join(distRoot, name, path), value)) {
					assert.ok(!expected.has(file), `${relative(repositoryRoot, file)} is produced twice`);
					expected.set(file, content);
				}
			}
		}
	}
	return expected;
}

export async function buildImplementations({ check = false } = {}) {
	const expected = await expectedOutputs();
	const actual = new Set((await Promise.all(implementations.map((name) => listFiles(join(distRoot, name))))).flat());
	const drift = [];
	for (const file of actual) if (!expected.has(file)) {
		if (check) drift.push(`${relative(repositoryRoot, file)} is not produced by any implementation`);
		else await rm(file);
	}
	for (const [file, { bytes, mode }] of expected) {
		const current = await readFile(file).catch(() => null);
		const currentMode = current ? (await stat(file)).mode & 0o111 : null;
		if (current?.equals(bytes) && currentMode === (mode & 0o111)) continue;
		if (check) drift.push(`${relative(repositoryRoot, file)} differs from its implementation output`);
		else {
			await mkdir(dirname(file), { recursive: true });
			await writeFile(file, bytes);
			await chmod(file, mode);
		}
	}
	if (!check) await pruneEmpty(distRoot);
	assert.deepEqual(drift, [], `dist/ drift:\n${drift.join("\n")}\nRun node scripts/build-implementations.mjs`);
	return expected.size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const count = await buildImplementations({ check: process.argv.includes("--check") });
	console.log(process.argv.includes("--check") ? `dist/ matches core (${count} files)` : `dist/ built (${count} files)`);
}
