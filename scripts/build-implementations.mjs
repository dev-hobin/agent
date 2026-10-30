// Build every core capability with every implementation into dist/<implementation>/.
// `--check` fails when dist/ differs from what the implementations produce (content,
// file set, or executable bit), so the committed outputs always match core.
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
	throw new Error(`Unknown output for ${path}`);
}

export async function expectedOutputs() {
	const capabilities = (await readdir(join(repositoryRoot, "core"), { withFileTypes: true }))
		.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
	const expected = new Map();
	for (const name of implementations) {
		const { build } = await import(`../implementations/${name}/build.mjs`);
		for (const capName of capabilities) {
			const cap = await loadCapability(capName);
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
	assert.deepEqual(drift, [], `dist/ drift:\n${drift.join("\n")}\nRun node scripts/build-implementations.mjs`);
	return expected.size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const count = await buildImplementations({ check: process.argv.includes("--check") });
	console.log(process.argv.includes("--check") ? `dist/ matches core (${count} files)` : `dist/ built (${count} files)`);
}
