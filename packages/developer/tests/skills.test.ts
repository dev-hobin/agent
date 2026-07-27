import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

import {
	availablePackageSkills,
	isWithinRoot,
	loadSkillReference,
	loadSkillReferencePolicy,
	renderSkillMethod,
	skillReferencePaths,
} from "../extensions/skills.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(packageRoot, "skills");
const expected = [
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

test("Pi's loaded skill metadata is the package leaf catalog", () => {
	const catalog = loadSkillsFromDir({
		dir: skillsRoot,
		source: "@hobin/developer",
	}).skills;
	assert.deepEqual(catalog.map((skill) => skill.name).sort(), expected);
	assert.equal(
		catalog.some((skill) => skill.name === "develop"),
		false,
	);
	for (const skill of catalog) {
		assert.ok(skill.description.length > 20);
		assert.ok(skill.filePath.endsWith("SKILL.md"));
	}
});

test("every skill defines an inspection surface suited to its judgment", async () => {
	const expectedSurfaces: Record<string, RegExp> = {
		"abstraction-review": /review card or table/,
		"adversarial-eval": /escalation ladder as an ordered matrix/,
		doctor:
			/Doctor scope and actual coverage[\s\S]*consultation ledger[\s\S]*treatment plan/,
		model: /case, decision, or truth table/,
		"naming-judgment": /rename map as the primary inspection surface/,
		schedule: /compact timing matrix/,
		signal: /Make the comparison visible/,
		sketch:
			/compact case\/check table[\s\S]*wished-interface table[\s\S]*ASCII flow/,
		specify: /scope table separating in scope/,
		verify: /evidence matrix as the primary surface/,
		visualize: /render the completed table, ASCII\/Mermaid diagram/,
	};

	for (const [name, expectedSurface] of Object.entries(expectedSurfaces)) {
		const source = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
		assert.match(
			source,
			expectedSurface,
			`${name} should expose an inspectable output surface`,
		);
	}
});

test("Doctor bounds claims, dispositions every owner skill, and delegates routed references", async () => {
	const source = await readFile(join(skillsRoot, "doctor", "SKILL.md"), "utf8");
	for (const owner of expected.filter((name) => name !== "doctor")) {
		assert.ok(
			source.includes(`| \`${owner}\` |`),
			`Doctor must disposition ${owner}`,
		);
	}
	assert.match(source, /requested \/ inspected \/ claim scope/i);
	assert.match(source, /thorough-within-scope/);
	assert.match(
		source,
		/route\s+every triggered distinct consultation[\s\S]*every reference-policy route[\s\S]*every co-required reference/i,
	);
	assert.match(source, /must not read sibling skill\s+references/i);
	assert.match(
		source,
		/treat-now[\s\S]*prepare-next[\s\S]*observe[\s\S]*leave-alone/,
	);

	const doctor = loadSkillsFromDir({
		dir: skillsRoot,
		source: "@hobin/developer",
	}).skills.find((skill) => skill.name === "doctor")!;
	assert.deepEqual(await skillReferencePaths(doctor), []);
	assert.deepEqual((await loadSkillReferencePolicy(doctor)).routes, []);
});

test("inherits Pi's recursive discovery, YAML parsing, and directory-name policy", async () => {
	const root = await mkdtemp(join(tmpdir(), "developer-skills-"));
	const nested = join(root, "group", "directory-name-can-differ");
	await mkdir(nested, { recursive: true });
	await writeFile(
		join(nested, "SKILL.md"),
		"---\nname: actual-name\ndescription: >-\n  Folded description from Pi.\n---\n\n# Actual\n\nKeep this body.\n",
	);

	const catalog = loadSkillsFromDir({ dir: root, source: "test" }).skills;
	const actual = catalog.find((skill) => skill.name === "actual-name")!;
	assert.equal(actual.description, "Folded description from Pi.");
	const rendered = await renderSkillMethod(actual);
	assert.match(rendered, /location=".*SKILL\.md"/);
	assert.match(rendered, /base-dir=".*directory-name-can-differ"/);
	assert.match(rendered, /# Actual\n\nKeep this body\./);
});

test("lists and loads direct skill references with content provenance", async () => {
	const sketch = loadSkillsFromDir({
		dir: skillsRoot,
		source: "@hobin/developer",
	}).skills.find((skill) => skill.name === "sketch")!;

	const references = await skillReferencePaths(sketch);
	assert.ok(references.includes("references/data-driven-design.md"));
	const policy = await loadSkillReferencePolicy(sketch, references);
	assert.equal(policy.contentSha256?.length, 64);
	const dataShapeRoute = policy.routes.find(
		(route) => route.id === "data-shape-template",
	);
	assert.equal(dataShapeRoute?.readOrder, "listed");
	assert.match(dataShapeRoute?.question ?? "", /branches|selectors/i);
	assert.match(dataShapeRoute?.methodStep ?? "", /derive/i);
	assert.match(dataShapeRoute?.stop ?? "", /corresponds|omission/i);
	assert.match(dataShapeRoute?.separateWhen ?? "", /generated|carried/i);
	assert.deepEqual(dataShapeRoute?.references, [
		"references/data-driven-design.md",
		"references/data-shape-template-catalog.md",
	]);
	const evidenceBoundaryRoute = policy.routes.find(
		(route) => route.id === "evidence-preserving-boundary",
	);
	assert.deepEqual(evidenceBoundaryRoute?.references, [
		"references/evidence-preserving-boundaries.md",
	]);
	assert.match(
		evidenceBoundaryRoute?.question ?? "",
		/less-trusted|domain value/i,
	);
	assert.match(evidenceBoundaryRoute?.stop ?? "", /unchecked narrowing/i);
	assert.match(
		policy.exemption?.when ?? "",
		/no routed judgment has an independent artifact/i,
	);
	const loaded = await loadSkillReference(
		sketch,
		"references/data-driven-design.md",
	);
	assert.equal(loaded.path, "references/data-driven-design.md");
	assert.equal(loaded.contentSha256.length, 64);
	assert.match(loaded.content, /The Six-Artifact Recipe/);
	assert.match(loaded.sourceTrace, /How to Design Programs/);
	const evidenceBoundary = await loadSkillReference(
		sketch,
		"references/evidence-preserving-boundaries.md",
	);
	assert.match(
		evidenceBoundary.content,
		/Values\(Domain\) ⊆ Values\(Raw\) ⊆ Values\(External\)/,
	);
	assert.match(
		evidenceBoundary.content,
		/narrowest honest representation the caller can\s+already supply/i,
	);
	assert.match(
		evidenceBoundary.content,
		/Less trusted does not imply less typed/,
	);
	assert.doesNotMatch(evidenceBoundary.content, /UnknownInput/);
	await assert.rejects(
		loadSkillReference(sketch, "../model/references/problem-modeling.md"),
		/direct skill-relative path/,
	);
	await assert.rejects(
		loadSkillReference(sketch, "references/not-present.md"),
		/unavailable for sketch/,
	);
});

test("every reference-bearing skill routes its complete catalog without global document ranks", async () => {
	const catalog = loadSkillsFromDir({
		dir: skillsRoot,
		source: "@hobin/developer",
	}).skills;
	for (const skill of catalog) {
		const references = await skillReferencePaths(skill);
		const policy = await loadSkillReferencePolicy(skill, references);
		if (references.length === 0) {
			assert.deepEqual(policy.routes, []);
			continue;
		}
		assert.ok(policy.routes.length > 0, `${skill.name} needs reference routes`);
		assert.deepEqual(
			[...new Set(policy.routes.flatMap((route) => route.references))].sort(),
			references,
			`${skill.name} must route every packaged reference`,
		);
		assert.ok(policy.exemption?.evidence.length);
	}
});

test("a reference-bearing skill cannot silently omit its routing policy", async () => {
	const root = await mkdtemp(join(tmpdir(), "developer-policy-"));
	const skillDir = join(root, "policy-missing");
	await mkdir(join(skillDir, "references"), { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		"---\nname: policy-missing\ndescription: Missing policy fixture.\n---\n\n# Missing\n",
	);
	await writeFile(join(skillDir, "references", "method.md"), "# Method\n");
	const skill = loadSkillsFromDir({ dir: root, source: "test" }).skills[0]!;
	await assert.rejects(
		loadSkillReferencePolicy(skill),
		/has references but no reference-policy\.json/,
	);
});

test("rejects legacy reference policy shape without judgment integration fields", async () => {
	const root = await mkdtemp(join(tmpdir(), "developer-policy-v1-"));
	const skillDir = join(root, "legacy-policy");
	await mkdir(join(skillDir, "references"), { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		"---\nname: legacy-policy\ndescription: Legacy policy fixture.\n---\n\n# Legacy\n",
	);
	await writeFile(join(skillDir, "references", "method.md"), "# Method\n");
	await writeFile(
		join(skillDir, "reference-policy.json"),
		JSON.stringify({
			version: 1,
			routes: [
				{
					id: "legacy",
					trigger: "A broad topic matches.",
					references: ["references/method.md"],
					artifacts: ["an answer"],
				},
			],
			exemption: { when: "Never.", evidence: ["none"] },
		}),
	);
	const skill = loadSkillsFromDir({ dir: root, source: "test" }).skills[0]!;
	await assert.rejects(
		loadSkillReferencePolicy(skill),
		/version 2, judgment-integrated routes/,
	);
});

test("routes only Pi-loaded, model-invocable leaves from this package", () => {
	const specify = loadSkillsFromDir({
		dir: skillsRoot,
		source: "@hobin/developer",
	}).skills.find((skill) => skill.name === "specify")!;
	const external = {
		...specify,
		filePath: "/outside/specify/SKILL.md",
		baseDir: "/outside/specify",
	};

	assert.deepEqual(
		[...availablePackageSkills([external], skillsRoot).keys()],
		[],
	);
	assert.deepEqual(
		[
			...availablePackageSkills(
				[{ ...specify, disableModelInvocation: true }],
				skillsRoot,
			).keys(),
		],
		[],
	);
	assert.deepEqual(
		[...availablePackageSkills([specify], skillsRoot).keys()],
		["specify"],
	);
});

test("canonical path checks reject a skill symlink that escapes the package root", async () => {
	const root = await mkdtemp(join(tmpdir(), "developer-skill-root-"));
	const outside = await mkdtemp(join(tmpdir(), "developer-skill-outside-"));
	const outsideFile = join(outside, "SKILL.md");
	const linkedFile = join(root, "SKILL.md");
	await writeFile(outsideFile, "outside");
	await symlink(outsideFile, linkedFile);

	assert.equal(isWithinRoot(root, linkedFile), false);
});

test("rejects a forced leaf body that would exceed Pi's tool-output limit", async () => {
	const root = await mkdtemp(join(tmpdir(), "developer-large-skill-"));
	const skillDir = join(root, "large");
	await mkdir(skillDir, { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		`---\nname: large\ndescription: Large test skill.\n---\n\n# Large\n\n${"x".repeat(60_000)}`,
	);

	const skill = loadSkillsFromDir({ dir: root, source: "test" }).skills[0]!;
	await assert.rejects(
		renderSkillMethod(skill),
		/too large for safe forced loading/,
	);
});
