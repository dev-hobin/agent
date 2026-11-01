#!/usr/bin/env node
// PostToolUse hook: when a written file starts with an output-contract marker, check it against
// the contract with that id (from skills/*/assets/output-contract.json) and send the problems
// back to the model (exit 2). Exits 0 for every other file and on any unexpected error, so a
// user's edit never fails here.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writtenFiles } from "./hook-input.mjs";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const skills = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
	const contracts = new Map();
	for (const skill of readdirSync(skills)) {
		const path = join(skills, skill, "assets/output-contract.json");
		if (!existsSync(path)) continue;
		const contract = JSON.parse(readFileSync(path, "utf8"));
		contracts.set(contract.id, { contract, checker: join(skills, skill, "scripts/output-contract.mjs") });
	}
	const problems = [];
	for (const file of writtenFiles(input)) {
		let text;
		try { text = readFileSync(file, "utf8"); } catch { continue; }
		const id = /^<!-- output-contract: (\S+) -->/.exec(text)?.[1];
		const entry = id && contracts.get(id);
		if (!entry) continue;
		const { checkText } = await import(entry.checker);
		const found = checkText(entry.contract, text);
		if (found.length) problems.push(`${file} does not meet the ${id} output contract:\n${found.map((p) => `- ${p}`).join("\n")}`);
	}
	if (problems.length) { console.error(problems.join("\n")); process.exit(2); }
} catch {
	// never fail the user's edit because of the hook
}
process.exit(0);
