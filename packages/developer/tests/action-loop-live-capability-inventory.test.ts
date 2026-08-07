import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import type {
	BeforeAgentStartEvent,
	Skill,
} from "@earendil-works/pi-coding-agent";
import {
	liveCapabilityInventoryPrompt,
	prepareLiveCapabilityInventory,
} from "../extensions/action-loop-capability-inventory.ts";
import { SKILL_TOC_SCHEMA_URI } from "../src/action-loop/routing/parse-toc.ts";

async function workspace(t: TestContext): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "developer-live-capabilities-"));
	t.after(async () => rm(path, { recursive: true, force: true }));
	return path;
}

async function skill(
	root: string,
	name: string,
	invalidToc = false,
): Promise<Skill> {
	const skillRoot = join(root, name);
	const filePath = join(skillRoot, "SKILL.md");
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `# ${name}\n`);
	if (invalidToc) {
		await writeFile(
			join(skillRoot, "toc.json"),
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [],
				unless: ["Another capability owns the Need."],
				references: [],
			}),
		);
	}
	return {
		name,
		description: `${name} live inventory fixture.`,
		filePath,
		baseDir: skillRoot,
		disableModelInvocation: false,
		sourceInfo: {
			path: filePath,
			source: "npm:@hobin/developer@cutover",
			scope: "project",
			origin: "package",
			baseDir: root,
		},
	};
}

function event(
	cwd: string,
	skills: Skill[],
): Pick<BeforeAgentStartEvent, "systemPromptOptions"> {
	return { systemPromptOptions: { cwd, skills } };
}

test("live inventory admits only bound Pi-loaded package Skills", async (t) => {
	const root = await workspace(t);
	const ready = await skill(root, "ready");
	const invalid = await skill(root, "invalid", true);
	const result = await prepareLiveCapabilityInventory(
		event(root, [ready, invalid]),
		root,
	);

	assert.equal(result.status, "ready");
	if (result.status !== "ready") return;
	assert.deepEqual(result.value.summary, {
		bound: 1,
		unavailable: 1,
		excluded: 0,
	});
	assert.deepEqual([...result.value.availablePackageSkills.keys()], ["ready"]);
	assert.deepEqual(
		[...result.value.boundCapabilitiesBySkillName.keys()],
		["ready"],
	);
	assert.match(
		result.value.boundCapabilitiesBySkillName.get("ready")?.capability
			.capabilityRevisionId ?? "",
		/^caprev_[a-f0-9]{64}$/,
	);
	assert.equal(
		liveCapabilityInventoryPrompt(result),
		"Action Loop capability inventory: 1 bound (1 unavailable, 0 excluded).",
	);
});

test("duplicate Pi source occurrence rejects the live handoff atomically", async (t) => {
	const root = await workspace(t);
	const ready = await skill(root, "ready");
	const result = await prepareLiveCapabilityInventory(
		event(root, [ready, ready]),
		root,
	);

	assert.equal(result.status, "rejected");
	if (result.status !== "rejected") return;
	assert.match(liveCapabilityInventoryPrompt(result), /inventory rejected/);
	assert.match(
		liveCapabilityInventoryPrompt(result),
		/no Developer Skill is admitted/,
	);
});
