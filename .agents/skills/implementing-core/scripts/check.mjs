#!/usr/bin/env node
// Deterministic checks between core specs and their host implementations. No model calls.
//   node check.mjs          fail when an implementation is stale, a copy differs from core,
//                           a scenario has no eval case or its case does not carry the
//                           scenario's request, a Codex benchmark's successChecklist is not
//                           the scenario's check ids, a Claude regex grader differs from its
//                           file_matches / file_lacks check, a skill's description differs
//                           from its spec, or a scenario's golden result does not prove its checks
//   node check.mjs --sync   copy core resources into implementations, write each Codex
//                           benchmark's successChecklist and each Claude case's regex graders,
//                           and record spec hashes
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { parse } from "yaml";

import { checkScenario } from "./scenario-check.mjs";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const hosts = ["claude", "codex"];
const sync = process.argv.includes("--sync");
// While writing a spec: prove its scenarios without requiring implementations yet.
const scenariosOnly = process.argv.includes("--scenarios-only");

// Text an eval case gives the model: its Markdown as written and every string in its JSON,
// from the case file itself or the files directly in the case directory (not fixtures).
function caseText(path) {
	const strings = (v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
	const paths = statSync(path).isDirectory()
		? readdirSync(path).map((name) => join(path, name)).filter((f) => statSync(f).isFile())
		: [path];
	return paths.flatMap((f) => {
		const text = readFileSync(f, "utf8");
		if (f.endsWith(".md")) return [text];
		if (f.endsWith(".json")) return strings(JSON.parse(text));
		return [];
	}).join("\n").replace(/\s+/g, " ");
}

// The description a spec gives in §1 (the blockquote after "설명문"), as one line. A line
// that ends in a hyphen continues the word on the next line.
function specDescription(core) {
	const quote = /설명문[^\n]*\n\n((?:> [^\n]*\n?)+)/.exec(readFileSync(join(core, "SPEC.md"), "utf8"))?.[1];
	if (!quote) return null;
	return quote.trim().split("\n").map((line) => line.slice(2).trim())
		.reduce((text, line) => (text.endsWith("-") ? text + line : `${text} ${line}`)).replace(/\s+/g, " ");
}

function files(dir, base = dir) {
	return readdirSync(dir).sort().flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path, base) : [relative(base, path)];
	});
}

function specHash(dir) {
	const hash = createHash("sha256");
	for (const file of files(dir)) hash.update(file).update("\0").update(readFileSync(join(dir, file))).update("\0");
	return hash.digest("hex").slice(0, 16);
}

function sameTree(a, b) {
	if (!existsSync(b)) return false;
	if (statSync(a).isFile()) return statSync(b).isFile() && readFileSync(a).equals(readFileSync(b))
		&& (statSync(a).mode & 0o111) === (statSync(b).mode & 0o111);
	const left = files(a), right = files(b);
	return left.length === right.length && left.every((f, i) => f === right[i] && sameTree(join(a, f), join(b, f)));
}

// A Claude eval case grades each file_matches / file_lacks check of its scenario with a regex
// grader of the same id (references/claude.md). --sync writes these graders from scenario.yaml
// and removes the ones whose check is gone; other graders (tool_used, file_exists, the
// SCENARIO_CHECK.txt regexes of code-based checks) stay hand-written. A grader counts as
// current when its frontmatter means the same, so either quoting style passes.
const graderData = (text) => parse(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "") ?? {};
const sameGrader = (a, b) => isDeepStrictEqual({ ...a, flags: a.flags || undefined }, { ...b, flags: b.flags || undefined });
function regexGrader(check) {
	const { path, pattern, flags } = check.file_matches ?? check.file_lacks;
	return ["---", 'type: "regex"', `target: { source: "file", path: ${JSON.stringify(path)} }`, `pattern: ${JSON.stringify(pattern)}`,
		...(flags ? [`flags: ${JSON.stringify(flags)}`] : []), ...(check.file_lacks ? ['match: "not_contains"'] : []), "---", ""].join("\n");
}
function syncRegexGraders(dir, scenario, name) {
	const problems = [];
	const want = new Map(scenario.expect.filter((c) => c.file_matches || c.file_lacks).map((c) => [`${c.id}.md`, regexGrader(c)]));
	for (const file of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : []) {
		const data = graderData(readFileSync(join(dir, file), "utf8"));
		if (data.type !== "regex" || data.target?.path === "SCENARIO_CHECK.txt" || want.has(file)) continue;
		if (sync) rmSync(join(dir, file));
		else problems.push(`claude: ${relative(root, join(dir, file))} grades no file_matches/file_lacks check of ${name}; run check.mjs --sync`);
	}
	for (const [file, text] of want) {
		const path = join(dir, file);
		if (existsSync(path) && sameGrader(graderData(readFileSync(path, "utf8")), graderData(text))) continue;
		if (sync) writeFileSync(path, text);
		else problems.push(`claude: ${relative(root, path)} differs from its check in ${name}; run check.mjs --sync`);
	}
	return problems;
}

// The reviewed state of a scenario: base with change.patch applied.
function changedTree(scenarioDir, spec) {
	const dir = mkdtempSync(join(tmpdir(), "core-scenario-"));
	cpSync(join(scenarioDir, spec.base), dir, { recursive: true });
	if (spec.change) {
		const git = (...args) => execFileSync("git", ["-c", "user.name=check", "-c", "user.email=check@example.invalid", ...args], { cwd: dir, stdio: "pipe" });
		git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "base");
		git("apply", join(scenarioDir, spec.change));
		rmSync(join(dir, ".git"), { recursive: true, force: true });
	}
	return dir;
}

function proveScenario(id, scenarioDir) {
	const spec = parse(readFileSync(join(scenarioDir, "scenario.yaml"), "utf8"));
	assert.equal(spec.id, id, `${scenarioDir}: id matches directory`);
	const baseline = changedTree(scenarioDir, spec);
	const scratch = [baseline];
	try {
		const copy = () => { const d = mkdtempSync(join(tmpdir(), "core-run-")); scratch.push(d); cpSync(baseline, d, { recursive: true }); return d; };
		const yamlPath = join(scenarioDir, "scenario.yaml");
		assert.ok(checkScenario(yamlPath, copy(), baseline).some((r) => !r.passed), `${id}: the untouched workspace must fail`);
		const golden = copy();
		cpSync(join(scenarioDir, "golden"), golden, { recursive: true });
		const failing = checkScenario(yamlPath, golden, baseline).filter((r) => !r.passed).map((r) => r.id);
		assert.deepEqual(failing, [], `${id}: the golden result must pass`);
		for (const e of spec.expect.filter((x) => x.file_lacks)) {
			const wrong = copy();
			cpSync(join(scenarioDir, "golden"), wrong, { recursive: true });
			const term = e.file_lacks.pattern.split("]*").pop().replace(/[\\()|]/g, " ").trim();
			writeFileSync(join(wrong, e.file_lacks.path), `${readFileSync(join(wrong, e.file_lacks.path), "utf8")}[P1] ${term} is wrong — src/x.js:1\n`);
			assert.equal(checkScenario(yamlPath, wrong, baseline).find((r) => r.id === e.id).passed, false, `${id}: ${e.id} must reject a flagged non-defect`);
		}
	} finally {
		for (const d of scratch) rmSync(d, { recursive: true, force: true });
	}
}

const problems = [];
// core/shared/ holds knowledge several capabilities use; a change there makes every
// implementation stale, because the hash covers it too.
const capabilities = readdirSync(join(root, "core")).filter((id) => existsSync(join(root, "core", id, "SPEC.md"))).sort();
for (const id of capabilities) {
	const core = join(root, "core", id);
	const scenarios = readdirSync(join(core, "scenarios")).sort();
	if (!sync) for (const s of scenarios) {
		try { proveScenario(s, join(core, "scenarios", s)); } catch (error) { problems.push(error.message); }
	}
	for (const host of scenariosOnly ? [] : hosts) {
		const recordPath = join(root, host, "IMPLEMENTS.json");
		const record = JSON.parse(readFileSync(recordPath, "utf8"));
		const entry = record[id];
		if (!entry) { problems.push(`${host}: core/${id} is not implemented`); continue; }
		for (const [from, to] of Object.entries(entry.copies ?? {})) {
			for (const s of from.includes("{scenario}") ? scenarios : [null]) {
				const src = join(core, s ? from.replaceAll("{scenario}", s) : from);
				const dst = join(root, host, s ? to.replaceAll("{scenario}", s) : to);
				if (sync) { rmSync(dst, { recursive: true, force: true }); cpSync(src, dst, { recursive: true }); }
				else if (!sameTree(src, dst)) problems.push(`${host}: ${relative(root, dst)} differs from ${relative(root, src)}`);
			}
		}
		for (const s of scenarios) {
			const evalDir = join(root, host, entry.evals.replaceAll("{scenario}", s));
			if (!existsSync(evalDir)) { problems.push(`${host}: no eval case for core/${id} scenario ${s}`); continue; }
			const scenario = parse(readFileSync(join(core, "scenarios", s, "scenario.yaml"), "utf8"));
			const request = scenario.request.replace(/\s+/g, " ").trim();
			if (!caseText(evalDir).includes(request)) problems.push(`${host}: ${relative(root, evalDir)} does not carry the request of core/${id} scenario ${s} word for word`);
			// A plugin-eval benchmark lists the scenario's check ids, in order, as its successChecklist;
			// --sync writes them from scenario.yaml, so they are never copied by hand.
			if (evalDir.endsWith("benchmark.json")) {
				const ids = scenario.expect.map((check) => check.id);
				const config = JSON.parse(readFileSync(evalDir, "utf8"));
				if (config.scenarios.some((x) => JSON.stringify(x.successChecklist) !== JSON.stringify(ids))) {
					if (sync) {
						for (const x of config.scenarios) x.successChecklist = ids;
						writeFileSync(evalDir, JSON.stringify(config, null, 2) + "\n");
					} else problems.push(`${host}: ${relative(root, evalDir)} successChecklist differs from the check ids of core/${id} scenario ${s}; run check.mjs --sync`);
				}
			}
			if (evalDir.endsWith("prompt.md")) problems.push(...syncRegexGraders(join(dirname(evalDir), "graders"), scenario, `core/${id} scenario ${s}`));
		}
		const triggersFile = join(core, "triggers.yaml");
		if (existsSync(triggersFile)) {
			if (!entry.triggers) problems.push(`${host}: core/${id} has triggers.yaml but IMPLEMENTS.json has no "triggers" entry`);
			else if (!entry.triggers.startsWith("unsupported:")) for (const q of parse(readFileSync(triggersFile, "utf8")).queries) {
				if (!existsSync(join(root, host, entry.triggers.replaceAll("{trigger}", q.id)))) problems.push(`${host}: no trigger case for core/${id} query ${q.id}`);
			}
		}
		const description = specDescription(core);
		const skillFile = entry.skill && join(root, host, entry.skill);
		if (!skillFile || !existsSync(skillFile)) problems.push(`${host}: core/${id} needs "skill" (the SKILL.md path) in IMPLEMENTS.json`);
		else if (description) {
			const frontmatter = parse(/^---\n([\s\S]*?)\n---/.exec(readFileSync(skillFile, "utf8"))[1]);
			if (String(frontmatter.description ?? "").replace(/\s+/g, " ").trim() !== description) problems.push(`${host}: ${entry.skill} description differs from core/${id}/SPEC.md §1`);
		}
		const promised = [...readFileSync(join(core, "SPEC.md"), "utf8").matchAll(/^\| (G\d+) \|/gm)].map((m) => m[1]);
		for (const g of promised) {
			if (!/^(enforced|instructed|unsupported):/.test(entry.guarantees?.[g] ?? "")) problems.push(`${host}: core/${id} ${g} needs "enforced|instructed|unsupported: how" in IMPLEMENTS.json`);
		}
		const hash = specHash(core) + (existsSync(join(root, "core/shared")) ? specHash(join(root, "core/shared")).slice(0, 8) : "");
		if (sync) { entry.spec = hash; writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n"); }
		else if (entry.spec !== hash) problems.push(`${host}: implements core/${id}@${entry.spec}, but core is now @${hash}; run the implementing-core skill`);
	}
}
assert.deepEqual(problems, [], `Core implementations are not in step:\n${problems.join("\n")}`);
console.log(sync ? `Synced ${capabilities.length} capabilities into ${hosts.join(", ")}` : `${capabilities.length} capabilities: implementations in step, scenarios proven`);
