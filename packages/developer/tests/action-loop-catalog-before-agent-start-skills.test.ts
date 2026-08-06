import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import type {
	BeforeAgentStartEvent,
	Skill,
} from "@earendil-works/pi-coding-agent";
import { catalogBeforeAgentStartSkills } from "../src/action-loop/pi/catalog-pi-loaded-skills.ts";
import { SKILL_TOC_SCHEMA_URI } from "../src/action-loop/routing/parse-toc.ts";

async function createWorkspace(t: TestContext): Promise<string> {
	const workspace = await mkdtemp(join(tmpdir(), "developer-hook-catalog-"));
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
	readonly disabled?: boolean;
}): Skill {
	return {
		name: input.name,
		description: `${input.name} hook fixture.`,
		filePath: input.filePath,
		baseDir: input.skillRootPath,
		disableModelInvocation: input.disabled ?? false,
		sourceInfo: {
			path: input.filePath,
			source: "local",
			scope: "project",
			origin: "top-level",
			baseDir: input.sourceBaseDir,
		},
	};
}

function hookInput(
	cwd: string,
	skills?: Skill[],
): Pick<BeforeAgentStartEvent, "systemPromptOptions"> {
	return { systemPromptOptions: { cwd, skills } };
}

test("catalogues every Pi-provided Skill into a source-bound discovery outcome", async (t) => {
	const workspace = await createWorkspace(t);
	const sourceBase = join(workspace, "provided");

	const structuredRoot = join(sourceBase, "structured");
	const structuredFile = join(structuredRoot, "SKILL.md");
	await writeSkill(structuredFile, "structured");
	await writeFile(
		join(structuredRoot, "routing.json"),
		toc(["A structured contribution is needed."]),
	);

	const directFile = join(sourceBase, "direct.md");
	await writeSkill(directFile, "direct");
	await writeFile(
		join(sourceBase, "toc.json"),
		toc(["A direct-file parent descriptor must not be claimed."]),
	);

	const plainRoot = join(sourceBase, "plain");
	const plainFile = join(plainRoot, "SKILL.md");
	await writeSkill(plainFile, "plain");

	const invalidRoot = join(sourceBase, "invalid");
	const invalidFile = join(invalidRoot, "SKILL.md");
	await writeSkill(invalidFile, "invalid");
	await writeFile(join(invalidRoot, "toc.json"), toc([]));

	const disabledRoot = join(sourceBase, "manual-only");
	const disabledFile = join(disabledRoot, "SKILL.md");
	await writeSkill(disabledFile, "manual-only");

	const unlistedRoot = join(workspace, ".pi", "skills", "unlisted");
	await writeSkill(join(unlistedRoot, "SKILL.md"), "unlisted");
	await writeFile(
		join(unlistedRoot, "toc.json"),
		toc(["This Skill was not supplied by Pi."]),
	);

	const skills = [
		loadedSkill({
			name: "structured",
			filePath: structuredFile,
			skillRootPath: structuredRoot,
			sourceBaseDir: sourceBase,
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
		loadedSkill({
			name: "manual-only",
			filePath: disabledFile,
			skillRootPath: disabledRoot,
			sourceBaseDir: sourceBase,
			disabled: true,
		}),
	];

	const result = await catalogBeforeAgentStartSkills(
		hookInput(workspace, skills),
	);

	assert.equal(result.status, "catalogued");
	if (result.status === "catalogued") {
		assert.deepEqual(
			result.entries.map((entry) => [
				entry.candidate.label,
				entry.status,
				entry.status === "unstructured" ? entry.reason : undefined,
			]),
			[
				["structured", "structured", undefined],
				["direct", "unstructured", "unsupported-skill-material"],
				["plain", "unstructured", "descriptor-absent"],
				["invalid", "failed", undefined],
			],
		);
		const structured = result.entries[0];
		assert.equal(
			structured?.status === "structured"
				? structured.descriptor.name
				: undefined,
			"routing.json",
		);
		const failed = result.entries[3];
		assert.equal(
			failed?.status === "failed" ? failed.error.code : undefined,
			"invalid-descriptor",
		);
		assert.deepEqual(result.excluded, [
			{
				label: "manual-only",
				skillFilePath: disabledFile,
				reason: "model-invocation-disabled",
			},
		]);
		assert.equal(
			result.entries.some(
				(entry) => entry.candidate.label === "unlisted",
			),
			false,
		);
		assert.equal(Object.isFrozen(result), true);
		assert.equal(Object.isFrozen(result.entries), true);
	}
});

test("an empty Pi catalog does not rediscover Skills beneath cwd", async (t) => {
	const workspace = await createWorkspace(t);
	const hiddenRoot = join(workspace, ".pi", "skills", "hidden");
	await writeSkill(join(hiddenRoot, "SKILL.md"), "hidden");
	await writeFile(
		join(hiddenRoot, "toc.json"),
		toc(["This Skill is excluded from Pi's current catalog."]),
	);

	const result = await catalogBeforeAgentStartSkills(hookInput(workspace));

	assert.deepEqual(result, {
		status: "catalogued",
		entries: [],
		excluded: [],
	});
	assert.equal(Object.isFrozen(result), true);
});

test("catalog adaptation failure rejects the handoff without partial entries", async (t) => {
	const workspace = await createWorkspace(t);
	const skillRoot = join(workspace, "skills", "duplicate");
	const skillFile = join(skillRoot, "SKILL.md");
	await writeSkill(skillFile, "duplicate");
	const skill = loadedSkill({
		name: "duplicate",
		filePath: skillFile,
		skillRootPath: skillRoot,
		sourceBaseDir: workspace,
	});

	const result = await catalogBeforeAgentStartSkills(
		hookInput(workspace, [skill, skill]),
	);

	assert.equal(result.status, "rejected");
	if (result.status === "rejected") {
		assert.equal(result.error.code, "duplicate-occurrence");
		assert.equal("entries" in result, false);
		assert.equal(Object.isFrozen(result), true);
	}
});
