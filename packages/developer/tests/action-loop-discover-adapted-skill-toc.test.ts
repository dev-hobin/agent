import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { Skill } from "@earendil-works/pi-coding-agent";
import {
	adaptPiSkillCatalog,
	type AdaptedPiSkillDescriptor,
} from "../src/action-loop/pi/adapt-skill-catalog.ts";
import { discoverAdaptedSkillToc } from "../src/action-loop/pi/discover-admitted-skill-toc.ts";
import { SKILL_TOC_SCHEMA_URI } from "../src/action-loop/routing/parse-toc.ts";

async function createWorkspace(t: TestContext): Promise<string> {
	const workspace = await mkdtemp(join(tmpdir(), "developer-adapted-toc-"));
	t.after(async () => rm(workspace, { recursive: true, force: true }));
	return workspace;
}

function piSkill(input: {
	readonly name: string;
	readonly filePath: string;
	readonly skillRootPath: string;
	readonly sourceBaseDir: string;
}): Skill {
	return {
		name: input.name,
		description: `${input.name} fixture.`,
		filePath: input.filePath,
		baseDir: input.skillRootPath,
		disableModelInvocation: false,
		sourceInfo: {
			path: input.filePath,
			source: "local",
			scope: "project",
			origin: "top-level",
			baseDir: input.sourceBaseDir,
		},
	};
}

async function adaptedCandidate(
	skill: Skill,
): Promise<AdaptedPiSkillDescriptor> {
	const adapted = await adaptPiSkillCatalog([skill]);
	if (!adapted.ok) throw new Error(adapted.error.message);
	const candidate = adapted.inventory[0];
	if (candidate === undefined) throw new Error("Expected adapted candidate");
	return candidate;
}

function toc(when: readonly string[]): string {
	return JSON.stringify({
		$schema: SKILL_TOC_SCHEMA_URI,
		when,
		unless: ["The Skill is explicitly outside the delegated Need."],
		references: [],
	});
}

test("discovers a canonical descriptor only inside an adapted directory Skill", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "skills", "verify");
	const skillFile = join(skillRoot, "SKILL.md");
	await mkdir(skillRoot, { recursive: true });
	await writeFile(skillFile, "# Verify\n");
	await writeFile(
		join(skillRoot, "routing.json"),
		toc(["A bounded claim requires evidence."]),
	);
	const candidate = await adaptedCandidate(
		piSkill({
			name: "verify",
			filePath: skillFile,
			skillRootPath: skillRoot,
			sourceBaseDir: workspace,
		}),
	);

	const result = await discoverAdaptedSkillToc(candidate);

	assert.equal(result.status, "structured");
	if (result.status === "structured") {
		assert.equal(result.candidate, candidate);
		assert.equal(result.descriptor.name, "routing.json");
		assert.deepEqual(result.descriptor.toc.when, [
			"A bounded claim requires evidence.",
		]);
		assert.equal(Object.isFrozen(result), true);
	}
});

test("a direct-file Skill is unstructured without scanning its parent", async (t) => {
	const workspace = await createWorkspace(t);
	const skillFile = join(workspace, "verify.md");
	await writeFile(skillFile, "# Verify\n");
	await writeFile(
		join(workspace, "toc.json"),
		toc(["This descriptor belongs to no directory-shaped Skill."]),
	);
	const candidate = await adaptedCandidate(
		piSkill({
			name: "verify-direct",
			filePath: skillFile,
			skillRootPath: workspace,
			sourceBaseDir: workspace,
		}),
	);
	assert.equal(candidate.supportsStructuredToc, false);

	const result = await discoverAdaptedSkillToc(candidate);

	assert.deepEqual(result, {
		status: "unstructured",
		reason: "unsupported-skill-material",
		candidate,
	});
	assert.equal(Object.isFrozen(result), true);
});

test("a directory Skill without a descriptor remains explicitly unstructured", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "skills", "plain");
	const skillFile = join(skillRoot, "SKILL.md");
	await mkdir(skillRoot, { recursive: true });
	await writeFile(skillFile, "# Plain\n");
	const candidate = await adaptedCandidate(
		piSkill({
			name: "plain",
			filePath: skillFile,
			skillRootPath: skillRoot,
			sourceBaseDir: workspace,
		}),
	);

	const result = await discoverAdaptedSkillToc(candidate);

	assert.deepEqual(result, {
		status: "unstructured",
		reason: "descriptor-absent",
		candidate,
	});
	assert.equal(Object.isFrozen(result), true);
});

test("descriptor failure remains source-bound and cannot become absence", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "skills", "invalid");
	const skillFile = join(skillRoot, "SKILL.md");
	await mkdir(skillRoot, { recursive: true });
	await writeFile(skillFile, "# Invalid\n");
	await writeFile(join(skillRoot, "toc.json"), toc([]));
	const candidate = await adaptedCandidate(
		piSkill({
			name: "invalid",
			filePath: skillFile,
			skillRootPath: skillRoot,
			sourceBaseDir: workspace,
		}),
	);

	const result = await discoverAdaptedSkillToc(candidate);

	assert.equal(result.status, "failed");
	if (result.status === "failed") {
		assert.equal(result.candidate, candidate);
		assert.equal(result.error.code, "invalid-descriptor");
		assert.equal(result.error.parseError?.code, "empty-list");
		assert.equal(Object.isFrozen(result), true);
	}
});
