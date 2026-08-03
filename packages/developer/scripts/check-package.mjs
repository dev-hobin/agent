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
assert.equal(manifest.version, "0.1.18");
assert.equal(manifest.private, undefined);
assert.deepEqual(manifest.files, [
	"extensions",
	"skills",
	"src",
	"docs",
	"README.md",
	"README.ko.md",
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
	...englishDocNames.map((name) => `docs/${name}`),
	...koreanDocNames.map((name) => `docs/ko/${name}`),
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
const documentedGuides = [
	"how-it-works.md",
	"user-guide.md",
	"runtime-protocol.md",
];
for (const path of documentedGuides.map((name) => `docs/${name}`))
	assert.match(readme, new RegExp(path.replaceAll("/", "\\/"), "u"));
const koreanReadme = await readFile(join(root, "README.ko.md"), "utf8");
for (const path of documentedGuides.map((name) => `docs/ko/${name}`))
	assert.match(koreanReadme, new RegExp(path.replaceAll("/", "\\/"), "u"));
assert.match(readme, /Try this first/u);
assert.match(readme, /RouteDefinition/u);
assert.match(readme, /Receipt observer/u);

const howItWorks = await readFile(join(root, "docs/how-it-works.md"), "utf8");
for (const term of [
	"Stable Routes and dynamic frames",
	"Descriptor-first routing",
	"Skill returns are candidates",
	"Frame completion is reducer-guarded",
	"Authorization and landing are root capabilities",
	"Runtime history is one exact v8 chain",
	"Receipts are the only TUI data source",
])
	assert.match(howItWorks, new RegExp(term, "u"));

const runtimeProtocol = await readFile(
	join(root, "docs/runtime-protocol.md"),
	"utf8",
);
for (const term of [
	"developer/v8",
	"developer.runtime",
	"RouteDefinition",
	"RouteFrame",
	"developer_open_judgment",
	"developer_open_context_sources",
	"developer_conclude_judgment",
	"developer_authorize_change",
	"developer_record_landing",
	"branchResultId",
	"scopeSequence",
	"receipt",
])
	assert.match(runtimeProtocol, new RegExp(term, "u"));

const entrypoint = await readFile(
	join(root, "extensions/developer.ts"),
	"utf8",
);
assert.equal(entrypoint.trim(), 'export { default } from "./developer-v8.ts";');
assert.doesNotMatch(entrypoint, /developerV7|package-check sentinels/u);

const extension = await readFile(
	join(root, "extensions/developer-v8.ts"),
	"utf8",
);
for (const toolConstant of [
	"OPEN_JUDGMENT_TOOL",
	"OPEN_CONTEXT_SOURCES_TOOL",
	"CONCLUDE_JUDGMENT_TOOL",
	"AUTHORIZE_CHANGE_TOOL",
	"RECORD_LANDING_TOOL",
])
	assert.ok(extension.includes(`name: ${toolConstant}`));
assert.match(extension, /registerCommand\("developer"/u);
assert.match(extension, /registerFlag\("developer"/u);
assert.match(extension, /event\.systemPromptOptions\.skills/u);
assert.match(extension, /DEVELOPER_RUNTIME_ENTRY/u);
assert.doesNotMatch(extension, /developer-v7|from "\.\.\/src\/protocol\.ts"/u);
assert.doesNotMatch(extension, /loadSkillsFromDir/u);

const receiptTui = await readFile(
	join(root, "extensions/developer-receipt-tui.ts"),
	"utf8",
);
assert.match(receiptTui, /projectionReadTarget/u);
assert.match(receiptTui, /readCurrentReceiptPage/u);
assert.match(receiptTui, /overlay:\s*true/u);
assert.doesNotMatch(
	receiptTui,
	/appendEntry|registerTool|setActiveTools|runtime-transition|runtime-root|developer-runtime-state|prepareDeveloperRuntimeBatch|reconcileProtocolTools/u,
);

const publicIndex = await readFile(join(root, "src/index.ts"), "utf8");
for (const moduleName of [
	"runtime-tools",
	"runtime-protocol",
	"routing-context",
	"runtime-transition",
	"runtime-root",
	"runtime-replay",
	"receipt-projection",
	"projection-coordinator",
])
	assert.match(publicIndex, new RegExp(`\\./${moduleName}\\.ts`, "u"));
assert.doesNotMatch(
	publicIndex,
	/"\.\/protocol\.ts"|"\.\/replay\.ts"|"\.\/transition\.ts"|context-basis/u,
);

const evalOutcome = await readFile(
	join(root, "scripts/eval-outcome.mjs"),
	"utf8",
);
assert.match(evalOutcome, /developer\/v8-result/u);
assert.match(evalOutcome, /parseDeveloperRuntimeResultDetails/u);
assert.match(evalOutcome, /no valid Developer v8 result details/u);
assert.doesNotMatch(
	evalOutcome,
	/src\/protocol\.ts|src\/transition\.ts|parseDeveloperStatus/u,
);
for (const runner of ["eval-json.mjs", "eval-rpc.mjs"]) {
	const source = await readFile(join(root, "scripts", runner), "utf8");
	assert.match(source, /statusFromDeveloperEvents/u);
	assert.doesNotMatch(source, /parseDeveloperStatus/u);
}

for (const path of [
	"src/protocol.ts",
	"src/replay.ts",
	"src/transition.ts",
	"tests/protocol-v7.test.ts",
	"extensions/developer-v7.ts",
	"extensions/developer-workbench.ts",
	"extensions/developer-workbench-tui.ts",
	"extensions/developer-settings-tui.ts",
	"extensions/machine.ts",
	"extensions/state.ts",
	"extensions/tui.ts",
])
	await assert.rejects(access(join(root, path)));

for (const path of [
	"extensions/developer-v8.ts",
	"extensions/developer-runtime-state.ts",
	"extensions/developer-context.ts",
	"extensions/developer-conclusion.ts",
	"extensions/developer-receipt-tui.ts",
	"src/runtime-tools.ts",
	"src/runtime-protocol.ts",
	"src/runtime-transition.ts",
]) {
	const source = await readFile(join(root, path), "utf8");
	assert.doesNotMatch(
		source,
		/developer-v7|developer\/v7|from "\.\.\/src\/protocol\.ts"|opened_questions|question_updates|resolution_owner|GuidanceLoad|GuidanceRoute|GuidanceExemption|availableGuidance|guidanceRoutes|loadedGuidance|guidance_synthesis|guidance_exemption/u,
		`Live/public legacy runtime dependency remains in ${path}.`,
	);
}
for (const path of [
	"README.md",
	"README.ko.md",
	"docs/how-it-works.md",
	"docs/ko/how-it-works.md",
	"docs/runtime-protocol.md",
	"docs/ko/runtime-protocol.md",
	"docs/user-guide.md",
	"docs/ko/user-guide.md",
]) {
	const source = await readFile(join(root, path), "utf8");
	assert.doesNotMatch(
		source,
		/developer\/v7|ActiveJudgment|AuthorizedChange|ImplementationLanding|PendingQuestion|Workbench|워크벤치/u,
		`Stale Developer runtime promise remains in ${path}.`,
	);
}
await assert.rejects(access(join(root, "GUIDANCE_ROUTING.md")));
await assert.rejects(access(join(root, "CONTEXT_CONTRACTS.md")));
await assert.rejects(access(join(root, "extensions/skills.ts")));
assert.match(await readFile(join(root, "LICENSE"), "utf8"), /^MIT License$/mu);
