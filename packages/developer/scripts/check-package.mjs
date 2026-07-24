import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

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
assert.equal(manifest.version, "0.1.8");
assert.deepEqual(manifest.pi.extensions, ["./extensions/developer.ts"]);
assert.deepEqual(manifest.pi.skills, ["./skills"]);
assert.match(manifest.scripts["eval:live"], /eval-live\.mjs --transport rpc/);
assert.match(
	manifest.scripts["eval:live:json"],
	/eval-live\.mjs --transport json/,
);
assert.deepEqual(manifest.files, [
	"extensions",
	"skills",
	"README.md",
	"SOURCES.md",
	"LICENSE",
]);
for (const dependency of [
	"@earendil-works/pi-ai",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"typebox",
]) {
	assert.equal(manifest.peerDependencies[dependency], "*");
}

const entries = await readdir(join(root, "skills"), { withFileTypes: true });
const skills = entries
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
assert.deepEqual(skills, expectedSkills);
assert.equal(skills.includes("develop"), false);

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
	assert.match(source, new RegExp("^---\\nname: " + name + "\\n", "m"));
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
}

const requiredReferences = [
	"skills/abstraction-review/references/field-card.md",
	"skills/abstraction-review/references/recipe-cards.md",
	"skills/abstraction-review/references/repair-table.md",
	"skills/abstraction-review/references/worked-examples.md",
	"skills/model/references/problem-modeling.md",
	"skills/model/references/worked-models-and-specialized-techniques.md",
	"skills/naming-judgment/references/domain-naming.md",
	"skills/schedule/references/structural-change-timing.md",
	"skills/signal/references/structural-movement.md",
	"skills/sketch/references/data-driven-design.md",
	"skills/sketch/references/data-shape-template-catalog.md",
	"skills/sketch/references/composition-generative-recursion-and-accumulators.md",
	"skills/sketch/references/abstraction-composition-and-state.md",
	"skills/sketch/references/abstraction-barriers-and-closure.md",
	"skills/sketch/references/processes-state-and-time.md",
	"skills/sketch/references/generic-operations-and-languages.md",
	"skills/sketch/references/responsibility-and-variation.md",
	"skills/verify/references/verifier-selection-and-pass-but-wrong.md",
];

const referenceRoutes = {
	"abstraction-review": [
		"references/field-card.md",
		"references/recipe-cards.md",
		"references/repair-table.md",
		"references/worked-examples.md",
	],
	model: [
		"references/problem-modeling.md",
		"references/worked-models-and-specialized-techniques.md",
	],
	"naming-judgment": ["references/domain-naming.md"],
	schedule: ["references/structural-change-timing.md"],
	signal: ["references/structural-movement.md"],
	sketch: [
		"references/data-driven-design.md",
		"references/data-shape-template-catalog.md",
		"references/composition-generative-recursion-and-accumulators.md",
		"references/abstraction-composition-and-state.md",
		"references/abstraction-barriers-and-closure.md",
		"references/processes-state-and-time.md",
		"references/generic-operations-and-languages.md",
		"references/responsibility-and-variation.md",
	],
	verify: ["references/verifier-selection-and-pass-but-wrong.md"],
};

const descriptionTriggers = {
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

for (const [name, routes] of Object.entries(referenceRoutes)) {
	const source = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
	for (const route of routes) {
		assert.ok(
			source.includes(`](${route})`),
			`Expected ${name} to route ${route}`,
		);
	}
}

for (const path of requiredReferences) {
	const source = await readFile(join(root, path), "utf8");
	assert.ok(source.length > 0, "Expected non-empty reference: " + path);
}

const referenceAnchors = {
	"skills/abstraction-review/references/field-card.md":
		/## Operating Loop[\s\S]*## Recipe-Grade Gate[\s\S]*## Self-Application Check/,
	"skills/abstraction-review/references/recipe-cards.md":
		/## Pocket Deck[\s\S]*### Responsibility Boundary[\s\S]*## Source Trace/,
	"skills/abstraction-review/references/repair-table.md":
		/## Diagnostic Loop[\s\S]*## Repair Matrix[\s\S]*## Exit Checks/,
	"skills/abstraction-review/references/worked-examples.md":
		/## Example Selector[\s\S]*## Skill Update Self-Review[\s\S]*## Stateful Account[\s\S]*## Chainable Builder/,
	"skills/model/references/problem-modeling.md":
		/## Safe Replacement[\s\S]*## Proof And Formal Verification Boundary[\s\S]*## Logic Programming And Planning[\s\S]*## Source Trace[\s\S]*Logic for Programmers/,
	"skills/model/references/worked-models-and-specialized-techniques.md":
		/## Boolean Policy[\s\S]*## Relational Data And Constraints[\s\S]*## Proof Boundary[\s\S]*## Constraint Propagation[\s\S]*## Planning[\s\S]*## Source Trace/,
	"skills/naming-judgment/references/domain-naming.md":
		/## Responsibility-Derived Names[\s\S]*## Worked Review[\s\S]*## Source Trace[\s\S]*Elements of Clojure/,
	"skills/schedule/references/structural-change-timing.md":
		/## Worked Timing Decision[\s\S]*## Source Trace[\s\S]*Tidy First\?[\s\S]*99 Bottles of OOP/,
	"skills/signal/references/structural-movement.md":
		/## Worked Observation[\s\S]*## Source Trace[\s\S]*99 Bottles of OOP[\s\S]*How to Design Programs/,
	"skills/sketch/references/data-driven-design.md":
		/## The Six-Artifact Recipe[\s\S]*## Complete Example[\s\S]*## Failure Diagnosis[\s\S]*## Source Trace/,
	"skills/sketch/references/data-shape-template-catalog.md":
		/## Self-Referential Data[\s\S]*## Interactive Programs[\s\S]*## Diagnosis[\s\S]*## Source Trace/,
	"skills/sketch/references/composition-generative-recursion-and-accumulators.md":
		/## Generative Recursion Recipe[\s\S]*## Accumulator Recipe[\s\S]*## Failure Diagnosis[\s\S]*## Source Trace/,
	"skills/sketch/references/abstraction-composition-and-state.md":
		/## Complete Example[\s\S]*## Modules As Models[\s\S]*## Failure Diagnosis[\s\S]*## Source Trace/,
	"skills/sketch/references/abstraction-barriers-and-closure.md":
		/## Build A Data Barrier[\s\S]*## Closure[\s\S]*## Failure Diagnosis[\s\S]*## Source Trace/,
	"skills/sketch/references/processes-state-and-time.md":
		/## Procedure Versus Process[\s\S]*## State Means History Matters[\s\S]*## Event Order And Atomicity[\s\S]*## Failure Diagnosis[\s\S]*## Source Trace/,
	"skills/sketch/references/generic-operations-and-languages.md":
		/## Two Axes Of Generic Operations[\s\S]*## When Data Becomes A Language[\s\S]*## Source Trace/,
	"skills/sketch/references/responsibility-and-variation.md":
		/## Object Creation And Factories[\s\S]*## Complete Example[\s\S]*## Source Trace[\s\S]*99 Bottles of OOP/,
	"skills/verify/references/verifier-selection-and-pass-but-wrong.md":
		/## Test Design And Cost[\s\S]*## Complete Evidence Example[\s\S]*## Source Trace[\s\S]*Logic for Programmers[\s\S]*99 Bottles of OOP/,
};

for (const [path, expected] of Object.entries(referenceAnchors)) {
	assert.match(
		await readFile(join(root, path), "utf8"),
		expected,
		`Expected conceptual anchor in ${path}`,
	);
}

const evalFixtures = await readJson(join(root, "evals", "fixtures.json"));
for (const fixture of evalFixtures) {
	assert.ok(
		Array.isArray(fixture.admissibleFirstTargets) &&
			fixture.admissibleFirstTargets.length > 0,
		`Eval fixture ${fixture.id} must declare admissibleFirstTargets`,
	);
	assert.ok(
		Array.isArray(fixture.preferredFirstTargets) &&
			fixture.preferredFirstTargets.length > 0,
		`Eval fixture ${fixture.id} must declare preferredFirstTargets`,
	);
	for (const target of fixture.preferredFirstTargets) {
		assert.ok(
			fixture.admissibleFirstTargets.includes(target),
			`Eval fixture ${fixture.id} prefers inadmissible target ${target}`,
		);
	}
	for (const term of fixture.requiredJudgmentTerms ?? []) {
		assert.ok(
			typeof term === "string" && term.length > 0,
			`Eval fixture ${fixture.id} has an invalid required judgment term`,
		);
	}
	for (const alternatives of fixture.requiredJudgmentConcepts ?? []) {
		assert.ok(
			Array.isArray(alternatives) &&
				alternatives.length > 0 &&
				alternatives.every(
					(term) => typeof term === "string" && term.length > 0,
				),
			`Eval fixture ${fixture.id} has an invalid required judgment concept`,
		);
	}
	for (const referencePath of fixture.expectedReferenceReads ?? []) {
		assert.ok(
			requiredReferences.includes(referencePath),
			`Expected live eval reference to be part of the package contract: ${referencePath}`,
		);
		await readFile(join(root, referencePath), "utf8");
	}
}
for (const fixtureId of [
	"implementation-stable-landing-paused",
	"agent-before-implementation-evidence-gate",
]) {
	assert.ok(
		evalFixtures.some((fixture) => fixture.id === fixtureId),
		`Missing required live eval fixture: ${fixtureId}`,
	);
}
const evalJson = await readFile(join(root, "scripts/eval-json.mjs"), "utf8");
const evalEventMonitor = await readFile(
	join(root, "scripts/eval-event-monitor.mjs"),
	"utf8",
);
const evalLive = await readFile(join(root, "scripts/eval-live.mjs"), "utf8");
assert.match(evalJson, /createEvalEventMonitor/);
assert.match(evalEventMonitor, /createFixtureBudgetMonitor/);
assert.match(evalEventMonitor, /createJsonlDecoder/);
assert.match(evalLive, /summarizeTrialObservations/);

const scheduleReference = await readFile(
	join(root, "skills/schedule/references/structural-change-timing.md"),
	"utf8",
);
assert.doesNotMatch(scheduleReference, /newsletter\.kentbeck\.com/);

const markdownDocuments = [
	...skills.map((name) => `skills/${name}/SKILL.md`),
	...requiredReferences,
	"SOURCES.md",
	"extensions/references/behavior-preserving-structural-change.md",
];
for (const documentPath of markdownDocuments) {
	const absoluteDocumentPath = join(root, documentPath);
	const source = await readFile(absoluteDocumentPath, "utf8");
	for (const match of source.matchAll(/\]\(([^)]+\.md)\)/g)) {
		if (/^[a-z][a-z0-9+.-]*:/i.test(match[1])) continue;
		await readFile(join(dirname(absoluteDocumentPath), match[1]), "utf8");
	}
}

const extension = await readFile(
	join(root, "extensions", "developer.ts"),
	"utf8",
);
assert.match(extension, /name: ROUTE_TOOL/);
assert.match(extension, /name: JUDGMENT_TOOL/);
assert.match(extension, /registerCommand\("develop"/);
assert.match(extension, /getArgumentCompletions/);
assert.match(extension, /ctx\.ui\.confirm/);
assert.match(extension, /event\.systemPromptOptions\.skills/);
assert.match(extension, /behavior-preserving-structure/);
assert.doesNotMatch(extension, /loadCandidateSkills|loadSkillsFromDir/);
assert.doesNotMatch(
	extension,
	/developer\.snapshot|acceptedContract|verifiedClaims|completionState/,
);
assert.doesNotMatch(extension, /isError\s*:/);

const skillIntegration = await readFile(
	join(root, "extensions", "skills.ts"),
	"utf8",
);
assert.doesNotMatch(skillIntegration, /loadSkillsFromDir/);

const implementationReference = await readFile(
	join(
		root,
		"extensions",
		"references",
		"behavior-preserving-structural-change.md",
	),
	"utf8",
);
assert.match(
	implementationReference,
	/## Smallest Green Transformation[\s\S]*## Stable Landing/,
);
assert.match(
	implementationReference,
	/## Worked Mutation Trace[\s\S]*## Failure Checks/,
);
assert.match(
	implementationReference,
	/## Source Trace[\s\S]*99 Bottles of OOP[\s\S]*Tidy First\?/,
);

const sourceTrace = await readFile(join(root, "SOURCES.md"), "utf8");
assert.match(sourceTrace, /## Capability Matrix/);
assert.match(sourceTrace, /## Runtime Reference Quality/);
assert.match(sourceTrace, /## Intentionally Not Imported As Universal Rules/);

const tui = await readFile(join(root, "extensions", "tui.ts"), "utf8");
assert.match(tui, /SelectList/);
assert.match(tui, /DeveloperStatusPanel/);
assert.match(tui, /showPendingQuestionSelector/);
assert.match(tui, /overlay:\s*true/);

const state = await readFile(join(root, "extensions", "state.ts"), "utf8");
assert.match(state, /developer\/v5/);
assert.doesNotMatch(state, /developer\/v[1-4]/);
assert.match(state, /pendingQuestions/);
assert.doesNotMatch(state, /acceptedContract|verifiedClaims/);

console.log("developer package structure is consistent");
