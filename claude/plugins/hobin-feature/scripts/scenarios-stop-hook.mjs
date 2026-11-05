#!/usr/bin/env node
// The hobin-feature hook, the same script on Claude Code and Codex. When this session wrote an
// acceptance-scenario or control decision record, the model may finish only when that record
// passes `scenarios.mjs check` and `compile-control-model.mjs --gate` (G6, G7).
//
// Which records are this session's comes from a ledger the session's own tool calls fill, never
// from the file tree: another session writing records under the same folder must not block this
// one, and records this session never touched are not its to fix.
// - PostToolUse of an edit tool (Write/Edit/MultiEdit, a Codex apply_patch) adds the record it
//   wrote.
// - A shell command that names a record or a record script adds the records it changed: those it
//   names and those under its cwd changed since PreToolUse stamped the same call (by tool_use_id).
//   Without a usable stamp only the records it names count, and only if they changed after the
//   session started.
// - Stop checks only the ledger's records. While one fails, exit 2 sends the problems back; after
//   three blocks in a row the model may stop, so a check that cannot pass never traps the session
//   (G5: the report must then say so). A record that is not JSON is a record problem. A checker
//   that throws is the hook's own failure: exit 1, shown to the user, never sent to the model.
// Any other unexpected error exits 0: the hook never fails the user's work because of itself.
import { appendFileSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RECORD, SCENARIO_RECORD, findFiles } from "../skills/developing-features/scripts/records.mjs";

const scripts = join(dirname(fileURLToPath(import.meta.url)), "../skills/developing-features/scripts");
const MAX_BLOCKS = 3;
// File systems with one-second mtimes round a write in the stamp's second down below the stamp.
const SLACK_MS = 1000;
const MENTIONS = /acceptance-scenarios|control-decisions|scenarios\.mjs|compile-control-model\.mjs/;
const NAMED = /[^\s"'`;|&<>()=]*(?:acceptance-scenarios|control-decisions)[^\s"'`;|&<>()]*\.json/g;

const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
const temp = (kind, ...parts) => join(tmpdir(), `hobin-feature-${kind}-${parts.map(safe).join("-")}`);
const mtime = (path) => { try { return statSync(path).mtimeMs; } catch { return -Infinity; } };
const isRecord = (path) => RECORD.test(basename(path));

function sessionStart(input) {
	try { const t = statSync(input.transcript_path); return t.birthtimeMs || t.ctimeMs; } catch { return undefined; }
}

// Codex sends file edits as apply_patch text in tool_input.command; any other command is a shell
// command. Claude's edit tools carry tool_input.file_path.
function commandText(input) {
	const command = input?.tool_input?.command;
	return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
}
const isPatch = (input, text) => input?.tool_name === "apply_patch" || text.trimStart().startsWith("*** Begin Patch");

function editedRecords(input, root) {
	const direct = input?.tool_input?.file_path;
	if (typeof direct === "string") return isRecord(direct) ? [resolve(root, direct)] : [];
	const text = commandText(input);
	return [...text.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)]
		.map((m) => resolve(input?.cwd ?? root, m[1].trim()))
		.filter(isRecord);
}

function shellRecords(input, root, stamp) {
	const text = commandText(input);
	if (!MENTIONS.test(text)) return [];
	const cwd = input?.cwd ?? root;
	const named = [...text.matchAll(NAMED)].map((m) => resolve(cwd, m[0].replace(/^~(?=\/)/, process.env.HOME ?? "~")));
	if (stamp === undefined) {
		const start = sessionStart(input);
		return start === undefined ? [] : named.filter((path) => mtime(path) >= start - SLACK_MS);
	}
	const since = stamp - SLACK_MS;
	return [...named, ...findFiles(RECORD, cwd).map((path) => resolve(path))].filter((path) => mtime(path) >= since);
}

function ledger(session) {
	try {
		return [...new Set(readFileSync(temp("ledger", session), "utf8").split("\n").filter(Boolean))];
	} catch { return []; }
}

// The root a record is checked against: the hook root when it is inside a git work tree and holds
// the record (as before), otherwise the record's nearest ancestor holding .git, otherwise the
// hook root.
function insideGit(dir) {
	for (let d = resolve(dir); ; d = dirname(d)) {
		if (existsSync(join(d, ".git"))) return d;
		if (d === dirname(d)) return undefined;
	}
}
function projectRoot(record, root) {
	const within = !relative(root, record).startsWith("..") && !isAbsolute(relative(root, record));
	if (within && insideGit(root)) return root;
	return insideGit(dirname(record)) ?? root;
}

async function checkRecords(records, root) {
	const { checkRecord } = await import(pathToFileURL(join(scripts, "scenarios.mjs")).href);
	const { gateRecord } = await import(pathToFileURL(join(scripts, "compile-control-model.mjs")).href);
	const problems = [];
	const errors = [];
	for (const path of records) {
		let record;
		try { record = JSON.parse(readFileSync(path, "utf8")); } catch (error) {
			if (existsSync(path)) problems.push(`${path}: not valid JSON (${error.message})`);
			continue;
		}
		const base = projectRoot(path, root);
		try {
			process.chdir(base);
			const found = SCENARIO_RECORD.test(basename(path))
				? checkRecord(record)
				: gateRecord(record, { recordDir: dirname(path), root: base, recordPath: path });
			problems.push(...found.map((p) => `${path}: ${p}`));
		} catch (error) {
			errors.push(`${path}: ${error?.stack ?? error}`);
		}
	}
	return { problems, errors };
}

async function stop(input, root) {
	const session = input.session_id;
	if (!session) return 0;
	const records = ledger(session).filter((path) => existsSync(path));
	if (!records.length) return 0;
	const counter = temp("stop", session);
	const { problems, errors } = await checkRecords(records, root);
	if (!problems.length) {
		rmSync(counter, { force: true });
		if (!errors.length) return 0;
		console.error(`hobin-feature Stop hook internal error (not a problem in the record; the model was not sent back):\n${errors.join("\n")}`);
		return 1;
	}
	let blocks = 0;
	try { blocks = Number(readFileSync(counter, "utf8")) || 0; } catch {}
	if (blocks >= MAX_BLOCKS) { rmSync(counter, { force: true }); return 0; }
	writeFileSync(counter, String(blocks + 1));
	const internal = errors.length ? `\nThe hook could not check these (its own error, not yours):\n${errors.join("\n")}` : "";
	console.error(`A record this session wrote is not complete (scenarios.mjs check, compile-control-model.mjs --gate):\n${problems.join("\n")}${internal}\nFix the code or the record, run "scenarios.mjs run <record>", and finish only when "scenarios.mjs check <record>" and "compile-control-model.mjs --gate <record>" pass. If a check cannot pass, say so in the report.`);
	return 2;
}

// A stamp is the PreToolUse time of the same call, so it needs the call's id: without one, calls
// would share a stamp and a stale one (a call denied before PostToolUse) would date a later call.
// Anything but a positive time not in the future is no stamp at all (D6 fallback).
function readStamp(file) {
	let text;
	try { text = readFileSync(file, "utf8").trim(); } catch { return undefined; }
	const stamp = /^\d+$/.test(text) ? Number(text) : NaN;
	return stamp > 0 && stamp <= Date.now() ? stamp : undefined;
}

function toolUse(input, root) {
	const session = input.session_id;
	if (!session) return 0;
	const text = commandText(input);
	const shell = typeof input?.tool_input?.file_path !== "string" && text && !isPatch(input, text);
	const useId = typeof input.tool_use_id === "string" && input.tool_use_id ? input.tool_use_id : undefined;
	const stampFile = useId && temp("pre", session, useId);
	if (input.hook_event_name === "PreToolUse") {
		if (shell && stampFile && MENTIONS.test(text)) writeFileSync(stampFile, String(Date.now()));
		return 0;
	}
	let records;
	if (shell) {
		const stamp = stampFile ? readStamp(stampFile) : undefined;
		if (stampFile) rmSync(stampFile, { force: true });
		records = shellRecords(input, root, stamp);
	} else {
		records = editedRecords(input, root);
	}
	const fresh = [...new Set(records)].filter((path) => existsSync(path));
	if (fresh.length) appendFileSync(temp("ledger", session), fresh.map((path) => `${path}\n`).join(""));
	return 0;
}

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	// The project root: on Claude Code, input.cwd follows the model's `cd` in Bash.
	const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd());
	process.exitCode = input.hook_event_name === "Stop" ? await stop(input, root) : toolUse(input, root);
} catch {
	process.exitCode = 0;
}
