#!/usr/bin/env node
// Produce and check the stances block (assets/stances.md) for an instruction file.
//   node stances.mjs block <target> [--skip 2,5] [--learning]
//       print the exact unified diff that inserts or replaces the block in <target>, leaving
//       out the stances numbered in --skip (1-based, as listed in assets/stances.md)
//   node stances.mjs check <file>
//       exit 0 when <file> (an instruction file or a proposal with a diff) has one stances
//       block of at most 15 lines whose stances all come from the asset, without repeats
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const asset = readFileSync(join(here, "../assets/stances.md"), "utf8").trimEnd().split("\n");
const learning = readFileSync(join(here, "../assets/learning-stance.md"), "utf8").trim();
const [OPEN, CLOSE] = [asset[0], asset.at(-1)];
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [mode, file, ...rest] = process.argv.slice(2);
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
	} else if (mode === "check") {
		const problems = checkText(readFileSync(file, "utf8"));
		for (const p of problems) console.error(`- ${p}`);
		if (problems.length) process.exit(1);
		console.log(`${file}: stances block is valid.`);
	} else {
		console.error("Usage: stances.mjs <block <target> [--skip n,…] [--learning] | check <file>>");
		process.exit(2);
	}
}
