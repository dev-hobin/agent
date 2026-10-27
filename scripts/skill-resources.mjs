// Repository-owned authoring checks, not an Agent Skills runtime or validator.
import assert from "node:assert/strict";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import {
	extractLearningContextDirections,
	parseLearningJudgmentPolicy,
	renderLearningContextDirections,
} from "../packages/learning/scripts/context-directions.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const schemaPath = new URL("../schemas/skill-references-v0.1.schema.json", import.meta.url);
const schema = parseJson(await readFile(schemaPath, "utf8"), fileURLToPath(schemaPath));
const validateReferences = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

function parseJson(source, path) {
	try {
		return JSON.parse(source);
	} catch (error) {
		throw new SyntaxError(`Invalid JSON at ${path}`, { cause: error });
	}
}

export async function canonicalSkillDirectories() {
	const roots = ["skills", "packages/developer/skills", "packages/learning/skills"];
	const catalogs = await Promise.all(roots.map(async (path) => {
		const root = join(repositoryRoot, path);
		const entries = await readdir(root, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(root, entry.name))
			.sort();
	}));
	return catalogs.flat();
}

async function containedFile(skillDir, path) {
	assert.equal(typeof path, "string", "Resource path must be a string");
	assert.ok(
		path && path === path.trim() && !path.includes("\\") && !path.includes("\0"),
		`Invalid resource path: ${path}`,
	);
	assert.ok(
		!isAbsolute(path) && !/^[A-Za-z]:/.test(path) &&
		posix.normalize(path) === path &&
		!path.split("/").some((part) => !part || part === "." || part === ".."),
		`Resource path must be normalized and relative: ${path}`,
	);
	const root = await realpath(skillDir);
	const target = await realpath(join(root, path));
	const offset = relative(root, target);
	assert.ok(
		offset && offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset),
		`Resource escapes Skill directory: ${path}`,
	);
	const info = await stat(target);
	assert.ok(info.isFile(), `Resource is not a file: ${path}`);
	return target;
}

async function optionalJson(skillDir, name) {
	let source;
	try {
		source = await readFile(join(skillDir, name), "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return undefined;
		throw error;
	}
	return parseJson(source, join(skillDir, name));
}

export async function checkSkillResources(skillDir) {
	const markdown = await readFile(join(skillDir, "SKILL.md"), "utf8");
	// Check simple local Markdown/JSON links in the entry point. Policy targets
	// below also cover generated directions that use code spans instead of links.
	for (const match of markdown.matchAll(/\]\(([^\s)]+)\)/gu)) {
		const target = match[1].split("#")[0];
		if (!target || /^https?:\/\//u.test(target)) continue;
		if (/\.(?:md|json)$/u.test(target)) await containedFile(skillDir, target);
	}

	const references = await optionalJson(skillDir, "references.json");
	if (references !== undefined) {
		assert.ok(
			validateReferences(references),
			`Invalid Skill References: ${JSON.stringify(validateReferences.errors)}`,
		);
		for (const reference of references.references) {
			await containedFile(skillDir, reference.path);
		}
	}

	const judgment = await optionalJson(skillDir, "judgment.json");
	if (judgment !== undefined) {
		const policy = parseLearningJudgmentPolicy(JSON.stringify(judgment));
		assert.equal(
			extractLearningContextDirections(markdown),
			renderLearningContextDirections(policy),
			"Context Directions drift",
		);
		for (const reference of policy.references) {
			await containedFile(skillDir, reference.path);
		}
	}
}
