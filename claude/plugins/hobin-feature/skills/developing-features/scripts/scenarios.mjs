#!/usr/bin/env node
// Run and check the acceptance-scenario record (assets/acceptance-scenarios.json format).
//   node scenarios.mjs run   [record]   run every scenario check and the existing tests, write
//                                       each result into the record, exit 0 when all pass
//   node scenarios.mjs check [record]   exit 0 when the record is complete and every result
//                                       passed; otherwise print what to fix
// Without a record argument, every acceptance-scenarios*.json under the current directory
// (outside node_modules) is used. Results come only from `run`, never from hand edits.
import { execSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SCENARIO_RECORD, findFiles } from "./records.mjs";

const placeholder = (value) => typeof value !== "string" || !value.trim() || /<[^>]+>/.test(value);

const findRecords = (dir = ".") => findFiles(SCENARIO_RECORD, dir).map((path) => relative(".", path));

// Commands run through the default shell with only the PATH directories this process can reach:
// in a sandbox that denies one PATH directory, every lookup behind it fails (EPERM), even for a
// program such as node or npm that lives in a later directory.
function runCommand(command) {
	const { NODE_TEST_CONTEXT: _, ...env } = process.env;
	const reachable = (dir) => { try { accessSync(dir, constants.X_OK); return true; } catch { return false; } };
	env.PATH = (env.PATH ?? "").split(delimiter).filter((dir) => dir && reachable(dir)).join(delimiter);
	try {
		const output = execSync(command, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
		return { status: "pass", output };
	} catch (error) {
		return { status: "fail", output: `${error.stdout ?? ""}${error.stderr ?? ""}` || String(error.message) };
	}
}

// A record must run in anyone's checkout: a command may not name a home path or an existing
// file outside the project (system directories such as /usr are fine).
const SYSTEM = /^\/(usr|bin|sbin|opt|etc|dev|System|Library)\//;
export function outsideProject(command, root = process.cwd()) {
	const base = resolve(root);
	return [...String(command).matchAll(/(?:^|[\s"'=(])((?:~\/|\/)[^\s"';)]+)/g)]
		.map((m) => m[1])
		.filter((path) => path.startsWith("~/") || (isAbsolute(path) && !path.startsWith(`${base}/`) && !SYSTEM.test(path) && existsSync(path)));
}

export function checkRecord(record) {
	const problems = [];
	if (!Array.isArray(record.scenarios) || !record.scenarios.length) problems.push("Add at least one scenario.");
	for (const s of record.scenarios ?? []) {
		for (const field of ["id", "given", "when", "then", "check"]) {
			if (placeholder(s[field])) problems.push(`Scenario ${s.id ?? "?"}: fill "${field}" (no <placeholders>).`);
		}
		if (s.status !== "pass") problems.push(`Scenario ${s.id ?? "?"}: status is "${s.status}"; fix the code or the check, then run "scenarios.mjs run".`);
		for (const path of outsideProject(s.check ?? "")) problems.push(`Scenario ${s.id ?? "?"}: the check names ${path}, outside the project; use a path inside it so the record runs anywhere.`);
	}
	for (const d of record.decisions ?? []) {
		for (const field of ["question", "decision", "reason", "revert"]) {
			if (placeholder(d[field])) problems.push(`Decision ${d.id ?? "?"}: fill "${field}" (say how to change it later in "revert").`);
		}
	}
	const v = record.verification ?? {};
	if (placeholder(v.existing_tests)) problems.push('Set "verification.existing_tests" to the command for the existing suites around the change.');
	else {
		for (const path of outsideProject(v.existing_tests)) problems.push(`Existing tests: the command names ${path}, outside the project; use a path inside it.`);
		if (v.existing_tests_status !== "pass") problems.push(`Existing tests status is "${v.existing_tests_status}"; run "scenarios.mjs run" after fixing them.`);
	}
	return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [mode, file] = process.argv.slice(2);
	const records = file ? [file] : findRecords();
	if (!["run", "check"].includes(mode)) { console.error("Usage: scenarios.mjs <run|check> [record]"); process.exit(2); }
	if (!records.length) { console.error("No acceptance-scenarios*.json found; copy the template from assets/ and fill it."); process.exit(1); }
	let ok = true;
	for (const path of records) {
		const record = JSON.parse(readFileSync(path, "utf8"));
		if (mode === "run") {
			for (const s of record.scenarios ?? []) {
				const result = runCommand(s.check);
				s.status = result.status;
				if (result.status !== "pass") { ok = false; console.error(`${path} ${s.id}: fail\n${result.output.slice(-2000)}`); }
			}
			const v = (record.verification ??= {});
			if (!placeholder(v.existing_tests)) {
				const result = runCommand(v.existing_tests);
				v.existing_tests_status = result.status;
				if (result.status !== "pass") { ok = false; console.error(`${path} existing tests: fail\n${result.output.slice(-2000)}`); }
			}
			writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
		}
		const problems = checkRecord(record);
		for (const p of problems) console.error(`${path}: ${p}`);
		if (problems.length) ok = false;
	}
	console.log(ok ? `${records.join(", ")}: every scenario and the existing tests pass.` : "Not complete.");
	process.exit(ok ? 0 : 1);
}
