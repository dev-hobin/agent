#!/usr/bin/env node
// The hobin-feature hook, the same script on Claude Code and Codex (hooks.json names the host as the
// first argument). The model may finish only when every record in this session's registry passes
// `scenarios.mjs check` / `compile-control-model.mjs --gate` (G6, G7), and, once this session
// started developing-features, only when the registry lists a record (a declined record counts).
//
// The session registry is <start dir>/.hobin-feature/sessions/<session_id>.jsonl. Its lifecycle (the
// start directory, edit-tool paths, SessionStart/UserPromptSubmit/SessionEnd, pruning, the state in
// the plugin data directory) is session-registry.mjs's hookSession, shared with the result hooks.
// - scenarios.mjs init, register, run and decline append the records they make or run; they stop
//   when a session has no registry, so a session whose hooks do not run is told so at once.
// - PostToolUse appends a record file the session wrote with an edit tool, when the file exists
//   after the edit.
// - Stop gates exactly the records the registry lists; a listed record that no longer exists is
//   reported. Nothing searches directories, and nothing is inferred from shell text, command output
//   or transcripts.
// - Obligation (the session started the skill): Claude's Skill tool with skill `developing-features`
//   (optionally `<plugin>:`), a prompt that starts with `/developing-features` or
//   `/hobin-feature:developing-features`, a Codex prompt that mentions `$developing-features`, or a
//   Codex shell command that reads this plugin's skills/developing-features/SKILL.md.
// - SessionEnd deletes the session's registry and its plugin data state (the obligation included)
//   and prunes week-old state. Stop prunes week-old state and registries.
//
// Stop: while a registered record fails, exit 2 sends the problems back. With an obligation and an
// empty registry, exit 2 names the exact commands that make one. After three blocks in a row the
// model may stop, so a check that cannot pass never traps the session (G5: the report must then say
// so). A checker that throws is the hook's own failure: exit 1, shown to the user, never sent to the
// model. Any other unexpected error exits 0: the hook never fails the user's work because of itself.
import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RECORD, SCENARIO_RECORD, gitRoot } from "../skills/developing-features/scripts/records.mjs";
import { hookSession } from "../skills/developing-features/scripts/session-registry.mjs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(pluginRoot, "skills/developing-features/scripts");
const SKILL = join(pluginRoot, "skills/developing-features/SKILL.md");
const SCENARIOS = `node "${join(scripts, "scenarios.mjs")}"`;
const GATE = `node "${join(scripts, "compile-control-model.mjs")}" --gate`;
const MAX_BLOCKS = 3;
const host = process.argv[2] === "codex" ? "codex" : "claude";

const real = (path) => { try { return realpathSync(path); } catch { return path; } };
const isFile = (path) => { try { return statSync(path).isFile(); } catch { return false; } };

// The text of a Codex tool's tool_input.command (apply_patch carries the patch there).
function commandText(input) {
	const command = input?.tool_input?.command;
	return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
}
const isPatch = (input, text) => input?.tool_name === "apply_patch" || text.trimStart().startsWith("*** Begin Patch");

// The obligation (developing-features started), kept in the session's state.
const readObligation = (session) => { try { return JSON.parse(readFileSync(session.statePath("obligation"), "utf8")); } catch { return null; } };
const startObligation = (session, source) =>
	writeFileSync(session.statePath("obligation"), JSON.stringify({ source, at: new Date().toISOString() }));

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

async function stop(input, session) {
	session.prune();
	const start = session.start();
	const records = session.registered();
	const obligation = readObligation(session);
	if (!records.length && !obligation) return 0;

	const { problems, errors, running, declined } = await checkRecords(records);
	if (!records.length) problems.push(noRecord(obligation, start));
	// Claude Code lists the session's background tasks in the Stop input.
	if (running && Array.isArray(input.background_tasks) && input.background_tasks.length) {
		problems.push(`background tasks are still running in this session (${input.background_tasks.length}); if one of them is the scenarios.mjs run, wait for it.`);
	}
	if (!problems.length) {
		session.unblock();
		for (const line of declined) console.error(`hobin-feature: this session declined an acceptance-scenario record (${line})`);
		if (!errors.length) return 0;
		console.error(`hobin-feature Stop hook internal error (not a problem in the record; the model was not sent back):\n${errors.join("\n")}`);
		return 1;
	}
	if (session.blocks() >= MAX_BLOCKS) { session.unblock(); return 0; }
	session.block();
	const internal = errors.length ? `\nThe hook could not check these (its own error, not yours):\n${errors.join("\n")}` : "";
	const fix = records.length
		? `\nFix the code or the record, run ${SCENARIOS} run <record> from ${start}, and finish only when ${SCENARIOS} check <record> and, for a control decision record, ${GATE} <record> pass. If a check cannot pass, say so in the report.`
		: "";
	console.error(`hobin-feature: a record of this session is not complete, or none is registered yet:\n${problems.join("\n")}${internal}${fix}`);
	return 2;
}

function event(input, session) {
	if (input.hook_event_name === "SessionEnd") {
		session.end("obligation");
		session.pruneState();
		return 0;
	}
	if (input.hook_event_name === "SessionStart") {
		session.begin();
		return 0;
	}
	session.start();
	if (input.hook_event_name === "UserPromptSubmit") session.ensure();
	const source = obligationSource(input);
	if (source && !readObligation(session)) startObligation(session, source);
	if (input.hook_event_name !== "PostToolUse") return 0;
	session.registerFiles(session.editedFiles().filter((path) => RECORD.test(basename(path)) && isFile(path)));
	return 0;
}

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const session = hookSession(input, { name: ".hobin-feature", host });
	if (!session.id) process.exitCode = 0;
	else process.exitCode = input.hook_event_name === "Stop" ? await stop(input, session) : event(input, session);
} catch {
	process.exitCode = 0;
}
