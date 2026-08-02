import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import {
	availableDeveloperSkills,
	loadOptionalSkillPolicy,
	skillReferencePaths,
} from "../extensions/skill-catalog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const loaded = loadSkillsFromDir({
	dir: skillsRoot,
	source: "@hobin/developer",
});
const skills = availableDeveloperSkills(loaded.skills, skillsRoot);
const withPolicy = new Set([
	"abstraction-review",
	"model",
	"naming-judgment",
	"schedule",
	"signal",
	"sketch",
	"verify",
]);

test("Developer policies are optional and only conditional-reference skills own one", async () => {
	for (const [name, skill] of skills) {
		const policy = await loadOptionalSkillPolicy(skill);
		assert.equal(Boolean(policy), withPolicy.has(name), name);
		const references = await skillReferencePaths(skill);
		assert.deepEqual(
			policy?.references.map((reference) => reference.path).sort() ?? [],
			references,
		);
	}
});

test("compiled owner comes from the Pi skill rather than authored JSON", async () => {
	const skill = skills.get("sketch");
	assert.ok(skill);
	const policy = await loadOptionalSkillPolicy(skill);
	assert.ok(policy);
	assert.equal(policy.owner.name, "sketch");
	assert.equal(policy.owner.kind, "pi-skill");
	assert.ok(policy.when.length > 0);
	assert.ok(policy.unless.length > 0);
	assert.equal(policy.references.length, 20);
});
