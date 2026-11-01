#!/usr/bin/env node
// Results that start with an output-contract marker must meet the contract with that id
// (skills/*/assets/output-contract.json).
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

await runHook("output-contract", async (file, text) => {
	const id = /^<!-- output-contract: (\S+) -->/.exec(text)?.[1];
	const entry = id && contracts.get(id);
	if (!entry) return null;
	const { checkText } = await import(entry.checker);
	const problems = checkText(entry.contract, text);
	return problems.length ? [`does not meet the ${id} output contract:`, ...problems] : [];
});
