#!/usr/bin/env node
// Results must meet the output contract their first line names (skills/*/assets/output-contract.json):
// a file this session registered (output-contract.mjs new or check), or a written file that starts
// with an output-contract marker.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runHook } from "./hook-input.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skills = join(here, "..", "skills");
const contracts = new Map();
for (const skill of readdirSync(skills)) {
	const path = join(skills, skill, "assets/output-contract.json");
	if (!existsSync(path)) continue;
	const contract = JSON.parse(readFileSync(path, "utf8"));
	// The checker sits next to this hook (Claude) or in each skill's scripts/ (Codex).
	const checker = [join(here, "output-contract.mjs"), join(skills, skill, "scripts/output-contract.mjs")].find(existsSync);
	contracts.set(contract.id, { contract, checker });
}

await runHook("learning", async (file, text, registered) => {
	const id = /^<!-- output-contract: (\S+) -->/.exec(text)?.[1];
	const entry = id && contracts.get(id);
	if (!entry) {
		if (!registered) return null;
		return [`this session registered it as a result, but its first line is not an output-contract marker of this plugin (<!-- output-contract: <id> --> with one of: ${[...contracts.keys()].join(", ")}); keep the marker line of the skeleton output-contract.mjs new wrote.`];
	}
	const { checkText } = await import(entry.checker);
	const problems = checkText(entry.contract, text);
	return problems.length ? [`does not meet the ${id} output contract:`, ...problems] : [];
});
