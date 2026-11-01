// Seeded property tests for the canonical form. No model calls; every run sees
// the same generated tables, so a failure is reproducible from its seed.
import assert from "node:assert/strict";
import test from "node:test";

import { canonicalize, compareModels } from "../core/developing-features/scripts/check-control-model.mjs";

const RUNS = 300;

function prng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function plainCell(rng, states) {
	const r = rng();
	if (r < 0.4) return { to: pick(rng, states) };
	if (r < 0.55) return { ignore: "stays" };
	if (r < 0.8) return { forbid: "guarantee" };
	if (r < 0.92) return { forbid: "assumption", assumption: "K1" };
	return { question: "D1" };
}

function generate(seed) {
	const rng = prng(seed);
	const states = Array.from({ length: 2 + Math.floor(rng() * 5) }, (_, i) => `q${i}`);
	const events = Array.from({ length: 1 + Math.floor(rng() * 4) }, (_, i) => `E${i}`);
	const guards = {};
	for (const event of events) if (rng() < 0.3) guards[event] = ["a", "b"];
	const cells = {};
	for (const state of states) {
		cells[state] = {};
		for (const event of events)
			cells[state][event] =
				guards[event] && rng() < 0.5 ? guards[event].map((guard) => ({ guard, ...plainCell(rng, states) })) : plainCell(rng, states);
	}
	// Make every state reachable most of the time, so behavior is not trivially one state.
	for (let i = 1; i < states.length; i++)
		if (rng() < 0.85) cells[states[Math.floor(rng() * i)]][pick(rng, events)] = { to: states[i] };
	const model = { initial: "q0", events, states: Object.fromEntries(states.map((s) => [s, rng() < 0.15 ? { terminal: true } : {}])), cells };
	if (Object.keys(guards).length) model.guards = guards;
	return model;
}

const mapCells = (model, f) => ({
	...model,
	cells: Object.fromEntries(Object.entries(model.cells).map(([s, row]) => [s, Object.fromEntries(Object.entries(row).map(([e, c]) => [e, Array.isArray(c) ? c.map((b) => f(b, s, e)) : f(c, s, e)]))])),
});

const transforms = {
	renameStates(model, rng) {
		const names = Object.fromEntries(Object.keys(model.states).map((s) => [s, `x${Math.floor(rng() * 1e6)}_${s}`]));
		const renamed = mapCells(model, (c) => (c.to ? { ...c, to: names[c.to] } : c));
		return {
			...renamed,
			initial: names[model.initial],
			states: Object.fromEntries(Object.entries(model.states).map(([s, v]) => [names[s], v])),
			cells: Object.fromEntries(Object.entries(renamed.cells).map(([s, row]) => [names[s], row])),
		};
	},
	shuffleKeys(model, rng) {
		const shuffle = (list) => list.map((x) => [rng(), x]).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
		return {
			...model,
			events: shuffle(model.events),
			states: Object.fromEntries(shuffle(Object.entries(model.states))),
			cells: Object.fromEntries(shuffle(Object.entries(model.cells)).map(([s, row]) => [s, Object.fromEntries(shuffle(Object.entries(row)))])),
		};
	},
	duplicateState(model, rng) {
		const source = pick(rng, Object.keys(model.states));
		const copy = `${source}_copy`;
		const redirected = mapCells(model, (c) => (c.to === source && rng() < 0.5 ? { ...c, to: copy } : c));
		const row = structuredClone(redirected.cells[source]);
		return { ...redirected, states: { ...model.states, [copy]: { ...model.states[source] } }, cells: { ...redirected.cells, [copy]: row } };
	},
	swapIgnoreAndSelfLoop(model, rng) {
		return mapCells(model, (c, s) => {
			if (c.ignore && rng() < 0.5) return { ...(c.guard ? { guard: c.guard } : {}), to: s };
			if (c.to === s && rng() < 0.5) return { ...(c.guard ? { guard: c.guard } : {}), ignore: "was a self-loop" };
			return c;
		});
	},
	addUnreachableState(model, rng) {
		const states = Object.keys(model.states);
		return {
			...model,
			states: { ...model.states, orphan: {} },
			cells: { ...model.cells, orphan: Object.fromEntries(model.events.map((e) => [e, { to: pick(rng, states) }])) },
		};
	},
	nameVariantDifferently(model, rng) {
		return { ...model, variants: { [`mode${Math.floor(rng() * 1e6)}`]: { without: [model.events[0]] } } };
	},
};

const canonical = (model) => JSON.stringify(canonicalize(model));

test("canonicalizing a canonical form changes nothing", () => {
	for (let seed = 1; seed <= RUNS; seed++) {
		const once = canonicalize(generate(seed));
		assert.deepEqual(canonicalize(once), once, `seed ${seed}`);
	}
});

for (const [name, transform] of Object.entries(transforms))
	test(`the canonical form does not change under ${name}`, () => {
		for (let seed = 1; seed <= RUNS; seed++) {
			const model = generate(seed);
			const base = name === "nameVariantDifferently" ? transforms.nameVariantDifferently(model, prng(seed * 7)) : model;
			assert.equal(canonical(transform(base, prng(seed * 31))), canonical(base), `seed ${seed}`);
		}
	});

test("equal canonical forms and --compare agree on single-cell mutants", () => {
	let differing = 0;
	for (let seed = 1; seed <= RUNS; seed++) {
		const model = generate(seed);
		const rng = prng(seed * 13);
		const mutant = structuredClone(model);
		const state = pick(rng, Object.keys(model.states));
		const event = pick(rng, model.events);
		mutant.cells[state][event] = plainCell(rng, Object.keys(model.states));
		const same = canonical(model) === canonical(mutant);
		assert.equal(compareModels(model, mutant).equivalent, same, `seed ${seed}`);
		if (!same) differing++;
	}
	assert.ok(differing > RUNS / 3, `mutants should usually change behavior (${differing}/${RUNS})`);
});
