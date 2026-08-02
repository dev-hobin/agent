import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function field(value: unknown, key: string): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		assert.fail(`Expected an object while reading ${key}.`);
	}
	return Reflect.get(value, key);
}

async function skillNames(): Promise<string[]> {
	return (await readdir(join(root, "skills"), { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

async function skillArtifacts(name: string): Promise<{
	readonly contract: unknown;
	readonly markdown: string;
}> {
	const skillRoot = join(root, "skills", name);
	const [contractSource, markdown] = await Promise.all([
		readFile(join(skillRoot, "judgment.json"), "utf8"),
		readFile(join(skillRoot, "SKILL.md"), "utf8"),
	]);
	return { contract: JSON.parse(contractSource), markdown };
}

test("L1 red: every Learning skill uses the common context-contract representation", async () => {
	for (const name of await skillNames()) {
		const { contract } = await skillArtifacts(name);
		assert.equal(field(contract, "specVersion"), "0.1", name);
		assert.ok(
			Array.isArray(field(contract, "sources")),
			`${name}: missing sources`,
		);
		assert.ok(
			Array.isArray(field(contract, "questions")),
			`${name}: missing questions`,
		);
		assert.equal(
			field(contract, "routes"),
			undefined,
			`${name}: legacy routes`,
		);
		assert.equal(
			field(contract, "exemption"),
			undefined,
			`${name}: legacy exemption`,
		);
	}
});

test("L1 red: packed SKILL directions expose every declared need and source", async () => {
	for (const name of await skillNames()) {
		const { contract, markdown } = await skillArtifacts(name);
		assert.ok(
			/^## Context Directions$/mu.test(markdown),
			`${name}: missing Context Directions`,
		);
		assert.ok(
			!/^## Judgment Guidance$/mu.test(markdown),
			`${name}: legacy Judgment Guidance remains`,
		);

		const questions = field(contract, "questions");
		const sources = field(contract, "sources");
		assert.ok(Array.isArray(questions), `${name}: missing questions`);
		assert.ok(Array.isArray(sources), `${name}: missing sources`);
		for (const question of questions) {
			const needs = field(question, "needs");
			assert.ok(Array.isArray(needs), `${name}: missing needs`);
			for (const need of needs) {
				assert.ok(
					markdown.includes(String(field(need, "id"))),
					`${name}: missing need direction ${String(field(need, "id"))}`,
				);
				assert.ok(
					markdown.includes(String(field(need, "onMissing"))),
					`${name}: missing policy ${String(field(need, "onMissing"))}`,
				);
			}
		}
		for (const source of sources) {
			assert.ok(
				markdown.includes(String(field(source, "id"))),
				`${name}: missing source direction ${String(field(source, "id"))}`,
			);
		}
	}
});

test("L1 red: chooser vocabulary names Pi skills rather than routes", async () => {
	const [learning, tui] = await Promise.all([
		readFile(join(root, "extensions/learning.ts"), "utf8"),
		readFile(join(root, "extensions/tui.ts"), "utf8"),
	]);
	const combined = `${learning}\n${tui}`;
	for (const name of [
		"LEARNING_SKILL_NAMES",
		"LearningSkillName",
		"parseLearningSkillName",
		"learningSkillItems",
		"prepareLearningSkill",
	]) {
		assert.ok(combined.includes(name), `Missing Learning skill name: ${name}`);
	}
	assert.doesNotMatch(
		combined,
		/LEARNING_ROUTES|LearningRoute|parseLearningAction|prepareLearningAction/u,
	);
});
