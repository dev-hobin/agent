#!/usr/bin/env node
// PostToolUse hook (Write|Edit): when the written file starts with an output-contract marker,
// check it against that contract and feed the problems back to the model (exit 2).
// Exits 0 for every other file and on any unexpected error, so a user's edit never fails here.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkText } from "./output-contract.mjs";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const file = input?.tool_input?.file_path;
	if (typeof file !== "string") process.exit(0);
	const text = readFileSync(file, "utf8");
	const id = /^<!-- output-contract: (\S+) -->/.exec(text)?.[1];
	if (!id) process.exit(0);

	const skills = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
	for (const skill of readdirSync(skills)) {
		let contract;
		try { contract = JSON.parse(readFileSync(join(skills, skill, "assets", "output-contract.json"), "utf8")); } catch { continue; }
		if (contract.id !== id) continue;
		const problems = checkText(contract, text);
		if (problems.length) {
			console.error(`${file} does not meet the ${id} output contract:\n${problems.map((p) => `- ${p}`).join("\n")}`);
			process.exit(2);
		}
		break;
	}
} catch {
	// never fail the user's edit because of the hook
}
process.exit(0);
