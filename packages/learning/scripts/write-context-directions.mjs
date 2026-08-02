import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	parseLearningJudgmentPolicy,
	renderLearningContextDirections,
	replaceLearningContextDirections,
} from "./context-directions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const skillNames = (await readdir(skillsRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

for (const skillName of skillNames) {
	const skillRoot = join(skillsRoot, skillName);
	const [contractSource, markdown] = await Promise.all([
		readFile(join(skillRoot, "judgment.json"), "utf8"),
		readFile(join(skillRoot, "SKILL.md"), "utf8"),
	]);
	const policy = parseLearningJudgmentPolicy(contractSource);
	const section = renderLearningContextDirections(policy);
	await writeFile(
		join(skillRoot, "SKILL.md"),
		replaceLearningContextDirections(markdown, section),
		"utf8",
	);
}

process.stdout.write(
	`wrote Context Directions for ${skillNames.length} Learning skills\n`,
);
