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
assert.equal(manifest.version, "0.1.16");
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
	"docs",
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

const requiredReferencePolicies = [
	"skills/abstraction-review/reference-policy.json",
	"skills/model/reference-policy.json",
	"skills/naming-judgment/reference-policy.json",
	"skills/schedule/reference-policy.json",
	"skills/signal/reference-policy.json",
	"skills/sketch/reference-policy.json",
	"skills/verify/reference-policy.json",
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
	assert.ok(
		source.includes("](reference-policy.json)"),
		`Expected ${name} to link its machine-readable reference policy`,
	);
}

for (const path of requiredReferences) {
	const source = await readFile(join(root, path), "utf8");
	assert.ok(source.length > 0, `Expected non-empty reference: ${path}`);
}

for (const path of requiredReferencePolicies) {
	const policy = await readJson(join(root, path));
	assert.equal(policy.version, 2);
	assert.ok(Array.isArray(policy.routes) && policy.routes.length > 0);
	assert.equal(typeof policy.exemption?.when, "string");
	assert.ok(
		Array.isArray(policy.exemption?.evidence) &&
			policy.exemption.evidence.length > 0,
	);
	const skillName = path.split("/")[1];
	const catalog = new Set(referenceCatalog[skillName] ?? []);
	const covered = new Set();
	const routeIds = new Set();
	for (const route of policy.routes) {
		assert.match(route.id, /^[a-z][a-z0-9-]*$/);
		assert.equal(
			routeIds.has(route.id),
			false,
			`${path} duplicates ${route.id}`,
		);
		routeIds.add(route.id);
		assert.equal(typeof route.question, "string");
		assert.equal(typeof route.trigger, "string");
		assert.equal(typeof route.method_step, "string");
		assert.ok(Array.isArray(route.references) && route.references.length > 0);
		if (route.references.length > 1) {
			assert.ok(
				route.read_order === "listed" || route.read_order === "any",
				`${path} route ${route.id} must separate co-required membership from read order`,
			);
		}
		assert.ok(Array.isArray(route.artifacts) && route.artifacts.length > 0);
		assert.equal(typeof route.stop, "string");
		assert.equal(typeof route.separate_when, "string");
		assert.doesNotMatch(
			JSON.stringify(route),
			/99 Bottles|SICP|HtDP|Logic for Programmers|Elements of Clojure|Tidy First/i,
			`${path} route ${route.id} must describe a judgment, not a source`,
		);
		for (const reference of route.references) {
			assert.ok(
				catalog.has(reference),
				`${path} route ${route.id} names unknown reference ${reference}`,
			);
			covered.add(reference);
		}
	}
	assert.deepEqual(
		[...covered].sort(),
		[...catalog].sort(),
		`${path} must route every reference owned by ${skillName}`,
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
	for (const routeId of fixture.expectedReferenceRoutes ?? []) {
		const target = fixture.preferredFirstTargets[0];
		const policy = await readJson(
			join(root, "skills", target, "reference-policy.json"),
		);
		assert.ok(
			policy.routes.some((route) => route.id === routeId),
			`Expected live eval route ${routeId} to be declared by ${target}`,
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
	"doctor-unscoped-orientation",
	"doctor-thorough-bounded-codebase",
	"implementation-stable-landing-paused",
	"agent-before-implementation-evidence-gate",
]) {
	assert.ok(
		evalFixtures.some((fixture) => fixture.id === fixtureId),
		`Missing required live eval fixture: ${fixtureId}`,
	);
}
const evalJson = await readFile(join(root, "scripts/eval-json.mjs"), "utf8");
const evalRpc = await readFile(join(root, "scripts/eval-rpc.mjs"), "utf8");
const evalEventMonitor = await readFile(
	join(root, "scripts/eval-event-monitor.mjs"),
	"utf8",
);
const evalLive = await readFile(join(root, "scripts/eval-live.mjs"), "utf8");
assert.match(evalJson, /createEvalEventMonitor/);
assert.match(
	evalJson,
	/"--skill",\s*skills,\s*fixture\.request,\s*"--developer"/,
	"JSON eval must place the positional prompt before the extension flag",
);
assert.match(evalEventMonitor, /createFixtureBudgetMonitor/);
assert.match(evalEventMonitor, /createJsonlDecoder/);
assert.match(
	evalRpc,
	/value\.type !== "message_update"/,
	"RPC eval traces must drop cumulative token updates before long Doctor runs",
);
assert.match(evalLive, /summarizeTrialObservations/);

const scheduleReference = await readFile(
	join(root, "skills/schedule/references/structural-change-timing.md"),
	"utf8",
);
assert.doesNotMatch(scheduleReference, /newsletter\.kentbeck\.com/);

const implementationReferenceSource = await readFile(
	join(root, "extensions/references/behavior-preserving-structural-change.md"),
	"utf8",
);
assert.doesNotMatch(
	implementationReferenceSource.split("## Source Trace", 2)[1],
	/\[[^\]\n]+\]\([^)\n]+\)/,
	"Implementation reference Source Trace must be bibliographic; audit workpapers are repository-only and unpublished",
);

const markdownDocuments = [
	...skills.map((name) => `skills/${name}/SKILL.md`),
	...requiredReferences,
	"REFERENCE_ROUTING.md",
	"SOURCES.md",
	"source-audits/cross-source-judgment-integration-2026-07-24.md",
	"source-audits/parse-dont-validate-2019-11-05.md",
	"extensions/references/behavior-preserving-structural-change.md",
	"README.md",
	"docs/terminal-judgment-workbench-study-v0.1.ko.md",
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
assert.match(extension, /registerCommand\("developer"/);
assert.doesNotMatch(extension, /registerCommand\("develop"/);
assert.match(extension, /registerFlag\("developer"/);
assert.doesNotMatch(extension, /registerFlag\("develop"/);
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
assert.match(sourceTrace, /cross-source-judgment-integration-2026-07-24\.md/);
assert.match(sourceTrace, /## Intentionally Not Imported As Universal Rules/);

const tui = await readFile(join(root, "extensions", "tui.ts"), "utf8");
assert.match(tui, /SelectList/);
assert.match(tui, /showPendingQuestionSelector/);
assert.match(tui, /overlay:\s*true/);
assert.doesNotMatch(tui, /DeveloperStatusPanel|DeveloperHistoryDetailPanel/);

const workbench = await readFile(
	join(root, "extensions", "developer-workbench.ts"),
	"utf8",
);
assert.match(workbench, /inspectDeveloperWorkbench/);
assert.match(
	workbench,
	/Overview[\s\S]*Active route[\s\S]*Questions[\s\S]*Judgments[\s\S]*Landings[\s\S]*Settings/,
);
assert.match(workbench, /no per-landing Verified claim is inferred/);

const workbenchTui = await readFile(
	join(root, "extensions", "developer-workbench-tui.ts"),
	"utf8",
);
assert.match(workbenchTui, /DeveloperWorkbenchSurface/);
assert.match(workbenchTui, /PgUp\/PgDn[\s\S]*Contextual actions/);

const command = await readFile(
	join(root, "extensions", "developer-command.ts"),
	"utf8",
);
assert.match(command, /parseDeveloperCommand/);
assert.match(command, /completeDeveloperArgs/);

const state = await readFile(join(root, "extensions", "state.ts"), "utf8");
assert.match(state, /developer\/v5/);
assert.doesNotMatch(state, /developer\/v[1-4]/);
assert.match(state, /pendingQuestions/);
assert.doesNotMatch(state, /acceptedContract|verifiedClaims/);

console.log("developer package structure is consistent");
