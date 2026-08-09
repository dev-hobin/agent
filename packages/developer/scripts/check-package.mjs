import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

import { MODEL_FACING_ACTION_LOOP_TOOLS } from "../extensions/action-loop-model-tools.ts";
import { SDK_PROPOSAL_STAGES } from "../src/action-loop/sdk/proposal-prompt.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(
			`Failed to read JSON fixture ${path}: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		);
	}
}

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

const manifest = await readJson(join(root, "package.json"));
assert.equal(manifest.name, "@hobin/developer");
assert.equal(manifest.version, "0.1.20");
assert.equal(manifest.dependencies?.xstate, undefined);
assert.deepEqual(manifest.pi.extensions, ["./extensions/developer.ts"]);
assert.deepEqual(manifest.pi.skills, ["./skills"]);
assert.equal(manifest.scripts.eval, undefined);
assert.equal(manifest.scripts["eval:json"], undefined);
assert.equal(manifest.scripts["eval:live"], undefined);
assert.equal(manifest.scripts["eval:live:json"], undefined);
assert.equal(manifest.scripts["eval:live:sdk"], undefined);
const expectedEvaluatorScripts = {
	"eval:live:sdk:routing": "node scripts/eval-sdk-routing.ts",
	"eval:live:sdk:judgment": "node scripts/eval-sdk-judgment.ts",
	"eval:live:sdk:intervention": "node scripts/eval-sdk-intervention.ts",
	"eval:live:sdk:remediation": "node scripts/eval-sdk-remediation.ts",
	"eval:live:sdk:resume": "node scripts/eval-sdk-action-loop-resume.mjs",
};
for (const [name, command] of Object.entries(expectedEvaluatorScripts)) {
	assert.equal(manifest.scripts[name], command);
}
assert.match(manifest.scripts.check, /build-sdk-public-api\.mjs --check/);
assert.match(manifest.scripts.prepack, /build-sdk-public-api\.mjs --check/);
assert.deepEqual(manifest.exports["./sdk"], {
	types: "./src/action-loop/sdk/index.ts",
	import: "./dist/sdk.mjs",
	default: "./dist/sdk.mjs",
});
assert.deepEqual(manifest.files, [
	"extensions",
	"src/action-loop",
	"skills",
	"docs",
	"dist",
	"README.md",
	"REFERENCE_ROUTING.md",
	"LICENSE",
]);
assert.equal(
	manifest.files.includes("source-audits") ||
		manifest.files.includes("SOURCES.md"),
	false,
	"Maintainer provenance ledgers must not be published in the runtime package",
);
for (const dependency of [
	"@earendil-works/pi-ai",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
]) {
	assert.equal(manifest.peerDependencies[dependency], ">=0.80.10");
}
assert.equal(manifest.peerDependencies.typebox, "*");
assert.equal(manifest.devDependencies.esbuild, "0.25.12");
await access(join(root, "dist", "sdk.mjs"));

const sdkRoot = join(root, "src", "action-loop", "sdk");
const proposalPromptSource = await readFile(
	join(sdkRoot, "proposal-prompt.ts"),
	"utf8",
);
assert.match(proposalPromptSource, /authority: proposal-only/);
assert.match(proposalPromptSource, /packet_sections: current data only/);
const sdkControllerSources = [];
for (const entry of await readdir(sdkRoot, { withFileTypes: true })) {
	if (
		!entry.isFile() ||
		!entry.name.endsWith(".ts") ||
		entry.name === "proposal-prompt.ts"
	) {
		continue;
	}
	const source = await readFile(join(sdkRoot, entry.name), "utf8");
	sdkControllerSources.push(source);
	assert.doesNotMatch(
		source,
		/\b(?:systemPrompt|prompt):\s*\[/,
		`${entry.name} bypasses the generated proposal prompt boundary`,
	);
}
const sdkControllerSource = sdkControllerSources.join("\n");
for (const stage of SDK_PROPOSAL_STAGES) {
	assert.match(
		sdkControllerSource,
		new RegExp(`stage: ["']${stage}["']`),
		`No SDK controller uses the canonical ${stage} proposal stage`,
	);
}

const entries = await readdir(join(root, "skills"), { withFileTypes: true });
const skills = entries
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
assert.deepEqual(skills, expectedSkills);
assert.equal(skills.includes("developer"), false);

const loaded = loadSkillsFromDir({
	dir: join(root, "skills"),
	source: "@hobin/developer",
});
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(
	loaded.skills.map((skill) => skill.name).sort(),
	expectedSkills,
);

for (const name of skills) {
	const source = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
	assert.match(source, new RegExp(`^---\\nname: ${name}\\n`, "m"));
	const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	assert.doesNotMatch(frontmatter, /\bskip\b/i);
	assert.doesNotMatch(
		frontmatter,
		/99 Bottles|SICP|HtDP|Logic for Programmers|Elements of Clojure|Tidy First/i,
		`Expected ${name} discovery metadata to describe a capability, not a source`,
	);
	assert.match(
		source,
		/^Status: resolved \| needs-evidence \| not-applicable \| blocked$/m,
	);
	assert.doesNotMatch(source, /Codex|developer-toolbox|openai\.yaml/);
	const skillSourceTrace = source.split("## Source Trace", 2)[1];
	if (skillSourceTrace !== undefined) {
		assert.doesNotMatch(
			skillSourceTrace,
			/\[[^\]\n]+\]\([^)\n]+\)/,
			`${name} Source Trace must be bibliographic; audit workpapers are repository-only and unpublished`,
		);
	}
}

const requiredReferences = [
	"skills/abstraction-review/references/field-card.md",
	"skills/abstraction-review/references/repair-table.md",
	"skills/abstraction-review/references/worked-examples.md",
	"skills/model/references/problem-modeling.md",
	"skills/model/references/contract-and-replacement-models.md",
	"skills/model/references/relational-constraint-models.md",
	"skills/model/references/temporal-behavior-models.md",
	"skills/model/references/proof-obligations.md",
	"skills/model/references/solver-result-boundaries.md",
	"skills/model/references/logic-query-semantics.md",
	"skills/model/references/planning-models.md",
	"skills/naming-judgment/references/domain-naming.md",
	"skills/schedule/references/structural-change-timing.md",
	"skills/signal/references/structural-movement.md",
	"skills/sketch/references/data-driven-design.md",
	"skills/sketch/references/data-shape-template-catalog.md",
	"skills/sketch/references/composition-by-wishes.md",
	"skills/sketch/references/earned-abstraction.md",
	"skills/sketch/references/generative-recursion.md",
	"skills/sketch/references/accumulator-invariants.md",
	"skills/sketch/references/evidence-preserving-boundaries.md",
	"skills/sketch/references/design-levels-and-boundaries.md",
	"skills/sketch/references/representation-barriers.md",
	"skills/sketch/references/closure-and-conventional-interfaces.md",
	"skills/sketch/references/process-shape-and-resources.md",
	"skills/sketch/references/state-history-and-order.md",
	"skills/sketch/references/generic-dispatch-systems.md",
	"skills/sketch/references/meaning-preserving-conversions.md",
	"skills/sketch/references/language-semantics.md",
	"skills/sketch/references/runtime-and-compilation.md",
	"skills/sketch/references/responsibility-and-collaboration.md",
	"skills/sketch/references/variation-roles.md",
	"skills/sketch/references/type-transitions.md",
	"skills/sketch/references/selection-and-creation.md",
	"skills/verify/references/verifier-selection-and-pass-but-wrong.md",
];

const requiredCapabilityTocs = [
	"skills/abstraction-review/toc.json",
	"skills/model/toc.json",
	"skills/naming-judgment/toc.json",
	"skills/schedule/toc.json",
	"skills/signal/toc.json",
	"skills/sketch/toc.json",
	"skills/verify/toc.json",
];

const referenceCatalog = {
	"abstraction-review": [
		"references/field-card.md",
		"references/repair-table.md",
		"references/worked-examples.md",
	],
	model: [
		"references/problem-modeling.md",
		"references/contract-and-replacement-models.md",
		"references/relational-constraint-models.md",
		"references/temporal-behavior-models.md",
		"references/proof-obligations.md",
		"references/solver-result-boundaries.md",
		"references/logic-query-semantics.md",
		"references/planning-models.md",
	],
	"naming-judgment": ["references/domain-naming.md"],
	schedule: ["references/structural-change-timing.md"],
	signal: ["references/structural-movement.md"],
	sketch: [
		"references/data-driven-design.md",
		"references/data-shape-template-catalog.md",
		"references/composition-by-wishes.md",
		"references/earned-abstraction.md",
		"references/generative-recursion.md",
		"references/accumulator-invariants.md",
		"references/evidence-preserving-boundaries.md",
		"references/design-levels-and-boundaries.md",
		"references/representation-barriers.md",
		"references/closure-and-conventional-interfaces.md",
		"references/process-shape-and-resources.md",
		"references/state-history-and-order.md",
		"references/generic-dispatch-systems.md",
		"references/meaning-preserving-conversions.md",
		"references/language-semantics.md",
		"references/runtime-and-compilation.md",
		"references/responsibility-and-collaboration.md",
		"references/variation-roles.md",
		"references/type-transitions.md",
		"references/selection-and-creation.md",
	],
	verify: ["references/verifier-selection-and-pass-but-wrong.md"],
};

const descriptionTriggers = {
	doctor: /bounded existing codebase scope.*improvement plan/i,
	model: /condition space.*contracts.*replacement/i,
	"naming-judgment": /domain meaning.*effect-hiding/i,
	schedule: /behavior-versus-structure separation/i,
	signal: /structural movement.*model-code mismatch/i,
	sketch:
		/data flow.*recursion.*state.*composition.*responsibility.*variation/i,
	verify: /verifier selection/i,
};

for (const [name, expected] of Object.entries(descriptionTriggers)) {
	const description =
		loaded.skills.find((skill) => skill.name === name)?.description ?? "";
	assert.match(
		description,
		expected,
		`Expected Pi discovery trigger in ${name} description`,
	);
}

for (const name of Object.keys(referenceCatalog)) {
	const source = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
	assert.match(
		source,
		/## Judgment Spine/,
		`Expected ${name} to own one source-independent judgment spine`,
	);
	assert.match(
		source,
		/## Supporting Materials/,
		`Expected ${name} to explain standalone supporting-material discovery`,
	);
	assert.ok(
		source.includes("](toc.json)"),
		`Expected ${name} to link its colocated Skill TOC`,
	);
	assert.match(source, /If no Reference applies, proceed with/);
	assert.doesNotMatch(source, /## Reference Routing/);
	assert.doesNotMatch(
		source,
		/Upper Judgment|Capability TOC|Skill Contribution|sealed Context|Developer protocol|Action Loop/,
	);
	assert.doesNotMatch(source, /^## Context Directions$/mu);
	await assert.rejects(access(join(root, "skills", name, "judgment.json")));
}

for (const path of requiredReferences) {
	const source = await readFile(join(root, path), "utf8");
	assert.ok(source.length > 0, `Expected non-empty reference: ${path}`);
	assert.doesNotMatch(source, /\bDeveloper\b/);
	assert.doesNotMatch(
		source,
		/Upper Judgment|Capability TOC|Skill Contribution|sealed Context|Developer protocol|Action Loop/,
	);
}

for (const path of requiredCapabilityTocs) {
	const toc = await readJson(join(root, path));
	assert.equal(
		toc.$schema,
		"https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v0.1.schema.json",
	);
	assert.ok(Array.isArray(toc.when) && toc.when.length > 0);
	assert.ok(Array.isArray(toc.unless) && toc.unless.length > 0);
	assert.ok(Array.isArray(toc.references) && toc.references.length > 0);
	const skillName = path.split("/")[1];
	const catalog = new Set(referenceCatalog[skillName] ?? []);
	const declared = new Set();
	for (const reference of toc.references) {
		assert.ok(
			catalog.has(reference.path),
			`${path} names unknown Reference ${reference.path}`,
		);
		assert.equal(
			declared.has(reference.path),
			false,
			`${path} duplicates ${reference.path}`,
		);
		declared.add(reference.path);
		assert.ok(Array.isArray(reference.when) && reference.when.length > 0);
	}
	assert.deepEqual(
		[...declared].sort(),
		[...catalog].sort(),
		`${path} must declare every Reference owned by ${skillName}`,
	);
	await assert.rejects(
		access(join(root, "skills", skillName, "reference-policy.json")),
	);
}

const referenceAnchors = {
	"skills/abstraction-review/references/field-card.md":
		/## Judgment Spine[\s\S]*## Review Promises[\s\S]*## Separation Router/,
	"skills/model/references/problem-modeling.md":
		/## Judgment Spine[\s\S]*## Choose The Smallest Sufficient Model[\s\S]*## Stop And Separation/,
	"skills/model/references/contract-and-replacement-models.md":
		/## Contract Relation[\s\S]*## Replacement Relation[\s\S]*## Stop And Separation/,
	"skills/model/references/relational-constraint-models.md":
		/## Relation Before Procedure[\s\S]*## Runtime Translation Boundary[\s\S]*## Stop And Separation/,
	"skills/model/references/temporal-behavior-models.md":
		/## Behavior Before State Names[\s\S]*## Stuttering, Termination, And Valid Behavior[\s\S]*## Stop And Separation/,
	"skills/model/references/proof-obligations.md":
		/## Specification Relative Proof[\s\S]*## Worked Shape[\s\S]*## Stop And Separation/,
	"skills/model/references/solver-result-boundaries.md":
		/## Encoding Before Status[\s\S]*## Preserve Result States[\s\S]*## Stop And Separation/,
	"skills/model/references/logic-query-semantics.md":
		/## Query Contract[\s\S]*## Negation And Failure[\s\S]*## Stop And Separation/,
	"skills/model/references/planning-models.md":
		/## Planning Contract[\s\S]*## Valid Is Not Preferred[\s\S]*## Stop And Separation/,
	"skills/sketch/references/composition-by-wishes.md":
		/## Wish Before Helper Bodies[\s\S]*## Composition Boundary[\s\S]*## Stop And Separation/,
	"skills/sketch/references/earned-abstraction.md":
		/## Align Completed Designs[\s\S]*## Stability And Migration[\s\S]*## Stop And Separation/,
	"skills/sketch/references/generative-recursion.md":
		/## Structural Or Generated[\s\S]*## Machine, Numeric, Random, And Search Progress[\s\S]*## Stop And Separation/,
	"skills/sketch/references/accumulator-invariants.md":
		/## Pressure Before Parameter[\s\S]*## Three Obligations[\s\S]*## Stop And Separation/,
	"skills/sketch/references/evidence-preserving-boundaries.md":
		/## Information Must Survive The Check[\s\S]*## Construction And Escape Audit[\s\S]*## Stop And Separation/,
	"skills/sketch/references/design-levels-and-boundaries.md":
		/## Boundary Spine[\s\S]*## Select One Specialized Judgment[\s\S]*## Stop And Separation/,
	"skills/sketch/references/process-shape-and-resources.md":
		/## Procedure Is Not Process[\s\S]*## Task Completion And Acknowledgment[\s\S]*## Stop And Separation/,
	"skills/sketch/references/state-history-and-order.md":
		/## State Is A History Summary[\s\S]*## Event Order And Atomicity[\s\S]*## Stop And Separation/,
	"skills/sketch/references/representation-barriers.md":
		/## Build The Barrier[\s\S]*## Worked Shape[\s\S]*## Stop And Separation/,
	"skills/sketch/references/closure-and-conventional-interfaces.md":
		/## Closure Unit[\s\S]*## Conventional Interface[\s\S]*## Stop And Separation/,
	"skills/sketch/references/generic-dispatch-systems.md":
		/## Two Axes Before Mechanism[\s\S]*## Dispatch Ownership[\s\S]*## Stop And Separation/,
	"skills/sketch/references/meaning-preserving-conversions.md":
		/## Draw Paths[\s\S]*## Path Selection[\s\S]*## Stop And Separation/,
	"skills/sketch/references/language-semantics.md":
		/## Language Gate[\s\S]*## Evaluator Contract[\s\S]*## Stop And Separation/,
	"skills/sketch/references/runtime-and-compilation.md":
		/## Execution Convention[\s\S]*## Optimization Guard[\s\S]*## Stop And Separation/,
	"skills/sketch/references/responsibility-and-collaboration.md":
		/## Begin With Change Pressure[\s\S]*## Participant And Environment Boundary[\s\S]*## Stop And Separation/,
	"skills/sketch/references/variation-roles.md":
		/## Role And Substitution[\s\S]*## Artifact[\s\S]*## Stop And Separation/,
	"skills/sketch/references/type-transitions.md":
		/## Transition Contract[\s\S]*## Artifact[\s\S]*## Stop And Separation/,
	"skills/sketch/references/selection-and-creation.md":
		/## Selection Policy[\s\S]*## Creation Continuum[\s\S]*## Stop And Separation/,
	"skills/verify/references/verifier-selection-and-pass-but-wrong.md":
		/## Judgment Spine[\s\S]*## Counterexample Families[\s\S]*## Feedback And Stop/,
};

for (const path of requiredReferences) {
	const source = await readFile(join(root, path), "utf8");
	assert.match(source, /## Source Trace/, `${path} must preserve provenance`);
	const [operationalBody, sourceTrace] = source.split("## Source Trace", 2);
	assert.doesNotMatch(
		sourceTrace,
		/\[[^\]\n]+\]\([^)\n]+\)/,
		`${path} Source Trace must be bibliographic; audit workpapers are repository-only and unpublished`,
	);
	assert.doesNotMatch(
		operationalBody,
		/^## .*?(99 Bottles|SICP|HtDP|Logic for Programmers|Elements of Clojure|Tidy First).*$/im,
		`${path} must organize runtime guidance by judgment, not source`,
	);
}
for (const [path, expected] of Object.entries(referenceAnchors)) {
	assert.match(
		await readFile(join(root, path), "utf8"),
		expected,
		`Expected judgment integration anchor in ${path}`,
	);
}

for (const evaluator of [
	"eval-sdk-routing.ts",
	"eval-sdk-judgment.ts",
	"eval-sdk-intervention.ts",
	"eval-sdk-remediation.ts",
	"eval-sdk-action-loop-resume.mjs",
]) {
	await access(join(root, "scripts", evaluator));
}
for (const removedEvaluator of [
	"eval-assertions.mjs",
	"eval-budget.mjs",
	"eval-event-monitor.mjs",
	"eval-json.mjs",
	"eval-live.mjs",
	"eval-probability.mjs",
	"eval-rpc.mjs",
	"eval-sdk-context.ts",
	"eval-workspace.mjs",
	"ghostty-tui-qa.sh",
]) {
	await assert.rejects(access(join(root, "scripts", removedEvaluator)));
}
await assert.rejects(access(join(root, "evals", "fixtures.json")));

const scheduleReference = await readFile(
	join(root, "skills/schedule/references/structural-change-timing.md"),
	"utf8",
);
assert.doesNotMatch(scheduleReference, /newsletter\.kentbeck\.com/);

const markdownDocuments = [
	...skills.map((name) => `skills/${name}/SKILL.md`),
	...requiredReferences,
	"REFERENCE_ROUTING.md",
	"SOURCES.md",
	"source-audits/cross-source-judgment-integration-2026-07-24.md",
	"source-audits/parse-dont-validate-2019-11-05.md",
	"README.md",
	"docs/ko/terminal-judgment-workbench-study-v0.1.md",
];
for (const documentPath of markdownDocuments) {
	const absoluteDocumentPath = join(root, documentPath);
	const source = await readFile(absoluteDocumentPath, "utf8");
	for (const match of source.matchAll(/\]\(([^)]+\.md)\)/g)) {
		if (/^[a-z][a-z0-9+.-]*:/i.test(match[1])) continue;
		await readFile(join(dirname(absoluteDocumentPath), match[1]), "utf8");
	}
}

const modelFacingToolNames = [...MODEL_FACING_ACTION_LOOP_TOOLS];
const modelFacingToolNameSet = new Set(modelFacingToolNames);
const publicRuntimeDocuments = [
	"README.md",
	"README.ko.md",
	"REFERENCE_ROUTING.md",
	"docs/action-loop-architecture-v0.1.md",
	"docs/ko/action-loop-architecture-v0.1.md",
];
for (const documentPath of publicRuntimeDocuments) {
	const source = await readFile(join(root, documentPath), "utf8");
	for (const match of source.matchAll(/\bdeveloper_[a-z_]+\b/g)) {
		assert.ok(
			modelFacingToolNameSet.has(match[0]),
			`${documentPath} presents an unrecognized Developer tool ${match[0]}`,
		);
	}
	if (documentPath === "README.md" || documentPath === "README.ko.md") {
		for (const toolName of modelFacingToolNames) {
			assert.match(source, new RegExp(`\\b${toolName}\\b`));
		}
	}
}

await assert.rejects(
	access(join(root, "extensions", "compaction-language.ts")),
);
const extension = await readFile(
	join(root, "extensions", "developer.ts"),
	"utf8",
);
assert.match(extension, /name: ACTION_LOOP_PROGRESS_TOOL/);
assert.match(extension, /name: ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL/);
assert.match(extension, /name: ACTION_LOOP_PAUSE_WORK_CASE_TOOL/);
assert.match(extension, /name: ACTION_LOOP_WAIT_WORK_CASE_TOOL/);
assert.match(extension, /name: ACTION_LOOP_BLOCK_WORK_CASE_TOOL/);
assert.match(extension, /name: ACTION_LOOP_RESUME_WORK_CASE_TOOL/);
assert.doesNotMatch(
	extension,
	/name: ACTION_LOOP_(?:OPEN|ASSESS|SELECT|LOAD|CLOSE|PROPOSE|SETTLE|RECORD|PREPARE|COMPLETE|PROGRESS_JUDGMENT|ACCEPT_CONTRIBUTION)/,
);
assert.doesNotMatch(
	extension,
	/name: ROUTE_TOOL|name: REFERENCE_TOOL|name: JUDGMENT_TOOL/,
);
assert.match(extension, /registerCommand\("developer"/);
assert.doesNotMatch(extension, /registerCommand\("develop"/);
assert.match(extension, /registerFlag\("developer"/);
assert.doesNotMatch(extension, /registerFlag\("develop"/);
assert.match(extension, /getArgumentCompletions/);
assert.match(extension, /ctx\.ui\.confirm/);
assert.match(extension, /prepareLiveCapabilityInventory\(event, skillsRoot\)/);
assert.doesNotMatch(extension, /loadCandidateSkills|loadSkillsFromDir/);
assert.doesNotMatch(
	extension,
	/developer\.snapshot|acceptedContract|verifiedClaims|completionState/,
);
assert.match(extension, /observeLivePiToolResult\(/);
assert.doesNotMatch(
	extension,
	/compaction-language|COMPACTION_LANGUAGE|compactionLanguage|detectStrongUserLanguage/u,
);
for (const entry of await readdir(join(root, "extensions"), {
	withFileTypes: true,
})) {
	if (
		!entry.isFile() ||
		!entry.name.endsWith(".ts") ||
		entry.name === "developer.ts"
	) {
		continue;
	}
	const source = await readFile(join(root, "extensions", entry.name), "utf8");
	for (const match of source.matchAll(/\bdeveloper_[a-z_]+\b/g)) {
		assert.ok(
			modelFacingToolNameSet.has(match[0]),
			`${entry.name} defines an unrecognized Developer tool ${match[0]}`,
		);
	}
}

const sourceTrace = await readFile(join(root, "SOURCES.md"), "utf8");
assert.match(sourceTrace, /## Capability Matrix/);
assert.match(sourceTrace, /## Runtime Reference Quality/);
assert.match(sourceTrace, /cross-source-judgment-integration-2026-07-24\.md/);
assert.match(sourceTrace, /## Intentionally Not Imported As Universal Rules/);

const workbench = await readFile(
	join(root, "extensions", "action-loop-workbench.ts"),
	"utf8",
);
assert.match(workbench, /inspectActionLoopWorkbench/);
assert.match(
	workbench,
	/Overview[\s\S]*Judgments[\s\S]*Evidence[\s\S]*Actions & Effects[\s\S]*Continuity[\s\S]*History[\s\S]*Settings/,
);
assert.doesNotMatch(workbench, /workCaseId|revisionId|contributionId/);

const workbenchTui = await readFile(
	join(root, "extensions", "action-loop-workbench-tui.ts"),
	"utf8",
);
assert.match(workbenchTui, /ActionLoopWorkbenchSurface/);
assert.match(workbenchTui, /←→ sections · ↑↓\/jk move/);
assert.match(workbenchTui, /overlay:\s*true/);

const command = await readFile(
	join(root, "extensions", "developer-command.ts"),
	"utf8",
);
assert.match(command, /parseDeveloperCommand/);
assert.match(command, /completeDeveloperArgs/);
assert.doesNotMatch(command, /questions/);

const mode = await readFile(
	join(root, "extensions", "developer-mode.ts"),
	"utf8",
);
assert.match(mode, /developer\.mode\/v1/);
assert.match(mode, /reconstructDeveloperMode/);

assert.doesNotMatch(extension, /\.\/state\.ts|\.\/machine\.ts|from "xstate"/);
for (const legacyPath of [
	"state.ts",
	"machine.ts",
	"tui.ts",
	"developer-workbench.ts",
	"developer-workbench-tui.ts",
]) {
	await assert.rejects(access(join(root, "extensions", legacyPath)));
}

console.log("developer package structure is consistent");
