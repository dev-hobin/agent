import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	parseDeveloperJudgmentPolicy,
	removeDeveloperContextDirections,
	renderDeveloperContextDirections,
	replaceDeveloperContextDirections,
} from "./context-directions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const skillNames = (await readdir(skillsRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
let policies = 0;
for (const skillName of skillNames) {
	const skillRoot = join(skillsRoot, skillName);
	const skillPath = join(skillRoot, "SKILL.md");
	const markdown = await readFile(skillPath, "utf8");
	try {
		const policy = parseDeveloperJudgmentPolicy(
			await readFile(join(skillRoot, "judgment.json"), "utf8"),
		);
		await writeFile(
			skillPath,
			replaceDeveloperContextDirections(
				markdown,
				renderDeveloperContextDirections(policy),
			),
			"utf8",
		);
		policies += 1;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			await writeFile(
				skillPath,
				removeDeveloperContextDirections(markdown),
				"utf8",
			);
			continue;
		}
		throw error;
	}
}
process.stdout.write(
	`wrote Context Directions for ${policies} policy-aware Developer skills\n`,
);
