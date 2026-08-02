import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import {
	extractDeveloperContextDirections,
	parseDeveloperJudgmentPolicy,
	renderDeveloperContextDirections,
} from "./context-directions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSkills = [
	"abstraction-review",
	"adversarial-eval",
	"doctor",
	"model",
	"naming-judgment",
	"schedule",
	"signal",
	"sketch",
	"specify",
	"verify",
	"visualize",
];
const policySkills = new Set([
	"abstraction-review",
	"model",
	"naming-judgment",
	"schedule",
	"signal",
	"sketch",
	"verify",
]);
async function readJson(path, label = "JSON") {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(`Invalid ${label} at ${path}.`, { cause: error });
	}
}
function missing(error) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "ENOENT"
	);
}

const manifest = await readJson(join(root, "package.json"), "package manifest");
assert.equal(manifest.name, "@hobin/developer");
assert.equal(manifest.version, "0.1.17");
assert.equal(manifest.private, true);
assert.deepEqual(manifest.files, [
	"extensions",
	"skills",
	"src",
	"docs",
	"README.md",
	"JUDGMENT_POLICIES.md",
	"LICENSE",
]);
assert.deepEqual(manifest.exports, { ".": "./src/index.ts" });
assert.deepEqual(manifest.pi.extensions, ["./extensions/developer.ts"]);
assert.deepEqual(manifest.pi.skills, ["./skills"]);
assert.deepEqual(manifest.dependencies, {
	"@hobin/judgment": "workspace:^0.1.0",
});
assert.equal(manifest.bundledDependencies, undefined);
assert.equal(manifest.devDependencies.typebox, "1.1.38");
for (const dependency of [
	"@earendil-works/pi-ai",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"typebox",
])
	assert.equal(manifest.peerDependencies[dependency], "*");
assert.equal(manifest.dependencies.xstate, undefined);
assert.equal(
	manifest.files.includes("SOURCES.md") ||
		manifest.files.includes("source-audits"),
	false,
);

const skillEntries = await readdir(join(root, "skills"), {
	withFileTypes: true,
});
const skillNames = skillEntries
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
assert.deepEqual(skillNames, expectedSkills);
const loaded = loadSkillsFromDir({
	dir: join(root, "skills"),
	source: "@hobin/developer",
});
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(
	loaded.skills.map((skill) => skill.name).sort(),
	expectedSkills,
);
const markdownDocuments = [
	"README.md",
	"JUDGMENT_POLICIES.md",
	...(await readdir(join(root, "docs"), { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => `docs/${entry.name}`),
];

for (const skillName of skillNames) {
	const skillRoot = join(root, "skills", skillName);
	const skillPath = join(skillRoot, "SKILL.md");
	const source = await readFile(skillPath, "utf8");
	assert.match(source, new RegExp(`^---\\nname: ${skillName}(?:\\n|$)`, "m"));
	assert.match(source, /^description:/mu);
	assert.match(
		source,
		/^Status: resolved \| needs-evidence \| not-applicable \| blocked$/mu,
	);
	assert.doesNotMatch(
		source,
		/GuidanceSet|developer_load_guidance|guidance_synthesis|guidance_exemption/iu,
	);
	const children = await readdir(skillRoot, { withFileTypes: true });
	const referenceDirectory = children.find(
		(entry) => entry.isDirectory() && entry.name === "references",
	);
	const references = referenceDirectory
		? (await readdir(join(skillRoot, "references"), { withFileTypes: true }))
				.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
				.map((entry) => `references/${entry.name}`)
				.sort()
		: [];
	let policySource;
	try {
		policySource = await readFile(join(skillRoot, "judgment.json"), "utf8");
	} catch (error) {
		if (!missing(error)) throw error;
	}
	if (policySkills.has(skillName)) {
		assert.equal(
			typeof policySource,
			"string",
			`${skillName} must have judgment.json`,
		);
		const policy = parseDeveloperJudgmentPolicy(policySource);
		assert.equal(
			extractDeveloperContextDirections(source),
			renderDeveloperContextDirections(policy),
			`Context Directions drift: ${skillName}`,
		);
		assert.deepEqual(
			policy.references.map((reference) => reference.path).sort(),
			references,
			`Every packaged reference must appear once: ${skillName}`,
		);
		assert.ok(policy.when.length > 0);
		assert.ok(policy.unless.length > 0);
		for (const reference of policy.references)
			assert.ok(reference.when.length > 0);
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
			assert.doesNotMatch(policySource, new RegExp(`"${legacy}"`, "u"));
	} else {
		assert.equal(
			policySource,
			undefined,
			`${skillName} has no conditional packaged references and must not own judgment.json`,
		);
		assert.equal(references.length, 0);
		assert.equal(extractDeveloperContextDirections(source), undefined);
	}
	for (const reference of references) {
		const referenceSource = await readFile(join(skillRoot, reference), "utf8");
		assert.ok(referenceSource.trim().length > 0);
		assert.match(referenceSource, /## Source Trace/u);
		const trace = referenceSource.split("## Source Trace", 2)[1] ?? "";
		assert.doesNotMatch(trace, /\[[^\]\n]+\]\([^)\n]+\)/u);
		markdownDocuments.push(`skills/${skillName}/${reference}`);
	}
	markdownDocuments.push(`skills/${skillName}/SKILL.md`);
}
for (const documentPath of markdownDocuments) {
	const absolutePath = join(root, documentPath);
	const source = await readFile(absolutePath, "utf8");
	for (const match of source.matchAll(/\]\(([^)]+\.md)\)/gu)) {
		if (/^[a-z][a-z0-9+.-]*:/iu.test(match[1])) continue;
		await readFile(join(dirname(absolutePath), match[1]), "utf8");
	}
}

const readme = await readFile(join(root, "README.md"), "utf8");
assert.match(readme, /What changed from 0\.1\.16/u);
assert.match(readme, /docs\/migration-from-0\.1\.md/u);
assert.match(readme, /docs\/judgment-reference-routing\.md/u);
assert.match(readme, /docs\/runtime-flow\.md/u);
const routing = await readFile(
	join(root, "docs/judgment-reference-routing.md"),
	"utf8",
);
for (const term of [
	"Skill Applicability and Reference Selection",
	"no root `contractId`",
	"Decided authoring shape",
	'"when"',
	'"unless"',
	'"references"',
	"Dynamic judgment question",
	"Package-external context",
])
	assert.match(
		routing,
		new RegExp(term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
	);
const migration = await readFile(
	join(root, "docs/migration-from-0.1.md"),
	"utf8",
);
for (const term of [
	"developer/v6",
	"developer/v7",
	"developer_route_question",
	"developer_load_guidance",
	"developer_record_judgment",
	"developer_open_judgment",
	"developer_open_context_sources",
	"developer_conclude_judgment",
	"developer_authorize_change",
	"developer_record_landing",
	"changedArtifacts",
	"branchResultId",
	"unsupported",
])
	assert.match(migration, new RegExp(term, "u"));

const extension = await readFile(join(root, "extensions/developer.ts"), "utf8");
for (const toolName of [
	"developer_open_judgment",
	"developer_conclude_judgment",
	"developer_authorize_change",
	"developer_record_landing",
])
	assert.ok(extension.includes(`name: "${toolName}"`));
assert.match(extension, /name: OPEN_CONTEXT_SOURCES_TOOL/u);
assert.match(extension, /registerCommand\("developer"/u);
assert.match(extension, /registerFlag\("developer"/u);
assert.match(extension, /event\.systemPromptOptions\.skills/u);
assert.match(extension, /ctx\.ui\.confirm/u);
assert.doesNotMatch(
	extension,
	/developer_route_question|developer_record_judgment|developer_load_guidance|changedArtifacts|GuidanceSet|contextContract|contractSourceId|needApplicability/u,
);
assert.doesNotMatch(extension, /loadSkillsFromDir/u);
const protocol = await readFile(join(root, "src/protocol.ts"), "utf8");
const transition = await readFile(join(root, "src/transition.ts"), "utf8");
const replay = await readFile(join(root, "src/replay.ts"), "utf8");
assert.match(protocol, /developer\/v7/u);
for (const term of [
	"ActiveJudgment",
	"ContextSourcesOpened",
	"AuthorizedChange",
	"JudgmentConcluded",
	"LandingRecorded",
	"ContributionBasis",
])
	assert.match(protocol, new RegExp(term, "u"));
assert.match(transition, /transitionDeveloper/u);
assert.match(replay, /unsupported-v6/u);
assert.doesNotMatch(
	protocol,
	/developer\/v6|changedArtifacts|activeRoute|ContextContract|NeedCoverageBasis/u,
);
for (const path of [
	"extensions/developer.ts",
	"extensions/state.ts",
	"extensions/machine.ts",
	"extensions/developer-context.ts",
	"extensions/skill-catalog.ts",
	"extensions/developer-workbench.ts",
	"src/protocol.ts",
	"src/transition.ts",
]) {
	const source = await readFile(join(root, path), "utf8");
	assert.doesNotMatch(
		source,
		/GuidanceLoad|GuidanceRoute|GuidanceExemption|availableGuidance|guidanceRoutes|judgmentSpecSha256|loadedGuidance|guidance_synthesis|guidance_exemption|contractSourceId|needApplicability/u,
		`Legacy runtime vocabulary remains in ${path}.`,
	);
}
await assert.rejects(access(join(root, "GUIDANCE_ROUTING.md")));
await assert.rejects(access(join(root, "CONTEXT_CONTRACTS.md")));
await assert.rejects(access(join(root, "extensions/skills.ts")));
assert.match(await readFile(join(root, "LICENSE"), "utf8"), /^MIT License$/mu);
const workbench = await readFile(
	join(root, "extensions/developer-workbench.ts"),
	"utf8",
);
assert.match(
	workbench,
	/Overview[\s\S]*Active work[\s\S]*Questions[\s\S]*Judgments[\s\S]*Landings[\s\S]*Settings/u,
);
assert.doesNotMatch(
	workbench,
	/loadedGuidance|guidanceRoutes|contextContract/u,
);
const tui = await readFile(join(root, "extensions/tui.ts"), "utf8");
assert.match(tui, /showPendingQuestionSelector/u);
assert.match(tui, /overlay:\s*true/u);
assert.match(
	await readFile(join(root, "extensions/developer-workbench-tui.ts"), "utf8"),
	/DeveloperWorkbenchSurface/u,
);
console.log(
	"developer package structure and optional Judgment policies are consistent",
);
