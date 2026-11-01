#!/usr/bin/env node
// Files with the stances block marker must pass stances.mjs check.
import { runHook } from "./hook-input.mjs";
import { checkText } from "../skills/applying-stances/scripts/stances.mjs";

await runHook("stances", (file, text) => {
	if (!text.includes("<!-- hobin-stances:v1 -->")) return null;
	const problems = checkText(text);
	return problems.length ? ["the stances block does not pass stances.mjs check:", ...problems] : [];
});
