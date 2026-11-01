import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { checkModel, compareModels, deriveScenarios, parseExpression } from "../core/developing-features/scripts/check-control-model.mjs";

const exec = promisify(execFile);
const skill = join(repositoryRoot, "core/developing-features");
const script = join(skill, "scripts/check-control-model.mjs");
const lookupPath = join(repositoryRoot, "tests/fixtures/control-model/external-job-lookup.json");
const load = async (path) => JSON.parse(await readFile(path, "utf8"));
const lookup = async () => structuredClone(await load(lookupPath));

function rename(model, names) {
	const to = (state) => names[state] ?? state;
	const renameCell = (cell) => (Array.isArray(cell) ? cell.map((b) => renameCell(b)) : cell?.to ? { ...cell, to: to(cell.to) } : cell);
	return {
		...model,
		initial: to(model.initial),
		states: Object.fromEntries(Object.entries(model.states).map(([s, v]) => [to(s), v])),
		cells: Object.fromEntries(
			Object.entries(model.cells).map(([s, row]) => [to(s), Object.fromEntries(Object.entries(row).map(([e, c]) => [e, renameCell(c)]))]),
		),
	};
}

function resolved(model) {
	model.cells.lookingUp.JOB_EXPIRED = { to: "failed" };
	model.cells.succeeded.SUBMIT = { to: "lookingUp" };
	for (const state of ["unknown", "unknownNoRef", "rechecking"]) model.cells[state].RESET = { to: "idle" };
	model.assumptions[0].status = "verified";
	delete model.variants;
	return model;
}

// A two-state model whose FINISHED event is split by declared guards. The RESET
// control is offered only in done, which is what makes the two states observable.
function guarded(swap = false) {
	const branches = [
		{ guard: "valid", to: swap ? "idle" : "done" },
		{ guard: "invalid", to: swap ? "done" : "idle" },
	];
	return {
		initial: "idle",
		events: ["FINISHED", "RESET"],
		sources: { FINISHED: "response", RESET: "control" },
		guards: { FINISHED: ["valid", "invalid"] },
		states: { idle: {}, done: {} },
		cells: {
			idle: { FINISHED: branches, RESET: { forbid: "guarantee" } },
			done: { FINISHED: { ignore: "already done" }, RESET: { to: "idle" } },
		},
	};
}

test("the synthetic lookup surfaces its dead ends, the embedded trap, and its owner questions", async () => {
	const { errors, findings, questions } = checkModel(await lookup());
	assert.deepEqual(errors, []);
	const ids = (prefix) => findings.map((f) => f.id).filter((id) => id.startsWith(prefix) || id.includes(`:${prefix}`));
	assert.deepEqual(ids("dead-end:"), ["dead-end:unknownNoRef", "embedded:dead-end:succeeded", "embedded:dead-end:unknownNoRef"]);
	assert.ok(findings.some((f) => f.id === "unverified:I1:K1"));
	const questionIds = questions.filter((q) => q.startsWith("[base]")).map((q) => q.split(": ")[1].split(":")[0]);
	assert.deepEqual(questionIds, ["D2", "D1", "D3", "D3", "D3"]);
});

test("resolving the questions leaves only warnings about states and events that behave alike", async () => {
	const { errors, findings, questions } = checkModel(resolved(await lookup()));
	assert.deepEqual(errors, []);
	assert.deepEqual(questions, []);
	assert.deepEqual(
		findings.map((f) => f.id).sort(),
		["same-events:JOB_FAILED|JOB_EXPIRED", "same-events:RECHECK_PENDING|RECHECK_ERROR", "same-states:idle|succeeded|failed", "text-invariant:I1"].sort(),
	);
});

test("an empty cell and an unknown target are errors; an unreachable state is a finding", async () => {
	const model = await lookup();
	delete model.cells.failed.RESET;
	model.cells.idle.RESET = { to: "nowhere" };
	model.states.orphan = { terminal: true, otherwise: { ignore: "done" } };
	const { errors } = checkModel(model);
	assert.ok(errors.includes("[base] cells.failed.RESET: empty cell; choose to, ignore, forbid, or question"));
	assert.ok(errors.includes('[base] cells.idle.RESET: target "nowhere" is not a declared state'));
	assert.ok(checkModel(model).findings.some((f) => f.id === "unreachable:orphan"));
});

test("a forbid needs its kind, and only a rendered control can be refused", async () => {
	const model = await lookup();
	model.cells.idle.RECHECK = { forbid: true };
	model.cells.failed.RECHECK = { forbid: "assumption", assumption: "K9" };
	model.cells.lookingUp.DEADLINE = { forbid: "guarantee" };
	const { errors } = checkModel(model);
	assert.ok(errors.includes('[base] cells.idle.RECHECK: forbid must be "guarantee" or "assumption"'));
	assert.ok(errors.includes("[base] cells.failed.RECHECK: forbid by assumption needs a declared assumption id"));
	assert.ok(
		errors.includes(
			"[base] cells.lookingUp.DEADLINE: only a control the code renders can be refused; a response event can only be to, ignore, or forbid by assumption",
		),
	);
});

test("results of an attempt are dropped outside their owner and cannot be written there", async () => {
	const model = await lookup();
	model.cells.idle.JOB_COMPLETED = { ignore: "stale" };
	model.states.unknown.owns = ["RECHECK"];
	const { errors } = checkModel(model);
	assert.ok(
		errors.includes(
			"[base] cells.idle.JOB_COMPLETED: JOB_COMPLETED is a result of the attempt owned by lookingUp; leave this cell empty, the stale result is dropped",
		),
	);
	assert.ok(errors.includes("[base] states.unknown.owns: RECHECK is a control; only results of work belong to an attempt"));
});

test("a self-transition in an attempt owner must say whether it restarts the work", async () => {
	const model = await lookup();
	model.cells.lookingUp.SUBMIT = { to: "lookingUp" };
	assert.ok(
		checkModel(model).errors.includes(
			"[base] cells.lookingUp.SUBMIT: a self-transition in a state that owns an attempt must say reenter: true (restart the work) or false",
		),
	);
});

test("guarded cells must use the declared guards exactly once; undeclared guards only warn", () => {
	const model = guarded();
	model.cells.idle.FINISHED = [
		{ guard: "valid", to: "done" },
		{ guard: "late", to: "idle" },
	];
	assert.ok(checkModel(model).errors.includes("cells.idle.FINISHED: branches must use each guard of guards.FINISHED exactly once (valid, invalid)"));
	const undeclared = guarded();
	delete undeclared.guards;
	assert.ok(
		checkModel(undeclared).warnings.includes(
			"cells.idle.FINISHED: guards of FINISHED are not declared; coverage cannot be checked and --compare is modulo guards",
		),
	);
});

test("compare finds two models equivalent up to state names", async () => {
	const a = await lookup();
	const b = rename(a, { idle: "ready", lookingUp: "pending", unknown: "outcomeUnknown" });
	assert.deepEqual(compareModels(a, b), { equivalent: true, verdict: "equivalent", differences: [] });
});

test("compare reports the shortest local difference, not the path to it", async () => {
	const a = await lookup();
	const b = await lookup();
	b.cells.failed.SUBMIT = { forbid: "guarantee" };
	const { equivalent, differences } = compareModels(a, b);
	assert.equal(equivalent, false);
	assert.match(differences[0], /^\[base\] after \[SUBMIT,JOB_FAILED\] then SUBMIT: A\.failed \{"to":"lookingUp"\} vs B\.failed \{"forbid":"guarantee"\}/);
});

test("compare keeps refusal, assumption, and ignore apart, but not a plain self-loop and ignore", async () => {
	const a = await lookup();
	const refused = await lookup();
	refused.cells.idle.RESET = { forbid: "guarantee" };
	assert.equal(compareModels(a, refused).equivalent, false);
	const assumed = await lookup();
	assumed.cells.idle.RECHECK = { forbid: "assumption", assumption: "K1" };
	assert.equal(compareModels(a, assumed).equivalent, false);
	const selfLoop = await lookup();
	selfLoop.cells.idle.RESET = { to: "idle" };
	assert.deepEqual(compareModels(a, selfLoop), { equivalent: true, verdict: "equivalent", differences: [] });
});

test("compare splits declared guards, so swapped guards differ; undeclared guards are modulo guards", () => {
	assert.equal(compareModels(guarded(), guarded(true)).equivalent, false);
	const [plain, swapped] = [guarded(), guarded(true)];
	delete plain.guards;
	delete swapped.guards;
	assert.equal(compareModels(plain, swapped).verdict, "equivalent modulo guards");
});

test("compare names a different event boundary and compares each variant", async () => {
	const a = await lookup();
	const fewer = await lookup();
	fewer.events = fewer.events.filter((e) => e !== "RECHECK_PENDING");
	assert.match(compareModels(a, fewer).differences[0], /event sets differ; only in A: \[RECHECK_PENDING\]/);
	const noVariant = await lookup();
	delete noVariant.variants;
	assert.deepEqual(compareModels(a, noVariant).differences, ["[embedded] variant embedded exists only in A"]);
});

test("scenarios cover every transition and every refusal, and set aside assumptions and questions", async () => {
	const model = resolved(await lookup());
	model.cells.idle.RECHECK = { forbid: "assumption", assumption: "K1" };
	const { scenarios, untested } = deriveScenarios(model);
	const transitionSteps = scenarios.filter((s) => s.kind === "transitions").flatMap((s) => s.steps);
	for (const [state, row] of Object.entries(model.cells))
		for (const [event, cell] of Object.entries(row)) {
			if (cell.to && cell.to !== state)
				assert.ok(transitionSteps.some((s) => s.event === event && s.expect === cell.to), `${state}.${event}`);
			if (cell.forbid === "guarantee")
				assert.ok(
					scenarios.some((s) => s.id === `S-${state}` && s.steps.some((x) => x.event === event && x.check?.startsWith("the control is not offered"))),
					`${state}.${event}`,
				);
		}
	assert.ok(scenarios.find((s) => s.id === "S-idle").steps.some((x) => x.event === "JOB_COMPLETED" && x.check.startsWith("a late result")));
	assert.deepEqual(untested, ["idle.RECHECK: rests on assumption K1; verify it, it is not a test"]);
});

// A small model whose START guard is written as expressions over variables.
function expressed(notReady = "!ready") {
	return {
		initial: "idle",
		events: ["START", "DONE", "RESET"],
		sources: { START: "control", DONE: "response", RESET: "control" },
		variables: { ready: "bool", retries: [0, 1, 2] },
		guards: { START: { ready: "ready", notReady } },
		states: { idle: {}, working: { owns: ["DONE"] } },
		cells: {
			idle: { START: [{ guard: "ready", to: "working" }, { guard: "notReady", forbid: "guarantee" }], RESET: { forbid: "guarantee" } },
			working: { START: { forbid: "guarantee" }, DONE: { to: "idle" }, RESET: { to: "idle" } },
		},
	};
}

test("every combination of the declared variables maps to exactly one state or is listed unreachable", async () => {
	const gap = resolved(await lookup());
	gap.unreachable.pop();
	assert.ok(checkModel(gap).errors.some((e) => /^refinement: busy=false, recovering=false, result=true, failure="other" maps to no state/.test(e)));
	const overlap = resolved(await lookup());
	overlap.refinement[0].when = "!busy && !recovering && !result";
	assert.ok(checkModel(overlap).errors.some((e) => / maps to idle and failed$/.test(e)));
	const both = resolved(await lookup());
	both.unreachable.push({ when: "!busy && recovering && failure == \"review\" && !result", reason: "wrong", by: "invariant", invariant: "I2" });
	assert.ok(checkModel(both).errors.some((e) => e.includes("is listed unreachable but maps to rechecking")));
});

test("holds, refuses, and step invariants are checked over every reachable state", async () => {
	const model = resolved(await lookup());
	model.invariants.find((i) => i.id === "I5").holds = "busy == in(idle)";
	model.cells.unknown.SUBMIT = { to: "lookingUp" };
	model.cells.failed.RESET = { to: "failed" };
	const { errors } = checkModel(model);
	assert.ok(errors.some((e) => e.startsWith("invariants.I5: fails in idle for busy=false")));
	assert.ok(errors.includes("invariants.I3: SUBMIT is not refused in unknown"));
	assert.ok(errors.includes("invariants.I4: RESET from failed goes to failed"));
});

test("guard expressions must cover every combination in the state and never overlap", () => {
	const gap = checkModel(expressed("!ready && retries == 0"));
	assert.ok(gap.errors.includes("cells.idle.START: no guard holds for ready=false, retries=1"));
	const overlap = checkModel(expressed("!ready || retries == 2"));
	assert.ok(overlap.errors.includes("cells.idle.START: guards ready and notReady both hold for ready=true, retries=2"));
	const clean = checkModel(expressed());
	assert.deepEqual(clean.errors, []);
	assert.ok(clean.warnings.includes("variables.retries: used by no expression"));
});

test("expressions name declared variables, values, and states only where allowed", async () => {
	const model = resolved(await lookup());
	model.refinement[0].when = "!busy && in(idle)";
	model.refinement[1].when = "pending";
	model.unreachable[0].when = "failure == \"lost\"";
	const { errors } = checkModel(model);
	assert.ok(errors.includes("refinement[0].when: in(...) is not allowed here"));
	assert.ok(errors.includes('refinement[1].when: "pending" is not a declared variable'));
	assert.ok(errors.includes('unreachable[0].when: "lost" is not a value of failure'));
});

test("otherwise has one fixed meaning and never fills a control", async () => {
	const model = resolved(await lookup());
	delete model.cells.failed.SUBMIT;
	model.states.failed.otherwise = { ignore: "quiet" };
	model.states.succeeded.otherwise = { to: "idle" };
	const { errors } = checkModel(model);
	assert.ok(errors.includes("states.failed.otherwise: fills the control SUBMIT; write that cell explicitly"));
	assert.ok(errors.includes("states.succeeded.otherwise: may only be ignore or forbid by assumption"));
});

test("a state that only waits on the outside needs a timer or a progress assumption", async () => {
	const model = resolved(await lookup());
	model.cells.lookingUp.RESET = { forbid: "guarantee" };
	assert.ok(!checkModel(model).findings.some((f) => f.id === "waiting:lookingUp"));
	model.progress = [];
	assert.ok(checkModel(model).findings.some((f) => f.id === "waiting:lookingUp"));
});

test("closed groups, unused events, and misused assumption kinds are reported", async () => {
	const model = resolved(await lookup());
	for (const state of ["unknown", "unknownNoRef", "rechecking"]) model.cells[state].RESET = { forbid: "guarantee" };
	model.cells.unknownNoRef.RECHECK = { to: "rechecking" };
	model.events.push("PING");
	model.sources.PING = "external";
	for (const state of Object.keys(model.states)) model.cells[state].PING = { ignore: "heartbeat" };
	model.cells.idle.RECHECK = { forbid: "assumption", assumption: "K1" };
	model.progress[0].assuming = "K1";
	const { errors } = checkModel(model);
	assert.ok(errors.includes("cells.idle.RECHECK: only an arrival assumption can say an event does not arrive"));
	assert.ok(errors.includes("progress.P1: assuming must name an eventual assumption"));
	model.cells.idle.RECHECK = { forbid: "guarantee" };
	model.progress[0].assuming = "K2";
	model.cells.rechecking.RECHECK_COMPLETED = { to: "unknown" };
	model.cells.rechecking.RECHECK_FAILED = { to: "unknown" };
	const after = checkModel(model);
	assert.ok(after.findings.some((f) => f.id === "closed-group:unknown|rechecking"));
	assert.ok(after.findings.some((f) => f.id === "never-changes:PING"));
});

test("an invariant about an event a variant removes is skipped in that variant", async () => {
	const model = resolved(await lookup());
	model.variants = { embedded: { without: ["RESET"] } };
	assert.ok(!checkModel(model).errors.some((e) => e.includes("I4")));
});

test("a dead end does not stop the later checks, so nobody has to hide it to see them", async () => {
	const model = await lookup();
	model.invariants.find((i) => i.id === "I5").holds = "busy == in(idle)";
	const { errors, findings } = checkModel(model);
	assert.ok(findings.some((f) => f.id === "dead-end:unknownNoRef"));
	assert.ok(errors.some((e) => e.startsWith("[base] invariants.I5: fails in idle")));
});

test("variants pair by the events they remove when their names differ", async () => {
	const a = await lookup();
	const b = await lookup();
	b.variants = { contextual: b.variants.embedded };
	assert.deepEqual(compareModels(a, b), { equivalent: true, verdict: "equivalent", differences: [] });
});

test("a negation may follow == or !=", () => {
	assert.deepEqual(parseExpression("active == !in(idle)"), { op: "==", left: { name: "active" }, right: { op: "!", operand: { in: ["idle"] } } });
});

test("refuses.when may test variables and follows the guard that holds", () => {
	const model = expressed();
	model.invariants = [{ id: "I1", text: "no start unless ready", refuses: { event: "START", when: "!ready" } }];
	model.refinement = [
		{ when: "!busy", state: "idle" },
		{ when: "busy", state: "working" },
	];
	model.variables.busy = "bool";
	model.guards.START.notReady = "!ready";
	assert.deepEqual(checkModel(model).errors, []);
	model.invariants[0].refuses.when = "ready";
	assert.ok(checkModel(model).errors.some((e) => e.startsWith("invariants.I1: START is not refused in idle for ")));
});

test("a state left only by a person or a lifecycle event is resting, not waiting", () => {
	const model = {
		initial: "idle",
		events: ["CONFIRMED", "DONE", "UNMOUNT"],
		sources: { CONFIRMED: "external", DONE: "response", UNMOUNT: "lifecycle" },
		states: { idle: {}, working: { owns: ["DONE"] }, gone: { terminal: true } },
		cells: {
			idle: { CONFIRMED: { to: "working" }, UNMOUNT: { to: "gone" } },
			working: { CONFIRMED: { ignore: "busy" }, DONE: { to: "idle" }, UNMOUNT: { to: "gone" } },
			gone: { CONFIRMED: { ignore: "gone" }, UNMOUNT: { ignore: "gone" } },
		},
	};
	assert.ok(!checkModel(model).findings.some((f) => f.id === "waiting:idle"));
	model.cells.working.UNMOUNT = { forbid: "assumption", assumption: "K1" };
	model.assumptions = [{ id: "K1", kind: "arrival", text: "no unmount mid-run", status: "verified" }];
	assert.ok(checkModel(model).findings.some((f) => f.id === "waiting:working"));
});

test("the command exits 1 only on errors, and with --strict also on findings", async () => {
	const clean = resolved(await lookup());
	const dir = await mkdtemp(join(tmpdir(), "control-model-"));
	const broken = { ...clean, cells: { ...clean.cells, failed: { ...clean.cells.failed, RESET: undefined } } };
	await writeFile(join(dir, "clean.json"), JSON.stringify(clean));
	await writeFile(join(dir, "broken.json"), JSON.stringify(broken));
	await exec(process.execPath, [script, join(dir, "clean.json")]);
	await assert.rejects(exec(process.execPath, [script, join(dir, "clean.json"), "--strict"]), (error) => error.code === 1);
	await assert.rejects(exec(process.execPath, [script, join(dir, "broken.json")]), (error) => error.code === 1);
});
