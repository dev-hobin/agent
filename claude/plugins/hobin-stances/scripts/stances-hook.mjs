#!/usr/bin/env node
// PostToolUse hook (Write|Edit), registered by the applying-stances skill: when the written file
// contains the stances block marker, check it with the skill's stances.mjs and feed problems back
// to the model (exit 2). Exits 0 for every other file and on any unexpected error, so a user's
// edit never fails here.
import { readFileSync } from "node:fs";

import { checkText } from "../skills/applying-stances/scripts/stances.mjs";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const file = input?.tool_input?.file_path;
	if (typeof file !== "string") process.exit(0);
	const text = readFileSync(file, "utf8");
	if (!text.includes("<!-- hobin-stances:v1 -->")) process.exit(0);
	const problems = checkText(text);
	if (problems.length) {
		console.error(`${file}: the stances block does not pass stances.mjs check:\n${problems.map((p) => `- ${p}`).join("\n")}`);
		process.exit(2);
	}
} catch {
	// never fail the user's edit because of the hook
}
process.exit(0);
