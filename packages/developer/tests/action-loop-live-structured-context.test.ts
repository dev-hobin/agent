import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { assessLiveCapabilityApplicability } from "../extensions/action-loop-applicability.ts";
import {
	loadLiveSelectedReference,
	selectAndSealLiveStructuredCapability,
} from "../extensions/action-loop-context.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import { bindCapability } from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";

const encoder = new TextEncoder();
const declaredWhen = "A concrete Claim requires evidence.";
const skillText = "---\nname: verify\n---\n# Verify exactly\n";
const relevantPath = "references/relevant.md";
const unnecessaryPath = "references/unnecessary.md";

async function fixture(t: TestContext) {
	const root = await mkdtemp(join(tmpdir(), "developer-live-structured-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "references"));
	await writeFile(join(root, "SKILL.md"), skillText);
	await writeFile(join(root, relevantPath), "Relevant verifier rule.\n");
	await writeFile(join(root, unnecessaryPath), "Unnecessary branch rule.\n");
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [declaredWhen],
				unless: ["There is no concrete Claim to assess."],
				references: [
					{ path: relevantPath, when: ["Verifier relevance is unresolved."] },
					{ path: unnecessaryPath, when: ["A separate risk is present."] },
				],
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "project",
			locator: "project:live-structured-fixture",
			skillRoot: "skills/verify",
		},
		parsed.value,
		encoder.encode(skillText),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	const work = openLiveWorkCase(undefined, {
		outcome: {
			statement: "The Claim uses one exact selected verifier Reference.",
			acceptanceConditions: ["Every declared Reference is dispositioned."],
			constraints: ["No partial selected material is exposed."],
		},
		basis: ["The delegated Outcome requires a structured verifier."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (work.status !== "opened") throw new Error("Work Case did not open");
	const judgment = openLiveJudgment(work.value, {
		category: "Claim Assurance",
		subject: "The current bounded Claim.",
		question: "Which verifier material is needed?",
		requirements: [
			{
				statement: "Verifier material has complete accounting.",
				contributionNeeds: ["claim-relevant verifier"],
			},
		],
		basis: ["The Claim requires selected evidence guidance."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (judgment.status !== "opened") throw new Error("Judgment did not open");
	const entry = {
		candidate: { skillRootPath: root },
		capability: bound.value,
	};
	const assessed = assessLiveCapabilityApplicability(judgment.state, entry, {
		status: "applicable",
		matchedWhen: [declaredWhen],
		matchedUnless: [],
		basis: ["The current Need asks for a Claim verifier."],
		missingContext: [],
	});
	if (assessed.status !== "assessed" || !assessed.assignment) {
		throw new Error("Capability was not assigned");
	}
	return { entry, state: assessed.state, assignment: assessed.assignment };
}

const readyDispositions = [
	{
		path: relevantPath,
		status: "selected" as const,
		basis: ["Verifier relevance is unresolved for the current Claim."],
	},
	{
		path: unnecessaryPath,
		status: "not-needed" as const,
		basis: ["The separate risk is absent from the bounded Claim."],
	},
];

test("ready structured selection seals Skill and selected References atomically", async (t) => {
	const current = await fixture(t);
	const result = await selectAndSealLiveStructuredCapability(
		current.state,
		current.entry,
		current.assignment,
		readyDispositions,
	);

	assert.equal(result.status, "sealed");
	if (result.status !== "sealed" || !result.context) return;
	assert.match(result.selectionId, /^selection_[a-f0-9]{64}$/);
	assert.deepEqual(result.context.selectedPaths, [relevantPath]);
	assert.deepEqual(
		result.context.materials.map(({ path }) => path),
		["SKILL.md", relevantPath],
	);
	assert.deepEqual(result.state.referenceSelections.map(({ status }) => status), [
		"ready",
	]);
	const loaded = loadLiveSelectedReference(
		result.state,
		result.context.sealedContextId,
		relevantPath,
	);
	assert.equal(loaded.status, "loaded");
	if (loaded.status === "loaded") {
		assert.equal(loaded.content, "Relevant verifier rule.\n");
		assert.match(loaded.hash, /^sha256_[a-f0-9]{64}$/);
	}
	assert.equal(
		loadLiveSelectedReference(
			result.state,
			result.context.sealedContextId,
			unnecessaryPath,
		).status,
		"invalid",
	);
	const repeated = await selectAndSealLiveStructuredCapability(
		result.state,
		current.entry,
		current.assignment,
		readyDispositions,
	);
	assert.equal(repeated.status, "unchanged");
});

test("needs-context remains unsealed and incomplete accounting fails closed", async (t) => {
	const current = await fixture(t);
	const unresolved = await selectAndSealLiveStructuredCapability(
		current.state,
		current.entry,
		current.assignment,
		[
			readyDispositions[0],
			{
				path: unnecessaryPath,
				status: "needs-context",
				basis: ["Whether the separate risk exists is not yet observed."],
			},
		],
	);
	const incomplete = await selectAndSealLiveStructuredCapability(
		current.state,
		current.entry,
		current.assignment,
		[readyDispositions[0]],
	);

	assert.equal(unresolved.status, "selected");
	if (unresolved.status === "selected") {
		assert.equal(unresolved.context, undefined);
		assert.deepEqual(unresolved.state.sealedSkillContexts, []);
		assert.deepEqual(
			unresolved.state.referenceSelections.map(({ status }) => status),
			["needs-context"],
		);
	}
	assert.equal(incomplete.status, "invalid");
});
