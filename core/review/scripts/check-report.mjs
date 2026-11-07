#!/usr/bin/env node
// Start and check a review report against the spec's format (SPEC.md §3). Run from the repository root.
//   node check-report.mjs new <file> [--no-gate]         write the report skeleton to <file>; it
//                                                        fails the check until it is filled
//   node check-report.mjs [report=REVIEW.md] [--no-gate] exit 0 when the report is valid; otherwise
//                                                        print each problem and how to fix it
// A finding is `[P0|P1] <defect> — <file>:<line>` followed by `Scenario:` and `Evidence:`
// lines; the cited file must exist and contain that line. "No findings" is a valid report.
//
// The session registry (session-registry.mjs). Run inside an agent session (CLAUDE_CODE_SESSION_ID
// or CODEX_SESSION_ID set), both modes find the session's registry, .hobin-review/sessions/<id>.jsonl,
// in the working directory or a parent, and append the report's absolute path; the plugin's Stop
// hook checks every report listed there. With a session id and no registry (or one that cannot be
// written) they stop with exit 2 before writing or checking anything. Without a session id (a
// person at a terminal) they proceed and register nothing; --no-gate does the same inside a
// session whose registry is not found and says no Stop gate covers the report; it is refused
// (exit 2) when the registry is found, because the hooks are active.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The shared session registry (core/shared/scripts/session-registry.mjs): copied next to this
// script in a plugin, two folders up in this repository's core.
const here = dirname(fileURLToPath(import.meta.url));
const { register, registryFor, sessionIds } = await import(pathToFileURL(
	[join(here, "session-registry.mjs"), join(here, "../../shared/scripts/session-registry.mjs")].find(existsSync)).href);
const REGISTRY = ".hobin-review";

const FINDING = /^\[(P[0-9])\]\s+(.+?)\s+—\s+(\S+?):(\d+)(?:-(\d+))?\s*$/;
// A skeleton line not yet replaced: it starts with TODO:, or a report field holds TODO:.
const PLACEHOLDER = /^(?:(?:Checked without findings|Not checked):\s*)?TODO:/m;

export const SKELETON = `TODO: write each finding as "[P0|P1] <one-line defect> — <file>:<line>" followed by "Scenario:", "Evidence:" and "Direction:" lines, or the single line "No findings"; then fill the two lines below and delete this line.

Checked without findings: TODO: <perspectives>
Not checked: TODO: <what the review could not observe>
`;

export function checkReport(text, exists = existsSync, read = (p) => readFileSync(p, "utf8")) {
	const lines = text.split("\n");
	const problems = [];
	if (PLACEHOLDER.test(text)) problems.push("Replace every TODO: line of the skeleton with the report's content.");
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

// Where this command registers the report: { registry, note } (a writable registry of this
// session), { note } (nothing to register, the command proceeds), or undefined (it must stop).
function registration(noGate) {
	const sessions = sessionIds();
	const registry = sessions.map((sessionId) => registryFor({ name: REGISTRY, sessionId })).find(Boolean);
	if (noGate) {
		if (!registry) return { note: "--no-gate: no Stop gate covers this report." };
		console.error(`--no-gate is refused: this session's hobin-review hooks are active (its registry is ${registry}). Run the command again without --no-gate.`);
		return undefined;
	}
	if (registry) return { registry, note: "Registered for this session's Stop gate." };
	if (!sessions.length) return { note: "" };
	console.error(`No hobin-review registry for this agent session above ${process.cwd()}. Run check-report.mjs from the directory the session started in (or below it). If the hobin-review hooks are not active in this session (Codex: trust them in /hooks; evaluations that do not install the plugin), pass --no-gate: nothing will stop the session for this report.`);
	return undefined;
}
const registerIn = (where, file) => {
	if (where.registry) register(where.registry, file);
	return where.note ? ` ${where.note}` : "";
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const noGate = args.includes("--no-gate");
	const words = args.filter((arg) => arg !== "--no-gate");
	if (words[0] === "new") {
		const file = words[1];
		if (!file) { console.error("Usage: check-report.mjs new <file> [--no-gate]"); process.exit(2); }
		const where = registration(noGate);
		if (!where) process.exit(2);
		mkdirSync(dirname(resolve(file)), { recursive: true });
		writeFileSync(file, SKELETON);
		console.log(`Wrote ${file}.${registerIn(where, file)} Replace the skeleton with the report, then run: check-report.mjs ${file}`);
		process.exit(0);
	}
	const report = words[0] ?? "REVIEW.md";
	const where = registration(noGate);
	if (!where) process.exit(2);
	if (!existsSync(report)) { console.error(`${report} does not exist; start it with: check-report.mjs new ${report}`); process.exit(1); }
	const note = registerIn(where, report);
	const problems = checkReport(readFileSync(report, "utf8"));
	for (const p of problems) console.error(`- ${p}`);
	if (problems.length) { console.error(`${report} does not follow the review report format.${note}`); process.exit(1); }
	console.log(`${report} follows the review report format.${note}`);
}
