#!/usr/bin/env node
// The hobin-feature hook, the same script on Claude Code and Codex (hooks.json names the host as the
// first argument). The model may finish only when every record in this session's registry passes
// `scenarios.mjs check` / `compile-control-model.mjs --gate` (G6, G7), and, once this session
// started developing-features, only when the registry lists a record (a declined record counts).
//
// The session registry (session-registry.mjs) is <start dir>/.hobin-feature/sessions/<session_id>.jsonl.
// - SessionStart creates it in the event's cwd and remembers that start directory in the plugin
//   data directory. If SessionStart was missed (the plugin enabled mid-session), UserPromptSubmit
//   creates it the same way in the project directory (Claude: CLAUDE_PROJECT_DIR; Codex: the event
//   cwd). Later events never locate it from their own cwd: on Claude Code the hook cwd follows the
//   model's `cd`.
// - scenarios.mjs init, register, run and decline append the records they make or run; they stop
//   when a session has no registry, so a session whose hooks do not run is told so at once.
// - PostToolUse appends a record file the session wrote with an edit tool: Claude Write, Edit and
//   MultiEdit (tool_input.file_path); Codex apply_patch (`*** Add File:`, `*** Update File:`,
//   `*** Move to:`), when the file exists after the edit.
// - Stop gates exactly the records the registry lists; a listed record that no longer exists is
//   reported. Nothing searches directories, and nothing is inferred from shell text, command output
//   or transcripts.
// - Obligation (the session started the skill): Claude's Skill tool with skill `developing-features`
//   (optionally `<plugin>:`), a prompt that starts with `/developing-features` or
//   `/hobin-feature:developing-features`, a Codex prompt that mentions `$developing-features`, or a
//   Codex shell command that reads this plugin's skills/developing-features/SKILL.md.
// - SessionEnd deletes the session's registry and its plugin data state. Stop prunes files older
//   than seven days in the plugin data directory and in the start directory's registry folder.
//
// Stop: while a registered record fails, exit 2 sends the problems back. With an obligation and an
// empty registry, exit 2 names the exact commands that make one. After three blocks in a row the
// model may stop, so a check that cannot pass never traps the session (G5: the report must then say
// so). A checker that throws is the hook's own failure: exit 1, shown to the user, never sent to the
// model. Any other unexpected error exits 0: the hook never fails the user's work because of itself.
import { readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	RECORD, SCENARIO_RECORD, clearSession, gitRoot, pruneSessions, readObligation, readStart, rememberStart,
	sessionStatePath, startObligation,
} from "../skills/developing-features/scripts/records.mjs";
import {
	ensureRegistry, pruneRegistries, register, registered, registryPath, removeRegistry,
} from "../skills/developing-features/scripts/session-registry.mjs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(pluginRoot, "skills/developing-features/scripts");
const SKILL = join(pluginRoot, "skills/developing-features/SKILL.md");
const SCENARIOS = `node "${join(scripts, "scenarios.mjs")}"`;
const GATE = `node "${join(scripts, "compile-control-model.mjs")}" --gate`;
const MAX_BLOCKS = 3;
const REGISTRY = ".hobin-feature";
const registry = (sessionId, startDir) => ({ name: REGISTRY, sessionId, startDir });
const host = process.argv[2] === "codex" ? "codex" : "claude";

const real = (path) => { try { return realpathSync(path); } catch { return path; } };
const isFile = (path) => { try { return statSync(path).isFile(); } catch { return false; } };
const eventCwd = (input) => resolve(typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd());

// The text of a Codex tool's tool_input.command (apply_patch carries the patch there).
function commandText(input) {
	const command = input?.tool_input?.command;
	return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
}
const isPatch = (input, text) => input?.tool_name === "apply_patch" || text.trimStart().startsWith("*** Begin Patch");

// The record files an edit tool wrote, from its structured input only.
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
function editedRecords(input) {
	const cwd = eventCwd(input);
	let paths = [];
	if (EDIT_TOOLS.has(input?.tool_name)) {
		const path = input?.tool_input?.file_path;
		paths = typeof path === "string" && path ? [resolve(cwd, path)] : [];
	} else if (input?.tool_name === "apply_patch") {
		paths = [...commandText(input).matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)].map((m) => resolve(cwd, m[1].trim()));
	}
	return paths.filter((path) => RECORD.test(basename(path)) && isFile(path));
}

const SKILL_NAME = /(?:^|:)developing-features$/;
const SLASH = /^\/(?:hobin-feature:)?developing-features(?:\s|$)/;
const MENTION = /\$developing-features(?![\w-])/;

// What started developing-features in this call, or undefined.
function obligationSource(input) {
	if (input.hook_event_name === "UserPromptSubmit") {
		const prompt = typeof input.prompt === "string" ? input.prompt : "";
		if (SLASH.test(prompt.trimStart())) return "slash command";
		if (MENTION.test(prompt)) return "$developing-features mention";
		return undefined;
	}
	if (input?.tool_name === "Skill" && SKILL_NAME.test(String(input?.tool_input?.skill ?? ""))) return "Skill tool";
	const text = commandText(input);
	if (text && !isPatch(input, text) && [SKILL, real(SKILL)].some((path) => text.includes(path))) return "SKILL.md read";
	return undefined;
}

// The session's start directory: remembered at SessionStart; otherwise the project directory
// (Claude: CLAUDE_PROJECT_DIR; Codex: the event cwd), remembered from then on.
function startDir(session, input) {
	const known = readStart(session);
	if (known) return known;
	const dir = host === "claude" && process.env.CLAUDE_PROJECT_DIR ? resolve(process.env.CLAUDE_PROJECT_DIR) : eventCwd(input);
	rememberStart(session, dir);
	return dir;
}

async function checkRecords(paths) {
	const { checkRecord } = await import(pathToFileURL(join(scripts, "scenarios.mjs")).href);
	const { gateRecord } = await import(pathToFileURL(join(scripts, "compile-control-model.mjs")).href);
	const problems = [];
	const errors = [];
	const declined = [];
	let running = false;
	for (const path of paths) {
		if (!isFile(path)) { problems.push(`${path}: this session registered the record, but it no longer exists. Restore it, or register the record that replaced it.`); continue; }
		let record;
		try { record = JSON.parse(readFileSync(path, "utf8")); } catch (error) { problems.push(`${path}: not valid JSON (${error.message})`); continue; }
		// A record is checked from its repository: evidence such as src/lookup.js:10 resolves there.
		const base = gitRoot(dirname(path)) ?? dirname(path);
		try {
			process.chdir(base);
			const scenarioRecord = SCENARIO_RECORD.test(basename(path));
			if (scenarioRecord && record?.verification?.run) running = true;
			if (record?.declined) declined.push(`${path}: ${record.declined.reason}`);
			const found = scenarioRecord
				? checkRecord(record)
				: gateRecord(record, { recordDir: dirname(path), root: base, recordPath: path });
			problems.push(...found.map((p) => `${path}: ${p}`));
		} catch (error) {
			errors.push(`${path}: ${error?.stack ?? error}`);
		}
	}
	return { problems, errors, running, declined };
}

const noRecord = (obligation, start) =>
	`developing-features started in this session (${obligation.source}) but its registry lists no record. Run one of these from ${start}, the directory this session started in (pass absolute record paths; each registers the record for this session):\n`
	+ `- new record: ${SCENARIOS} init <absolute path>/acceptance-scenarios-<name>.json\n`
	+ `- a record that already exists: ${SCENARIOS} register <path>\n`
	+ `- this work needs no record: ${SCENARIOS} decline <absolute path>/acceptance-scenarios-<name>.json --reason "<why>" (and give the reason in the report)`;

async function stop(input) {
	const session = input.session_id;
	if (!session) return 0;
	pruneSessions();
	const start = startDir(session, input);
	pruneRegistries({ name: REGISTRY, startDir: start });
	const records = registered(registryPath(registry(session, start)));
	const obligation = readObligation(session);
	if (!records.length && !obligation) return 0;

	const counter = sessionStatePath("stop", session);
	const { problems, errors, running, declined } = await checkRecords(records);
	if (!records.length) problems.push(noRecord(obligation, start));
	// Claude Code lists the session's background tasks in the Stop input.
	if (running && Array.isArray(input.background_tasks) && input.background_tasks.length) {
		problems.push(`background tasks are still running in this session (${input.background_tasks.length}); if one of them is the scenarios.mjs run, wait for it.`);
	}
	if (!problems.length) {
		rmSync(counter, { force: true });
		for (const line of declined) console.error(`hobin-feature: this session declined an acceptance-scenario record (${line})`);
		if (!errors.length) return 0;
		console.error(`hobin-feature Stop hook internal error (not a problem in the record; the model was not sent back):\n${errors.join("\n")}`);
		return 1;
	}
	let blocks = 0;
	try { blocks = Number(readFileSync(counter, "utf8")) || 0; } catch {}
	if (blocks >= MAX_BLOCKS) { rmSync(counter, { force: true }); return 0; }
	writeFileSync(counter, String(blocks + 1));
	const internal = errors.length ? `\nThe hook could not check these (its own error, not yours):\n${errors.join("\n")}` : "";
	const fix = records.length
		? `\nFix the code or the record, run ${SCENARIOS} run <record> from ${start}, and finish only when ${SCENARIOS} check <record> and, for a control decision record, ${GATE} <record> pass. If a check cannot pass, say so in the report.`
		: "";
	console.error(`hobin-feature: a record of this session is not complete, or none is registered yet:\n${problems.join("\n")}${internal}${fix}`);
	return 2;
}

function event(input) {
	const session = input.session_id;
	if (!session) return 0;
	if (input.hook_event_name === "SessionEnd") {
		const start = readStart(session);
		if (start) removeRegistry(registry(session, start));
		clearSession(session);
		pruneSessions();
		return 0;
	}
	if (input.hook_event_name === "SessionStart") {
		rememberStart(session, eventCwd(input));
		ensureRegistry(registry(session, eventCwd(input)));
		return 0;
	}
	const start = startDir(session, input);
	if (input.hook_event_name === "UserPromptSubmit") ensureRegistry(registry(session, start));
	const source = obligationSource(input);
	if (source && !readObligation(session)) startObligation(session, source);
	if (input.hook_event_name !== "PostToolUse") return 0;
	const records = editedRecords(input);
	if (records.length) {
		const path = ensureRegistry(registry(session, start));
		for (const record of records) register(path, record);
	}
	return 0;
}

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	process.exitCode = input.hook_event_name === "Stop" ? await stop(input) : event(input);
} catch {
	process.exitCode = 0;
}
