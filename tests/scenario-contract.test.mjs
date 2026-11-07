// A core scenario with an `output_contract` check grades the result's parts once, with the
// capability's own contract checker. A `file_matches` regex that looks for a part's label or a
// contract mention again is a second, different standard: it can reject a result the contract
// accepts (lease-spec rejected `**Example or contrast — illustrative interpretation:**`).
import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { checkScenario } from "../.agents/skills/implementing-core/scripts/scenario-check.mjs";
import { checkText } from "../core/shared/scripts/output-contract.mjs";
import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { tempRoot } from "./temp-root.mjs";

const temp = tempRoot(import.meta.url);
const scenarios = readdirSync(join(repositoryRoot, "core"), { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.flatMap((d) => {
		const dir = join(repositoryRoot, "core", d.name, "scenarios");
		try { return readdirSync(dir).map((s) => join(dir, s, "scenario.yaml")); } catch { return []; }
	});

// What a contract check decides about a result: each part's label or alias as a heading, a bold
// field label or a bare word, each mention, and the table and numbered list it requires.
function contractTargets(contract, regex) {
	const hits = [];
	for (const part of contract.required) {
		for (const name of [part.label, ...(part.aliases ?? [])]) {
			if ([`## ${name}`, `**${name}:**`, `- **${name}:** text`, name].some((sample) => regex.test(sample))) hits.push(`part "${part.label}" (${name})`);
		}
	}
	for (const m of contract.mentions ?? []) {
		if (new RegExp(m.pattern, "i").test(regex.source)) hits.push(`mention ${m.pattern}`);
	}
	if (contract.table && regex.test("| case | outcome |")) hits.push("table");
	if (contract.orderedList && regex.test("1. first move")) hits.push("numbered list");
	return [...new Set(hits)];
}

function doubleChecks(yamlPath) {
	const spec = parse(readFileSync(yamlPath, "utf8"));
	const problems = [];
	for (const oc of spec.expect.filter((e) => e.output_contract)) {
		const contract = JSON.parse(readFileSync(join(dirname(yamlPath), "../..", oc.output_contract.contract), "utf8"));
		for (const e of spec.expect.filter((x) => x.file_matches?.path === oc.output_contract.file)) {
			const hits = contractTargets(contract, new RegExp(e.file_matches.pattern, e.file_matches.flags ?? ""));
			if (hits.length) problems.push(`${e.id} re-checks ${hits.join(", ")}`);
		}
	}
	return problems;
}

test("scenarios check output-contract parts only through the output contract", () => {
	const withContract = scenarios.filter((p) => parse(readFileSync(p, "utf8")).expect.some((e) => e.output_contract));
	assert.ok(withContract.length >= 5, "the learning scenarios carry an output_contract check");
	for (const path of withContract) {
		assert.deepEqual(doubleChecks(path), [], `${path.slice(repositoryRoot.length)}: contract parts are checked only by the output contract (meets-output-contract); remove these file_matches checks`);
	}
});

test("the guard catches the regex that rejected a valid lease-spec result", () => {
	const contract = JSON.parse(readFileSync(join(repositoryRoot, "core/technical-reading/assets/output-contract.json"), "utf8"));
	const strict = /^(#{1,6} [^\n]*(example|contrast)|\s*[-*]?\s*\**[^\n:]{0,40}(example|contrast)[^\n:]{0,20}\**:)/im;
	assert.ok(contractTargets(contract, strict).some((hit) => hit.startsWith('part "Example or contrast"')));
	assert.deepEqual(contractTargets(contract, /fencing token/i), []);
});

// A Codex run's out/insights.md (synthetic source material) that the contract accepted and the
// old `has-example-or-contrast` regex rejected: `- **Example or contrast — illustrative
// interpretation:** …`.
const captured = readFileSync(join(repositoryRoot, "tests/fixtures/output-contract/lease-spec-codex-insights.md"), "utf8");

test("the captured lease-spec result meets its contract and every remaining scenario check", (t) => {
	const contract = JSON.parse(readFileSync(join(repositoryRoot, "core/technical-reading/assets/output-contract.json"), "utf8"));
	assert.deepEqual(checkText(contract, captured), []);
	const scenario = join(repositoryRoot, "core/technical-reading/scenarios/lease-spec");
	const dir = temp.dir("scenario-contract");
	const [baseline, workspace] = [join(dir, "baseline"), join(dir, "workspace")];
	cpSync(join(scenario, "base"), baseline, { recursive: true });
	cpSync(join(scenario, "base"), workspace, { recursive: true });
	mkdirSync(join(workspace, "out"));
	cpSync(join(repositoryRoot, "tests/fixtures/output-contract/lease-spec-codex-insights.md"), join(workspace, "out/insights.md"));
	const failing = checkScenario(join(scenario, "scenario.yaml"), workspace, baseline).filter((r) => !r.passed).map((r) => r.id);
	assert.deepEqual(failing, []);
});
