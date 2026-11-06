// The record tools: the operations on acceptance-scenario and control decision records that a
// host session performs through the plugin (served over MCP by the plugin's records server), so
// that the plugin's hooks see each one as a structured tool call with its arguments.
//   init     { path }    create an acceptance-scenarios*.json from the template; never overwrites
//   register { path }    confirm an existing record file (name, regular file, JSON)
//   check    { path }    report what the record still needs (scenarios.mjs check, or the control
//                        model gate for control-decisions*.json); changes nothing
//   decline  { reason }  confirm a non-empty reason for writing no record
// Paths must be absolute: the server's working directory is not the project's.
//
// These tools neither track sessions nor execute project commands: they run outside the host's
// sandbox, so running a record's checks stays with `scenarios.mjs run` in the host's shell.
// A check that finds problems is still a successful call (isError false): the record is the
// session's, and the hook gates it. isError marks only a call whose arguments are unusable.
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute } from "node:path";

import { gateRecord } from "./compile-control-model.mjs";
import { CONTROL_RECORD, RECORD, SCENARIO_RECORD, gitRoot } from "./records.mjs";
import { checkRecord, createRecord } from "./scenarios.mjs";

const pathInput = (description) => ({
	type: "object",
	properties: { path: { type: "string", description } },
	required: ["path"],
	additionalProperties: false,
});

// Annotations let hosts run these without asking each time: Codex approves a tool marked read-only,
// or neither destructive nor open-world, under its default `auto` MCP approval.
const WRITES_LOCAL = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
export const TOOLS = [
	{
		name: "init",
		title: "Create an acceptance-scenario record",
		description: "Create an acceptance-scenarios*.json record from the template at an absolute path (never overwrites) and make it this session's record, which the Stop hook then gates.",
		inputSchema: pathInput("Absolute path of the new record; the file name must match acceptance-scenarios*.json"),
		annotations: WRITES_LOCAL,
	},
	{
		name: "register",
		title: "Register an existing record",
		description: "Make an existing acceptance-scenarios*.json or control-decisions*.json (absolute path) this session's record, which the Stop hook then gates.",
		inputSchema: pathInput("Absolute path of an existing record"),
		annotations: { ...WRITES_LOCAL, idempotentHint: true },
	},
	{
		name: "check",
		title: "Check a record",
		description: "Report what an acceptance-scenarios*.json or control-decisions*.json (absolute path) still needs, without running its commands, and make it this session's record. Run its checks with `scenarios.mjs run <record>` in the shell.",
		inputSchema: pathInput("Absolute path of an existing record"),
		annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
	},
	{
		name: "decline",
		title: "Decline writing a record",
		description: "State why this work needs no acceptance-scenario record. It lifts only the 'no record yet' obligation; records already registered must still pass. Give the reason in the report.",
		inputSchema: {
			type: "object",
			properties: { reason: { type: "string", description: "Why this session writes no acceptance-scenario record" } },
			required: ["reason"],
			additionalProperties: false,
		},
		annotations: { ...WRITES_LOCAL, idempotentHint: true },
	},
];

const fail = (text) => ({ isError: true, text });

// The problem with `path` as an existing record, or undefined.
function recordProblem(path) {
	if (typeof path !== "string" || !isAbsolute(path)) return `path must be an absolute path to a record, got ${JSON.stringify(path)}`;
	if (!RECORD.test(basename(path))) return `${path}: a record's file name matches acceptance-scenarios*.json or control-decisions*.json`;
	if (!existsSync(path) || !statSync(path).isFile()) return `${path}: no such record file; create one with the init tool`;
	try { JSON.parse(readFileSync(path, "utf8")); } catch (error) { return `${path}: not valid JSON (${error.message})`; }
	return undefined;
}

// The record's problems, checked from its repository (the nearest folder holding .git, otherwise
// the record's folder), as the Stop hook checks it.
export function recordProblems(path) {
	const record = JSON.parse(readFileSync(path, "utf8"));
	const root = gitRoot(dirname(path)) ?? dirname(path);
	const before = process.cwd();
	try {
		process.chdir(root);
		return SCENARIO_RECORD.test(basename(path))
			? checkRecord(record)
			: gateRecord(record, { recordDir: dirname(path), root, recordPath: path });
	} finally {
		process.chdir(before);
	}
}

const handlers = {
	init({ path }) {
		if (typeof path !== "string" || !isAbsolute(path)) return fail(`path must be an absolute path, got ${JSON.stringify(path)}`);
		const { status, message } = createRecord(path);
		return status ? fail(message) : { isError: false, text: `${message} It is this session's record now.` };
	},
	register({ path }) {
		const problem = recordProblem(path);
		return problem ? fail(problem) : { isError: false, text: `${path} is this session's record now; the Stop hook gates it.` };
	},
	check({ path }) {
		const problem = recordProblem(path);
		if (problem) return fail(problem);
		const problems = recordProblems(path);
		const kind = CONTROL_RECORD.test(basename(path)) ? "the control model gate passes" : "every scenario and the existing tests pass";
		return { isError: false, text: problems.length ? `${path} is not complete:\n${problems.map((p) => `- ${p}`).join("\n")}` : `${path}: ${kind}.` };
	},
	decline({ reason }) {
		if (typeof reason !== "string" || !reason.trim()) return fail("reason must be a non-empty explanation of why this work needs no record");
		return { isError: false, text: `Declined for this session: ${reason.trim()}. Records already registered must still pass; give the reason in the report.` };
	},
};

// { isError, text } for a call of tool `name` with `args`.
export function callTool(name, args) {
	const handler = Object.hasOwn(handlers, name) ? handlers[name] : undefined;
	if (!handler) return fail(`unknown tool ${JSON.stringify(name)}`);
	try { return handler(args && typeof args === "object" ? args : {}); } catch (error) { return fail(String(error?.message ?? error)); }
}
