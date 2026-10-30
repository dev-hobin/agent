// Generate `claude plugin eval` trigger cases from each package's evals/triggers/<skill>.json.
// Each query becomes one case whose only tool is Skill, graded by whether that Skill was invoked.
// `--check` fails when the generated cases drift from their source.
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { packageNames, repositoryRoot } from "./check-agent-plugins.mjs";

export function renderCase(skill, query) {
	const prompt = `---\ntags: [trigger, ${skill}]\nruns: 3\nmax_turns: 3\ntimeout_seconds: 120\nallowed_tools: [Skill]\n---\n\n${query.query}\n`;
	const match = JSON.stringify(`"skill"\\s*:\\s*"(?:[\\w-]+:)?${skill}"`);
	const bounds = query.should_trigger ? "min: 1" : "min: 0\nmax: 0";
	const grader = `---\ntype: tool_used\ntool: Skill\ninput_match: ${match}\n${bounds}\narm: both\n---\n`;
	return { [`${skill}-${query.id}/prompt.md`]: prompt, [`${skill}-${query.id}/graders/trigger.md`]: grader };
}

export async function buildTriggerCases({ check = false, root = repositoryRoot } = {}) {
	const drift = [];
	for (const name of packageNames) {
		const dir = join(root, "packages", name, "evals", "triggers");
		if (!(await stat(dir).catch(() => null))) continue;
		const sources = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
		const expected = {};
		for (const file of sources) {
			const { skill, queries } = JSON.parse(await readFile(join(dir, file), "utf8"));
			assert.equal(`${skill}.json`, file, `${file}: skill name must match the file name`);
			for (const query of queries) Object.assign(expected, renderCase(skill, query));
		}
		const existing = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
		const wanted = new Set(Object.keys(expected).map((path) => path.split("/")[0]));
		for (const stale of existing.filter((entry) => !wanted.has(entry))) {
			if (check) drift.push(`${name}: ${stale} has no source query`);
			else await rm(join(dir, stale), { recursive: true });
		}
		for (const [path, content] of Object.entries(expected)) {
			const target = join(dir, path);
			if ((await readFile(target, "utf8").catch(() => null)) === content) continue;
			if (check) drift.push(`${name}: ${path} differs from its source`);
			else {
				await mkdir(join(target, ".."), { recursive: true });
				await writeFile(target, content);
			}
		}
	}
	assert.deepEqual(drift, [], `Trigger case drift:\n${drift.join("\n")}\nRun node scripts/build-trigger-cases.mjs`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await buildTriggerCases({ check: process.argv.includes("--check") });
	console.log(process.argv.includes("--check") ? "Trigger cases are in sync" : "Trigger cases generated");
}
