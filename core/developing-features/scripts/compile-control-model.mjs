#!/usr/bin/env node
// Compiles a decision record (assets/control-decisions.json shape) into a control
// model. The record holds what only reading the code can decide: the code facts
// with their evidence, a closed answer for each fact, the variables, and one
// rule list per event that copies what the code does. States are not written by
// hand: they are the variable combinations reachable from the initial values.
// Node 18+, no dependencies.
//
//   node compile-control-model.mjs decisions.json [--canonical]
//   node compile-control-model.mjs --gate [decisions.json] [--require]
//   node compile-control-model.mjs --baseline [decisions.json]   before changing the code
//   node compile-control-model.mjs --changes [decisions.json]    cells that differ from the baseline
//
// The same record always compiles to the same model. --gate is the pass/fail check for a
// record: without a path it checks every control-decisions*.json under the current
// directory, and passes when there is none unless --require is given.

import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { CONTROL_RECORD, SCENARIO_RECORD, findFiles, recordLine } from "./records.mjs";

import { canonicalize, checkModel, parseExpression } from "./check-control-model.mjs";

const ANSWERS = {
	variable: "state the code owns and that decides which events are accepted",
	input: "data another owner keeps (props, queries, the browser) that only guards events",
	event: "something the code reacts to",
	excluded: "kept out of the model",
	outside: "an assumption, a function, or a person's wait",
};
const EXCLUDED_REASONS = ["display", "derived", "owned", "unbounded", "server"];
const OUTCOMES = ["then", "refuse", "ignore", "question"];

const domainOf = (type) => (type === "bool" ? [false, true] : type);
const combinations = (variables) => {
	let result = [{}];
	for (const [name, type] of Object.entries(variables)) result = result.flatMap((v) => domainOf(type).map((value) => ({ ...v, [name]: value })));
	return result;
};
const literal = (value) => JSON.stringify(value);
const stateName = (valuation) => Object.keys(valuation).sort().map((k) => `${k}=${typeof valuation[k] === "boolean" ? (valuation[k] ? 1 : 0) : valuation[k]}`).join(",");
const whenOf = (valuation) =>
	Object.keys(valuation)
		.sort()
		.map((k) => (typeof valuation[k] === "boolean" ? (valuation[k] ? k : `!${k}`) : `${k} == ${literal(valuation[k])}`))
		.join(" && ") || "true";

// Evaluates a parsed expression; in() is not allowed in rules.
function evaluate(node, valuation) {
	if ("value" in node) return node.value;
	if (node.name) return valuation[node.name];
	if (node.in) throw new Error("in(...) is not allowed in rules");
	if (node.op === "!") return !evaluate(node.operand, valuation);
	if (node.op === "&&") return evaluate(node.left, valuation) && evaluate(node.right, valuation);
	if (node.op === "||") return evaluate(node.left, valuation) || evaluate(node.right, valuation);
	const [l, r] = [evaluate(node.left, valuation), evaluate(node.right, valuation)];
	return node.op === "==" ? l === r : l !== r;
}
const sortBy = (list, key) => [...list].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0));
const names = (node, acc = new Set()) => {
	if (node.name) acc.add(node.name);
	for (const child of [node.left, node.right, node.operand]) if (child) names(child, acc);
	return acc;
};

export function compileDecisions(record) {
	const errors = [];
	const variables = record.variables ?? {};
	const inputs = record.inputs ?? {};
	const all = { ...variables, ...inputs };
	const events = record.events ?? {};
	for (const name of Object.keys(inputs)) if (name in variables) errors.push(`inputs.${name}: also declared as a variable`);
	for (const [name, type] of Object.entries(all))
		if (type !== "bool" && !(Array.isArray(type) && type.length >= 2 && new Set(type).size === type.length))
			errors.push(`${name in inputs ? "inputs" : "variables"}.${name}: must be "bool" or a list of two or more distinct values`);

	// Closed answers: every code fact has exactly one answer, and every variable,
	// input, and event rests on at least one fact.
	const facts = record.facts ?? [];
	const covered = { variable: new Set(), input: new Set(), event: new Set() };
	facts.forEach((fact, i) => {
		const at = `facts[${i}]`;
		if (!fact.code || !fact.evidence) errors.push(`${at}: needs the code it names and file:line evidence`);
		if (!(fact.answer in ANSWERS)) errors.push(`${at}: answer must be one of ${Object.keys(ANSWERS).join(", ")}`);
		if (["variable", "input", "event"].includes(fact.answer)) {
			const pool = { variable: variables, input: inputs, event: events }[fact.answer];
			for (const target of [].concat(fact.as ?? [])) {
				if (!(target in pool)) errors.push(`${at}: "${target}" is not a declared ${fact.answer}`);
				else covered[fact.answer].add(target);
			}
			if (!fact.as) errors.push(`${at}: name the ${fact.answer} it becomes in "as"`);
		}
		if (fact.answer === "excluded" && !EXCLUDED_REASONS.includes(fact.reason)) errors.push(`${at}: reason must be one of ${EXCLUDED_REASONS.join(", ")}`);
		if (fact.answer === "outside" && !["assumption", "function", "wait"].includes(fact.as)) errors.push(`${at}: an outside fact is an assumption, a function, or a wait`);
	});
	for (const [kind, pool] of [["variable", variables], ["input", inputs], ["event", events]])
		for (const name of Object.keys(pool)) if (!covered[kind].has(name)) errors.push(`${kind}s.${name}: no code fact is answered "${kind}" with as: "${name}"`);

	const initial = record.initial ?? {};
	for (const name of Object.keys(variables)) if (!(name in initial)) errors.push(`initial.${name}: missing`);
	for (const [name, value] of Object.entries(initial)) {
		if (!(name in variables)) errors.push(`initial.${name}: not a variable`);
		else if (!domainOf(variables[name]).includes(value)) errors.push(`initial.${name}: ${literal(value)} is not a value of ${name}`);
	}

	const compile = (source, at, allowed) => {
		try {
			const tree = parseExpression(String(source));
			for (const n of names(tree)) if (!(n in allowed)) errors.push(`${at}: "${n}" is not declared here`);
			return tree;
		} catch (error) {
			errors.push(`${at}: ${error.message}`);
			return null;
		}
	};
	const rules = {};
	for (const [event, spec] of Object.entries(events)) {
		const at = `events.${event}`;
		if (!["control", "response", "timer", "lifecycle", "external"].includes(spec.source)) errors.push(`${at}.source: must be control, response, timer, lifecycle, or external`);
		const arrives = spec.arrives !== undefined ? compile(spec.arrives, `${at}.arrives`, variables) : null;
		const list = (spec.rules ?? []).map((rule, i) => {
			const where = `${at}.rules[${i}]`;
			const present = OUTCOMES.filter((k) => rule[k] !== undefined);
			if (present.length !== 1) errors.push(`${where}: exactly one of ${OUTCOMES.join(", ")}`);
			if (rule.refuse !== undefined && !["guarantee", "assumption"].includes(rule.refuse)) errors.push(`${where}.refuse: guarantee or assumption`);
			if (rule.refuse === "guarantee" && spec.source !== "control") errors.push(`${where}: only a control can be refused`);
			const then = {};
			for (const [name, source] of Object.entries(rule.then ?? {})) {
				if (!(name in variables)) errors.push(`${where}.then.${name}: not a variable`);
				then[name] = compile(source, `${where}.then.${name}`, all);
			}
			return { ...rule, when: compile(rule.when ?? "true", `${where}.when`, all), then: rule.then ? then : undefined };
		});
		if (!list.length) errors.push(`${at}: needs at least one rule`);
		rules[event] = { arrives, list, inputsUsed: [...new Set(list.flatMap((r) => (r.when ? [...names(r.when)] : [])).filter((n) => n in inputs))].sort() };
	}
	const terminal = record.terminal !== undefined ? compile(record.terminal, "terminal", variables) : null;
	if (errors.length) return { errors };

	// Explore every reachable combination of the variables.
	const eventNames = Object.keys(events).sort();
	const start = Object.fromEntries(Object.keys(variables).sort().map((k) => [k, initial[k]]));
	const seen = new Map([[stateName(start), start]]);
	const queue = [start];
	const states = {};
	const cells = {};
	const guards = {};
	const outcomeOf = (rule, valuation, at) => {
		if (rule.refuse) return rule.refuse === "assumption" ? { forbid: "assumption", assumption: rule.assumption } : { forbid: "guarantee" };
		if (rule.ignore !== undefined) return { ignore: rule.ignore };
		if (rule.question !== undefined) return { question: rule.question };
		const next = { ...valuation };
		for (const [name, tree] of Object.entries(rule.then)) {
			const value = evaluate(tree, valuation);
			if (!domainOf(variables[name]).includes(value)) {
				errors.push(`${at}: sets ${name} to ${literal(value)}, which is not one of its values`);
				return { ignore: "invalid" };
			}
			next[name] = value;
		}
		const target = Object.fromEntries(Object.keys(variables).sort().map((k) => [k, next[k]]));
		const name = stateName(target);
		if (!seen.has(name)) seen.set(name, target), queue.push(target);
		return name === stateName(valuation) ? (rule.restart ? { to: name, reenter: true } : { ignore: rule.note ?? "no change" }) : { to: name };
	};
	while (queue.length && errors.length < 50) {
		const valuation = queue.shift();
		const name = stateName(valuation);
		states[name] = terminal && evaluate(terminal, valuation) === true ? { terminal: true } : {};
		cells[name] = {};
		for (const event of eventNames) {
			const { arrives, list, inputsUsed } = rules[event];
			if (arrives && evaluate(arrives, valuation) !== true) {
				cells[name][event] = { ignore: "stale: no attempt that produces this result is running" };
				continue;
			}
			const branches = combinations(Object.fromEntries(inputsUsed.map((n) => [n, inputs[n]]))).map((inputValues) => {
				const env = { ...valuation, ...inputValues };
				const matching = list.filter((rule) => evaluate(rule.when, env) === true);
				const label = inputsUsed.length ? stateName(inputValues) : null;
				const at = `events.${event} in ${name}${label ? ` with ${label}` : ""}`;
				if (matching.length !== 1) {
					errors.push(`${at}: ${matching.length ? "more than one rule holds" : "no rule holds"}`);
					return { label, cell: { ignore: "invalid" } };
				}
				return { label, cell: outcomeOf(matching[0], valuation, at) };
			});
			const distinct = new Set(branches.map((b) => JSON.stringify(b.cell)));
			if (distinct.size === 1) cells[name][event] = branches[0].cell;
			else {
				guards[event] = Object.fromEntries(
					combinations(Object.fromEntries(inputsUsed.map((n) => [n, inputs[n]]))).map((v) => [stateName(v), whenOf(v)]),
				);
				cells[name][event] = branches.map((b) => ({ guard: b.label, ...b.cell }));
			}
		}
	}
	if (errors.length) return { errors };

	const reached = [...seen.values()];
	const model = {
		feature: record.feature,
		compiledFrom: "control-decisions",
		semantics: record.semantics,
		outside: sortBy(facts.filter((f) => f.answer === "outside").map((f) => ({ item: f.code, as: f.as, note: f.evidence })), "item"),
		excluded: sortBy(facts.filter((f) => f.answer === "excluded").map((f) => ({ item: f.code, reason: f.reason, owner: f.owner ?? f.evidence })), "item"),
		initial: stateName(start),
		events: eventNames,
		sources: Object.fromEntries(eventNames.map((e) => [e, events[e].source])),
		...(Object.keys(guards).length ? { guards } : {}),
		variables: Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]])),
		states,
		cells,
		...(record.variants ? { variants: record.variants } : {}),
		...(record.assumptions ? { assumptions: record.assumptions } : {}),
		...(record.invariants ? { invariants: record.invariants } : {}),
		...(record.progress
			? {
					progress: record.progress.map((entry) => {
						if (entry.when === undefined) return entry;
						const tree = parseExpression(String(entry.when));
						const { when, ...rest } = entry;
						return { ...rest, states: reached.filter((v) => evaluate(tree, v) === true).map(stateName) };
					}),
				}
			: {}),
		refinement: reached.map((v) => ({ implementation: "computed", when: whenOf(v), state: stateName(v) })),
		unreachable: [{ when: reached.length ? `!(${reached.map((v) => `(${whenOf(v)})`).join(" || ")})` : "true", reason: "not reachable from the initial values under the rules", by: "computed" }],
		...(record.findings ? { findings: record.findings } : {}),
	};
	return { errors: [], model };
}

// Evidence is "path:line", "path:12-14", or "path:12,40", relative to the project root or to
// the record. A symbol is the code name or literal a fact is about; it must appear on the
// cited lines as a whole token, so a citation names what it points at instead of copying text.
const IDENT = /^[A-Za-z_$][\w$]*$/;
const squash = (text) => text.replace(/\s+/g, " ").trim();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const mentions = (text, symbol) =>
	IDENT.test(symbol) ? new RegExp(`(?<![\\w$])${escape(symbol)}(?![\\w$])`).test(text) : squash(text).includes(squash(symbol));

function cited(evidence, at, recordDir, root) {
	const match = typeof evidence === "string" ? /^(.+?):(\d+(?:[-,]\d+)*)$/.exec(evidence.trim()) : null;
	if (!match) return { problems: [`${at}: evidence must be "path:line" (or path:12-14, path:12,40)`] };
	const file = [resolve(root, match[1]), resolve(recordDir, match[1])].find((f) => existsSync(f) && statSync(f).isFile());
	if (!file) return { problems: [`${at}: ${match[1]} does not exist`] };
	const lines = readFileSync(file, "utf8").split("\n");
	const numbers = match[2].split(",").flatMap((part) => {
		const [from, to = from] = part.split("-").map(Number);
		return Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
	});
	const outside = numbers.filter((n) => n < 1 || n > lines.length);
	if (outside.length) return { problems: [`${at}: ${match[1]} has ${lines.length} lines; line ${outside[0]} does not exist`] };
	return { problems: [], text: numbers.map((n) => lines[n - 1]).join("\n"), where: `${match[1]} line ${match[2]}` };
}

function symbolProblems(item, at, recordDir, root) {
	if (typeof item.symbol !== "string" || !item.symbol.trim()) return [`${at}: name the code it points at in "symbol" (an identifier or a literal on the cited lines)`];
	const { problems, text, where } = cited(item.evidence, at, recordDir, root);
	if (problems.length) return problems;
	return mentions(text, item.symbol) ? [] : [`${at}: "${item.symbol}" is not on ${where}; cite the lines where it appears`];
}

// Names a line writes: this.x = / this.x++ / x.current = (fields and refs), and setX( (React state).
function writtenNames(text) {
	const names = new Set();
	for (const m of text.matchAll(/this\.([A-Za-z_$][\w$]*)\s*(?:=(?!=)|\+\+|--|\+=|-=)/g)) names.add(m[1]);
	for (const m of text.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\.current\s*=(?!=)/g)) names.add(m[1]);
	for (const m of text.matchAll(/(?<![\w$.])set([A-Z][\w$]*)\s*\(/g)) names.add(m[1][0].toLowerCase() + m[1].slice(1));
	return names;
}

// Every rule (and every `arrives`) cites the code it copies. The cited lines must mention the
// symbol of each variable the rule reads or writes, and every name they write must be some
// fact's symbol, so state the record leaves out cannot hide behind a rule.
function ruleProblems(record, recordDir, root) {
	const problems = [];
	const symbolsOf = new Map();
	const add = (name, symbol) => symbol && symbolsOf.set(name, new Set([...(symbolsOf.get(name) ?? []), symbol]));
	const covered = new Set();
	for (const fact of record.facts ?? []) {
		if (fact.symbol) covered.add(fact.symbol);
		for (const part of fact.from ?? []) if (part.symbol) covered.add(part.symbol);
		if (!["variable", "input"].includes(fact.answer)) continue;
		for (const name of [].concat(fact.as ?? [])) {
			add(name, fact.symbol);
			for (const part of fact.from ?? []) add(name, part.symbol);
		}
	}
	const known = { ...(record.variables ?? {}), ...(record.inputs ?? {}) };
	const namesIn = (source) => {
		try {
			const out = new Set();
			const walk = (n) => { if (n.name) out.add(n.name); for (const c of [n.left, n.right, n.operand]) if (c) walk(c); };
			walk(parseExpression(String(source)));
			return [...out].filter((n) => n in known);
		} catch {
			return [];
		}
	};
	const check = (evidence, at, needed) => {
		if (evidence === undefined) return problems.push(`${at}: cite the code it copies in "evidence"`);
		const { problems: p, text, where } = cited(evidence, at, recordDir, root);
		if (p.length) return problems.push(...p);
		for (const name of needed) {
			const symbols = [...(symbolsOf.get(name) ?? [])];
			if (symbols.length && !symbols.some((symbol) => mentions(text, symbol)))
				problems.push(`${at}: reads or writes ${name}, but ${where} mentions none of ${symbols.map((x) => `"${x}"`).join(", ")}`);
		}
		for (const name of writtenNames(text))
			if (![...covered].some((symbol) => symbol === name || mentions(symbol, name)))
				problems.push(`${at}: ${where} writes ${name}, which no fact covers; add it as a variable or an excluded fact`);
	};
	for (const [event, spec] of Object.entries(record.events ?? {})) {
		if (spec.arrives !== undefined) check(spec.evidence, `events.${event}.arrives`, namesIn(spec.arrives));
		(spec.rules ?? []).forEach((rule, i) =>
			check(rule.evidence, `events.${event}.rules[${i}]`, [...new Set([...namesIn(rule.when ?? "true"), ...Object.keys(rule.then ?? {})])]),
		);
	}
	return problems;
}

const findRecords = (dir = ".") => findFiles(CONTROL_RECORD, dir);

// The baseline sits next to its record: control-decisions.x.json -> control-baseline.x.json.
export const baselinePathOf = (recordPath) => join(dirname(recordPath), basename(recordPath).replace(/^control-decisions/, "control-baseline"));

// A cell's behavior without its free text, so a baseline and a later model compare by meaning.
function behavior(cell) {
	if (cell === undefined) return "absent";
	if (Array.isArray(cell)) return cell.map((b) => `${b.guard}:${behavior({ ...b, guard: undefined })}`).sort().join("|");
	if (cell.to !== undefined) return `to ${cell.to}${cell.reenter ? " (restart)" : ""}`;
	if (cell.forbid !== undefined) return `refuse (${cell.forbid})`;
	if (cell.question !== undefined) return "question";
	return "no change";
}
const stale = (cell) => cell && !Array.isArray(cell) && typeof cell.ignore === "string" && cell.ignore.startsWith("stale");

// Cells of the record's model whose behavior differs from the baseline taken before the code
// changed (every cell, when there is no baseline). Each must be covered by an acceptance
// scenario that `scenarios.mjs run` ran and recorded as passing.
export function changedCells(model, baseline) {
	const changed = [];
	for (const [state, row] of Object.entries(model.cells)) {
		for (const [event, cell] of Object.entries(row)) {
			if (stale(cell)) continue;
			const before = baseline?.cells?.[state]?.[event];
			if (baseline && behavior(before) === behavior(cell)) continue;
			changed.push({ id: `${event}@${state}`, before: baseline ? behavior(before) : "no baseline", after: behavior(cell) });
		}
	}
	return changed;
}

function coverageProblems(model, recordPath, root) {
	const baselinePath = baselinePathOf(recordPath);
	const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
	const scenarios = findFiles(SCENARIO_RECORD, root).flatMap((path) => {
		try { return JSON.parse(readFileSync(path, "utf8")).scenarios ?? []; } catch { return []; }
	});
	const covered = new Set(scenarios.filter((s) => s.status === "pass").flatMap((s) => s.covers ?? []));
	const cells = new Set(Object.entries(model.cells).flatMap(([state, row]) => Object.keys(row).map((event) => `${event}@${state}`)));
	const problems = [];
	for (const cell of changedCells(model, baseline))
		if (!covered.has(cell.id))
			problems.push(`cell ${cell.id} changed (${cell.before} -> ${cell.after}); no passing acceptance scenario covers it. Add "covers": ["${cell.id}"] to the scenario that tests it and run "scenarios.mjs run"${baseline ? "" : ` (there is no ${basename(baselinePath)}: take one with --baseline before changing the code, and only changed cells need scenarios)`}`);
	for (const s of scenarios)
		for (const id of s.covers ?? [])
			if (typeof id !== "string" || (id.includes("@") && !cells.has(id) && model.events.includes(id.split("@")[0])))
				problems.push(`scenario ${s.id ?? "?"} covers ${JSON.stringify(id)}, which is not a cell of the control model`);
	return problems;
}

// The pass/fail check for one record. Findings are facts about the code (a dead end, two
// events that behave alike); the record passes only when it acknowledges each one by id.
// The gate checks structure: that evidence exists and names what it points at. Whether a
// rule reads the code correctly is for tests and benchmarks.
export function gateRecord(record, { recordDir = ".", root = ".", recordPath = join(recordDir, "control-decisions.json"), coverage = true } = {}) {
	const problems = [];
	(record.facts ?? []).forEach((fact, i) => {
		problems.push(...symbolProblems(fact, `facts[${i}]`, recordDir, root));
		if (fact.answer === "input") {
			if (!Array.isArray(fact.from) || !fact.from.length) problems.push(`facts[${i}]: an input lists the conditions it stands for in "from", each with evidence and symbol`);
			else fact.from.forEach((part, k) => problems.push(...symbolProblems(part, `facts[${i}].from[${k}]`, recordDir, root)));
		}
	});
	problems.push(...ruleProblems(record, recordDir, root));
	const first = compileDecisions(record);
	if (first.errors.length) return [...problems, ...first.errors];
	const second = compileDecisions(structuredClone(record));
	if (JSON.stringify(first.model) !== JSON.stringify(second.model)) problems.push("compiling twice gave different models");
	const canonical = canonicalize(first.model);
	if (JSON.stringify(canonicalize(canonical)) !== JSON.stringify(canonical)) problems.push("the canonical form is not stable");
	const { errors, warnings, findings } = checkModel(first.model);
	problems.push(...errors, ...warnings);
	const acknowledged = new Set((record.findings ?? []).filter((f) => f && typeof f === "object").map((f) => f.id));
	for (const f of findings)
		if (!acknowledged.has(f.id)) problems.push(`finding ${f.id} is not acknowledged: ${f.text}. Add {"id": "${f.id}", "note": "..."} to findings`);
	const computed = new Set(findings.map((f) => f.id));
	for (const id of acknowledged) if (!computed.has(id)) problems.push(`finding ${id} is in the record but no longer occurs; remove it`);
	if (coverage) problems.push(...coverageProblems(first.model, recordPath, root));
	return problems;
}

function main(argv) {
	const files = argv.filter((a) => !a.startsWith("--"));
	// Inside a host session, a control decision record named with --baseline, --changes or --gate is
	// the session's: the plugin's Stop hook gates it wherever it lives. Records found by walking are not.
	if (["--baseline", "--changes", "--gate"].some((flag) => argv.includes(flag))) {
		for (const file of files) if (existsSync(file) && CONTROL_RECORD.test(basename(file))) console.log(recordLine(file));
	}
	if (argv.includes("--baseline")) {
		const records = files.length ? files : findRecords();
		if (records.length !== 1) throw new Error("--baseline needs exactly one control-decisions*.json");
		const [path] = records;
		const record = JSON.parse(readFileSync(path, "utf8"));
		const problems = gateRecord(record, { recordDir: dirname(resolve(path)), root: process.cwd(), recordPath: resolve(path), coverage: false });
		if (problems.length) {
			for (const problem of problems) console.error(`${path}: ${problem}`);
			console.error("Fix the record of the current code first; a baseline is taken only from a record that passes the gate.");
			return 1;
		}
		const { model } = compileDecisions(record);
		const out = baselinePathOf(path);
		writeFileSync(out, JSON.stringify({ baselineOf: basename(path), initial: model.initial, events: model.events, cells: model.cells }, null, 2) + "\n");
		console.log(`${out}: baseline of the current behavior. Change the code and the record; the gate then asks for a scenario per changed cell.`);
		return 0;
	}
	if (argv.includes("--changes")) {
		const records = files.length ? files : findRecords();
		for (const path of records) {
			const { errors, model } = compileDecisions(JSON.parse(readFileSync(path, "utf8")));
			if (errors.length) throw new Error(`${path}: ${errors[0]}`);
			const baselinePath = baselinePathOf(path);
			const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
			for (const cell of changedCells(model, baseline)) console.log(`${cell.id}: ${cell.before} -> ${cell.after}`);
		}
		return 0;
	}
	if (argv.includes("--gate")) {
		const records = files.length ? files : findRecords();
		if (!records.length) {
			const message = "No control-decisions*.json found.";
			if (argv.includes("--require")) console.error(`${message} Copy assets/control-decisions.json into the project and fill it.`);
			else console.log(`${message} Nothing to check.`);
			return argv.includes("--require") ? 1 : 0;
		}
		let ok = true;
		for (const path of records) {
			const problems = gateRecord(JSON.parse(readFileSync(path, "utf8")), { recordDir: dirname(resolve(path)), root: process.cwd(), recordPath: resolve(path) });
			for (const problem of problems) console.error(`${path}: ${problem}`);
			if (problems.length) ok = false;
		}
		console.log(ok ? `${records.join(", ")}: the control model gate passes.` : "The control model gate fails.");
		return ok ? 0 : 1;
	}
	if (files.length !== 1) throw new Error("usage: compile-control-model.mjs decisions.json [--canonical]");
	const { errors, model } = compileDecisions(JSON.parse(readFileSync(files[0], "utf8")));
	if (errors.length) {
		for (const line of errors) console.error(`error: ${line}`);
		return 1;
	}
	console.log(JSON.stringify(argv.includes("--canonical") ? canonicalize(model) : model, null, 2));
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 2;
	}
}
