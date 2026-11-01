#!/usr/bin/env node
// Review reports (first line is a finding or "No findings") must pass check-report.mjs.
import { runHook } from "./hook-input.mjs";
import { checkReport } from "../skills/reviewing-code/scripts/check-report.mjs";

await runHook("review", (file, text) => {
	const first = text.split("\n").find((line) => line.trim()) ?? "";
	if (!/^\[P\d\]|^No findings\b/.test(first)) return null;
	const problems = checkReport(text);
	return problems.length ? ["does not follow the review report format:", ...problems] : [];
});
