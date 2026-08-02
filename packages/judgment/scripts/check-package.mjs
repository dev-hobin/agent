import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import {
	JudgmentAuthoringJsonSchema,
	parseJudgmentAuthoringPolicyJson,
} from "../src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
async function readJson(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(`Invalid JSON at ${path}.`, { cause: error });
	}
}
const manifest = await readJson(join(root, "package.json"));
assert.equal(manifest.name, "@hobin/judgment");
assert.equal(manifest.version, "0.1.0");
assert.equal(manifest.private, true);
assert.deepEqual(manifest.publishConfig, { access: "public" });
assert.deepEqual(manifest.files, [
	"extensions",
	"skills",
	"schemas",
	"docs",
	"src",
	"dist",
	"bin",
	"README.md",
	"LICENSE",
]);
assert.deepEqual(manifest.bin, { judgment: "./bin/judgment.mjs" });
assert.equal(manifest.types, "./src/index.ts");
assert.deepEqual(manifest.pi, {
	extensions: ["./extensions/judgment.ts"],
	skills: ["./skills"],
});
assert.deepEqual(manifest.peerDependencies, {
	"@earendil-works/pi-ai": "*",
	"@earendil-works/pi-coding-agent": "*",
	typebox: "*",
});
assert.deepEqual(manifest.dependencies, {});
assert.deepEqual(manifest.exports, {
	".": {
		types: "./src/index.ts",
		import: "./dist/index.mjs",
		default: "./dist/index.mjs",
	},
	"./node": {
		types: "./src/node/seal-context.ts",
		import: "./dist/index.mjs",
		default: "./dist/index.mjs",
	},
	"./pi-context": {
		types: "./extensions/pi-context.ts",
		import: "./dist/index.mjs",
		default: "./dist/index.mjs",
	},
	"./schema": "./schemas/judgment-authoring.schema.json",
});
const publicApi = await readFile(join(root, "dist/index.mjs"), "utf8");
assert.doesNotMatch(publicApi, /(?:from\s+|import\()["'][^"']+\.ts["']/u);
for (const symbol of [
	"parseJudgmentAuthoringPolicyJson",
	"createNodeLocalReferenceReader",
	"ContextAttempt",
])
	assert.match(publicApi, new RegExp(`\\b${symbol}\\b`, "u"));
assert.deepEqual(
	await readJson(join(root, "schemas/judgment-authoring.schema.json")),
	JudgmentAuthoringJsonSchema,
);
await assert.rejects(access(join(root, "schemas/judgment.schema.json")));

const markdownPaths = [
	"README.md",
	"docs/compiled-policy-and-runtime.md",
	"docs/runtime-integration.md",
	"docs/runtime-flow.md",
	"docs/authoring-schema-v0.1.md",
	"docs/external-context-composition.md",
];
const markdown = new Map();
for (const path of markdownPaths) {
	const source = await readFile(join(root, path), "utf8");
	markdown.set(path, source);
	for (const match of source.matchAll(/\]\(([^)]+\.md)\)/gu)) {
		if (/^[a-z][a-z0-9+.-]*:/iu.test(match[1])) continue;
		await readFile(join(dirname(join(root, path)), match[1]), "utf8");
	}
}
const authoring = markdown.get("docs/authoring-schema-v0.1.md");
assert.equal(typeof authoring, "string");
const example = authoring.match(
	/## Canonical authored shape\s*```json\s*([^]*?)```/u,
)?.[1];
assert.ok(example);
const parsed = parseJudgmentAuthoringPolicyJson(example);
assert.equal(parsed.specVersion, "0.1");
assert.ok(parsed.when.length > 0);
assert.ok(parsed.unless.length > 0);
assert.ok(parsed.references.length > 0);
for (const legacy of [
	"decisionUnit",
	"questions",
	"needs",
	"sourceIds",
	"canInform",
	"routeId",
	"useWhen",
	"useFor",
])
	assert.doesNotMatch(example, new RegExp(`"${legacy}"`, "u"));
const readme = markdown.get("README.md");
assert.match(readme, /Judgment Authoring Policy Schema 0\.1/u);
assert.match(readme, /External Context Composition/u);
assert.match(readme, /Runtime Flow/u);
assert.match(readme, /"specVersion": "0\.1"/u);
const decision = authoring;
assert.match(decision, /`unless` is an exclusion/u);
assert.match(
	decision,
	/Runtime questions are created from the current task and evidence/u,
);
assert.match(decision, /Every reference `when` statement must name both/u);

const loaded = loadSkillsFromDir({
	dir: join(root, "skills"),
	source: "@hobin/judgment",
});
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(
	loaded.skills.map((skill) => skill.name),
	["judgment"],
);
const extension = await readFile(join(root, "extensions/judgment.ts"), "utf8");
for (const tool of [
	"judgment_open_context",
	"judgment_assess_applicability",
	"judgment_select_context",
	"judgment_assess_coverage",
	"judgment_conclude",
])
	assert.match(extension, new RegExp(`name: ["']${tool}["']`));
assert.equal(
	(extension.match(/executionMode: "sequential"/gu) ?? []).length,
	5,
);
assert.match(extension, /before_agent_start/u);
assert.match(extension, /getAllTools\(\)/u);
assert.match(extension, /getBranch\(\)/u);
assert.match(extension, /loadOptionalJudgmentPolicyFile/u);
const cli = await readFile(join(root, "bin/judgment.mjs"), "utf8");
for (const command of ["check", "compile", "explain"])
	assert.match(cli, new RegExp(`"${command}"`, "u"));
assert.doesNotMatch(cli, /(?:from\s+|import\()["'][^"']+\.ts["']/u);

for (const removed of [
	"contract.ts",
	"node/read-context-contract.ts",
	"admission.ts",
	"guidance.ts",
	"runtime.ts",
	"spec.ts",
	"state.ts",
	"synthesis.ts",
	"reducer.ts",
	"machine.ts",
	"node/load-guidance-set.ts",
])
	await assert.rejects(access(join(root, "src", removed)));
async function* files(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.name === "node_modules") continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (entry.isFile()) yield path;
	}
}
for await (const path of files(root)) {
	if (extname(path) !== ".ts") continue;
	const source = await readFile(path, "utf8");
	assert.doesNotMatch(
		source,
		/\bas\s+(?:unknown\s+as|const\b|never\b|[A-Z][A-Za-z0-9_$]*(?:<|\b))/u,
		`Unsafe type assertion in ${relative(root, path)}`,
	);
	assert.doesNotMatch(
		source,
		/Value\.Check|\bCheck\(/u,
		`Validation-only boundary in ${relative(root, path)}`,
	);
}
assert.match(await readFile(join(root, "LICENSE"), "utf8"), /^MIT License$/m);
process.stdout.write(
	"judgment authoring policy, dynamic runtime, skill, and adapter are consistent\n",
);
