#!/usr/bin/env node
// The hobin-feature hook, the same script on Claude Code and Codex. When this session started
// developing-features or registered a record, the model may finish only when every registered
// record passes `scenarios.mjs check` / `compile-control-model.mjs --gate` (G6, G7), and only once
// a record exists or the session declined writing one with a reason.
//
// Nothing here infers from shell text or the file tree. What counts comes from fixed identifiers
// and from the record tools themselves:
// - Obligation (the session started the skill): Claude's Skill tool with skill `developing-features`
//   (optionally `<plugin>:`), a prompt that starts with `/developing-features` or
//   `/hobin-feature:developing-features`, a Codex prompt that mentions `$developing-features`, or a
//   Codex shell command that reads this plugin's skills/developing-features/SKILL.md.
// - Registration: `scenarios.mjs init|run|check <record>` and `compile-control-model.mjs
//   --baseline|--changes|--gate <record>` print `hobin-feature-record: <absolute path>`. After any
//   tool call this hook reads every string in the tool's response (and a failure's error text),
//   and registers each marked path that is absolute, exists and names a record file, in its own
//   ledger. Nothing is shared with the scripts: no session id, no common temp directory. A
//   background run's output never reaches the hook, so the Stop message asks for a foreground
//   `check`. Edit tools (Write, Edit, MultiEdit; apply_patch Add/Update/Move to) register the
//   record path they wrote.
// - Release: `scenarios.mjs decline --reason "..."` prints `hobin-feature-decline: <reason>`. It
//   lifts only the "no record yet" obligation; records already registered must still pass.
//
// Stop: registered records are checked; while one fails exit 2 sends the problems back. With an
// obligation, no registered record and no decline, exit 2 asks for one. After three blocks in a
// row the model may stop, so a check that cannot pass never traps the session (G5: the report must
// then say so). A checker that throws is the hook's own failure: exit 1, shown to the user, never
// sent to the model. Any other unexpected error exits 0: the hook never fails the user's work
// because of itself.
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	RECORD, SCENARIO_RECORD, parseMarkers, readDecline, readLedger, readObligation, recordDecline,
	registerRecord, sessionStatePath, startObligation,
} from "../skills/developing-features/scripts/records.mjs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(pluginRoot, "skills/developing-features/scripts");
const SKILL = join(pluginRoot, "skills/developing-features/SKILL.md");
const MAX_BLOCKS = 3;

const isRecord = (path) => RECORD.test(basename(path));
const real = (path) => { try { return realpathSync(path); } catch { return path; } };

// Codex sends file edits as apply_patch text in tool_input.command; any other command is a shell
// command. Claude's edit tools carry tool_input.file_path.
function commandText(input) {
	const command = input?.tool_input?.command;
	return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
}
const isPatch = (input, text) => input?.tool_name === "apply_patch" || text.trimStart().startsWith("*** Begin Patch");

// The record paths an edit tool wrote, exactly as the tool reports them.
function editedRecords(input, root) {
	const direct = input?.tool_input?.file_path;
	if (typeof direct === "string") return isRecord(direct) ? [resolve(root, direct)] : [];
	const text = commandText(input);
	if (!isPatch(input, text)) return [];
	return [...text.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)]
		.map((m) => resolve(input?.cwd ?? root, m[1].trim()))
		.filter(isRecord);
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

// Every string inside a tool response, whatever its shape. A string that is itself JSON is walked
// too, so output serialized into one string still yields its lines.
function strings(value, out = [], depth = 0) {
	if (depth > 20) return out;
	if (typeof value === "string") {
		out.push(value);
		const t = value.trimStart();
		if (t.startsWith("{") || t.startsWith("[") || t.startsWith('"')) {
			try { strings(JSON.parse(value), out, depth + 1); } catch {}
		}
	} else if (Array.isArray(value)) for (const item of value) strings(item, out, depth + 1);
	else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, out, depth + 1);
	return out;
}

// The record paths and decline reasons the record tools printed in this tool call's output.
function printedMarkers(input) {
	const records = [];
	const declines = [];
	for (const text of strings([input?.tool_response, input?.error])) {
		const found = parseMarkers(text);
		records.push(...found.records);
		declines.push(...found.declines);
	}
	return { records: records.filter((path) => isAbsolute(path) && isRecord(path) && existsSync(path)), declines };
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
			const scenarioRecord = SCENARIO_RECORD.test(basename(path));
			const found = scenarioRecord
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
	const records = readLedger(session).filter((path) => existsSync(path));
	const obligation = readObligation(session);
	const decline = readDecline(session);
	if (!records.length && !obligation) return 0;

	const counter = sessionStatePath("stop", session);
	const { problems, errors } = records.length ? await checkRecords(records, root) : { problems: [], errors: [] };
	if (!records.length && !decline) {
		const init = join(scripts, "scenarios.mjs");
		problems.push(`developing-features started in this session (${obligation.source}) but no acceptance-scenario record is registered. For a new record run \`node "${init}" init <path>/acceptance-scenarios-<name>.json\`. For a record that already exists run \`node "${init}" check <path>\` in the foreground: this hook sees only the output of foreground commands, not of background runs. If this work needs no record, run \`node "${init}" decline --reason "<why>"\` and state the reason in the report.`);
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
	console.error(`A record this session registered is not complete, or none is registered yet (scenarios.mjs check, compile-control-model.mjs --gate):\n${problems.join("\n")}${internal}\nFix the code or the record, run "scenarios.mjs run <record>", and finish only when "scenarios.mjs check <record>" and "compile-control-model.mjs --gate <record>" pass. If a check cannot pass, say so in the report.`);
	return 2;
}

function event(input, root) {
	const session = input.session_id;
	if (!session) return 0;
	const source = obligationSource(input);
	if (source && !readObligation(session)) startObligation(session, source);
	if (input.hook_event_name === "UserPromptSubmit") return 0;
	const printed = printedMarkers(input);
	const known = new Set(readLedger(session));
	for (const path of new Set([...editedRecords(input, root), ...printed.records])) {
		if (existsSync(path) && !known.has(resolve(path))) registerRecord(path, session);
	}
	if (printed.declines.length) recordDecline(session, printed.declines.at(-1));
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
