#!/usr/bin/env node
// Check a review report against the spec's format (SPEC.md §3). Run from the repository root.
//   node check-report.mjs [report=REVIEW.md]   exit 0 when the report is valid; otherwise
//                                              print each problem and how to fix it
// A finding is `[P0|P1] <defect> — <file>:<line>` followed by `Scenario:` and `Evidence:`
// lines; the cited file must exist and contain that line. "No findings" is a valid report.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FINDING = /^\[(P[0-9])\]\s+(.+?)\s+—\s+(\S+?):(\d+)(?:-(\d+))?\s*$/;

export function checkReport(text, exists = existsSync, read = (p) => readFileSync(p, "utf8")) {
	const lines = text.split("\n");
	const problems = [];
	const starts = lines.map((line, i) => (/^\[P\d\]/.test(line) ? i : -1)).filter((i) => i >= 0);
	if (!starts.length) {
		if (!/^No findings\b/m.test(text)) problems.push('Write each finding as "[P0|P1] <defect> — <file>:<line>", or the single line "No findings".');
		return problems;
	}
	for (const [n, start] of starts.entries()) {
		const line = lines[start];
		const match = FINDING.exec(line);
		if (!match) { problems.push(`Line ${start + 1}: use "[P0|P1] <one-line defect> — <file>:<line>" (an em dash before the location): ${line}`); continue; }
		const [, severity, , file, first, last] = match;
		if (!["P0", "P1"].includes(severity)) problems.push(`Line ${start + 1}: report only P0 and P1 unless lower severities were asked for.`);
		if (!exists(file)) problems.push(`Line ${start + 1}: ${file} does not exist; cite the file the defect is in, relative to the repository root.`);
		else {
			const count = read(file).split("\n").length;
			for (const ref of [first, last].filter(Boolean)) {
				if (Number(ref) < 1 || Number(ref) > count) problems.push(`Line ${start + 1}: ${file} has ${count} lines; line ${ref} does not exist.`);
			}
		}
		const block = lines.slice(start + 1, starts[n + 1] ?? lines.length).join("\n");
		if (!/^\s*Scenario:\s*\S/m.test(block)) problems.push(`Line ${start + 1}: add a "Scenario:" line (input or state → wrong outcome) under the finding.`);
		if (!/^\s*Evidence:\s*\S/m.test(block)) problems.push(`Line ${start + 1}: add an "Evidence:" line (test, command output, or code trace) under the finding.`);
	}
	return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const report = process.argv[2] ?? "REVIEW.md";
	if (!existsSync(report)) { console.error(`${report} does not exist.`); process.exit(1); }
	const problems = checkReport(readFileSync(report, "utf8"));
	for (const p of problems) console.error(`- ${p}`);
	if (problems.length) { console.error(`${report} does not follow the review report format.`); process.exit(1); }
	console.log(`${report} follows the review report format.`);
}
