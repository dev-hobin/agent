// Copy shared lens sources into the Skills that ship them. `--check` fails on drift.
// A Skill must stay self-contained, so each one ships its own copy of the shared files.
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export const targets = [
	{ source: "sources/lenses", destination: "packages/review/skills/reviewing-code/references/perspectives" },
	{ source: "sources/lenses", destination: "packages/feature/skills/developing-features/references/lenses" },
];

export function render(name, body) {
	return `<!-- Generated from sources/lenses/${name}. Edit the source and run node scripts/sync-sources.mjs. -->\n${body}`;
}

export async function syncSources({ check = false, root = repositoryRoot } = {}) {
	const drift = [];
	for (const { source, destination } of targets) {
		const names = (await readdir(join(root, source))).filter((name) => name.endsWith(".md")).sort();
		await mkdir(join(root, destination), { recursive: true });
		const existing = (await readdir(join(root, destination))).filter((name) => name.endsWith(".md")).sort();
		for (const extra of existing.filter((name) => !names.includes(name))) drift.push(`${destination}/${extra} has no source`);
		for (const name of names) {
			const expected = render(name, await readFile(join(root, source, name), "utf8"));
			const path = join(root, destination, name);
			const actual = await readFile(path, "utf8").catch(() => null);
			if (actual === expected) continue;
			if (check) drift.push(`${destination}/${name} differs from ${source}/${name}`);
			else await writeFile(path, expected);
		}
	}
	assert.deepEqual(drift, [], `Shared source drift:\n${drift.join("\n")}\nRun node scripts/sync-sources.mjs`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await syncSources({ check: process.argv.includes("--check") });
	console.log(process.argv.includes("--check") ? "Shared sources are in sync" : "Shared sources synchronized");
}
