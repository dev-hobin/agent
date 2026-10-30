#!/usr/bin/env node
// Create or check a Markdown result against an output contract (assets/output-contract.json).
//   node output-contract.mjs new   <contract.json> <file>   write the contract's skeleton
//   node output-contract.mjs check <contract.json> <file>   exit 0 when the file meets the contract;
//                                                            otherwise print what to fix
// A required part is present when a heading or a bold field label (`**Label:**`) names it and
// it has content. The skeleton starts with a marker naming the contract so hosts can find results.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [mode, contractPath, file] = process.argv.slice(2);
	const contract = JSON.parse(readFileSync(contractPath, "utf8"));
	if (mode === "new") {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, skeleton(contract));
		console.log(`Wrote ${file}. Fill every part, then run: check ${contractPath} ${file}`);
	} else if (mode === "check") {
		let text;
		try { text = readFileSync(file, "utf8"); } catch { console.error(`${file} does not exist; create it with: new ${contractPath} ${file}`); process.exit(1); }
		const problems = checkText(contract, text);
		for (const p of problems) console.error(`- ${p}`);
		if (problems.length) { console.error(`${file} does not meet the ${contract.id} output contract.`); process.exit(1); }
		console.log(`${file} meets the ${contract.id} output contract.`);
	} else {
		console.error("Usage: output-contract.mjs <new|check> <contract.json> <file>");
		process.exit(2);
	}
}
