import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import { parse } from "yaml";

import {
	extractLearningContextDirections,
	parseLearningJudgmentPolicy,
	renderLearningContextDirections,
} from "./context-directions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSkills = [
	"conceptualize",
	"exercise",
	"opensource-reading",
	"patternize",
	"technical-reading",
];

async function readJson(path, label) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(`Invalid ${label} JSON at ${path}.`, { cause: error });
	}
}

const manifest = await readJson(join(root, "package.json"), "package manifest");
assert.equal(manifest.name, "@hobin/learning");
assert.equal(manifest.version, "0.1.1");
assert.equal(manifest.private, true);
assert.deepEqual(manifest.files, [
	"extensions",
	"references",
	"skills",
	"docs",
	"README.md",
	"README.ko.md",
	"LICENSE",
]);
assert.deepEqual(manifest.pi.extensions, ["./extensions/learning.ts"]);
assert.deepEqual(manifest.pi.skills, ["./skills"]);
assert.deepEqual(manifest.devDependencies, {
	"@hobin/judgment": "workspace:^0.1.0",
	yaml: "^2.9.0",
});
assert.equal(manifest.dependencies, undefined);
assert.equal(manifest.bundledDependencies, undefined);
assert.deepEqual(manifest.peerDependencies, {
	"@earendil-works/pi-coding-agent": "*",
	"@earendil-works/pi-tui": "*",
});
assert.equal(
	manifest.pi.extensions.includes("../judgment/extensions/judgment.ts"),
	false,
);
assert.equal(manifest.pi.skills.includes("../judgment/skills"), false);

const entries = await readdir(join(root, "skills"), { withFileTypes: true });
const skills = entries
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
assert.deepEqual(skills, expectedSkills);

const loaded = loadSkillsFromDir({
	dir: join(root, "skills"),
	source: "@hobin/learning",
});
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(
	loaded.skills.map((skill) => skill.name).sort(),
	expectedSkills,
);

const codexSyntax =
	/\$learning:|\$(?:technical-reading|opensource-reading|conceptualize|patternize|exercise)|learning:(?:technical-reading|opensource-reading|conceptualize|patternize|exercise)/;
const englishDocNames = (
	await readdir(join(root, "docs"), {
		withFileTypes: true,
	})
)
	.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
	.map((entry) => entry.name)
	.sort();
const koreanDocNames = (
	await readdir(join(root, "docs/ko"), {
		withFileTypes: true,
	})
)
	.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
	.map((entry) => entry.name)
	.sort();
assert.deepEqual(koreanDocNames, englishDocNames);
const markdownDocuments = [
	"README.md",
	"README.ko.md",
	"references/skill-boundaries.md",
	...englishDocNames.map((name) => `docs/${name}`),
	...koreanDocNames.map((name) => `docs/ko/${name}`),
];

for (const name of skills) {
	const skillRoot = join(root, "skills", name);
	const skillPath = join(skillRoot, "SKILL.md");
	const source = await readFile(skillPath, "utf8");
	assert.match(source, new RegExp(`^---\\nname: ${name}(?:\\n|$)`, "m"));
	assert.match(source, /^description:/m);
	assert.match(source, /^## Context Directions$/mu);
	assert.match(source, /\[judgment\.json\]\(judgment\.json\)/i);
	assert.doesNotMatch(source, /^## Judgment Guidance$/mu);
	assert.doesNotMatch(source, /reference-policy|read order|read_order/i);
	assert.doesNotMatch(source, codexSyntax);
	assert.doesNotMatch(
		source,
		/validate_learning_artifact|graph-artifact-standard|concepts\/context\.jsonld/,
	);

	const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	assert.ok(frontmatterMatch, `Expected skill frontmatter: ${name}`);
	const frontmatter = parse(frontmatterMatch[1]);
	assert.equal(frontmatter.name, name);
	assert.equal(typeof frontmatter.description, "string");
	assert.ok(
		frontmatter.description.length > 0,
		`Description is missing: ${name}`,
	);
	assert.ok(
		frontmatter.description.length <= 1024,
		`Description is too long: ${name}`,
	);
	assert.doesNotMatch(frontmatter.description, /\bskip\b/i);

	const children = await readdir(skillRoot, { withFileTypes: true });
	assert.equal(
		children.some((entry) => entry.name === "agents"),
		false,
	);
	const referenceDir = join(skillRoot, "references");
	const referenceEntries = await readdir(referenceDir, { withFileTypes: true });
	const references = referenceEntries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => `references/${entry.name}`)
		.sort();
	assert.ok(references.length > 0, `Expected judgment guidance: ${name}`);

	const judgmentPath = join(skillRoot, "judgment.json");
	const policySource = await readFile(judgmentPath, "utf8");
	const policy = parseLearningJudgmentPolicy(policySource);
	assert.ok(policy.when.length > 0);
	assert.ok(policy.unless.length > 0);
	assert.equal(
		extractLearningContextDirections(source),
		renderLearningContextDirections(policy),
		`Context Directions drift: ${name}`,
	);
	const coveredReferences = new Set();
	for (const reference of policy.references) {
		assert.match(reference.path, /^references\/[^/]+\.md$/u);
		assert.ok(
			references.includes(reference.path),
			`Unknown prepared reference: ${name}/${reference.path}`,
		);
		assert.ok(reference.when.length > 0);
		coveredReferences.add(reference.path);
	}
	for (const legacy of [
		"decisionUnit",
		"questions",
		"needs",
		"sourceIds",
		"canInform",
		"routeId",
		"useWhen",
		"useFor",
	]) {
		assert.doesNotMatch(policySource, new RegExp(`"${legacy}"`, "u"));
	}
	assert.deepEqual(
		[...coveredReferences].sort(),
		references,
		`Ungoverned conditional reference: ${name}`,
	);

	await assert.rejects(access(join(skillRoot, "reference-policy.json")));
	markdownDocuments.push(
		`skills/${name}/SKILL.md`,
		...references.map((path) => `skills/${name}/${path}`),
	);
}

for (const documentPath of markdownDocuments) {
	const absoluteDocumentPath = join(root, documentPath);
	const source = await readFile(absoluteDocumentPath, "utf8");
	for (const match of source.matchAll(/\]\(([^)]+\.md)\)/g)) {
		await readFile(join(dirname(absoluteDocumentPath), match[1]), "utf8");
	}
}

await assert.rejects(access(join(root, "references/reference-routing.md")));
await assert.rejects(access(join(root, "references/judgment-guidance.md")));
await assert.rejects(access(join(root, "extensions/artifact-validator.ts")));
await assert.rejects(
	access(join(root, "references/graph-artifact-standard.md")),
);
assert.match(await readFile(join(root, "LICENSE"), "utf8"), /^MIT License$/m);

const extension = await readFile(join(root, "extensions/learning.ts"), "utf8");
assert.match(extension, /registerCommand\("learning"/);
assert.doesNotMatch(extension, /registerTool|validate_learning_artifact/);

const tui = await readFile(join(root, "extensions/tui.ts"), "utf8");
assert.match(tui, /SelectList/);
assert.match(tui, /LEARNING_SKILL_NAMES/);
assert.match(tui, /showLearningSkillSelector/);
assert.match(tui, /prepareLearningSkill/);
assert.doesNotMatch(
	tui,
	/LEARNING_ROUTES|LearningRoute|parseLearningAction|prepareLearningAction/u,
);
assert.match(tui, /setEditorText/);
assert.doesNotMatch(
	tui,
	/validate_learning_artifact|value:\s*"validate"|Validate a saved artifact/,
);

const evalScript = await readFile(join(root, "scripts/eval-rpc.mjs"), "utf8");
assert.match(evalScript, /"skill:technical-reading"/);
assert.doesNotMatch(evalScript, /validate_learning_artifact/);
assert.match(evalScript, /LEARNING_EVAL_PACKAGE_PATH/);
assert.doesNotMatch(evalScript, /node:readline/);

process.stdout.write(
	"learning package structure and optional-reference Context Directions are consistent\n",
);
