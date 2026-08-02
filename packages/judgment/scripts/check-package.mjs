import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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
assert.deepEqual(manifest.pi, {});
assert.deepEqual(manifest.peerDependencies, { typebox: "*" });
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
		types: "./src/pi-context/index.ts",
		import: "./dist/index.mjs",
		default: "./dist/index.mjs",
	},
	"./schema": "./schemas/judgment-authoring.schema.json",
});
await assert.rejects(access(join(root, "extensions")));
await assert.rejects(access(join(root, "skills")));
const publicApi = await readFile(join(root, "dist/index.mjs"), "utf8");
assert.doesNotMatch(publicApi, /(?:from\s+|import\()["'][^"']+\.ts["']/u);
for (const symbol of [
	"parseJudgmentAuthoringPolicyJson",
	"createNodeLocalReferenceReader",
	"ContextAttempt",
	"buildPiContextInventory",
]) {
	assert.match(publicApi, new RegExp(`\\b${symbol}\\b`, "u"));
}
for (const removedRuntime of [
	"judgment_open_context",
	"judgment_assess_applicability",
	"judgment_select_context",
	"judgment_assess_coverage",
	"judgment_conclude",
]) {
	assert.doesNotMatch(publicApi, new RegExp(`\\b${removedRuntime}\\b`, "u"));
}
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
const readme = markdown.get("README.md");
assert.match(readme, /side-effect-free engine/u);
assert.match(readme, /External Context Composition/u);
assert.doesNotMatch(readme, /Direct Pi package/u);
const cli = await readFile(join(root, "bin/judgment.mjs"), "utf8");
for (const command of ["check", "compile", "explain"]) {
	assert.match(cli, new RegExp(`"${command}"`, "u"));
}
assert.doesNotMatch(cli, /(?:from\s+|import\()["'][^"']+\.ts["']/u);

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
	"judgment authoring policy and side-effect-free engine are consistent\n",
);
