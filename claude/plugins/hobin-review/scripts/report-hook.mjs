#!/usr/bin/env node
// PostToolUse hook (Write|Edit): when the written file is a review report (its first line is a
// finding or "No findings"), check it with the skill's check-report.mjs from the session's
// working directory and feed problems back to the model (exit 2). Exits 0 for every other
// file and on any unexpected error, so a user's edit never fails here.
import { readFileSync } from "node:fs";

import { checkReport } from "../skills/reviewing-code/scripts/check-report.mjs";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const file = input?.tool_input?.file_path;
	if (typeof file !== "string") process.exit(0);
	const text = readFileSync(file, "utf8");
	const first = text.split("\n").find((line) => line.trim()) ?? "";
	if (!/^\[P\d\]|^No findings\b/.test(first)) process.exit(0);
	if (input.cwd) process.chdir(input.cwd);
	const problems = checkReport(text);
	if (problems.length) {
		console.error(`${file} does not follow the review report format:\n${problems.map((p) => `- ${p}`).join("\n")}`);
		process.exit(2);
	}
} catch {
	// never fail the user's edit because of the hook
}
process.exit(0);
