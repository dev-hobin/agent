import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { progressLiveJudgmentWithSdk } from "../extensions/action-loop-sdk-progression.ts";
import { sdkJudgmentCheckpointEvent } from "../extensions/action-loop-sdk-session.ts";
import { openJudgment } from "../src/action-loop/judgment/open-judgment.ts";
import { bindUnstructuredCapability } from "../src/action-loop/routing/bind-capability.ts";
import type { SdkNamedCapability } from "../src/action-loop/sdk/capability-inventory-controller.ts";
import {
	progressJudgmentWithSdk,
	type SdkJudgmentCheckpoint,
	type SdkJudgmentProgressState,
} from "../src/action-loop/sdk/judgment-progression-controller.ts";
import { recordWorkCaseJudgment } from "../src/action-loop/work/record-work-case-judgment.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const request =
	"Determine how retries preserve one terminal approval without stale replacement.";
const contributionNeed = "A source-bound retry and terminal-state analysis";

async function progressionFixture(
	t: TestContext,
	contributionNeeds: readonly string[] = [contributionNeed],
): Promise<{
	readonly capability: SdkNamedCapability;
	readonly state: SdkJudgmentProgressState;
}> {
	const root = await mkdtemp(join(tmpdir(), "developer-sdk-progression-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	const skillPath = join(root, "SKILL.md");
	const skillContent = [
		"---",
		"name: direct",
		"description: Direct retry analysis",
		"---",
		"# Direct retry analysis",
		"Preserve the first terminal approval and retain stale replies as observations.",
	].join("\n");
	await writeFile(skillPath, skillContent, "utf8");
	const source = {
		kind: "cli" as const,
		locator: pathToFileURL(skillPath).href,
		skillRoot: ".",
	};
	const bound = bindUnstructuredCapability(
		source,
		new TextEncoder().encode(skillContent),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	const capability: SdkNamedCapability = {
		name: "direct",
		entry: {
			status: "bound",
			routing: "unstructured",
			reason: "unsupported-skill-material",
			candidate: {
				label: "direct",
				description: "Direct retry analysis",
				skillFilePath: skillPath,
				skillRootPath: root,
				skillMaterialPath: skillPath,
				supportsStructuredToc: false,
				source,
			},
			capability: bound.value,
		},
	};
	const openedWorkCase = openWorkCase({
		outcome: {
			statement: "Approval retries preserve one terminal decision.",
			acceptanceConditions: [
				"Stale and duplicate replies cannot replace the accepted terminal decision.",
			],
			constraints: ["Do not modify files."],
		},
		provenance: { kind: "model", source: "test" },
	});
	if (openedWorkCase.status !== "opened") {
		throw new Error(openedWorkCase.error.message);
	}
	const openedJudgment = openJudgment({
		workCaseId: openedWorkCase.value.workCaseId,
		contextRevisionId: openedWorkCase.value.revisionId,
		category: "Consequence Integrity",
		subject: "Terminal approval retry behavior",
		question: "How must stale, duplicate, and reordered replies behave?",
		requirements: [
			{
				statement: "Retry behavior preserves one terminal approval.",
				contributionNeeds: [...contributionNeeds],
			},
		],
		basis: ["The Outcome depends on temporal Effect integrity."],
		provenance: { kind: "model", source: "test" },
	});
	if (openedJudgment.status !== "opened") {
		throw new Error(openedJudgment.error.message);
	}
	const recorded = recordWorkCaseJudgment(
		openedWorkCase.value,
		openedJudgment.value,
	);
	if (recorded.status === "invalid") throw new Error(recorded.error.message);
	return {
		capability,
		state: {
			workCase: recorded.value,
			applicabilityAssessments: [],
			assignments: [],
			selections: [],
			contexts: [],
			contributions: [],
			coverages: [],
		},
	};
}

function completeScripts() {
	return [
		{
			proposals: [
				{
					status_0: "applicable",
					basis_0: "The direct method addresses the current retry Need.",
				},
			],
		},
		{
			proposals: [
				{
					local_status: "resolved",
					result:
						"Accept the first terminal approval and retain stale replies only as observations.",
					limitations_json: "[]",
					residual_needs_json: "[]",
				},
			],
		},
		{
			proposals: [
				{
					status: "covered",
					disposition_status_0: "supports",
					disposition_basis_0:
						"The source-bound Contribution directly resolves terminal retry behavior.",
					conflicts_json: "[]",
					basis_json:
						'["The current Contribution is source-bound and locally resolved."]',
				},
			],
		},
		{
			proposals: [
				{
					outcome: "conclude",
					answer:
						"Accept the first terminal approval and retain later stale responses only as observations.",
					refusal_reasons_json: "[]",
					basis_json:
						'["Current Need Coverage is complete and conflict-free."]',
					requirement_status_0: "satisfied",
					requirement_basis_0:
						"The current covered Need directly satisfies the requirement.",
				},
			],
		},
	] as const;
}

test("SDK Judgment progression checkpoints every accepted dependency before Conclusion", async (t) => {
	const fixture = await progressionFixture(t);
	const checkpoints: SdkJudgmentCheckpoint[] = [];
	const result = await progressJudgmentWithSdk({
		request,
		state: fixture.state,
		capabilities: [fixture.capability],
		runner: scriptedSdkRunner(completeScripts()),
		maxSteps: 5,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(result.status, "concluded");
	assert.equal(result.steps, 5);
	assert.equal(result.checkpoints, 5);
	assert.deepEqual(
		checkpoints.map(({ kind }) => kind),
		[
			"capability-inventory-assessed",
			"capability-context-prepared",
			"contribution-accepted",
			"coverage-assessed",
			"judgment-concluded",
		],
	);
	assert.deepEqual(
		checkpoints.map(
			(checkpoint) => sdkJudgmentCheckpointEvent(checkpoint).kind,
		),
		[
			"capability-inventory-assessed",
			"unstructured-context-sealed",
			"contribution-accepted",
			"coverage-assessed",
			"judgment-concluded",
		],
	);
	assert.equal(result.state.applicabilityAssessments.length, 1);
	assert.equal(result.state.assignments.length, 1);
	assert.equal(result.state.contexts.length, 1);
	assert.equal(result.state.contributions.length, 1);
	assert.equal(result.state.coverages.length, 1);
	assert.equal(result.state.workCase.openJudgments.length, 0);
	assert.equal(result.state.workCase.conclusions.length, 1);
});

test("SDK Judgment progression isolates prior Contributions while advancing a later Need", async (t) => {
	const fixture = await progressionFixture(t, [
		contributionNeed,
		"A source-bound safety and progress verification plan",
	]);
	const [inventory, contribution, coverage, conclusion] = completeScripts();
	const result = await progressJudgmentWithSdk({
		request,
		state: fixture.state,
		capabilities: [fixture.capability],
		runner: scriptedSdkRunner([
			inventory,
			contribution,
			coverage,
			inventory,
			contribution,
			coverage,
			conclusion,
		]),
		maxSteps: 9,
		checkpoint() {},
	});

	assert.equal(result.status, "concluded");
	assert.equal(result.state.contributions.length, 2);
	assert.equal(result.state.coverages.length, 2);
	assert.equal(result.state.workCase.conclusions.length, 1);
});

test("SDK Judgment progression resumes after a step budget without reassessing inventory", async (t) => {
	const fixture = await progressionFixture(t);
	const firstCheckpoints: SdkJudgmentCheckpoint[] = [];
	const first = await progressJudgmentWithSdk({
		request,
		state: fixture.state,
		capabilities: [fixture.capability],
		runner: scriptedSdkRunner(completeScripts()),
		maxSteps: 1,
		checkpoint(checkpoint) {
			firstCheckpoints.push(checkpoint);
		},
	});
	assert.equal(first.status, "bounded-stop");
	if (first.status !== "bounded-stop") return;
	assert.equal(first.stage, "context");
	assert.equal(first.reason, "progression-step-budget");
	assert.deepEqual(
		firstCheckpoints.map(({ kind }) => kind),
		["capability-inventory-assessed"],
	);

	const resumedCheckpoints: SdkJudgmentCheckpoint[] = [];
	const resumed = await progressJudgmentWithSdk({
		request,
		state: first.state,
		capabilities: [fixture.capability],
		runner: scriptedSdkRunner(completeScripts().slice(1)),
		maxSteps: 4,
		checkpoint(checkpoint) {
			resumedCheckpoints.push(checkpoint);
		},
	});
	assert.equal(resumed.status, "concluded");
	assert.deepEqual(
		resumedCheckpoints.map(({ kind }) => kind),
		[
			"capability-context-prepared",
			"contribution-accepted",
			"coverage-assessed",
			"judgment-concluded",
		],
	);
});

test("Pi adapter appends semantic checkpoints before advancing its live projection", async (t) => {
	const fixture = await progressionFixture(t);
	const judgment = fixture.state.workCase.openJudgments[0];
	assert.ok(judgment);
	const events: string[] = [];
	const result = await progressLiveJudgmentWithSdk({
		request,
		state: {
			workCase: fixture.state.workCase,
			openingBasis: ["The delegated request opened this Work Case."],
			applicabilityAssessments: [],
			capabilityAssignments: [],
			referenceSelections: [],
			sealedSkillContexts: [],
			contributions: [],
			needCoverages: [],
			piActionProposals: [],
			effectObservations: [],
		},
		inventory: {
			boundCapabilitiesBySkillName: new Map([
				[fixture.capability.name, fixture.capability.entry],
			]),
		},
		runner: scriptedSdkRunner(completeScripts()),
		maxSteps: 5,
		appendCheckpoint(event) {
			events.push(event.kind);
		},
	});

	assert.equal(result.result.status, "concluded");
	assert.deepEqual(events, [
		"capability-inventory-assessed",
		"unstructured-context-sealed",
		"contribution-accepted",
		"coverage-assessed",
		"judgment-concluded",
	]);
	assert.equal(result.state.workCase.openJudgments.length, 0);
	assert.equal(result.state.workCase.conclusions.length, 1);
	assert.equal(result.state.capabilityAssignments.length, 1);
	assert.equal(result.state.sealedSkillContexts.length, 1);
	assert.equal(result.state.contributions.length, 1);
	assert.equal(result.state.needCoverages.length, 1);
});

test("SDK Judgment progression does not depend on an unacknowledged checkpoint", async (t) => {
	const fixture = await progressionFixture(t);
	const result = await progressJudgmentWithSdk({
		request,
		state: fixture.state,
		capabilities: [fixture.capability],
		runner: scriptedSdkRunner(completeScripts()),
		maxSteps: 5,
		checkpoint(checkpoint) {
			if (checkpoint.kind === "capability-context-prepared") {
				throw new Error("Pi branch append unavailable");
			}
		},
	});

	assert.equal(result.status, "checkpoint-failure");
	if (result.status !== "checkpoint-failure") return;
	assert.equal(result.stage, "context");
	assert.equal(result.pendingCheckpoint.kind, "capability-context-prepared");
	assert.equal(result.checkpoints, 1);
	assert.equal(result.state.assignments.length, 1);
	assert.equal(result.state.contexts.length, 0);
	assert.match(result.message, /Pi branch append unavailable/);
});
