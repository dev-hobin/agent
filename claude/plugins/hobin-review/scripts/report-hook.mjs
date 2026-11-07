#!/usr/bin/env node
// Review reports must pass check-report.mjs: a file this session registered (check-report.mjs new
// or check), or a written file whose first line is a finding or "No findings".
import { runHook } from "./hook-input.mjs";
import { checkReport } from "../skills/reviewing-code/scripts/check-report.mjs";

await runHook("review", (file, text, registered) => {
	const first = text.split("\n").find((line) => line.trim()) ?? "";
	if (!registered && !/^\[P\d\]|^No findings\b/.test(first)) return null;
	const problems = checkReport(text);
	return problems.length ? ["does not follow the review report format:", ...problems] : [];
});
