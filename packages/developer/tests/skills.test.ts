import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

import { parseTocBytes } from "../src/action-loop/routing/parse-toc.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(packageRoot, "skills");
const expected = [
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

function loadedSkills() {
	return loadSkillsFromDir({
		dir: skillsRoot,
		source: "@hobin/developer",
	}).skills;
}

test("Pi's loaded skill metadata is the package leaf catalog", () => {
	const catalog = loadedSkills();
	assert.deepEqual(catalog.map((skill) => skill.name).sort(), expected);
	assert.equal(
		catalog.some((skill) => skill.name === "developer"),
		false,
	);
	for (const skill of catalog) {
		assert.ok(skill.description.length > 20);
		assert.ok(skill.filePath.endsWith("SKILL.md"));
	}
});

test("every skill defines an inspection surface suited to its judgment", async () => {
	const expectedSurfaces: Record<string, RegExp> = {
		"abstraction-review": /review card or table/,
		"adversarial-eval": /escalation ladder as an ordered matrix/,
		"convention-judgment": /Produce a[\s\S]*convention card/,
		doctor:
			/Doctor scope and actual coverage[\s\S]*investigation ledger[\s\S]*treatment plan/,
		"information-loss-judgment": /Produce an information-flow table/,
		model: /case, decision, or truth table/,
		"module-judgment": /Produce a module card/,
		"naming-judgment": /rename map as the primary inspection surface/,
		"process-judgment": /Produce a process card/,
		schedule: /compact timing matrix/,
		signal: /Make the comparison visible/,
		sketch:
			/compact case\/check table[\s\S]*wished-interface table[\s\S]*small ordered implementation queue/,
		specify: /scope table separating in scope/,
		"task-protocol-judgment": /Produce a protocol card/,
		"variation-judgment": /Show the accepted surface/,
		verify: /evidence matrix as the primary surface/,
		visualize: /render the completed table, ASCII\/Mermaid diagram/,
	};

	for (const [name, expectedSurface] of Object.entries(expectedSurfaces)) {
		const source = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
		assert.match(
			source,
			expectedSurface,
			`${name} should expose an inspectable output surface`,
		);
	}
});

test("Doctor remains a self-contained diagnostic method", async () => {
	const source = await readFile(join(skillsRoot, "doctor", "SKILL.md"), "utf8");
	assert.match(source, /requested \/ inspected \/ claim scope/i);
	assert.match(source, /thorough-within-scope/);
	assert.match(source, /## Diagnostic Lens Sweep/);
	assert.match(source, /## Follow-up Investigations/);
	assert.match(
		source,
		/treat-now[\s\S]*prepare-next[\s\S]*observe[\s\S]*leave-alone/,
	);
	assert.doesNotMatch(source, /\bDeveloper\b|Capability TOC|sealed Context/);
	for (const sibling of expected.filter((name) => name !== "doctor")) {
		assert.equal(
			source.includes(`| \`${sibling}\` |`),
			false,
			`Doctor must not hard-code sibling Skill ${sibling}`,
		);
	}
});

test("every reference-bearing Skill has one canonical complete TOC", async () => {
	for (const skill of loadedSkills()) {
		const referencesRoot = join(skill.baseDir, "references");
		const referencePaths = await readdir(referencesRoot)
			.then((names) =>
				names
					.filter((name) => name.endsWith(".md"))
					.map((name) => `references/${name}`)
					.sort(),
			)
			.catch(() => [] as string[]);
		const tocPath = join(skill.baseDir, "toc.json");
		if (referencePaths.length === 0) {
			await assert.rejects(access(tocPath));
			continue;
		}
		const bytes = await readFile(tocPath);
		const parsed = parseTocBytes(bytes);
		assert.equal(parsed.ok, true, `${skill.name} TOC must parse`);
		if (!parsed.ok) continue;
		assert.deepEqual(
			parsed.value.references.map((reference) => reference.path).sort(),
			referencePaths,
			`${skill.name} TOC must account for every packaged Reference`,
		);
		const method = await readFile(skill.filePath, "utf8");
		assert.match(method, /## Supporting Materials/);
		assert.ok(
			method.includes("](toc.json)"),
			`${skill.name} must link its colocated Skill TOC`,
		);
		assert.match(method, /If no Reference applies, proceed with/);
		assert.doesNotMatch(method, /## Reference Routing/);
		assert.doesNotMatch(
			method,
			/Upper Judgment|Capability TOC|Skill Contribution|sealed Context|Developer protocol|Action Loop/,
		);
		await assert.rejects(access(join(skill.baseDir, "reference-policy.json")));
	}
});
