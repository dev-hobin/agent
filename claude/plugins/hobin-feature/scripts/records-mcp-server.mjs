#!/usr/bin/env node
// The hobin-feature records server, the same script on Claude Code and Codex: a stdio MCP server
// (newline-delimited JSON-RPC 2.0) exposing the record tools init, register, check and decline
// from skills/developing-features/scripts/record-tools.mjs. The plugin's hook observes these
// calls (PostToolUse with the tool's structured input) and keeps the session's ledger; this
// server keeps no session state and runs no project command.
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scripts = join(dirname(fileURLToPath(import.meta.url)), "../skills/developing-features/scripts");
const { TOOLS, callTool } = await import(pathToFileURL(join(scripts, "record-tools.mjs")).href);

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const error = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

function handle(message) {
	const { id, method, params } = message ?? {};
	const notification = id === undefined || id === null;
	if (typeof method !== "string") { if (!notification) error(id, -32600, "invalid request"); return; }
	if (notification) return; // notifications/initialized, notifications/cancelled, ...
	if (method === "initialize") {
		const requested = params?.protocolVersion;
		reply(id, {
			protocolVersion: SUPPORTED.includes(requested) ? requested : SUPPORTED[0],
			capabilities: { tools: { listChanged: false } },
			serverInfo: { name: "hobin-feature-records", version: "0.6.0" },
			instructions: "Record operations for developing-features. Pass absolute paths. Running a record's checks stays in the shell: scenarios.mjs run <record>.",
		});
	} else if (method === "ping") reply(id, {});
	else if (method === "tools/list") reply(id, { tools: TOOLS });
	else if (method === "tools/call") {
		const { isError, text } = callTool(params?.name, params?.arguments);
		reply(id, { content: [{ type: "text", text }], isError });
	} else error(id, -32601, `method not found: ${method}`);
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
	if (!line.trim()) continue;
	let message;
	try { message = JSON.parse(line); } catch { error(null, -32700, "parse error"); continue; }
	for (const item of Array.isArray(message) ? message : [message]) handle(item);
}
