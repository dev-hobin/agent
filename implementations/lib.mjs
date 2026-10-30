// Shared helpers for implementations: load a core capability and fill its template slots.
// Implementations depend on core; core never refers to an implementation.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

export const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export async function loadCapability(name) {
	const dir = join(repositoryRoot, "core", name);
	const capability = parse(await readFile(join(dir, "capability.yaml"), "utf8"));
	const read = (path) => readFile(join(dir, path), "utf8");
	const perspectives = await Promise.all(capability.perspectives.map(async (p) => ({
		...p, body: await readFile(join(repositoryRoot, p.source), "utf8"),
	})));
	const contract = [];
	for (const id of (await readdir(join(dir, "contract"))).sort()) {
		const spec = parse(await readFile(join(dir, "contract", id, "case.yaml"), "utf8"));
		assert.equal(spec.id, id, `contract ${id}: id matches directory`);
		contract.push({ ...spec, dir: join(dir, "contract", id) });
	}
	return {
		...capability, dir, perspectives, contract,
		skill: await read("skill.md"), reviewer: await read("reviewer.md"),
		description: [capability.summary, capability.use_when, capability.not_for].join(" "),
	};
}

// Every {{slot}} in the template must be provided, and every provided slot must be used.
export function fill(template, slots) {
	const used = new Set();
	const out = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		assert.ok(key in slots, `template slot {{${key}}} has no value`);
		used.add(key);
		return slots[key];
	});
	for (const key of Object.keys(slots)) assert.ok(used.has(key), `slot ${key} is not in the template`);
	return out;
}

export function yamlString(value) {
	return JSON.stringify(value);
}

// File-based expectations every host can check the same way; trace-based ones are host-specific.
export const fileExpectations = ["file_exists", "file_matches", "file_lacks", "unchanged_except"];
export const traceExpectations = ["ran_command"];
export function expectationKind(expectation) {
	const kinds = Object.keys(expectation).filter((key) => key !== "id");
	assert.equal(kinds.length, 1, `expectation ${expectation.id} has exactly one kind`);
	return kinds[0];
}

// Build-time helper for presenting a contract change: copy the base, apply the patch with
// git, and write the full change to CHANGE.diff. Hosts whose run sandbox can use git may
// present a branch instead; that choice belongs to the implementation.
export const presentChangeAsDiff = (c) => ({ changedTree: { base: `${c.dir}/${c.base}`, patch: `${c.dir}/${c.change}`, diffFile: "CHANGE.diff" } });
export const presentChangeSentence = "The working tree is the changed version, and `CHANGE.diff` holds the full change against the base. ";
