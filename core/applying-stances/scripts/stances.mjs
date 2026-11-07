#!/usr/bin/env node
// Produce and check the stances block (assets/stances.md) for an instruction file.
//   node stances.mjs block <target> [--skip 2,5] [--learning]
//       print the exact unified diff that inserts or replaces the block in <target>, leaving
//       out the stances numbered in --skip (1-based, as listed in assets/stances.md)
//   node stances.mjs check <file> [--no-gate]
//       exit 0 when <file> (an instruction file or a proposal with a diff) has one stances
//       block of at most 15 lines whose stances all come from the asset, without repeats
//
// The session registry (session-registry.mjs). Run inside an agent session (CLAUDE_CODE_SESSION_ID
// or CODEX_SESSION_ID set), check finds the session's registry, .hobin-stances/sessions/<id>.jsonl,
// in the working directory or a parent, and appends the checked file's absolute path; the plugin's
// Stop hook checks every file listed there. With a session id and no registry (or one that cannot
// be written) it stops with exit 2 before checking anything. Without a session id (a person at a
// terminal) it proceeds and registers nothing; --no-gate does the same inside a session whose
// registry is not found and says no Stop gate covers the file; it is refused (exit 2) when the
// registry is found, because the hooks are active. block writes no file (it prints the diff for approval), so it
// registers nothing: the target changes only after the user approves, and step 5 checks it then.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The shared session registry (core/shared/scripts/session-registry.mjs): copied next to this
// script in a plugin, two folders up in this repository's core.
const here = dirname(fileURLToPath(import.meta.url));
const { register, registryFor, sessionIds } = await import(pathToFileURL(
	[join(here, "session-registry.mjs"), join(here, "../../shared/scripts/session-registry.mjs")].find(existsSync)).href);
const REGISTRY = ".hobin-stances";
const asset = readFileSync(join(here, "../assets/stances.md"), "utf8").trimEnd().split("\n");
const learning = readFileSync(join(here, "../assets/learning-stance.md"), "utf8").trim();
const [OPEN, CLOSE] = [asset[0], asset.at(-1)];
// The line that opens the stances block.
export const MARKER = OPEN;
const stances = asset.filter((line) => line.startsWith("- "));
const normalize = (line) => line.replace(/^\+/, "").replace(/\s*\(checked by [^)]*\)\s*$/, "").trim();

export function block({ skip = [], withLearning = false } = {}) {
	const kept = stances.filter((_, i) => !skip.includes(i + 1));
	if (withLearning) kept.push(learning);
	return [OPEN, ...asset.slice(1, asset.findIndex((l) => l.startsWith("- "))), ...kept, CLOSE];
}

export function checkText(text) {
	const lines = text.split("\n").map((l) => l.replace(/^\+/, ""));
	const opens = lines.flatMap((l, i) => (l.trim() === OPEN ? [i] : []));
	if (opens.length !== 1) return [opens.length ? "Keep exactly one stances block." : `Add the stances block (${OPEN} … ${CLOSE}); generate it with "stances.mjs block <target>".`];
	const close = lines.findIndex((l, i) => i > opens[0] && l.trim() === CLOSE);
	if (close === -1) return [`Close the block with ${CLOSE}.`];
	const body = lines.slice(opens[0] + 1, close);
	const problems = [];
	if (body.length > 15) problems.push(`The block has ${body.length} lines; keep it at 15 or fewer.`);
	const known = new Set([...stances, learning].map(normalize));
	const seen = new Set();
	for (const line of body.filter((l) => l.trim().startsWith("- "))) {
		const key = normalize(line);
		if (!known.has(key)) problems.push(`Not a stance from assets/stances.md (edit wording only through the asset): ${key}`);
		if (seen.has(key)) problems.push(`Repeated stance: ${key}`);
		seen.add(key);
	}
	return problems;
}

// Where check registers the file: { registry, note } (a writable registry of this session),
// { note } (nothing to register, check proceeds), or undefined (it must stop).
function registration(noGate) {
	const sessions = sessionIds();
	const registry = sessions.map((sessionId) => registryFor({ name: REGISTRY, sessionId })).find(Boolean);
	if (noGate) {
		if (!registry) return { note: "--no-gate: no Stop gate covers this file." };
		console.error(`--no-gate is refused: this session's hobin-stances hooks are active (its registry is ${registry}). Run the command again without --no-gate.`);
		return undefined;
	}
	if (registry) return { registry, note: "Registered for this session's Stop gate." };
	if (!sessions.length) return { note: "" };
	console.error(`No hobin-stances registry for this agent session above ${process.cwd()}. Run stances.mjs from the directory the session started in (or below it). If the hobin-stances hooks are not active in this session (Codex: trust them in /hooks; evaluations that do not install the plugin), pass --no-gate: nothing will stop the session for this file.`);
	return undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const noGate = args.includes("--no-gate");
	const [mode, file, ...rest] = args.filter((arg) => arg !== "--no-gate");
	if (mode === "block") {
		const skipArg = rest[rest.indexOf("--skip") + 1];
		const skip = rest.includes("--skip") ? skipArg.split(",").map(Number) : [];
		const before = existsSync(file) ? readFileSync(file, "utf8").replace(/\n$/, "").split("\n") : [];
		const start = before.indexOf(OPEN), end = before.indexOf(CLOSE);
		const replaced = start !== -1 && end > start;
		const head = replaced ? before.slice(0, start) : before;
		const tail = replaced ? before.slice(end + 1) : [];
		const added = [...(replaced || !before.length ? [] : [""]), ...block({ skip, withLearning: rest.includes("--learning") })];
		const removed = replaced ? before.slice(start, end + 1) : [];
		const after = [...head, ...added, ...tail];
		const oldStart = removed.length ? head.length + 1 : head.length;
		console.log(`--- a/${file}\n+++ b/${file}\n@@ -${oldStart},${removed.length} +${head.length + 1},${added.length} @@`);
		for (const l of removed) console.log(`-${l}`);
		for (const l of added) console.log(`+${l}`);
		console.log(`\n# size after: ${Buffer.byteLength(after.join("\n") + "\n")} bytes`);
	} else if (mode === "check" && file) {
		const where = registration(noGate);
		if (!where) process.exit(2);
		if (!existsSync(file)) { console.error(`${file} does not exist.`); process.exit(1); }
		if (where.registry) register(where.registry, file);
		const note = where.note ? ` ${where.note}` : "";
		const problems = checkText(readFileSync(file, "utf8"));
		for (const p of problems) console.error(`- ${p}`);
		if (problems.length) { console.error(`${file}: the stances block does not pass.${note}`); process.exit(1); }
		console.log(`${file}: stances block is valid.${note}`);
	} else {
		console.error("Usage: stances.mjs <block <target> [--skip n,…] [--learning] | check <file> [--no-gate]>");
		process.exit(2);
	}
}
