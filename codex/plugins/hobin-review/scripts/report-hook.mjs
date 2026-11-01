#!/usr/bin/env node
// PostToolUse hook: when a written file is a review report (its first line is a finding or
// "No findings"), check it with the skill's check-report.mjs from the session's working
// directory and send the problems back to the model (exit 2). Exits 0 for every other file and
// on any unexpected error, so a user's edit never fails here.
import { readFileSync } from "node:fs";

import { checkReport } from "../skills/reviewing-code/scripts/check-report.mjs";
import { writtenFiles } from "./hook-input.mjs";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	if (input.cwd) process.chdir(input.cwd);
	const problems = [];
	for (const file of writtenFiles(input)) {
		let text;
		try { text = readFileSync(file, "utf8"); } catch { continue; }
		const first = text.split("\n").find((line) => line.trim()) ?? "";
		if (!/^\[P\d\]|^No findings\b/.test(first)) continue;
		const found = checkReport(text);
		if (found.length) problems.push(`${file} does not follow the review report format:\n${found.map((p) => `- ${p}`).join("\n")}`);
	}
	if (problems.length) { console.error(problems.join("\n")); process.exit(2); }
} catch {
	// never fail the user's edit because of the hook
}
process.exit(0);
