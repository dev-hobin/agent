#!/usr/bin/env node
// Create or check a Markdown result against an output contract (assets/output-contract.json).
//   node output-contract.mjs new   <contract.json> <file> [--no-gate]   write the contract's skeleton
//   node output-contract.mjs check <contract.json> <file> [--no-gate]   exit 0 when the file meets
//                                                            the contract; otherwise print what to fix
// A required part is present when a heading or a bold field label (`**Label:**`) names it and
// it has content. The skeleton starts with a marker naming the contract so hosts can find results.
//
// The session registry (session-registry.mjs). The learning skills (the hobin-learning plugin) use
// this script. Run inside an agent session (CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID set), new
// and check find the session's registry, .hobin-learning/sessions/<id>.jsonl, in the working
// directory or a parent, and append the result's absolute path; the plugin's Stop hook checks
// every result listed there. With a session id and no registry (or one that cannot be written)
// they stop with exit 2 before writing or checking anything. Without a session id (a person at a
// terminal) they proceed and register nothing; --no-gate does the same inside a session whose
// registry is not found and says no Stop gate covers the result; it is refused (exit 2) when the
// registry is found, because the hooks are active.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The shared session registry (core/shared/scripts/session-registry.mjs), next to this script in
// core and in a plugin.
const here = dirname(fileURLToPath(import.meta.url));
const { register, registryFor, sessionIds } = await import(pathToFileURL(join(here, "session-registry.mjs")).href);
const REGISTRY = ".hobin-learning";

export const marker = (contract) => `<!-- output-contract: ${contract.id} -->`;
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternatives = (part) => [part.label, ...(part.aliases ?? [])].map(escape).join("|");

export function skeleton(contract) {
	return `${marker(contract)}\n\n${contract.skeleton.trim()}\n`;
}

// Content of a part: after its heading up to the next heading of the same or a higher level,
// or after its bold field label up to the next field label or heading.
function partBody(text, part) {
	const lines = text.split("\n");
	const words = new RegExp(`\\b(${alternatives(part)})\\b`, "i");
	for (let i = 0; i < lines.length; i++) {
		const heading = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
		if (heading && words.test(heading[2])) {
			const level = heading[1].length;
			const body = [];
			for (let j = i + 1; j < lines.length; j++) {
				const next = /^(#{1,6})\s/.exec(lines[j]);
				if (next && next[1].length <= level) break;
				body.push(lines[j]);
			}
			return body.join("\n").trim();
		}
		const field = /^\s*(?:[-*]\s+)?\*\*([^*\n]+?):?\*\*:?\s*(.*)$/.exec(lines[i]);
		if (field && words.test(field[1])) {
			const body = [field[2]];
			for (let j = i + 1; j < lines.length && !/^\s*(?:[-*]\s+)?\*\*[^*\n]+:?\*\*|^#{1,6}\s/.test(lines[j]); j++) body.push(lines[j]);
			return body.join("\n").trim();
		}
	}
	return null;
}

export function checkText(contract, text) {
	const problems = [];
	for (const part of contract.required) {
		const body = partBody(text, part);
		if (body === null) problems.push(`Add "${part.label}" as a heading or a **${part.label}:** field: ${part.hint}. If there is nothing to report, write "none" and why.`);
		else if (!body) problems.push(`"${part.label}" is empty: ${part.hint}.`);
	}
	if (/\bTODO:/.test(text)) problems.push("Replace every TODO: placeholder with content.");
	for (const m of contract.mentions ?? []) {
		if (!new RegExp(m.pattern, "i").test(text)) problems.push(`Mention ${m.hint}.`);
	}
	if (contract.table && !/^\|.*\|.*\|/m.test(text)) problems.push(`Include a table: ${contract.table}.`);
	if (contract.orderedList && !/^\s*1[.)]\s/m.test(text)) problems.push(`Include a numbered list: ${contract.orderedList}.`);
	return problems;
}

// Where this command registers the result: { registry, note } (a writable registry of this
// session), { note } (nothing to register, the command proceeds), or undefined (it must stop).
function registration(noGate) {
	const sessions = sessionIds();
	const registry = sessions.map((sessionId) => registryFor({ name: REGISTRY, sessionId })).find(Boolean);
	if (noGate) {
		if (!registry) return { note: "--no-gate: no Stop gate covers this result." };
		console.error(`--no-gate is refused: this session's hobin-learning hooks are active (its registry is ${registry}). Run the command again without --no-gate.`);
		return undefined;
	}
	if (registry) return { registry, note: "Registered for this session's Stop gate." };
	if (!sessions.length) return { note: "" };
	console.error(`No hobin-learning registry for this agent session above ${process.cwd()}. Run output-contract.mjs from the directory the session started in (or below it). If the hobin-learning hooks are not active in this session (Codex: trust them in /hooks; evaluations that do not install the plugin), pass --no-gate: nothing will stop the session for this result.`);
	return undefined;
}
const registerIn = (where, file) => {
	if (where.registry) register(where.registry, file);
	return where.note ? ` ${where.note}` : "";
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const noGate = args.includes("--no-gate");
	const [mode, contractPath, file] = args.filter((arg) => arg !== "--no-gate");
	if (!["new", "check"].includes(mode) || !contractPath || !file) {
		console.error("Usage: output-contract.mjs <new|check> <contract.json> <file> [--no-gate]");
		process.exit(2);
	}
	const contract = JSON.parse(readFileSync(contractPath, "utf8"));
	const where = registration(noGate);
	if (!where) process.exit(2);
	if (mode === "new") {
		mkdirSync(dirname(resolve(file)), { recursive: true });
		writeFileSync(file, skeleton(contract));
		console.log(`Wrote ${file}.${registerIn(where, file)} Fill every part, then run: check ${contractPath} ${file}`);
	} else {
		let text;
		try { text = readFileSync(file, "utf8"); } catch { console.error(`${file} does not exist; create it with: new ${contractPath} ${file}`); process.exit(1); }
		const note = registerIn(where, file);
		const problems = checkText(contract, text);
		for (const p of problems) console.error(`- ${p}`);
		if (problems.length) { console.error(`${file} does not meet the ${contract.id} output contract.${note}`); process.exit(1); }
		console.log(`${file} meets the ${contract.id} output contract.${note}`);
	}
}
