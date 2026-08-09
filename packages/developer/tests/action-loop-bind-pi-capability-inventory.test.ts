import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import type {
	BeforeAgentStartEvent,
	Skill,
} from "@earendil-works/pi-coding-agent";
import { acceptSkillContribution } from "../src/action-loop/contribution/accept-skill-contribution.ts";
import { sealUnstructuredSkillContext } from "../src/action-loop/io/seal-skill-context.ts";
import { closeJudgment } from "../src/action-loop/judgment/close-judgment.ts";
import { assessNeedCoverage } from "../src/action-loop/need-coverage/assess-need-coverage.ts";
import {
	bindPiCapabilityInventory,
	MAX_CAPABILITY_SKILL_BYTES,
} from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import {
	catalogBeforeAgentStartSkills,
	type BeforeAgentStartSkillCatalogResult,
} from "../src/action-loop/pi/catalog-pi-loaded-skills.ts";
import { acceptCapabilityApplicability } from "../src/action-loop/routing/accept-applicability.ts";
import { SKILL_TOC_SCHEMA_URI } from "../src/action-loop/routing/parse-toc.ts";

async function createWorkspace(t: TestContext): Promise<string> {
	const workspace = await mkdtemp(join(tmpdir(), "developer-cap-inventory-"));
	t.after(async () => rm(workspace, { recursive: true, force: true }));
	return workspace;
}

async function writeSkill(path: string, name: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `# ${name}\n`);
}

function toc(when: readonly string[]): string {
	return JSON.stringify({
		$schema: SKILL_TOC_SCHEMA_URI,
		when,
		unless: ["The Skill is explicitly outside the delegated Need."],
		references: [],
	});
}

function loadedSkill(input: {
	readonly name: string;
	readonly filePath: string;
	readonly skillRootPath: string;
	readonly sourceBaseDir: string;
	readonly source?: string;
	readonly origin?: "package" | "top-level";
}): Skill {
	return {
		name: input.name,
		description: `${input.name} inventory fixture.`,
		filePath: input.filePath,
		baseDir: input.skillRootPath,
		disableModelInvocation: false,
		sourceInfo: {
			path: input.filePath,
			source: input.source ?? "local",
			scope: "project",
			origin: input.origin ?? "top-level",
			baseDir: input.sourceBaseDir,
		},
	};
}

function hookInput(
	cwd: string,
	skills: Skill[],
): Pick<BeforeAgentStartEvent, "systemPromptOptions"> {
	return { systemPromptOptions: { cwd, skills } };
}

async function catalog(
	cwd: string,
	skills: Skill[],
): Promise<BeforeAgentStartSkillCatalogResult> {
	return catalogBeforeAgentStartSkills(hookInput(cwd, skills));
}

test("binds structured and unstructured entries while preserving TOC failures", async (t) => {
	const workspace = await createWorkspace(t);
	const sourceBase = join(workspace, "skills");

	const structuredRoot = join(sourceBase, "verify");
	const structuredFile = join(structuredRoot, "SKILL.md");
	await writeSkill(structuredFile, "verify");
	await writeFile(
		join(structuredRoot, "routing.json"),
		toc(["A bounded claim requires verification."]),
	);

	const directFile = join(sourceBase, "direct.md");
	await writeSkill(directFile, "direct");

	const plainRoot = join(sourceBase, "plain");
	const plainFile = join(plainRoot, "SKILL.md");
	await writeSkill(plainFile, "plain");

	const invalidRoot = join(sourceBase, "invalid");
	const invalidFile = join(invalidRoot, "SKILL.md");
	await writeSkill(invalidFile, "invalid");
	await writeFile(join(invalidRoot, "toc.json"), toc([]));

	const loaded = await catalog(workspace, [
		loadedSkill({
			name: "verify",
			filePath: structuredFile,
			skillRootPath: structuredRoot,
			sourceBaseDir: sourceBase,
			source: "npm:@hobin/developer@pilot",
			origin: "package",
		}),
		loadedSkill({
			name: "direct",
			filePath: directFile,
			skillRootPath: sourceBase,
			sourceBaseDir: sourceBase,
		}),
		loadedSkill({
			name: "plain",
			filePath: plainFile,
			skillRootPath: plainRoot,
			sourceBaseDir: sourceBase,
		}),
		loadedSkill({
			name: "invalid",
			filePath: invalidFile,
			skillRootPath: invalidRoot,
			sourceBaseDir: sourceBase,
		}),
	]);
	if (loaded.status === "rejected") throw new Error(loaded.error.message);
	const preservedFailure = loaded.entries[3];
	await rm(invalidFile);

	const first = await bindPiCapabilityInventory(loaded);
	const second = await bindPiCapabilityInventory(loaded);

	assert.equal(first.status, "inventoried");
	assert.equal(second.status, "inventoried");
	if (first.status === "inventoried" && second.status === "inventoried") {
		assert.deepEqual(
			first.entries.map((entry) => entry.status),
			["bound", "bound", "bound", "failed"],
		);
		const bound = first.entries[0];
		const rebound = second.entries[0];
		assert.equal(bound?.status, "bound");
		assert.equal(
			bound?.status === "bound" ? bound.routing : undefined,
			"structured",
		);
		assert.equal(rebound?.status, "bound");
		if (
			bound?.status === "bound" &&
			bound.routing === "structured" &&
			rebound?.status === "bound" &&
			rebound.routing === "structured"
		) {
			assert.equal(bound.candidate.label, "verify");
			assert.equal(bound.descriptor.name, "routing.json");
			assert.deepEqual(bound.capability.source, bound.candidate.source);
			assert.equal(
				bound.capability.capabilityId,
				rebound.capability.capabilityId,
			);
			assert.equal(
				bound.capability.capabilityRevisionId,
				rebound.capability.capabilityRevisionId,
			);
			assert.equal(Object.isFrozen(bound), true);
		}
		const direct = first.entries[1];
		const plain = first.entries[2];
		assert.equal(direct?.status, "bound");
		assert.equal(plain?.status, "bound");
		if (
			direct?.status === "bound" &&
			direct.routing === "unstructured" &&
			plain?.status === "bound" &&
			plain.routing === "unstructured"
		) {
			assert.equal(direct.reason, "unsupported-skill-material");
			assert.equal(plain.reason, "descriptor-absent");
			assert.equal(direct.capability.routing, "unstructured");
			assert.equal(plain.capability.routing, "unstructured");
		}
		assert.equal(first.entries[3], preservedFailure);
		assert.equal(Object.isFrozen(first), true);
		assert.equal(Object.isFrozen(first.entries), true);
	}
});

test("bound unstructured inventory composes through Upper Judgment closure", async (t) => {
	const workspace = await createWorkspace(t);
	const skillFile = join(workspace, "direct.md");
	await writeSkill(skillFile, "direct");
	const loaded = await catalog(workspace, [
		loadedSkill({
			name: "direct",
			filePath: skillFile,
			skillRootPath: workspace,
			sourceBaseDir: workspace,
		}),
	]);
	const inventory = await bindPiCapabilityInventory(loaded);
	if (inventory.status !== "inventoried") {
		throw new Error(inventory.error.message);
	}
	const entry = inventory.entries[0];
	assert.equal(entry?.status, "bound");
	assert.equal(
		entry?.status === "bound" ? entry.routing : undefined,
		"unstructured",
	);
	if (entry?.status !== "bound" || entry.routing !== "unstructured") return;

	const applicability = acceptCapabilityApplicability(
		{
			workCaseId: "work-1",
			judgmentId: "judgment-1",
			contributionNeedId: "need-1",
			capability: entry.capability,
		},
		{
			workCaseId: "work-1",
			judgmentId: "judgment-1",
			contributionNeedId: "need-1",
			capabilityRevisionId: entry.capability.capabilityRevisionId,
			status: "applicable",
			matchedWhen: [],
			matchedUnless: [],
			basis: [
				`${entry.candidate.description} directly addresses the current Need.`,
			],
			missingContext: [],
		},
	);

	assert.equal(applicability.status, "assigned");
	if (applicability.status !== "assigned") return;
	assert.equal(
		applicability.assignment.capabilityRevisionId,
		entry.capability.capabilityRevisionId,
	);
	assert.deepEqual(applicability.assignment.matchedWhen, []);

	const sealed = await sealUnstructuredSkillContext({
		skillFilePath: entry.candidate.skillFilePath,
		capability: entry.capability,
		assignment: applicability.assignment,
	});
	assert.equal(sealed.ok, true);
	if (!sealed.ok) return;
	assert.equal("selectionId" in sealed.value, false);
	assert.deepEqual(sealed.value.selectedPaths, []);

	const contribution = acceptSkillContribution(
		applicability.assignment,
		sealed.value,
		{
			workCaseId: applicability.assignment.workCaseId,
			judgmentId: applicability.assignment.judgmentId,
			contributionNeedId: applicability.assignment.contributionNeedId,
			assignmentId: applicability.assignment.assignmentId,
			capabilityId: applicability.assignment.capabilityId,
			capabilityRevisionId: applicability.assignment.capabilityRevisionId,
			sealedContextId: sealed.value.sealedContextId,
			localStatus: "resolved",
			result: "The direct Skill supplies the bounded requested method.",
			referenceApplications: [],
			limitations: [],
			residualNeeds: [],
			provenance: {
				kind: "tool",
				source: "unstructured-inventory-slice",
			},
		},
	);
	assert.equal(contribution.status, "accepted");
	if (contribution.status !== "accepted") return;
	assert.equal(
		contribution.value.sealedContextId,
		sealed.value.sealedContextId,
	);
	assert.deepEqual(contribution.value.referenceApplications, []);

	const coverage = assessNeedCoverage(
		{
			workCaseId: applicability.assignment.workCaseId,
			judgmentId: applicability.assignment.judgmentId,
			contributionNeedId: applicability.assignment.contributionNeedId,
		},
		[contribution.value],
		{
			workCaseId: applicability.assignment.workCaseId,
			judgmentId: applicability.assignment.judgmentId,
			contributionNeedId: applicability.assignment.contributionNeedId,
			status: "covered",
			dispositions: [
				{
					contributionId: contribution.value.contributionId,
					status: "supports",
					basis: ["The bounded result directly supplies the required input."],
				},
			],
			conflicts: [],
			basis: ["Current Contribution support is sufficient for this Need."],
			provenance: { kind: "tool", source: "unstructured-inventory-slice" },
		},
	);
	assert.equal(coverage.status, "accepted");
	if (coverage.status !== "accepted") return;

	const closure = closeJudgment(
		{
			workCaseId: applicability.assignment.workCaseId,
			judgmentId: applicability.assignment.judgmentId,
			category: "Contextual Adequacy",
			subject: "The direct Skill supplies the required bounded method.",
			contextRevisionId: "context-unstructured-slice",
			requirements: [
				{
					requirementId: "requirement-method",
					statement: "The requested bounded method is contextually adequate.",
					contributionNeedIds: [applicability.assignment.contributionNeedId],
				},
			],
		},
		[coverage.value],
		{
			workCaseId: applicability.assignment.workCaseId,
			judgmentId: applicability.assignment.judgmentId,
			category: "Contextual Adequacy",
			contextRevisionId: "context-unstructured-slice",
			outcome: "conclude",
			answer: "The bounded method is adequate for the delegated Need.",
			refusalReasons: [],
			requirementDispositions: [
				{
					requirementId: "requirement-method",
					status: "satisfied",
					coverageIds: [coverage.value.coverageId],
					basis: ["The required Need has current covered support."],
				},
			],
			basis: ["Current Coverage satisfies the closure requirement."],
			provenance: { kind: "tool", source: "unstructured-inventory-slice" },
		},
	);
	assert.equal(closure.status, "concluded");
	if (closure.status === "concluded") {
		assert.equal("actionClearance" in closure.value, false);
	}
});

test("records bounded acquisition failures on their structured entries", async (t) => {
	const workspace = await createWorkspace(t);
	const sourceBase = join(workspace, "skills");
	const cases = ["missing", "oversized", "invalid-utf8"] as const;
	const skills: Skill[] = [];
	const files = new Map<(typeof cases)[number], string>();
	for (const name of cases) {
		const skillRoot = join(sourceBase, name);
		const skillFile = join(skillRoot, "SKILL.md");
		await writeSkill(skillFile, name);
		await writeFile(
			join(skillRoot, "toc.json"),
			toc([`The ${name} acquisition case applies.`]),
		);
		files.set(name, skillFile);
		skills.push(
			loadedSkill({
				name,
				filePath: skillFile,
				skillRootPath: skillRoot,
				sourceBaseDir: sourceBase,
			}),
		);
	}
	const loaded = await catalog(workspace, skills);
	if (loaded.status === "rejected") throw new Error(loaded.error.message);
	await rm(files.get("missing") ?? "");
	await writeFile(
		files.get("oversized") ?? "",
		Buffer.alloc(MAX_CAPABILITY_SKILL_BYTES + 1, 0x61),
	);
	await writeFile(files.get("invalid-utf8") ?? "", Buffer.from([0xff]));

	const result = await bindPiCapabilityInventory(loaded);

	assert.equal(result.status, "inventoried");
	if (result.status === "inventoried") {
		assert.deepEqual(
			result.entries.map((entry) =>
				entry.status === "binding-failed"
					? [entry.stage, entry.error.code]
					: entry.status,
			),
			[
				["skill-acquisition", "skill-missing"],
				["skill-acquisition", "skill-too-large"],
				["skill-acquisition", "invalid-utf8"],
			],
		);
	}
});

test("unstructured acquisition failure remains source-bound without TOC fallback", async (t) => {
	const workspace = await createWorkspace(t);
	const skillFile = join(workspace, "direct.md");
	await writeSkill(skillFile, "direct");
	const loaded = await catalog(workspace, [
		loadedSkill({
			name: "direct",
			filePath: skillFile,
			skillRootPath: workspace,
			sourceBaseDir: workspace,
		}),
	]);
	if (loaded.status === "rejected") throw new Error(loaded.error.message);
	await rm(skillFile);

	const result = await bindPiCapabilityInventory(loaded);

	assert.equal(result.status, "inventoried");
	if (result.status === "inventoried") {
		const failure = result.entries[0];
		assert.equal(failure?.status, "binding-failed");
		if (
			failure?.status === "binding-failed" &&
			failure.routing === "unstructured"
		) {
			assert.equal(failure.reason, "unsupported-skill-material");
			assert.equal(failure.stage, "skill-acquisition");
			assert.equal(failure.error.code, "skill-missing");
		}
	}
});

test("Capability binding rejection remains explicit after successful acquisition", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "skills", "invalid-source");
	const skillFile = join(skillRoot, "SKILL.md");
	await writeSkill(skillFile, "invalid-source");
	await writeFile(
		join(skillRoot, "toc.json"),
		toc(["The malformed adapter source case applies."]),
	);
	const loaded = await catalog(workspace, [
		loadedSkill({
			name: "invalid-source",
			filePath: skillFile,
			skillRootPath: skillRoot,
			sourceBaseDir: workspace,
		}),
	]);
	if (loaded.status === "rejected") throw new Error(loaded.error.message);
	const structured = loaded.entries[0];
	if (structured?.status !== "structured") {
		throw new Error("Expected structured fixture");
	}
	const malformed = {
		status: "catalogued" as const,
		entries: [
			{
				...structured,
				candidate: {
					...structured.candidate,
					source: { ...structured.candidate.source, locator: "" },
				},
			},
		],
		excluded: [],
		unavailable: [],
	} satisfies BeforeAgentStartSkillCatalogResult;

	const result = await bindPiCapabilityInventory(malformed);

	assert.equal(result.status, "inventoried");
	if (result.status === "inventoried") {
		const failure = result.entries[0];
		assert.equal(failure?.status, "binding-failed");
		if (failure?.status === "binding-failed") {
			assert.equal(failure.stage, "capability-binding");
			assert.equal(failure.error.code, "invalid-source-locator");
			assert.equal(Object.isFrozen(failure), true);
			assert.equal(Object.isFrozen(failure.error), true);
		}
	}
});

test("unavailable duplicate occurrences cannot produce bound Capabilities", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "skills", "duplicate");
	const skillFile = join(skillRoot, "SKILL.md");
	await writeSkill(skillFile, "duplicate");
	await writeFile(
		join(skillRoot, "toc.json"),
		toc(["The duplicate source case applies."]),
	);
	const skill = loadedSkill({
		name: "duplicate",
		filePath: skillFile,
		skillRootPath: skillRoot,
		sourceBaseDir: workspace,
	});
	const loaded = await catalog(workspace, [skill, skill]);

	const result = await bindPiCapabilityInventory(loaded);

	assert.equal(result.status, "inventoried");
	if (result.status === "inventoried") {
		assert.deepEqual(result.entries, []);
		assert.deepEqual(
			result.unavailable.map((entry) => entry.error.code),
			["duplicate-occurrence", "duplicate-occurrence"],
		);
		assert.equal(Object.isFrozen(result), true);
	}
});
