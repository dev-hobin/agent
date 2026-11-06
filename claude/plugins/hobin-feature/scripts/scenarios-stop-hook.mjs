#!/usr/bin/env node
// The hobin-feature hook, the same script on Claude Code and Codex (hooks.json passes the host as
// the first argument). When this session started developing-features or registered a record, the
// model may finish only when every registered record passes `scenarios.mjs check` /
// `compile-control-model.mjs --gate` (G6, G7), and only once a record exists or the session
// declined writing one with a reason.
//
// Nothing here infers from shell text, command output or the file tree. What counts comes from
// structured tool calls:
// - Obligation (the session started the skill): Claude's Skill tool with skill `developing-features`
//   (optionally `<plugin>:`), a prompt that starts with `/developing-features` or
//   `/hobin-feature:developing-features`, a Codex prompt that mentions `$developing-features`, or a
//   Codex shell command that reads this plugin's skills/developing-features/SKILL.md.
// - Registration: a successful call of this plugin's record tools init, register or check (MCP;
//   tool names in TOOL_PREFIX), by tool_input.path; edit tools (Write, Edit, MultiEdit;
//   apply_patch Add/Update/Move to) by the record path they wrote. The path must name an existing
//   record file.
// - Release: a successful decline tool call with a non-empty tool_input.reason. It lifts only the
//   "no record yet" obligation; records already registered must still pass.
// - SessionEnd removes the session's state; state older than seven days is pruned on Stop and
//   SessionEnd.
//
// Stop: registered records are checked; while one fails exit 2 sends the problems back. With an
// obligation, no registered record and no decline, exit 2 asks for one. After three blocks in a
// row the model may stop, so a check that cannot pass never traps the session (G5: the report must
// then say so). A checker that throws is the hook's own failure: exit 1, shown to the user, never
// sent to the model. Any other unexpected error exits 0: the hook never fails the user's work
// because of itself.
import { existsSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	RECORD, SCENARIO_RECORD, clearSession, gitRoot, pruneSessions, readDecline, readLedger, readObligation,
	recordDecline, registerRecord, sessionStatePath, startObligation,
} from "../skills/developing-features/scripts/records.mjs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(pluginRoot, "skills/developing-features/scripts");
const SKILL = join(pluginRoot, "skills/developing-features/SKILL.md");
const MAX_BLOCKS = 3;

// This plugin's records server (`hobin_feature` in .mcp.json) as each host names its tools:
// Claude Code mcp__plugin_<plugin>_<server>__<tool>, Codex mcp__<server>__<tool>.
const TOOL_PREFIX = { claude: "mcp__plugin_hobin-feature_hobin_feature__", codex: "mcp__hobin_feature__" };
const host = process.argv[2] === "codex" ? "codex" : "claude";
const toolName = (tool) => `${TOOL_PREFIX[host]}${tool}`;

const isRecord = (path) => RECORD.test(basename(path));
const isRecordFile = (path) => { try { return isRecord(path) && statSync(path).isFile(); } catch { return false; } };
const real = (path) => { try { return realpathSync(path); } catch { return path; } };

// Codex sends file edits as apply_patch text in tool_input.command; any other command is a shell
// command. Claude's edit tools carry tool_input.file_path.
function commandText(input) {
	const command = input?.tool_input?.command;
	return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
}
const isPatch = (input, text) => input?.tool_name === "apply_patch" || text.trimStart().startsWith("*** Begin Patch");

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);

// The record paths an edit tool wrote, exactly as the tool reports them.
function editedRecords(input, root) {
	if (EDIT_TOOLS.has(input?.tool_name)) {
		const direct = input?.tool_input?.file_path;
		return typeof direct === "string" && isRecord(direct) ? [resolve(root, direct)] : [];
	}
	const text = commandText(input);
	if (!isPatch(input, text)) return [];
	return [...text.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)]
		.map((m) => resolve(input?.cwd ?? root, m[1].trim()))
		.filter(isRecord);
}

// A tool result the host marks as failed. Claude sends failures to PostToolUseFailure, which this
// hook does not receive; Codex hands the MCP result, possibly as a JSON string.
function failed(response) {
	let value = response;
	if (typeof value === "string") { try { value = JSON.parse(value); } catch { return false; } }
	return value?.isError === true || value?.is_error === true || value?.result?.isError === true;
}

// What a call of this plugin's record tools does for the session, or undefined.
function recordToolCall(input, root) {
	const name = input?.tool_name;
	if (typeof name !== "string" || !name.startsWith(TOOL_PREFIX[host])) return undefined;
	const tool = name.slice(TOOL_PREFIX[host].length);
	if (failed(input.tool_response)) return undefined;
	const args = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
	if (tool === "decline") {
		const reason = typeof args.reason === "string" ? args.reason.trim() : "";
		return reason ? { decline: reason } : undefined;
	}
	if (!["init", "register", "check"].includes(tool) || typeof args.path !== "string") return undefined;
	const path = resolve(input.cwd ?? root, args.path);
	return isRecordFile(path) ? { record: path } : undefined;
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

// The root a record is checked against: the hook root when it is inside a git work tree and holds
// the record, otherwise the record's nearest ancestor holding .git, otherwise the hook root.
function projectRoot(record, root) {
	const offset = relative(root, record);
	if (!offset.startsWith("..") && !isAbsolute(offset) && gitRoot(root)) return root;
	return gitRoot(dirname(record)) ?? root;
}

async function checkRecords(records, root) {
	const { checkRecord } = await import(pathToFileURL(join(scripts, "scenarios.mjs")).href);
	const { gateRecord } = await import(pathToFileURL(join(scripts, "compile-control-model.mjs")).href);
	const problems = [];
	const errors = [];
	let running = false;
	for (const path of records) {
		let record;
		try { record = JSON.parse(readFileSync(path, "utf8")); } catch (error) {
			if (existsSync(path)) problems.push(`${path}: not valid JSON (${error.message})`);
			continue;
		}
		const base = projectRoot(path, root);
		try {
			process.chdir(base);
			const scenarioRecord = SCENARIO_RECORD.test(basename(path));
			if (scenarioRecord && record?.verification?.run) running = true;
			const found = scenarioRecord
				? checkRecord(record)
				: gateRecord(record, { recordDir: dirname(path), root: base, recordPath: path });
			problems.push(...found.map((p) => `${path}: ${p}`));
		} catch (error) {
			errors.push(`${path}: ${error?.stack ?? error}`);
		}
	}
	return { problems, errors, running };
}

async function stop(input, root) {
	const session = input.session_id;
	if (!session) return 0;
	pruneSessions();
	const records = readLedger(session).filter((path) => existsSync(path));
	const obligation = readObligation(session);
	const decline = readDecline(session);
	if (!records.length && !obligation) return 0;

	const counter = sessionStatePath("stop", session);
	const { problems, errors, running } = records.length ? await checkRecords(records, root) : { problems: [], errors: [], running: false };
	if (!records.length && !decline) {
		problems.push(`developing-features started in this session (${obligation.source}) but no acceptance-scenario record is registered. For a new record call the ${toolName("init")} tool with its absolute path (acceptance-scenarios-<name>.json). For a record that already exists call ${toolName("register")} with its absolute path. If this work needs no record, call ${toolName("decline")} with the reason and state it in the report. Running scenarios.mjs in the shell does not register a record.`);
	}
	// Claude Code lists the session's background tasks in the Stop input.
	if (running && Array.isArray(input.background_tasks) && input.background_tasks.length) {
		problems.push(`background tasks are still running in this session (${input.background_tasks.length}); if one of them is the scenarios.mjs run, wait for it.`);
	}
	if (!problems.length) {
		rmSync(counter, { force: true });
		if (decline) console.error(`hobin-feature: this session declined an acceptance-scenario record: ${decline.reason}`);
		if (!errors.length) return 0;
		console.error(`hobin-feature Stop hook internal error (not a problem in the record; the model was not sent back):\n${errors.join("\n")}`);
		return 1;
	}
	let blocks = 0;
	try { blocks = Number(readFileSync(counter, "utf8")) || 0; } catch {}
	if (blocks >= MAX_BLOCKS) { rmSync(counter, { force: true }); return 0; }
	writeFileSync(counter, String(blocks + 1));
	const internal = errors.length ? `\nThe hook could not check these (its own error, not yours):\n${errors.join("\n")}` : "";
	console.error(`A record this session registered is not complete, or none is registered yet (${toolName("check")}, scenarios.mjs check, compile-control-model.mjs --gate):\n${problems.join("\n")}${internal}\nFix the code or the record, run "scenarios.mjs run <record>" in the shell, and finish only when "scenarios.mjs check <record>" and "compile-control-model.mjs --gate <record>" pass. If a check cannot pass, say so in the report.`);
	return 2;
}

function event(input, root) {
	const session = input.session_id;
	if (!session) return 0;
	if (input.hook_event_name === "SessionEnd") { clearSession(session); pruneSessions(); return 0; }
	const source = obligationSource(input);
	if (source && !readObligation(session)) startObligation(session, source);
	if (input.hook_event_name !== "PostToolUse") return 0;
	const call = recordToolCall(input, root);
	if (call?.decline) recordDecline(session, call.decline);
	const known = new Set(readLedger(session));
	const paths = [...editedRecords(input, root), ...(call?.record ? [call.record] : [])];
	for (const path of new Set(paths)) if (existsSync(path) && !known.has(path)) registerRecord(path, session);
	return 0;
}

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	// The project root: on Claude Code, input.cwd follows the model's `cd` in Bash.
	const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd());
	process.exitCode = input.hook_event_name === "Stop" ? await stop(input, root) : event(input, root);
} catch {
	process.exitCode = 0;
}
