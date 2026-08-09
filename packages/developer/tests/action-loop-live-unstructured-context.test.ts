import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { assessLiveCapabilityApplicability } from "../extensions/action-loop-applicability.ts";
import { sealLiveUnstructuredCapability } from "../extensions/action-loop-context.ts";
import { acceptLiveSkillContribution } from "../extensions/action-loop-contribution.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import { bindUnstructuredCapability } from "../src/action-loop/routing/bind-capability.ts";

const encoder = new TextEncoder();
const skillText =
	"---\nname: direct\ndescription: Direct method\n---\n# Exact method\n";

async function fixture(t: TestContext) {
	const root = await mkdtemp(join(tmpdir(), "developer-live-unstructured-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	const skillFilePath = join(root, "direct.md");
	await writeFile(skillFilePath, skillText);
	const bound = bindUnstructuredCapability(
		{
			kind: "cli",
			locator: `file://${skillFilePath}`,
			skillRoot: ".",
		},
		encoder.encode(skillText),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	const work = openLiveWorkCase(undefined, {
		outcome: {
			statement: "The direct admitted method serves one bounded Need.",
			acceptanceConditions: ["Only exact admitted Skill bytes are exposed."],
			constraints: ["No parent directory becomes a discovery root."],
		},
		basis: ["The delegated Outcome needs one direct-file method."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (work.status !== "opened") throw new Error("Work Case did not open");
	const judgment = openLiveJudgment(work.value, {
		category: "Proportionate Intervention",
		subject: "The exact direct-file method.",
		question: "Which admitted method fits the current Need?",
		requirements: [
			{
				statement: "The method is acquired without adjacent material.",
				contributionNeeds: ["direct admitted method"],
			},
		],
		basis: ["The direct Skill has no structured TOC."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (judgment.status !== "opened") throw new Error("Judgment did not open");
	const entry = {
		candidate: { skillFilePath },
		capability: bound.value,
	};
	const assessed = assessLiveCapabilityApplicability(judgment.state, entry, {
		status: "applicable",
		matchedWhen: [],
		matchedUnless: [],
		basis: ["The direct method explicitly addresses the current Need."],
		missingContext: [],
	});
	if (assessed.status !== "assessed" || !assessed.assignment) {
		throw new Error("Capability was not assigned");
	}
	return {
		skillFilePath,
		entry,
		state: assessed.state,
		assignment: assessed.assignment,
	};
}

test("live unstructured sealing acquires exactly one assigned Skill file", async (t) => {
	const current = await fixture(t);
	const sealed = await sealLiveUnstructuredCapability(
		current.state,
		current.entry,
		current.assignment,
	);

	assert.equal(sealed.status, "sealed");
	if (sealed.status !== "sealed") return;
	assert.match(sealed.context.sealedContextId, /^sealed_[a-f0-9]{64}$/);
	assert.deepEqual(sealed.context.selectedPaths, []);
	assert.equal(sealed.context.materials.length, 1);
	assert.equal(sealed.context.materials[0].kind, "skill");
	assert.equal(sealed.context.materials[0].content, skillText);
	assert.deepEqual(sealed.state.contexts, [sealed.context]);
	const repeated = await sealLiveUnstructuredCapability(
		sealed.state,
		current.entry,
		current.assignment,
	);
	assert.equal(repeated.status, "unchanged");
	const contributed = acceptLiveSkillContribution(sealed.state, current.entry, {
		localStatus: "resolved",
		result: "The exact direct method supplies the bounded distinction.",
		referenceApplications: [],
		limitations: [],
		residualNeeds: [],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	assert.equal(contributed.status, "accepted");
	if (contributed.status === "accepted") {
		assert.deepEqual(contributed.contribution.referenceApplications, []);
		assert.deepEqual(contributed.state.contributions, [
			contributed.contribution,
		]);
		assert.equal(
			acceptLiveSkillContribution(contributed.state, current.entry, {
				localStatus: "resolved",
				result: "The exact direct method supplies the bounded distinction.",
				referenceApplications: [],
				limitations: [],
				residualNeeds: [],
				provenance: { kind: "model", source: "test-evaluator" },
			}).status,
			"unchanged",
		);
	}
});

test("live unstructured sealing rejects drift and non-current Assignment", async (t) => {
	const current = await fixture(t);
	await writeFile(current.skillFilePath, `${skillText}\nDrift\n`);
	const drifted = await sealLiveUnstructuredCapability(
		current.state,
		current.entry,
		current.assignment,
	);
	const foreign = await sealLiveUnstructuredCapability(
		current.state,
		current.entry,
		{ ...current.assignment, assignmentId: `assign_${"f".repeat(64)}` },
	);

	assert.equal(drifted.status, "invalid");
	assert.equal(foreign.status, "invalid");
});
