#!/usr/bin/env node
// Checks a control model (assets/control-model.json shape), compares two models of
// the same boundary, or derives test scenarios from one. Node 18+, no dependencies.
//
//   node check-control-model.mjs model.json [--strict] [--json]
//   node check-control-model.mjs --compare a.json b.json [--json]
//   node check-control-model.mjs --scenarios model.json
//   node check-control-model.mjs --canonical model.json
//
// A passing check means each table is closed and consistent. It does not prove
// that invariants hold or that the implementation matches the model.

import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const KINDS = ["to", "ignore", "forbid", "question"];
const SOURCES = ["control", "response", "timer", "lifecycle", "external"];
const ASSUMPTION_KINDS = ["arrival", "world", "eventual"];
const STALE = Object.freeze({ ignore: "stale: the attempt that produced this result has ended", stale: true });

function plainKind(cell) {
	const present = KINDS.filter((kind) => cell && typeof cell === "object" && Object.hasOwn(cell, kind));
	return present.length === 1 ? present[0] : null;
}

const ownersOf = (model, event) => Object.keys(model.states ?? {}).filter((s) => model.states[s].owns?.includes(event));

// The cell that applies: written, filled for a result of an ended attempt, or `otherwise`.
export function cellAt(model, state, event) {
	const written = model.cells?.[state]?.[event];
	if (written !== undefined) return written;
	const owners = ownersOf(model, event);
	if (owners.length && !owners.includes(state)) return STALE;
	return model.states?.[state]?.otherwise;
}

// One flat model per mount-time variant. `without` removes events that cannot
// arrive in that variant; `states` and `cells` overlay the base.
export function expandVariants(model) {
	const base = structuredClone(model);
	delete base.variants;
	const result = [{ name: "base", model: base }];
	for (const [name, variant] of Object.entries(model.variants ?? {})) {
		const flat = structuredClone(base);
		const without = new Set(variant.without ?? []);
		Object.defineProperty(flat, "without", { value: without, enumerable: false });
		flat.events = flat.events.filter((e) => !without.has(e));
		for (const row of Object.values(flat.cells ?? {})) for (const e of without) delete row[e];
		for (const e of without) {
			if (flat.sources) delete flat.sources[e];
			if (flat.guards) delete flat.guards[e];
		}
		for (const state of Object.values(flat.states)) if (state.owns) state.owns = state.owns.filter((e) => !without.has(e));
		if (variant.initial) flat.initial = variant.initial;
		for (const [s, value] of Object.entries(variant.states ?? {})) flat.states[s] = { ...flat.states[s], ...value };
		for (const [s, row] of Object.entries(variant.cells ?? {})) flat.cells = { ...flat.cells, [s]: { ...flat.cells?.[s], ...row } };
		result.push({ name, model: flat });
	}
	return result;
}

// Declared guard labels of an event: an array of labels, or an object whose keys
// are labels and whose values are expressions over `variables`.
const guardLabels = (model, event) => {
	const declared = model.guards?.[event];
	return Array.isArray(declared) ? declared : declared && typeof declared === "object" ? Object.keys(declared) : null;
};

// One flat table per variant.
function prepare(model) {
	return expandVariants(model);
}

// Letters are events, split by a guard vocabulary when one applies: SUBMIT[ready].
function lettersOf(event, labels) {
	return labels ? labels.map((label) => ({ event, label, name: `${event}[${label}]` })) : [{ event, label: null, name: event }];
}

// The observable outcome of one letter in one state: a move to a state (`ignore`
// moves to itself), or a refusal, an assumed-absent event, or an open question.
// A guarded cell read without a label yields every branch outcome.
function outcomes(model, state, letter) {
	const cell = cellAt(model, state, letter.event);
	if (Array.isArray(cell)) {
		const branches = letter.label === null ? cell : cell.filter((b) => b.guard === letter.label);
		return branches.map((b) => outcomeOf(b, state));
	}
	return [outcomeOf(cell, state)];
}

function outcomeOf(cell, state) {
	const kind = plainKind(cell);
	if (kind === "to") return { move: cell.to, reenter: cell.to === state && cell.reenter === true };
	if (kind === "ignore") return { move: state, reenter: false };
	if (kind === "forbid") return { observe: cell.forbid === "assumption" ? "assumed-absent" : "refused" };
	return { observe: kind === "question" ? "question" : "invalid" };
}

// Partition refinement over the given models' states: blocks of equal behavior.
function partition(parts, lettersFor) {
	const nodes = parts.flatMap(({ tag, model }) => Object.keys(model.states).map((state) => ({ tag, model, state, key: `${tag}:${state}` })));
	const tokenOf = (node, letter, block) =>
		outcomes(node.model, node.state, letter)
			.map((o) => (o.observe ? o.observe : `to:${block.get(`${node.tag}:${o.move}`)}${o.reenter ? "+reenter" : ""}`))
			.sort()
			.join(",");
	let block = new Map(nodes.map((n) => [n.key, n.model.states[n.state].terminal ? "T" : "N"]));
	for (;;) {
		const ids = new Map();
		const next = new Map(
			nodes.map((n) => {
				const signature = `${block.get(n.key)}|${lettersFor(n).map((l) => tokenOf(n, l, block)).join("|")}`;
				if (!ids.has(signature)) ids.set(signature, String(ids.size));
				return [n.key, ids.get(signature)];
			}),
		);
		const stable = new Set(next.values()).size === new Set(block.values()).size;
		block = next;
		if (stable) return { block, tokenOf };
	}
}

const ownLetters = (model) => model.events.flatMap((e) => lettersOf(e, guardLabels(model, e)));

function reachableStates(model) {
	const reached = new Set([model.initial]);
	const queue = [model.initial];
	while (queue.length) {
		const state = queue.shift();
		for (const letter of ownLetters(model))
			for (const o of outcomes(model, state, letter))
				if (o.move && model.states[o.move] && !reached.has(o.move)) reached.add(o.move), queue.push(o.move);
	}
	return reached;
}

// Expressions over declared finite variables: names, in(state, ...), literals
// (true, false, "text", integers), ==, !=, !, &&, ||, and parentheses. Parsed
// without eval. `in` is allowed only where the expression is read in a state.
export function parseExpression(source) {
	const tokens = [];
	const pattern = /\s*(?:(\|\||&&|==|!=|[!(),])|("(?:[^"\\]|\\.)*")|(-?\d+)|([A-Za-z_][\w]*))/y;
	let index = 0;
	while (index < source.length) {
		if (/^\s*$/.test(source.slice(index))) break;
		pattern.lastIndex = index;
		const match = pattern.exec(source);
		if (!match) throw new Error(`cannot read "${source.slice(index).trim()}"`);
		index = pattern.lastIndex;
		if (match[1]) tokens.push({ op: match[1] });
		else if (match[2]) tokens.push({ value: JSON.parse(match[2]) });
		else if (match[3]) tokens.push({ value: Number(match[3]) });
		else if (match[4] === "true" || match[4] === "false") tokens.push({ value: match[4] === "true" });
		else tokens.push({ name: match[4] });
	}
	let at = 0;
	const peek = (op) => tokens[at]?.op === op;
	const expect = (op) => {
		if (!peek(op)) throw new Error(`expected "${op}"`);
		at++;
	};
	const or = () => {
		let node = and();
		while (peek("||")) at++, (node = { op: "||", left: node, right: and() });
		return node;
	};
	const and = () => {
		let node = unary();
		while (peek("&&")) at++, (node = { op: "&&", left: node, right: unary() });
		return node;
	};
	const unary = () => {
		if (peek("!")) return at++, { op: "!", operand: unary() };
		const left = primary();
		if (peek("==") || peek("!=")) {
			const op = tokens[at++].op;
			let negations = 0;
			while (peek("!")) at++, negations++;
			let right = primary();
			for (let i = 0; i < negations; i++) right = { op: "!", operand: right };
			return { op, left, right };
		}
		return left;
	};
	const primary = () => {
		const token = tokens[at++];
		if (!token) throw new Error("unexpected end");
		if (token.op === "(") {
			const node = or();
			expect(")");
			return node;
		}
		if ("value" in token) return { value: token.value };
		if (token.name === "in" && peek("(")) {
			at++;
			const states = [];
			do {
				const state = tokens[at++];
				if (!state?.name) throw new Error("in(...) takes state names");
				states.push(state.name);
			} while (peek(",") && at++);
			expect(")");
			return { in: states };
		}
		if (token.name) return { name: token.name };
		throw new Error(`unexpected "${token.op}"`);
	};
	const tree = or();
	if (at !== tokens.length) throw new Error(`unexpected "${tokens[at].op ?? tokens[at].name ?? tokens[at].value}"`);
	return tree;
}

// Names, states, and literal comparisons an expression uses, for type checks.
function usesOf(node, uses = { names: new Set(), states: new Set(), comparisons: [] }) {
	if (node.name) uses.names.add(node.name);
	if (node.in) node.in.forEach((s) => uses.states.add(s));
	if (node.op === "==" || node.op === "!=") {
		if (node.left.name && "value" in node.right) uses.comparisons.push([node.left.name, node.right.value]);
		if (node.right.name && "value" in node.left) uses.comparisons.push([node.right.name, node.left.value]);
	}
	for (const child of [node.left, node.right, node.operand]) if (child) usesOf(child, uses);
	return uses;
}

function evaluate(node, valuation, state) {
	if ("value" in node) return node.value;
	if (node.name) return valuation[node.name];
	if (node.in) return node.in.includes(state);
	if (node.op === "!") return !evaluate(node.operand, valuation, state);
	if (node.op === "&&") return evaluate(node.left, valuation, state) && evaluate(node.right, valuation, state);
	if (node.op === "||") return evaluate(node.left, valuation, state) || evaluate(node.right, valuation, state);
	const [left, right] = [evaluate(node.left, valuation, state), evaluate(node.right, valuation, state)];
	return node.op === "==" ? left === right : left !== right;
}

const domainOf = (type) => (type === "bool" ? [false, true] : type);
const MAX_VALUATIONS = 100_000;

function valuationsOf(variables) {
	let result = [{}];
	for (const [name, type] of Object.entries(variables)) result = result.flatMap((v) => domainOf(type).map((value) => ({ ...v, [name]: value })));
	return result;
}

const show = (valuation) => Object.entries(valuation).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");

// Checks everything written as an expression: refinement, unreachable, guards,
// and invariants. Returns the expression-derived facts later checks need.
function checkData(model, reached, errors, warnings, found) {
	const before = errors.length;
	const failed = () => errors.length > before;
	const variables = model.variables ?? {};
	const states = Object.keys(model.states);
	const usedNames = new Set();
	for (const [name, type] of Object.entries(variables))
		if (type !== "bool" && !(Array.isArray(type) && type.length >= 2 && new Set(type).size === type.length))
			errors.push(`variables.${name}: must be "bool" or a list of two or more distinct values`);
	if (failed()) return;
	const compile = (source, at, { allowIn }) => {
		let tree;
		try {
			tree = parseExpression(String(source));
		} catch (error) {
			errors.push(`${at}: ${error.message}`);
			return null;
		}
		const uses = usesOf(tree);
		let ok = true;
		for (const name of uses.names) {
			usedNames.add(name);
			if (!(name in variables)) errors.push(`${at}: "${name}" is not a declared variable`), (ok = false);
		}
		for (const state of uses.states) if (!states.includes(state)) errors.push(`${at}: in(${state}) names no declared state`), (ok = false);
		if (uses.states.size && !allowIn) errors.push(`${at}: in(...) is not allowed here`), (ok = false);
		for (const [name, value] of uses.comparisons)
			if (name in variables && !domainOf(variables[name]).includes(value))
				errors.push(`${at}: ${JSON.stringify(value)} is not a value of ${name}`), (ok = false);
		return ok ? tree : null;
	};
	const truth = (tree, valuation, state, at) => {
		const value = evaluate(tree, valuation, state);
		if (typeof value !== "boolean") throw new Error(`${at}: does not evaluate to true or false`);
		return value;
	};

	const all = Object.keys(variables).length ? valuationsOf(variables) : [];
	if (all.length > MAX_VALUATIONS) return errors.push(`variables: ${all.length} combinations; abstract the domains further`);

	const unreachable = (model.unreachable ?? []).map((entry, i) => ({ entry, at: `unreachable[${i}]`, tree: entry.when !== undefined ? compile(entry.when, `unreachable[${i}].when`, { allowIn: false }) : null }));
	for (const { entry, at } of unreachable) {
		if (entry.when === undefined) continue;
		if (entry.by === "computed" && model.compiledFrom) continue;
		if (!["invariant", "assumption"].includes(entry.by)) errors.push(`${at}: by must be "invariant" (our code prevents it) or "assumption" (the outside never produces it)`);
		if (entry.by === "invariant" && !(model.invariants ?? []).some((i) => i.id === entry.invariant)) errors.push(`${at}: by invariant needs the id of a declared invariant`);
		if (entry.by === "assumption") {
			const assumption = (model.assumptions ?? []).find((a) => a.id === entry.assumption);
			if (!assumption) errors.push(`${at}: by assumption needs the id of a declared assumption`);
			else if (assumption.kind && assumption.kind !== "arrival") errors.push(`${at}: only an arrival assumption can make a combination impossible`);
			else if (assumption.status !== "verified") found(`unverified:${at}:${assumption.id}`, `${at}: rests on unverified ${assumption.id}`);
		}
	}
	const impossible = (valuation) => unreachable.some(({ tree }) => tree && truth(tree, valuation, null, "unreachable"));
	const possible = all.filter((v) => !impossible(v));

	const refinement = (model.refinement ?? []).map((entry, i) => ({ entry, tree: entry.when !== undefined ? compile(entry.when, `refinement[${i}].when`, { allowIn: false }) : null }));
	const mapped = refinement.filter((r) => r.tree);
	const stateOf = new Map();
	if (mapped.length && !failed()) {
		for (const valuation of all) {
			const matches = mapped.filter(({ tree }) => truth(tree, valuation, null, "refinement"));
			const targets = [...new Set(matches.map((m) => m.entry.state))];
			if (impossible(valuation)) {
				if (targets.length) errors.push(`refinement: ${show(valuation)} is listed unreachable but maps to ${targets.join(", ")}`);
			} else if (!targets.length) errors.push(`refinement: ${show(valuation)} maps to no state and is not listed unreachable`);
			else if (targets.length > 1) errors.push(`refinement: ${show(valuation)} maps to ${targets.join(" and ")}`);
			else stateOf.set(valuation, targets[0]);
		}
		for (const state of reached)
			if (![...stateOf.values()].includes(state)) errors.push(`refinement: no possible combination maps to reachable state ${state}`);
	}
	const valuationsIn = (state) => (stateOf.size ? possible.filter((v) => stateOf.get(v) === state) : possible);

	for (const [event, declared] of Object.entries(model.guards ?? {})) {
		if (Array.isArray(declared) || !declared || typeof declared !== "object") continue;
		const trees = Object.entries(declared).map(([label, source]) => [label, compile(source, `guards.${event}.${label}`, { allowIn: false })]);
		if (trees.some(([, tree]) => !tree) || !all.length) {
			if (!all.length) errors.push(`guards.${event}: guard expressions need declared variables`);
			continue;
		}
		for (const state of reached) {
			if (!Array.isArray(cellAt(model, state, event))) continue;
			const seen = new Set();
			for (const valuation of valuationsIn(state)) {
				const holding = trees.filter(([, tree]) => truth(tree, valuation, state, `guards.${event}`)).map(([label]) => label);
				holding.forEach((l) => seen.add(l));
				if (!holding.length) errors.push(`cells.${state}.${event}: no guard holds for ${show(valuation)}`);
				if (holding.length > 1) errors.push(`cells.${state}.${event}: guards ${holding.join(" and ")} both hold for ${show(valuation)}`);
			}
			for (const [label] of trees)
				if (!seen.has(label)) found(`dead-guard:${state}.${event}[${label}]`, `cells.${state}.${event}[${label}]: the guard never holds in ${state}; the branch is dead`);
		}
	}

	for (const invariant of model.invariants ?? []) {
		const at = `invariants.${invariant.id}`;
		const forms = ["holds", "refuses", "step"].filter((k) => invariant[k] !== undefined);
		if (!forms.length) {
			found(`text-invariant:${invariant.id}`, `${at}: written only as text; it is not checked`);
			continue;
		}
		if (invariant.holds !== undefined) {
			const tree = compile(invariant.holds, `${at}.holds`, { allowIn: true });
			const names = tree ? usesOf(tree).names : new Set();
			if (tree && names.size && !stateOf.size) errors.push(`${at}.holds: uses variables, so refinement entries need "when"`);
			else if (tree)
				for (const state of reached) {
					const failing = (names.size ? valuationsIn(state) : [{}]).find((v) => !truth(tree, v, state, at));
					if (failing) errors.push(`${at}: fails in ${state}${names.size ? ` for ${show(failing)}` : ""}`);
				}
		}
		if (invariant.refuses !== undefined) {
			const { event, when = "true" } = invariant.refuses;
			const tree = compile(when, `${at}.refuses.when`, { allowIn: true });
			if (model.without?.has(event)) continue;
			if (!model.events.includes(event)) errors.push(`${at}.refuses: "${event}" is not a declared event`);
			else if (tree && usesOf(tree).names.size && !stateOf.size) errors.push(`${at}.refuses.when: uses variables, so refinement entries need "when"`);
			else if (tree) {
				const guardTrees = Object.entries(model.guards?.[event] && !Array.isArray(model.guards[event]) ? model.guards[event] : {}).map(([label, source]) => [label, parseExpression(String(source))]);
				for (const state of reached) {
					const cell = cellAt(model, state, event);
					const combos = usesOf(tree).names.size ? valuationsIn(state) : [null];
					const failing = combos.find((v) => {
						if (!truth(tree, v ?? {}, state, at)) return false;
						let branches = Array.isArray(cell) ? cell : [cell];
						if (Array.isArray(cell) && v && guardTrees.length)
							branches = cell.filter((b) => guardTrees.some(([label, g]) => label === b.guard && evaluate(g, v, state) === true));
						return !branches.every((b) => plainKind(b) === "forbid");
					});
					if (failing !== undefined) errors.push(`${at}: ${event} is not refused in ${state}${failing ? ` for ${show(failing)}` : ""}`);
				}
			}
		}
		if (invariant.step !== undefined) {
			const { event, from = "true", to } = invariant.step;
			const fromTree = compile(from, `${at}.step.from`, { allowIn: true });
			const toTree = compile(to, `${at}.step.to`, { allowIn: true });
			if (model.without?.has(event)) continue;
			if (event !== "*" && !model.events.includes(event)) errors.push(`${at}.step: "${event}" is not a declared event`);
			else if (fromTree && toTree && (usesOf(fromTree).names.size || usesOf(toTree).names.size) && !stateOf.size)
				errors.push(`${at}.step: uses variables, so refinement entries need "when"`);
			else if (fromTree && toTree) {
				// With variables, `from` is read in the source state and `to` must hold for
				// every combination that maps to the target state.
				const combosOf = (tree, state) => (usesOf(tree).names.size ? valuationsIn(state) : [{}]);
				for (const state of reached) {
					if (!combosOf(fromTree, state).some((v) => truth(fromTree, v, state, at))) continue;
					for (const e of event === "*" ? model.events : [event]) {
						const cell = cellAt(model, state, e);
						for (const branch of Array.isArray(cell) ? cell : [cell])
							if (plainKind(branch) === "to" && !combosOf(toTree, branch.to).every((v) => truth(toTree, v, branch.to, at)))
								errors.push(`${at}: ${e} from ${state} goes to ${branch.to}`);
					}
				}
			}
		}
	}

	for (const name of Object.keys(variables)) if (!usedNames.has(name)) warnings.push(`variables.${name}: used by no expression`);
}

// Completeness checks after the table is closed: defaults, waiting states, traps,
// unused events, and where each kind of assumption may be used.
function checkCompleteness(model, reached, errors, warnings, found) {
	const states = Object.keys(model.states);
	const assumptions = new Map((model.assumptions ?? []).map((a) => [a.id, a]));
	for (const state of states) {
		const otherwise = model.states[state].otherwise;
		if (otherwise === undefined) continue;
		const kind = plainKind(otherwise);
		if (!(kind === "ignore" || (kind === "forbid" && otherwise.forbid === "assumption")))
			errors.push(`states.${state}.otherwise: may only be ignore or forbid by assumption`);
		for (const event of model.events)
			if (model.cells?.[state]?.[event] === undefined && !ownersOf(model, event).some((o) => o !== state) && model.sources?.[event] === "control")
				errors.push(`states.${state}.otherwise: fills the control ${event}; write that cell explicitly`);
	}
	for (const state of states)
		for (const event of model.events) {
			const cell = cellAt(model, state, event);
			for (const branch of Array.isArray(cell) ? cell : [cell]) {
				const assumption = branch?.forbid === "assumption" ? assumptions.get(branch.assumption) : null;
				if (assumption?.kind && assumption.kind !== "arrival") errors.push(`cells.${state}.${event}: only an arrival assumption can say an event does not arrive`);
			}
		}
	for (const entry of model.progress ?? []) {
		const assumption = assumptions.get(entry.assuming);
		if (entry.assuming !== undefined && assumption?.kind && assumption.kind !== "eventual")
			errors.push(`progress.${entry.id}: assuming must name an eventual assumption`);
	}

	const exits = (state) =>
		model.events.flatMap((event) => {
			const cell = cellAt(model, state, event);
			return (Array.isArray(cell) ? cell : [cell]).filter((b) => plainKind(b) === "to" && b.to !== state).map((b) => ({ event, to: b.to }));
		});
	for (const state of reached) {
		if (model.states[state].terminal) continue;
		const out = exits(state);
		// Waiting means every way out is the result of work the code started; a state
		// left by a person, a lifecycle event, or another component is resting.
		const waiting = out.length && out.every(({ event }) => model.sources?.[event] === "response");
		const covered =
			out.some(({ event }) => model.sources?.[event] === "timer") ||
			(model.progress ?? []).some((p) => p.states?.includes(state) && assumptions.has(p.assuming));
		if (waiting && !covered)
			found(`waiting:${state}`, `states.${state}: waits only on results of work; add a timer event, or a progress entry for this state that names an eventual assumption`);
	}
	// A closed group of states: once entered, no transition leads out of it, and it
	// holds neither the initial state nor a terminal one. Single states are already
	// reported as having no exit.
	const reachFrom = (start) => {
		const seen = new Set([start]);
		const queue = [start];
		while (queue.length) for (const { to } of exits(queue.shift())) if (!seen.has(to)) seen.add(to), queue.push(to);
		return seen;
	};
	const reported = new Set();
	for (const state of reached) {
		if (reported.has(state)) continue;
		const group = reachFrom(state);
		const closed = [...group].every((s) => reachFrom(s).has(state));
		if (!closed || group.size < 2 || group.has(model.initial) || [...group].some((s) => model.states[s].terminal || model.states[s].recurrent)) continue;
		group.forEach((s) => reported.add(s));
		found(`closed-group:${[...group].join("|")}`, `states ${[...group].join(", ")}: once entered, nothing leads out; mark one recurrent with the exit condition, or add the way out`);
	}
	for (const event of model.events)
		if (![...reached].some((s) => {
			const cell = cellAt(model, s, event);
			return (Array.isArray(cell) ? cell : [cell]).some((b) => plainKind(b) === "to" || plainKind(b) === "question");
		}))
			found(`never-changes:${event}`, `events.${event}: changes the state nowhere; it is outside the boundary or the table misses its transitions`);
}

function checkFlat(model) {
	const errors = [];
	const warnings = [];
	const questions = [];
	const findings = [];
	const found = (id, text) => findings.push({ id, text });
	const states = Object.keys(model.states ?? {});
	const events = model.events ?? [];
	const assumptions = new Map((model.assumptions ?? []).map((a) => [a.id, a]));

	if (!states.length) errors.push("states: none declared");
	if (!events.length) errors.push("events: none declared");
	if (new Set(events).size !== events.length) errors.push("events: duplicate names");
	if (!states.includes(model.initial)) errors.push(`initial: "${model.initial}" is not a declared state`);
	for (const state of Object.keys(model.cells ?? {}))
		if (!states.includes(state)) errors.push(`cells.${state}: not a declared state`);
	if (errors.length) return { errors, warnings, questions, findings };

	if (!model.sources) warnings.push("sources: not declared; refusals cannot be checked against who controls each event");
	for (const [event, source] of Object.entries(model.sources ?? {})) {
		if (!events.includes(event)) errors.push(`sources.${event}: not a declared event`);
		if (!SOURCES.includes(source)) errors.push(`sources.${event}: must be one of ${SOURCES.join(", ")}`);
	}
	for (const event of Object.keys(model.guards ?? {})) {
		const labels = guardLabels(model, event);
		if (!events.includes(event)) errors.push(`guards.${event}: not a declared event`);
		if (!labels || labels.length < 2 || new Set(labels).size !== labels.length) errors.push(`guards.${event}: needs two or more distinct labels`);
	}
	for (const state of states)
		for (const event of model.states[state].owns ?? []) {
			if (!events.includes(event)) errors.push(`states.${state}.owns: "${event}" is not a declared event`);
			else if (model.sources?.[event] === "control")
				errors.push(`states.${state}.owns: ${event} is a control; only results of work belong to an attempt`);
		}

	const edges = new Map(states.map((s) => [s, new Set()]));
	const checkPlain = (cell, at, event, state) => {
		const kind = plainKind(cell);
		if (!kind) return errors.push(`${at}: exactly one of ${KINDS.join(", ")} is required`);
		if (kind === "to") {
			if (!states.includes(cell.to)) errors.push(`${at}: target "${cell.to}" is not a declared state`);
			else edges.get(state).add(cell.to);
			if (cell.to === state && model.states[state].owns?.length && typeof cell.reenter !== "boolean")
				errors.push(`${at}: a self-transition in a state that owns an attempt must say reenter: true (restart the work) or false`);
		}
		if (kind === "ignore" && (typeof cell.ignore !== "string" || !cell.ignore)) errors.push(`${at}: say why the event is ignored`);
		if (kind === "forbid") {
			if (!["guarantee", "assumption"].includes(cell.forbid)) errors.push(`${at}: forbid must be "guarantee" or "assumption"`);
			if (cell.forbid === "guarantee" && model.sources?.[event] && model.sources[event] !== "control")
				errors.push(`${at}: only a control the code renders can be refused; a ${model.sources[event]} event can only be to, ignore, or forbid by assumption`);
			if (cell.forbid === "assumption" && !assumptions.has(cell.assumption)) errors.push(`${at}: forbid by assumption needs a declared assumption id`);
		}
		if (kind === "question") {
			questions.push(`${at}: ${cell.question}`);
			found(`question:${at.replace(/^cells\./, "")}`, `${at}: ${cell.question}`);
		}
	};

	for (const state of states) {
		for (const event of Object.keys(model.cells?.[state] ?? {})) {
			if (!events.includes(event)) errors.push(`cells.${state}.${event}: not a declared event`);
			const owners = ownersOf(model, event);
			if (owners.length && !owners.includes(state))
				errors.push(`cells.${state}.${event}: ${event} is a result of the attempt owned by ${owners.join(", ")}; leave this cell empty, the stale result is dropped`);
		}
		for (const event of events) {
			const at = `cells.${state}.${event}`;
			const cell = cellAt(model, state, event);
			if (cell === undefined) {
				errors.push(`${at}: empty cell; choose to, ignore, forbid, or question`);
				continue;
			}
			if (!Array.isArray(cell)) {
				checkPlain(cell, at, event, state);
				continue;
			}
			const labels = cell.map((b) => b?.guard);
			const declared = guardLabels(model, event);
			if (labels.some((l) => typeof l !== "string" || !l)) errors.push(`${at}: every branch needs a guard`);
			if (cell.length < 2) errors.push(`${at}: a guarded cell needs at least two branches`);
			if (declared) {
				const missing = declared.filter((l) => !labels.includes(l));
				const extra = labels.filter((l) => !declared.includes(l));
				if (missing.length || extra.length || new Set(labels).size !== labels.length)
					errors.push(`${at}: branches must use each guard of guards.${event} exactly once (${declared.join(", ")})`);
			} else warnings.push(`${at}: guards of ${event} are not declared; coverage cannot be checked and --compare is modulo guards`);
			if (declared && Array.isArray(model.guards[event]))
				warnings.push(`${at}: guards of ${event} have labels but no expressions; coverage and disjointness are not checked`);
			cell.forEach((branch, i) => checkPlain(branch, `${at}[${branch?.guard ?? i}]`, event, state));
		}
	}

	// Unreachable and dead-end states are findings about behavior, not a broken
	// table, so the later checks still run when they are the only errors.
	const tableErrors = errors.length;
	const reached = reachableStates(model);
	for (const state of states) {
		if (!reached.has(state)) found(`unreachable:${state}`, `states.${state}: unreachable from ${model.initial}`);
		const exits = [...edges.get(state)].filter((target) => target !== state);
		if (!model.states[state].terminal && !exits.length) found(`dead-end:${state}`, `states.${state}: non-terminal state with no exit`);
	}

	for (const invariant of model.invariants ?? [])
		for (const id of invariant.reliesOn ?? []) {
			const assumption = assumptions.get(id);
			if (!assumption) errors.push(`invariants.${invariant.id}: unknown assumption ${id}`);
			else if (assumption.status !== "verified") found(`unverified:${invariant.id}:${id}`, `invariants.${invariant.id}: not established; relies on unverified ${id}`);
		}
	for (const [id, assumption] of assumptions) {
		if (!["verified", "unverified"].includes(assumption.status)) errors.push(`assumptions.${id}: status must be "verified" or "unverified"`);
		if (assumption.kind !== undefined && !ASSUMPTION_KINDS.includes(assumption.kind))
			errors.push(`assumptions.${id}: kind must be one of ${ASSUMPTION_KINDS.join(", ")}`);
	}

	if (model.refinement) {
		const mapped = new Set();
		for (const entry of model.refinement) {
			if (!states.includes(entry.state)) errors.push(`refinement: "${entry.state}" is not a declared state`);
			else mapped.add(entry.state);
		}
		for (const state of states) if (!mapped.has(state)) warnings.push(`refinement: no implementation condition maps to ${state}`);
	}

	const open = () => errors.length === findingsEnd;
	const findingsEnd = errors.length;
	if (!tableErrors && open()) checkCompleteness(model, reached, errors, warnings, found);
	if (!tableErrors && open()) checkData(model, reached, errors, warnings, found);

	if (!tableErrors && open()) {
		const { block } = partition([{ tag: "M", model }], () => ownLetters(model));
		const groups = new Map();
		for (const state of states) {
			const id = block.get(`M:${state}`);
			groups.set(id, [...(groups.get(id) ?? []), state]);
		}
		for (const group of groups.values())
			if (group.length > 1)
				found(`same-states:${group.join("|")}`, `states ${group.join(", ")}: behave the same for every event; merge them, or the difference lives outside the table (display data)`);
		const plainEvents = events.filter((e) => !guardLabels(model, e));
		for (let i = 0; i < plainEvents.length; i++)
			for (let j = i + 1; j < plainEvents.length; j++) {
				const [x, y] = [plainEvents[i], plainEvents[j]];
				if ((model.sources?.[x] ?? "") !== (model.sources?.[y] ?? "")) continue;
				const signature = (event) => states.map((s) => JSON.stringify(outcomes(model, s, { event, label: null }))).join("|");
				if (signature(x) === signature(y))
					found(`same-events:${x}|${y}`, `events ${x}, ${y}: lead to the same cell in every state; one event is enough unless the outside must tell them apart`);
			}
	}
	return { errors, warnings, questions, findings };
}

export function checkModel(model) {
	const flats = prepare(model);
	const result = { errors: [], warnings: [], questions: [], findings: [] };
	for (const { name, model: flat } of flats) {
		const prefix = flats.length > 1 ? `[${name}] ` : "";
		const part = checkFlat(flat);
		for (const key of ["errors", "warnings", "questions"]) result[key].push(...part[key].map((line) => prefix + line));
		// A finding's id names the code fact it reports; variants other than base prefix it.
		result.findings.push(...part.findings.map((f) => ({ id: name === "base" ? f.id : `${name}:${f.id}`, text: prefix + f.text })));
	}
	return result;
}

// Bisimulation over the disjoint union of two flat models with the same events.
// Refusal, an assumed-absent event, and an open question are observations. A
// guarded cell is split by its guard labels when both models declare the same
// labels for that event, and compared by its set of outcomes otherwise.
function compareFlat(a, b) {
	const sameEvents = a.events.length === b.events.length && a.events.every((e) => b.events.includes(e));
	if (!sameEvents) {
		const onlyA = a.events.filter((e) => !b.events.includes(e));
		const onlyB = b.events.filter((e) => !a.events.includes(e));
		return {
			equivalent: false,
			verdict: "not equivalent",
			differences: [`event sets differ; only in A: [${onlyA}], only in B: [${onlyB}]. The boundary differs before the table does.`],
		};
	}
	let moduloGuards = false;
	const letters = [...a.events].sort().flatMap((event) => {
		const la = guardLabels(a, event);
		const lb = guardLabels(b, event);
		if (la && lb && la.length === lb.length && la.every((l) => lb.includes(l))) return lettersOf(event, [...la].sort());
		if ([a, b].some((m) => Object.keys(m.states).some((s) => Array.isArray(cellAt(m, s, event))))) moduloGuards = true;
		return lettersOf(event, null);
	});
	const { block, tokenOf } = partition([{ tag: "A", model: a }, { tag: "B", model: b }], () => letters);
	const equivalent = block.get(`A:${a.initial}`) === block.get(`B:${b.initial}`);
	if (equivalent) return { equivalent, verdict: moduloGuards ? "equivalent modulo guards" : "equivalent", differences: [] };

	// Shortest distinguishing scenarios: walk paired states breadth first and report
	// where the two models first show something different.
	const differences = [];
	const seen = new Set();
	const queue = [[a.initial, b.initial, []]];
	const describe = (model, state, letter) => JSON.stringify(cellAt(model, state, letter.event));
	while (queue.length && differences.length < 20) {
		const [sa, sb, path] = queue.shift();
		if (seen.has(`${sa}|${sb}`)) continue;
		seen.add(`${sa}|${sb}`);
		if (!!a.states[sa].terminal !== !!b.states[sb].terminal) {
			differences.push(`after [${path}]: A.${sa} terminal=${!!a.states[sa].terminal}, B.${sb} terminal=${!!b.states[sb].terminal}`);
			continue;
		}
		for (const letter of letters) {
			const oa = outcomes(a, sa, letter);
			const ob = outcomes(b, sb, letter);
			const at = `after [${path}] then ${letter.name}: A.${sa} ${describe(a, sa, letter)} vs B.${sb} ${describe(b, sb, letter)}`;
			if (oa.length === 1 && ob.length === 1 && oa[0].move && ob[0].move) {
				if (oa[0].reenter !== ob[0].reenter) differences.push(at);
				else queue.push([oa[0].move, ob[0].move, [...path, letter.name]]);
			} else if (tokenOf({ tag: "A", model: a, state: sa }, letter, block) !== tokenOf({ tag: "B", model: b, state: sb }, letter, block)) {
				differences.push(at);
			}
		}
	}
	return { equivalent, verdict: "not equivalent", differences };
}

export function compareModels(a, b) {
	const fa = new Map(prepare(a).map((v) => [v.name, v.model]));
	const fb = new Map(prepare(b).map((v) => [v.name, v.model]));
	// Variants are paired by the events they remove, so names need not match.
	const removed = (model, name) => JSON.stringify([...(model.variants?.[name]?.without ?? [])].sort());
	for (const name of [...fb.keys()]) {
		if (name === "base" || fa.has(name)) continue;
		const twin = [...fa.keys()].find((n) => n !== "base" && !fb.has(n) && removed(a, n) === removed(b, name));
		if (twin) fb.set(twin, fb.get(name)), fb.delete(name);
	}
	const names = [...new Set([...fa.keys(), ...fb.keys()])];
	const results = names.map((name) => {
		if (!fa.has(name) || !fb.has(name))
			return { name, equivalent: false, verdict: "not equivalent", differences: [`variant ${name} exists only in ${fa.has(name) ? "A" : "B"}`] };
		return { name, ...compareFlat(fa.get(name), fb.get(name)) };
	});
	const prefix = (r) => (names.length > 1 ? `[${r.name}] ` : "");
	const equivalent = results.every((r) => r.equivalent);
	const verdict = !equivalent ? "not equivalent" : results.some((r) => r.verdict !== "equivalent") ? "equivalent modulo guards" : "equivalent";
	return { equivalent, verdict, differences: results.flatMap((r) => r.differences.map((d) => prefix(r) + d)) };
}

// The canonical form keeps only behavior: per variant, the reachable states are
// minimized, events whose cells agree in every state are merged (their names
// joined with "+"), guarded events are split into EVENT[label] letters, and
// states are numbered S0, S1, ... in breadth-first order over sorted letters.
// Free text (reasons, question text, assumption ids) is dropped. The output is
// itself a valid input, and canonicalizing it again returns the same object.
const CANONICAL = "control-model-canonical/1";

function canonicalTable(model) {
	const letters = model.events.flatMap((event) => {
		const declared = guardLabels(model, event);
		if (declared) return lettersOf(event, [...declared].sort());
		const labels = Object.keys(model.states).flatMap((s) => {
			const cell = cellAt(model, s, event);
			return Array.isArray(cell) ? cell.map((b) => b.guard) : [];
		});
		return lettersOf(event, labels.length ? [...new Set(labels)].sort() : null);
	});
	const reached = [...reachableStates(model)];
	const sub = { ...model, states: Object.fromEntries(reached.map((s) => [s, model.states[s]])) };
	const { block } = partition([{ tag: "M", model: sub }], () => letters);
	const blockOf = (state) => block.get(`M:${state}`);
	const representative = new Map();
	for (const state of reached) if (!representative.has(blockOf(state))) representative.set(blockOf(state), state);
	const kindOf = (o) => (o.observe ? o.observe : o.reenter ? "reenter" : "move");
	const column = (letter) =>
		[...representative.entries()]
			.map(([id, state]) => `${id}:${outcomes(model, state, letter).map((o) => `${kindOf(o)}>${o.move ? blockOf(o.move) : ""}`).sort().join(",")}`)
			.sort()
			.join("|");
	const groups = new Map();
	for (const letter of letters) {
		const key = column(letter);
		groups.set(key, [...(groups.get(key) ?? []), letter]);
	}
	const merged = [...groups.values()].map((group) => ({ name: group.map((l) => l.name).sort().join("+"), letter: group[0] })).sort((a, b) => (a.name < b.name ? -1 : 1));
	const order = [blockOf(model.initial)];
	for (let i = 0; i < order.length; i++)
		for (const { letter } of merged)
			for (const o of outcomes(model, representative.get(order[i]), letter))
				if (o.move && !order.includes(blockOf(o.move))) order.push(blockOf(o.move));
	const nameOf = (id) => `S${order.indexOf(id)}`;
	const cellOf = (o, state) => {
		if (o.observe === "refused") return { forbid: "guarantee" };
		if (o.observe === "assumed-absent") return { forbid: "assumption" };
		if (o.observe) return { question: "?" };
		if (blockOf(o.move) === blockOf(state) && !o.reenter) return { ignore: "stay" };
		return o.reenter ? { reenter: true, to: nameOf(blockOf(o.move)) } : { to: nameOf(blockOf(o.move)) };
	};
	const states = {};
	const cells = {};
	for (const id of order) {
		const state = representative.get(id);
		states[nameOf(id)] = model.states[state].terminal ? { terminal: true } : {};
		cells[nameOf(id)] = {};
		for (const { name, letter } of merged) {
			const list = outcomes(model, state, letter).map((o) => cellOf(o, state));
			const unique = [...new Map(list.map((c) => [JSON.stringify(c), c])).values()].sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
			cells[nameOf(id)][name] = unique.length === 1 ? unique[0] : unique.map((c, i) => ({ guard: `g${i}`, ...c }));
		}
	}
	return { initial: "S0", events: merged.map((m) => m.name), states, cells };
}

export function canonicalize(model) {
	const tables = {};
	if (model.canonical === CANONICAL) for (const [key, table] of Object.entries(model.tables)) tables[key] = canonicalTable(table);
	else
		for (const { name, model: flat } of prepare(model)) {
			const without = name === "base" ? null : [...(model.variants[name].without ?? [])].sort();
			const key = without ? `without:${without.join(",")}` : "base";
			if (tables[key]) throw new Error(`variants ${name} and another remove the same events; a canonical table is keyed by the removed events`);
			tables[key] = canonicalTable(flat);
		}
	return { canonical: CANONICAL, tables: Object.fromEntries(Object.keys(tables).sort().map((k) => [k, tables[k]])) };
}

// Scenarios that catch a transition to the wrong state: one per leaf of a
// breadth-first testing tree, plus one per state that sends every event the
// state must not react to. The state is asserted after every step.
export function deriveScenarios(model) {
	const scenarios = [];
	const untested = [];
	for (const { name, model: flat } of prepare(model)) {
		const letters = flat.events.flatMap((event) => {
			const declared = guardLabels(flat, event);
			if (declared) return lettersOf(event, declared);
			const labels = Object.keys(flat.states).flatMap((s) => {
				const cell = cellAt(flat, s, event);
				return Array.isArray(cell) ? cell.map((b) => b.guard) : [];
			});
			return lettersOf(event, labels.length ? [...new Set(labels)] : null);
		});
		const branchOf = (state, letter) => {
			const cell = cellAt(flat, state, letter.event);
			return Array.isArray(cell) ? cell.find((b) => b.guard === letter.label) : cell;
		};
		const tag = name === "base" ? "" : `${name}:`;
		const prefix = new Map([[flat.initial, []]]);
		const queue = [flat.initial];
		const leaves = [];
		while (queue.length) {
			const state = queue.shift();
			let children = 0;
			for (const letter of letters) {
				const branch = branchOf(state, letter);
				if (plainKind(branch) !== "to" || (branch.to === state && branch.reenter !== true)) continue;
				children++;
				const path = [...prefix.get(state), { event: letter.name, expect: branch.to }];
				if (prefix.has(branch.to)) leaves.push(path);
				else prefix.set(branch.to, path), queue.push(branch.to);
			}
			if (!children && prefix.get(state).length) leaves.push(prefix.get(state));
		}
		leaves.forEach((steps, i) => scenarios.push({ id: `${tag}T${i + 1}`, variant: name, kind: "transitions", steps }));
		for (const [state, path] of prefix) {
			const stay = [];
			for (const letter of letters) {
				const branch = branchOf(state, letter);
				const kind = plainKind(branch);
				if (kind === "ignore" || (kind === "to" && branch.to === state && branch.reenter !== true))
					stay.push({ event: letter.name, expect: state, check: branch.stale ? "a late result of an ended attempt changes nothing" : "no state change" });
				else if (kind === "forbid" && branch.forbid === "guarantee")
					stay.push({ event: letter.name, expect: state, check: "the control is not offered; forcing the event changes nothing" });
				else if (kind === "forbid") untested.push(`${tag}${state}.${letter.name}: rests on assumption ${branch.assumption}; verify it, it is not a test`);
				else if (kind === "question") untested.push(`${tag}${state}.${letter.name}: open question ${branch.question}`);
			}
			if (stay.length) scenarios.push({ id: `${tag}S-${state}`, variant: name, kind: "stays", steps: [...path, ...stay] });
		}
	}
	return { scenarios, untested };
}

function load(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function main(argv) {
	const json = argv.includes("--json");
	const strict = argv.includes("--strict");
	const files = argv.filter((arg) => !arg.startsWith("--"));
	if (argv.includes("--compare")) {
		if (files.length !== 2) throw new Error("--compare needs exactly two model files");
		const result = compareModels(load(files[0]), load(files[1]));
		if (json) console.log(JSON.stringify(result, null, 2));
		else {
			console.log(result.equivalent ? `${result.verdict}: same behavior up to state names` : "not equivalent");
			for (const line of result.differences) console.log(`  - ${line}`);
		}
		return result.equivalent ? 0 : 1;
	}
	if (argv.includes("--canonical")) {
		if (files.length !== 1) throw new Error("--canonical needs exactly one model file");
		console.log(JSON.stringify(canonicalize(load(files[0])), null, 2));
		return 0;
	}
	if (argv.includes("--scenarios")) {
		if (files.length !== 1) throw new Error("--scenarios needs exactly one model file");
		console.log(JSON.stringify(deriveScenarios(load(files[0])), null, 2));
		return 0;
	}
	if (files.length !== 1)
		throw new Error("usage: check-control-model.mjs model.json [--strict] [--json] | --compare a.json b.json | --scenarios model.json | --canonical model.json");
	const result = checkModel(load(files[0]));
	if (json) console.log(JSON.stringify(result, null, 2));
	else {
		for (const [label, lines] of [["error", result.errors], ["warning", result.warnings]]) for (const line of lines) console.log(`${label}: ${line}`);
		for (const finding of result.findings) console.log(`finding ${finding.id}: ${finding.text}`);
		console.log(`${result.errors.length} errors, ${result.warnings.length} warnings, ${result.findings.length} findings (${result.questions.length} open questions)`);
	}
	const blocking = result.errors.length + (strict ? result.warnings.length + result.findings.length : 0);
	return blocking ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 2;
	}
}
