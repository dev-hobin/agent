#!/usr/bin/env node
// PostToolUse hook: when a written file contains the stances block marker, check it with the
// skill's stances.mjs and send the problems back to the model (exit 2). Exits 0 for every other
// file and on any unexpected error, so a user's edit never fails here.
import { readFileSync } from "node:fs";

import { checkText } from "../skills/applying-stances/scripts/stances.mjs";
import { writtenFiles } from "./hook-input.mjs";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const problems = [];
	for (const file of writtenFiles(input)) {
		let text;
		try { text = readFileSync(file, "utf8"); } catch { continue; }
		if (!text.includes("<!-- hobin-stances:v1 -->")) continue;
		const found = checkText(text);
		if (found.length) problems.push(`${file}: the stances block does not pass stances.mjs check:\n${found.map((p) => `- ${p}`).join("\n")}`);
	}
	if (problems.length) { console.error(problems.join("\n")); process.exit(2); }
} catch {
	// never fail the user's edit because of the hook
}
process.exit(0);
