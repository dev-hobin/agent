import assert from "node:assert/strict";
import {
	mkdtemp,
	mkdir,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { adaptPiSkillCatalog } from "../src/action-loop/pi/adapt-skill-catalog.ts";

async function createWorkspace(t: TestContext): Promise<string> {
	const workspace = await mkdtemp(join(tmpdir(), "developer-pi-catalog-"));
	t.after(async () => rm(workspace, { recursive: true, force: true }));
	return workspace;
}

async function createSkillFile(path: string, name: string): Promise<void> {
	await mkdir(join(path, ".."), { recursive: true });
	await writeFile(
		path,
		`---\nname: ${name}\ndescription: ${name} fixture.\n---\n\n# ${name}\n`,
	);
}

function piSkill(input: {
	readonly name: string;
	readonly filePath: string;
	readonly baseDir: string;
	readonly sourceBaseDir: string;
	readonly source: string;
	readonly scope: "user" | "project" | "temporary";
	readonly origin: "package" | "top-level";
	readonly disabled?: boolean;
	readonly sourcePath?: string;
}): Skill {
	return {
		name: input.name,
		description: `${input.name} fixture.`,
		filePath: input.filePath,
		baseDir: input.baseDir,
		disableModelInvocation: input.disabled ?? false,
		sourceInfo: {
			path: input.sourcePath ?? input.filePath,
			source: input.source,
			scope: input.scope,
			origin: input.origin,
			baseDir: input.sourceBaseDir,
		},
	};
}

test("adapts only Pi-provided model-invocable Skills without name-based dedup", async (t) => {
	const workspace = await createWorkspace(t);
	const packageBase = join(workspace, "package");
	const packageSkillRoot = join(packageBase, "skills", "verify");
	const packageSkillFile = join(packageSkillRoot, "SKILL.md");
	await createSkillFile(packageSkillFile, "verify");
	await createSkillFile(
		join(packageBase, "skills", "not-in-pi-catalog", "SKILL.md"),
		"not-in-pi-catalog",
	);

	const projectBase = join(workspace, "project", ".pi", "skills");
	const projectSkillRoot = join(projectBase, "verify-local");
	const projectSkillFile = join(projectSkillRoot, "SKILL.md");
	await createSkillFile(projectSkillFile, "verify");

	const cliBase = join(workspace, "explicit-skills");
	const cliSkillFile = join(cliBase, "lint.md");
	await createSkillFile(cliSkillFile, "lint-check");

	const disabledRoot = join(packageBase, "skills", "manual-only");
	const disabledFile = join(disabledRoot, "SKILL.md");
	await createSkillFile(disabledFile, "manual-only");

	const packageSkill = piSkill({
		name: "verify",
		filePath: packageSkillFile,
		baseDir: packageSkillRoot,
		sourceBaseDir: packageBase,
		source: "npm:@hobin/developer@0.1.19",
		scope: "user",
		origin: "package",
	});
	const projectSkill = piSkill({
		name: "verify",
		filePath: projectSkillFile,
		baseDir: projectSkillRoot,
		sourceBaseDir: projectBase,
		source: "local",
		scope: "project",
		origin: "top-level",
	});
	const cliSkill = piSkill({
		name: "lint-check",
		filePath: cliSkillFile,
		baseDir: cliBase,
		sourceBaseDir: cliBase,
		source: "cli",
		scope: "temporary",
		origin: "top-level",
	});
	const disabled = piSkill({
		name: "manual-only",
		filePath: disabledFile,
		baseDir: disabledRoot,
		sourceBaseDir: packageBase,
		source: "npm:@hobin/developer@0.1.19",
		scope: "user",
		origin: "package",
		disabled: true,
	});

	const result = await adaptPiSkillCatalog([
		projectSkill,
		packageSkill,
		cliSkill,
		disabled,
	]);
	const physicalProjectBase = await realpath(projectBase);
	const physicalCliBase = await realpath(cliBase);

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(
			result.inventory.map((candidate) => candidate.label),
			["verify", "verify", "lint-check"],
		);
		assert.deepEqual(
			result.inventory.map((candidate) => candidate.source),
			[
				{
					kind: "project",
					locator: pathToFileURL(physicalProjectBase).href,
					skillRoot: "verify-local",
				},
				{
					kind: "package",
					locator: "npm:@hobin/developer@0.1.19",
					skillRoot: "skills/verify",
				},
				{
					kind: "cli",
					locator: pathToFileURL(physicalCliBase).href,
					skillRoot: "lint.md",
				},
			],
		);
		assert.deepEqual(
			result.inventory.map((candidate) => ({
				material: candidate.skillMaterialPath,
				structured: candidate.supportsStructuredToc,
			})),
			[
				{ material: "SKILL.md", structured: true },
				{ material: "SKILL.md", structured: true },
				{ material: "lint.md", structured: false },
			],
		);
		assert.deepEqual(result.excluded, [
			{
				label: "manual-only",
				skillFilePath: disabledFile,
				reason: "model-invocation-disabled",
			},
		]);
		assert.equal(
			result.inventory.some(
				(candidate) => candidate.label === "not-in-pi-catalog",
			),
			false,
		);
		assert.equal(Object.isFrozen(result), true);
		assert.equal(Object.isFrozen(result.inventory), true);
		assert.equal(Object.isFrozen(result.inventory[0]), true);
		assert.equal(Object.isFrozen(result.inventory[0]?.source), true);
	}
});

test("maps a Pi user-scoped top-level Skill to global provenance", async (t) => {
	const workspace = await createWorkspace(t);
	const sourceBase = join(workspace, "global-skills");
	const skillRoot = join(sourceBase, "model");
	const skillFile = join(skillRoot, "SKILL.md");
	await createSkillFile(skillFile, "model");
	const skill = piSkill({
		name: "model",
		filePath: skillFile,
		baseDir: skillRoot,
		sourceBaseDir: sourceBase,
		source: "local",
		scope: "user",
		origin: "top-level",
	});

	const result = await adaptPiSkillCatalog([skill]);
	const physicalSourceBase = await realpath(sourceBase);

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.inventory[0]?.source, {
			kind: "global",
			locator: pathToFileURL(physicalSourceBase).href,
			skillRoot: "model",
		});
	}
});

test("rejects duplicate source occurrences instead of deduplicating them", async (t) => {
	const workspace = await createWorkspace(t);
	const sourceBase = join(workspace, "skills");
	const skillRoot = join(sourceBase, "verify");
	const skillFile = join(skillRoot, "SKILL.md");
	await createSkillFile(skillFile, "verify");
	const skill = piSkill({
		name: "verify",
		filePath: skillFile,
		baseDir: skillRoot,
		sourceBaseDir: sourceBase,
		source: "local",
		scope: "user",
		origin: "top-level",
	});

	const result = await adaptPiSkillCatalog([skill, { ...skill }]);

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, "duplicate-occurrence");
		assert.equal(result.error.index, 1);
		assert.equal(result.error.path, "skills[1]");
		assert.equal(Object.isFrozen(result), true);
		assert.equal(Object.isFrozen(result.error), true);
	}
});

test("fails atomically when Pi descriptor paths or provenance disagree", async (t) => {
	const workspace = await createWorkspace(t);
	const sourceBase = join(workspace, "skills");
	const skillRoot = join(sourceBase, "verify");
	const skillFile = join(skillRoot, "SKILL.md");
	const otherFile = join(sourceBase, "other", "SKILL.md");
	await createSkillFile(skillFile, "verify");
	await createSkillFile(otherFile, "other");

	const mismatch = piSkill({
		name: "verify",
		filePath: skillFile,
		baseDir: skillRoot,
		sourceBaseDir: sourceBase,
		source: "local",
		scope: "project",
		origin: "top-level",
		sourcePath: otherFile,
	});
	const mismatchResult = await adaptPiSkillCatalog([mismatch]);
	assert.equal(mismatchResult.ok, false);
	if (!mismatchResult.ok) {
		assert.equal(mismatchResult.error.code, "source-path-mismatch");
		assert.equal("inventory" in mismatchResult, false);
	}

	const escapingBase = piSkill({
		name: "verify",
		filePath: skillFile,
		baseDir: skillRoot,
		sourceBaseDir: join(workspace, "unrelated"),
		source: "local",
		scope: "project",
		origin: "top-level",
	});
	await mkdir(join(workspace, "unrelated"));
	const escapingResult = await adaptPiSkillCatalog([escapingBase]);
	assert.equal(escapingResult.ok, false);
	if (!escapingResult.ok) {
		assert.equal(escapingResult.error.code, "source-root-escape");
		assert.equal("inventory" in escapingResult, false);
	}
});

test("rejects malformed runtime provenance before filesystem adaptation", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "verify");
	const skillFile = join(skillRoot, "SKILL.md");
	await createSkillFile(skillFile, "verify");
	const malformed = piSkill({
		name: "verify",
		filePath: skillFile,
		baseDir: skillRoot,
		sourceBaseDir: workspace,
		source: "local",
		scope: "temporary",
		origin: "top-level",
	});
	(malformed.sourceInfo as { scope: string }).scope = "unknown";

	const result = await adaptPiSkillCatalog([malformed]);

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, "invalid-source-provenance");
		assert.equal(result.error.path, "skills[0].sourceInfo.scope");
	}
});
