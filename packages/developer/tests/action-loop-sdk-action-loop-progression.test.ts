import assert from "node:assert/strict";
import test from "node:test";

import { bindPiControlledAction } from "../extensions/action-loop-pi-action.ts";
import {
	applySdkActionLoopCheckpoint,
	progressLiveActionLoopWithSdk,
	sdkActionLoopCheckpointEvent,
} from "../extensions/action-loop-sdk-progression.ts";
import type { SdkControlledActionAdapter } from "../src/action-loop/sdk/action-controller.ts";
import {
	progressActionLoopWithSdk,
	type SdkActionLoopCheckpoint,
} from "../src/action-loop/sdk/action-loop-progression-controller.ts";
import type { SdkJudgmentProgressState } from "../src/action-loop/sdk/judgment-progression-controller.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const request =
	"Determine whether a retryable payment authorization model is complete and evidence-backed.";

const workCaseProposal = {
	statement:
		"A complete retryable payment authorization model is available for review.",
	acceptance_conditions_json: JSON.stringify([
		"Lifecycle states and transitions are explicit.",
	]),
	constraints_json: JSON.stringify(["Do not modify workspace files."]),
	basis_json: JSON.stringify([
		"The delegated request explicitly asks for this bounded model.",
	]),
};

const judgmentProposal = {
	category: "Consequence Integrity",
	subject: "Retryable payment authorization lifecycle",
	question:
		"Which state and time rules are required for safe and progressing authorization?",
	requirements_json: JSON.stringify([
		{
			statement:
				"The model distinguishes consequential lifecycle and response-order cases.",
			contribution_needs: [
				"A condition model of state, retry, identity, and temporal behavior",
			],
		},
	]),
	basis_json: JSON.stringify([
		"The Outcome depends on explicit consequences and forbidden transitions.",
	]),
};

function stateFromOpening(
	checkpoint: Extract<
		SdkActionLoopCheckpoint,
		{ readonly kind: "work-case-opened" }
	>,
): SdkJudgmentProgressState {
	return {
		workCase: checkpoint.result.workCase,
		applicabilityAssessments: [],
		assignments: [],
		selections: [],
		contexts: [],
		contributions: [],
		coverages: [],
	};
}

test("SDK Action Loop progression checkpoints opening before dependent work", async () => {
	const checkpoints: SdkActionLoopCheckpoint[] = [];
	const first = await progressActionLoopWithSdk({
		request,
		capabilities: [],
		runner: scriptedSdkRunner([
			{ proposals: [workCaseProposal] },
			{ proposals: [judgmentProposal] },
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(first.status, "bounded-stop");
	if (first.status !== "bounded-stop") return;
	assert.equal(first.stage, "judgment");
	assert.equal(first.reason, "progression-step-budget");
	assert.equal(first.steps, 1);
	assert.equal(first.checkpoints, 1);
	assert.equal(checkpoints[0]?.kind, "work-case-opened");
	const workCaseCheckpoint = checkpoints[0];
	if (workCaseCheckpoint?.kind !== "work-case-opened") return;

	const resumedCheckpoints: SdkActionLoopCheckpoint[] = [];
	const resumed = await progressActionLoopWithSdk({
		request,
		state: stateFromOpening(workCaseCheckpoint),
		capabilities: [],
		runner: scriptedSdkRunner([{ proposals: [judgmentProposal] }]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			resumedCheckpoints.push(checkpoint);
		},
	});

	assert.equal(resumed.status, "bounded-stop");
	if (resumed.status !== "bounded-stop") return;
	assert.equal(resumed.stage, "inventory");
	assert.equal(resumed.reason, "progression-step-budget");
	assert.equal(resumed.state?.workCase.openJudgments.length, 1);
	assert.deepEqual(
		resumedCheckpoints.map(({ kind }) => kind),
		["judgment-opened"],
	);
});

test("Pi adapter appends opening checkpoints before advancing its live projection", async () => {
	const events: string[] = [];
	const first = await progressLiveActionLoopWithSdk({
		request,
		inventory: { boundCapabilitiesBySkillName: new Map() },
		runner: scriptedSdkRunner([{ proposals: [workCaseProposal] }]),
		maxSteps: 1,
		appendCheckpoint(event) {
			events.push(event.kind);
		},
	});

	assert.equal(first.result.status, "bounded-stop");
	assert.ok(first.state);
	assert.equal(first.state?.workCase.openJudgments.length, 0);
	assert.deepEqual(events, ["work-case-opened"]);

	const resumedEvents: string[] = [];
	const resumed = await progressLiveActionLoopWithSdk({
		request,
		state: first.state,
		inventory: { boundCapabilitiesBySkillName: new Map() },
		runner: scriptedSdkRunner([{ proposals: [judgmentProposal] }]),
		maxSteps: 1,
		appendCheckpoint(event) {
			resumedEvents.push(event.kind);
		},
	});

	assert.equal(resumed.result.status, "bounded-stop");
	assert.equal(resumed.state?.workCase.openJudgments.length, 1);
	assert.deepEqual(resumedEvents, ["judgment-opened"]);
});

test("SDK Action Loop progression does not open a replacement Judgment after Conclusion", async () => {
	const opened = openWorkCase({
		outcome: {
			statement: "The bounded retry decision is ready for action.",
			acceptanceConditions: ["The current Conclusion warrants the next action."],
			constraints: ["Do not replace concluded Judgment ownership."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const conclusion: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-ready",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-ready",
		category: "Proportionate Intervention",
		subject: "The warranted next action",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["The current bounded evidence warrants action."]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "Proceed to exact Action proposal.",
	});
	const recorded = recordWorkCaseConclusion(opened.value, conclusion);
	if (recorded.status !== "recorded") throw new Error("Conclusion not recorded");

	const result = await progressActionLoopWithSdk({
		request,
		state: {
			workCase: recorded.value,
			applicabilityAssessments: [],
			assignments: [],
			selections: [],
			contexts: [],
			contributions: [],
			coverages: [],
		},
		capabilities: [],
		runner: scriptedSdkRunner([]),
		maxSteps: 3,
		checkpoint() {
			throw new Error("No checkpoint should be attempted.");
		},
	});

	assert.equal(result.status, "ready-for-action");
	if (result.status !== "ready-for-action") return;
	assert.deepEqual(result.conclusionIds, [conclusion.conclusionId]);
	assert.equal(result.steps, 0);
	assert.equal(result.checkpoints, 0);
});

test("SDK Action Loop progression checkpoints one exact host-cleared Action", async () => {
	const opened = openWorkCase({
		outcome: {
			statement: "The bounded configuration is ready to write.",
			acceptanceConditions: ["The accepted configuration is written exactly."],
			constraints: ["No unrelated path changes."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const conclusion: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-write",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-write",
		category: "Proportionate Intervention",
		subject: "The exact bounded write",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["The exact write is warranted."]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "Write config.json with the accepted content.",
	});
	const recorded = recordWorkCaseConclusion(opened.value, conclusion);
	if (recorded.status !== "recorded") throw new Error("Conclusion not recorded");
	const writeAction: SdkControlledActionAdapter = {
		name: "write",
		description: "Write exact content to one path.",
		bind(input) {
			const bound = bindPiControlledAction("write", input);
			if (bound.status === "invalid") return bound;
			return {
				status: "bound",
				value: {
					controlledAction: bound.value,
					canonicalInput: bound.canonicalInput,
				},
			};
		},
	};
	const state: SdkJudgmentProgressState = {
		workCase: recorded.value,
		applicabilityAssessments: [],
		assignments: [],
		selections: [],
		contexts: [],
		contributions: [],
		coverages: [],
	};
	const checkpoints: SdkActionLoopCheckpoint[] = [];
	const result = await progressActionLoopWithSdk({
		request: "Write the accepted bounded configuration.",
		state,
		capabilities: [],
		actions: [writeAction],
		authorizeAction(action) {
			return {
				actionCandidateId: action.candidate.actionCandidateId,
				status: "granted",
				source: "pi:test-host",
				basis: ["The trusted test host grants this exact candidate."],
			};
		},
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						tool_name: "write",
						tool_input_json:
							'{"path":"config.json","content":"{\\n  \\"enabled\\": true\\n}\\n"}',
						summary: "Write the accepted bounded configuration.",
						intended_effects_json:
							'["config.json contains the accepted enabled value."]',
						requires_conclusion_0: true,
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(result.status, "ready-for-host-action");
	if (result.status !== "ready-for-host-action") return;
	assert.equal(result.toolName, "write");
	assert.deepEqual(result.toolInput, {
		path: "config.json",
		content: '{\n  "enabled": true\n}\n',
	});
	assert.deepEqual(checkpoints.map(({ kind }) => kind), ["action-cleared"]);
	assert.equal(result.state?.workCase.actionCandidates.length, 1);
	assert.equal(result.state?.workCase.actionClearances.length, 1);
	const actionCheckpoint = checkpoints[0];
	if (actionCheckpoint?.kind !== "action-cleared") return;
	assert.equal(sdkActionLoopCheckpointEvent(actionCheckpoint).kind, "action-cleared");
	const live = applySdkActionLoopCheckpoint(
		{
			workCase: state.workCase,
			contextRevisionId: state.workCase.revisionId,
			openingBasis: ["The test host opened this bounded Work Case."],
			applicabilityAssessments: [],
			capabilityAssignments: [],
			referenceSelections: [],
			sealedSkillContexts: [],
			contributions: [],
			needCoverages: [],
			piActionProposals: [],
			effectObservations: [],
		},
		actionCheckpoint,
	);
	assert.deepEqual(live.piActionProposals, [
		{
			actionCandidateId: result.actionCandidateId,
			toolName: "write",
			toolInput: result.toolInput,
		},
	]);

	const resumed = await progressActionLoopWithSdk({
		request: "Resume the exact cleared Action.",
		state: result.state,
		capabilities: [],
		actions: [writeAction],
		authorizeAction() {
			throw new Error("A resumed Clearance must not request permission again.");
		},
		runner: scriptedSdkRunner([]),
		maxSteps: 1,
		checkpoint() {
			throw new Error("A resumed Clearance must not checkpoint again.");
		},
	});
	assert.equal(resumed.status, "ready-for-host-action");
	assert.equal(resumed.steps, 0);
	assert.equal(resumed.checkpoints, 0);

	const unacknowledged = await progressActionLoopWithSdk({
		request: "Write the accepted bounded configuration.",
		state,
		capabilities: [],
		actions: [writeAction],
		authorizeAction(action) {
			return {
				actionCandidateId: action.candidate.actionCandidateId,
				status: "granted",
				source: "pi:test-host",
				basis: ["The trusted test host grants this exact candidate."],
			};
		},
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						tool_name: "write",
						tool_input_json:
							'{"path":"config.json","content":"{\\n  \\"enabled\\": true\\n}\\n"}',
						summary: "Write the accepted bounded configuration.",
						intended_effects_json:
							'["config.json contains the accepted enabled value."]',
						requires_conclusion_0: true,
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint() {
			throw new Error("Pi branch Action checkpoint failed");
		},
	});
	assert.equal(unacknowledged.status, "checkpoint-failure");
	if (unacknowledged.status !== "checkpoint-failure") return;
	assert.equal(unacknowledged.stage, "action");
	assert.equal(unacknowledged.pendingCheckpoint.kind, "action-cleared");
	assert.equal(unacknowledged.state?.workCase.actionClearances.length, 0);
});

test("SDK Action Loop progression does not depend on an unacknowledged opening", async () => {
	const result = await progressActionLoopWithSdk({
		request,
		capabilities: [],
		runner: scriptedSdkRunner([
			{ proposals: [workCaseProposal] },
			{ proposals: [judgmentProposal] },
		]),
		maxSteps: 3,
		checkpoint() {
			throw new Error("Pi branch append failed");
		},
	});

	assert.equal(result.status, "checkpoint-failure");
	if (result.status !== "checkpoint-failure") return;
	assert.equal(result.stage, "work-case");
	assert.equal(result.pendingCheckpoint.kind, "work-case-opened");
	assert.equal(result.state, undefined);
	assert.equal(result.checkpoints, 0);
});
