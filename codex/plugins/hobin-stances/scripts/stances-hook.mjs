#!/usr/bin/env node
// Files must pass stances.mjs check: a file this session registered (stances.mjs check), or a
// written file with the line that opens the stances block.
import { runHook } from "./hook-input.mjs";
import { MARKER, checkText } from "../skills/applying-stances/scripts/stances.mjs";

await runHook("stances", (file, text, registered) => {
	if (!registered && !text.split("\n").some((line) => line.replace(/^\+/, "").trim() === MARKER)) return null;
	const problems = checkText(text);
	return problems.length ? ["the stances block does not pass stances.mjs check:", ...problems] : [];
});
