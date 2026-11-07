#!/usr/bin/env node
// Create, register, run, check and decline acceptance-scenario records (assets/acceptance-scenarios.json).
//   node scenarios.mjs init     <record> [--no-gate]   copy the template to <record>; refuses to
//                                                    overwrite
//   node scenarios.mjs register <record> [--no-gate]   register an existing acceptance-scenarios*.json
//                                                    or control-decisions*.json for this session
//   node scenarios.mjs run      [record] [--no-gate]   run every scenario check and the existing
//                                       tests, write each result into the record, exit 0 when all
//                                       pass. It first marks every result "running", records the run
//                                       in verification.run and saves after each result, so an
//                                       interrupted run leaves "running" and verification.run, never
//                                       the passes of an earlier run.
//   node scenarios.mjs check    [record]               read only: exit 0 when the record is
//                                       complete and every result passed; otherwise print what to fix
//   node scenarios.mjs decline  <record> --reason "<why>" [--no-gate]
//                                       write a declined record: this work needs no scenarios
// Without a record argument, every acceptance-scenarios*.json under the current directory
// (outside node_modules) is used. Results come only from `run`, never from hand edits.
//
// The session registry (session-registry.mjs). Run inside an agent session (CLAUDE_CODE_SESSION_ID or
// CODEX_SESSION_ID set), init, register, run and decline find the session's registry,
// .hobin-feature/sessions/<id>.jsonl, in the working directory or a parent, and append the record's
// absolute path; the plugin's Stop hook gates every record listed there. With a session id and no
// registry (or one that cannot be written) they stop with exit 2 before creating or running
// anything. Without a session id (a person at a terminal) they proceed and register nothing;
// --no-gate does the same inside a session and says no Stop gate covers the record. check registers
// nothing. The commands `run` executes get no session id: they are the project's commands, not the
// session's record operations.
import { execSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RECORD, SCENARIO_RECORD, findFiles } from "./records.mjs";

// The shared session registry (core/shared/scripts/session-registry.mjs): copied next to this
// script in a plugin, two folders up in this repository's core.
const here = dirname(fileURLToPath(import.meta.url));
const { SESSION_ENV, register: registerFile, registryFor, sessionIds } = await import(pathToFileURL(
	[join(here, "session-registry.mjs"), join(here, "../../shared/scripts/session-registry.mjs")].find(existsSync)).href);
const REGISTRY = ".hobin-feature";

const placeholder = (value) => typeof value !== "string" || !value.trim() || /<[^>]+>/.test(value);

const findRecords = (dir = ".") => findFiles(SCENARIO_RECORD, dir).map((path) => relative(".", path));

// Commands run through the default shell with only the PATH directories this process can reach:
// in a sandbox that denies one PATH directory, every lookup behind it fails (EPERM), even for a
// program such as node or npm that lives in a later directory.
function runCommand(command) {
	const { NODE_TEST_CONTEXT: _, ...env } = process.env;
	for (const name of SESSION_ENV) delete env[name];
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
	if (record?.declined !== undefined) return checkDeclined(record);
	const problems = [];
	if (!Array.isArray(record.scenarios) || !record.scenarios.length) problems.push("Add at least one scenario.");
	for (const s of record.scenarios ?? []) {
		for (const field of ["id", "given", "when", "then", "check"]) {
			if (placeholder(s[field])) problems.push(`Scenario ${s.id ?? "?"}: fill "${field}" (no <placeholders>).`);
		}
		if (s.status === "running") problems.push(`Scenario ${s.id ?? "?"}: status is "running"; the run that set it has not finished.`);
		else if (s.status !== "pass") problems.push(`Scenario ${s.id ?? "?"}: status is "${s.status}"; fix the code or the check, then run "scenarios.mjs run".`);
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
		if (v.existing_tests_status === "running") problems.push('Existing tests status is "running"; the run that set it has not finished.');
		else if (v.existing_tests_status !== "pass") problems.push(`Existing tests status is "${v.existing_tests_status}"; run "scenarios.mjs run" after fixing them.`);
	}
	if (v.run) problems.push(runNotFinished(v.run));
	return problems;
}

// A declined record passes with a non-empty reason, and holds no scenarios to hide.
function checkDeclined(record) {
	const problems = [];
	if (typeof record.declined?.reason !== "string" || !record.declined.reason.trim()) problems.push('Declined record: "declined.reason" must say why this work needs no scenarios.');
	if (Array.isArray(record.scenarios) && record.scenarios.length) problems.push('Declined record: it also holds scenarios; remove "declined" and complete them, or remove the scenarios.');
	return problems;
}

// A record still holding verification.run: a run is in progress, or one stopped without finishing.
// Only the record is known here, not whether that process still exists.
export const runNotFinished = (run) =>
	`a scenarios.mjs run started at ${run?.startedAt ?? "?"} (last progress ${run?.lastProgressAt ?? "?"}) has not finished; if it is still running wait for it, do not start another; if it stopped, run it again.`;

const TEMPLATE = join(here, "../assets/acceptance-scenarios.json");

const save = (path, record) => writeFileSync(path, JSON.stringify(record, null, 2) + "\n");

// Where this command registers its records: { registry } (a writable registry of this session),
// { none: why } (nothing to register, the command proceeds), or { status } (it must stop).
function registration(flags) {
	const sessions = sessionIds();
	const registry = sessions.map((session) => registryFor({ name: REGISTRY, sessionId: session })).find(Boolean);
	// --no-gate is for sessions whose hooks are not active. A registry of this session means they
	// are, so the flag cannot take a record out of the gate.
	if (flags.noGate && registry) {
		console.error("--no-gate refused: this session's hobin-feature hooks are active (its registry is here). Run the command without --no-gate; the record is registered for the Stop gate.");
		return { status: 2 };
	}
	if (flags.noGate) return { none: "--no-gate: no Stop gate covers this record." };
	if (!sessions.length) return { none: "" };
	if (registry) return { registry };
	console.error(`No hobin-feature registry for this agent session above ${process.cwd()}. Run scenarios.mjs from the directory the session started in and pass the record's absolute path. If the hobin-feature hooks are not active in this session (Codex: trust them in /hooks; evaluations that do not install the plugin), pass --no-gate: nothing will stop the session for this record.`);
	return { status: 2 };
}
function registerIn(where, paths) {
	if (where.registry) for (const path of paths) registerFile(where.registry, path);
	return where.registry ? " Registered for this session's Stop gate." : where.none ? ` ${where.none}` : "";
}

// The record at `path`, or a message saying why it cannot be read as one.
function readRecord(path, pattern = RECORD) {
	if (!pattern.test(basename(path))) return { problem: `${path}: the file name must match ${pattern === RECORD ? "acceptance-scenarios*.json or control-decisions*.json" : "acceptance-scenarios*.json"}.` };
	if (!existsSync(path) || !statSync(path).isFile()) return { problem: `${path}: no such record file.` };
	try {
		const record = JSON.parse(readFileSync(path, "utf8"));
		if (!record || typeof record !== "object" || Array.isArray(record)) return { problem: `${path}: a record is a JSON object.` };
		return { record };
	} catch (error) { return { problem: `${path}: not valid JSON (${error.message}).` }; }
}

function init(file, flags) {
	if (!file) { console.error("Usage: scenarios.mjs init <absolute path>/acceptance-scenarios<name>.json [--no-gate]"); return 2; }
	if (!SCENARIO_RECORD.test(basename(file))) { console.error(`${file}: the record's file name must match acceptance-scenarios*.json.`); return 2; }
	if (existsSync(file)) { console.error(`${file} already exists; init never overwrites a record. Edit it, or register it with "scenarios.mjs register ${file}".`); return 1; }
	const where = registration(flags);
	if (where.status) return where.status;
	mkdirSync(dirname(resolve(file)), { recursive: true });
	writeFileSync(file, readFileSync(TEMPLATE));
	console.log(`${file}: created from the template.${registerIn(where, [file])} Fill every scenario and decision, then run "scenarios.mjs run ${resolve(file)}".`);
	return 0;
}

function register(file, flags) {
	if (!file) { console.error("Usage: scenarios.mjs register <record> [--no-gate]"); return 2; }
	const { problem } = readRecord(file);
	if (problem) { console.error(problem); return 1; }
	const where = registration(flags);
	if (where.status) return where.status;
	console.log(`${file}: a valid record.${registerIn(where, [file])}`);
	return 0;
}

function decline(file, flags) {
	const reason = String(flags.reason ?? "").trim();
	if (!file || !reason) {
		console.error('Usage: scenarios.mjs decline <absolute path>/acceptance-scenarios<name>.json --reason "<why this work needs no acceptance scenarios>" [--no-gate]');
		return 2;
	}
	if (!SCENARIO_RECORD.test(basename(file))) { console.error(`${file}: the record's file name must match acceptance-scenarios*.json.`); return 2; }
	let record = {};
	if (existsSync(file)) {
		const read = readRecord(file, SCENARIO_RECORD);
		if (read.problem) { console.error(read.problem); return 1; }
		if (read.record.declined === undefined) { console.error(`${file} exists and is not a declined record; decline never overwrites one. Complete it, or decline at another path.`); return 1; }
		record = read.record;
	}
	const where = registration(flags);
	if (where.status) return where.status;
	record.declined = { reason, at: new Date().toISOString() };
	mkdirSync(dirname(resolve(file)), { recursive: true });
	save(file, record);
	console.log(`${file}: declined: ${reason}.${registerIn(where, [file])} Other records of this session must still pass; give the reason in the report.`);
	return 0;
}

// The arguments: positional words, --no-gate, and --reason <text> (a missing or flag-like value is
// no reason).
function parse(argv) {
	const words = [];
	const flags = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--no-gate") flags.noGate = true;
		else if (argv[i] === "--reason") { const value = argv[i + 1]; if (value !== undefined && !value.startsWith("--")) { flags.reason = value; i++; } }
		else words.push(argv[i]);
	}
	return { words, flags };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { words: [mode, file], flags } = parse(process.argv.slice(2));
	if (mode === "init") process.exit(init(file, flags));
	if (mode === "register") process.exit(register(file, flags));
	if (mode === "decline") process.exit(decline(file, flags));
	if (!["run", "check"].includes(mode)) { console.error('Usage: scenarios.mjs init|register <record> [--no-gate] | run [record] [--no-gate] | check [record] | decline <record> --reason "<why>" [--no-gate]'); process.exit(2); }
	const records = file ? [file] : findRecords();
	if (!records.length) { console.error('No acceptance-scenarios*.json found; create one with "scenarios.mjs init <path>".'); process.exit(1); }
	const where = mode === "run" ? registration(flags) : {};
	if (where.status) process.exit(where.status);
	if (mode === "run") { const note = registerIn(where, records); if (note) console.log(note.trim()); }
	let ok = true;
	for (const path of records) {
		const record = JSON.parse(readFileSync(path, "utf8"));
		if (mode === "run") {
			const save = () => writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
			const v = (record.verification ??= {});
			const now = () => new Date().toISOString();
			const progress = () => { v.run.lastProgressAt = now(); save(); };
			const testsDeclared = !placeholder(v.existing_tests);
			v.run = { startedAt: now(), lastProgressAt: now() };
			try {
				for (const s of record.scenarios ?? []) s.status = "running";
				if (testsDeclared) v.existing_tests_status = "running";
				save();
				for (const s of record.scenarios ?? []) {
					const result = runCommand(s.check);
					s.status = result.status;
					progress();
					if (result.status !== "pass") { ok = false; console.error(`${path} ${s.id}: fail\n${result.output.slice(-2000)}`); }
				}
				if (testsDeclared) {
					const result = runCommand(v.existing_tests);
					v.existing_tests_status = result.status;
					progress();
					if (result.status !== "pass") { ok = false; console.error(`${path} existing tests: fail\n${result.output.slice(-2000)}`); }
				}
			} finally {
				delete v.run;
				save();
			}
		}
		const problems = checkRecord(record);
		for (const p of problems) console.error(`${path}: ${p}`);
		if (problems.length) ok = false;
	}
	console.log(ok ? `${records.join(", ")}: every scenario and the existing tests pass.` : "Not complete.");
	process.exit(ok ? 0 : 1);
}
