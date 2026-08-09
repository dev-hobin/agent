import assert from "node:assert/strict";
import test from "node:test";

import {
	beginLiveActionEffect,
	settleLiveEffect,
} from "../extensions/action-loop-effect.ts";
import { bindPiControlledAction } from "../extensions/action-loop-pi-action.ts";
import {
	reproduceSdkActionLoopCheckpoint,
	progressPiActionLoop,
	sessionEventForSdkCheckpoint,
} from "../extensions/action-loop-pi-controller.ts";
import type { SdkControlledActionAdapter } from "../src/action-loop/sdk/action-controller.ts";
import {
	progressActionLoopWithSdk,
	type SdkActionLoopCheckpoint,
} from "../src/action-loop/sdk/action-loop-progression-controller.ts";
import type { SdkActionLoopState } from "../src/action-loop/sdk/action-loop-state.ts";
import type { EffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { DELEGATED_REQUEST_EVIDENCE_FUNCTION } from "../src/action-loop/sdk/judgment-evidence-operation.ts";
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
	category: "Proportionate Intervention",
	subject: "Retryable payment authorization lifecycle",
	question:
		"What bounded next Action or no-Action disposition is warranted for the authorization model?",
	requirements_json: JSON.stringify([
		{
			statement:
				"The next intervention accounts for consequential lifecycle and response-order cases.",
			contribution_needs: [DELEGATED_REQUEST_EVIDENCE_FUNCTION],
		},
	]),
	basis_json: JSON.stringify([
		"The Action Loop must decide a bounded intervention before any controlled Action.",
	]),
};

function stateFromOpening(
	checkpoint: Extract<
		SdkActionLoopCheckpoint,
		{ readonly kind: "work-case-opened" }
	>,
): SdkActionLoopState {
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
	const first = await progressPiActionLoop({
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
	const resumed = await progressPiActionLoop({
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
			acceptanceConditions: [
				"The current Conclusion warrants the next action.",
			],
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
		interventionDisposition: "action-required",
	});
	const recorded = recordWorkCaseConclusion(opened.value, conclusion);
	if (recorded.status !== "recorded")
		throw new Error("Conclusion not recorded");

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

test("SDK Action Loop progression opens the next required intervention Judgment", async () => {
	const opened = openWorkCase({
		outcome: {
			statement:
				"The bounded retry model advances through warranted decisions.",
			acceptanceConditions: ["The next intervention is explicitly warranted."],
			constraints: ["A prior Conclusion cannot imply permission."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const contextual: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-context",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-context",
		category: "Contextual Adequacy",
		subject: "The current retry context",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([
			"The current context is adequate for intervention judgment.",
		]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "The consequential retry context is explicit.",
	});
	const recorded = recordWorkCaseConclusion(opened.value, contextual);
	if (recorded.status !== "recorded")
		throw new Error("Conclusion not recorded");
	const checkpoints: SdkActionLoopCheckpoint[] = [];
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
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						...judgmentProposal,
						category: "Proportionate Intervention",
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(result.status, "bounded-stop");
	if (result.status !== "bounded-stop") return;
	assert.equal(result.stage, "inventory");
	assert.deepEqual(
		checkpoints.map(({ kind }) => kind),
		["judgment-opened"],
	);
	const checkpoint = checkpoints[0];
	if (checkpoint?.kind !== "judgment-opened") return;
	assert.equal(
		checkpoint.result.judgment.category,
		"Proportionate Intervention",
	);
});

test("SDK Action Loop progression routes no-action intervention to Claim Assurance", async () => {
	const opened = openWorkCase({
		outcome: {
			statement: "The bounded analysis preserves current workspace state.",
			acceptanceConditions: ["No unnecessary Action is performed."],
			constraints: ["Claim Assurance remains independently explicit."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const intervention: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-no-action-route",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-no-action-route",
		category: "Proportionate Intervention",
		subject: "Whether any host Action is warranted",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([
			"Current state already satisfies the intervention aim.",
		]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "No host Action is proportionate.",
		interventionDisposition: "no-action",
		noActionDisposition: "outcome-attained",
	});
	const recorded = recordWorkCaseConclusion(opened.value, intervention);
	if (recorded.status !== "recorded")
		throw new Error("Conclusion not recorded");
	const checkpoints: SdkActionLoopCheckpoint[] = [];
	const result = await progressActionLoopWithSdk({
		request: "Complete the bounded analysis without changing files.",
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
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						...judgmentProposal,
						category: "Claim Assurance",
						question: "Does current evidence support no-change completion?",
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(result.status, "bounded-stop");
	if (result.status !== "bounded-stop") return;
	assert.equal(result.stage, "inventory");
	assert.deepEqual(
		checkpoints.map(({ kind }) => kind),
		["judgment-opened"],
	);
	const checkpoint = checkpoints[0];
	if (checkpoint?.kind !== "judgment-opened") return;
	assert.equal(checkpoint.result.judgment.category, "Claim Assurance");
});

test("SDK Action Loop progression cannot complete a blocked no-action disposition", async () => {
	const opened = openWorkCase({
		outcome: {
			statement: "A contradictory target remains unresolved.",
			acceptanceConditions: [
				"The contradiction is resolved before completion.",
			],
			constraints: ["Do not claim completion while blocked."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const intervention: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-blocked-no-action",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-blocked-no-action",
		category: "Proportionate Intervention",
		subject: "Whether contradiction permits intervention",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["The current target is contradictory."]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "No Action can resolve the contradiction; preserve the blocker.",
		interventionDisposition: "no-action",
		noActionDisposition: "blocked",
	});
	const recorded = recordWorkCaseConclusion(opened.value, intervention);
	if (recorded.status !== "recorded")
		throw new Error("Conclusion not recorded");
	const result = await progressActionLoopWithSdk({
		request: "Do not claim completion while the contradiction remains.",
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
		complete: true,
		maxSteps: 1,
		checkpoint() {},
	});
	assert.equal(result.status, "continuity-required");
	if (result.status !== "continuity-required") return;
	assert.equal(result.disposition, "blocked");
});

test("SDK Action Loop progression completes a Claim-Assured no-change Outcome before Action", async () => {
	const opened = openWorkCase({
		outcome: {
			statement: "The bounded analysis is complete without workspace mutation.",
			acceptanceConditions: ["The requested analysis is evidence-backed."],
			constraints: ["No workspace file is modified."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const intervention: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-no-action",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-no-action",
		category: "Proportionate Intervention",
		subject: "Whether the analysis requires host mutation",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["No host mutation is warranted."]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "Preserve current workspace state.",
		interventionDisposition: "no-action",
		noActionDisposition: "outcome-attained",
	});
	const intervened = recordWorkCaseConclusion(opened.value, intervention);
	if (intervened.status !== "recorded")
		throw new Error("Intervention not recorded");
	const assurance: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-action-loop-no-change",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-action-loop-no-change",
		category: "Claim Assurance",
		subject: "The bounded no-change analysis",
		contextRevisionId: opened.value.revisionId,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current evidence supports the bounded analysis."]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		answer: "The analysis is complete and no workspace Action is warranted.",
	});
	const recorded = recordWorkCaseConclusion(intervened.value, assurance);
	if (recorded.status !== "recorded") throw new Error("Assurance not recorded");
	const checkpoints: SdkActionLoopCheckpoint[] = [];
	const result = await progressActionLoopWithSdk({
		request: "Complete the analysis without changing workspace files.",
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
		complete: true,
		actions: [
			{
				name: "write",
				description: "Must not be selected for no-change completion.",
				bind() {
					throw new Error("No-change completion must not bind an Action.");
				},
			},
		],
		authorizeAction() {
			throw new Error("No-change completion must not request permission.");
		},
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						mode: "no-change",
						basis_json:
							'["Every current closure obligation is supported without an external Effect."]',
						obligation_0_conclusion_indices_json: "[0,1]",
						obligation_0_effect_indices_json: "[]",
						obligation_0_remediation_indices_json: "[]",
						obligation_0_basis:
							"Claim Assurance supports the analysis acceptance condition.",
						obligation_1_conclusion_indices_json: "[0,1]",
						obligation_1_effect_indices_json: "[]",
						obligation_1_remediation_indices_json: "[]",
						obligation_1_basis:
							"Claim Assurance supports the no-mutation constraint.",
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(result.status, "completed");
	if (result.status !== "completed") return;
	assert.equal(result.completedWorkCase.closureClaim.mode, "no-change");
	assert.deepEqual(
		checkpoints.map(({ kind }) => kind),
		["work-case-completed"],
	);
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
		interventionDisposition: "action-required",
	});
	const recorded = recordWorkCaseConclusion(opened.value, conclusion);
	if (recorded.status !== "recorded")
		throw new Error("Conclusion not recorded");
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
	const state: SdkActionLoopState = {
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
	assert.deepEqual(
		checkpoints.map(({ kind }) => kind),
		["action-cleared"],
	);
	assert.equal(result.state?.workCase.actionCandidates.length, 1);
	assert.deepEqual(
		result.state?.workCase.actionCandidates[0]?.requiredConclusionIds,
		[conclusion.conclusionId],
	);
	assert.equal(result.state?.workCase.actionClearances.length, 1);
	const actionCheckpoint = checkpoints[0];
	if (actionCheckpoint?.kind !== "action-cleared") return;
	assert.equal(
		sessionEventForSdkCheckpoint(actionCheckpoint).kind,
		"action-cleared",
	);
	const live = reproduceSdkActionLoopCheckpoint(
		{
			workCase: state.workCase,
			openingBasis: ["The test host opened this bounded Work Case."],
			applicabilityAssessments: [],
			assignments: [],
			selections: [],
			contexts: [],
			contributions: [],
			coverages: [],
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

	const clearance = live.workCase.actionClearances[0];
	assert.ok(clearance);
	const begun = beginLiveActionEffect(live, clearance, "write:config-json");
	if (begun.status === "invalid") throw new Error(begun.message);
	assert.equal(begun.status, "begun");
	assert.equal(begun.state.piActionProposals.length, 0);
	const observation: EffectObservation = Object.freeze({
		effectObservationId: "effect-observation-action-loop-write",
		workCaseId: begun.effect.workCaseId,
		effectId: begun.effect.effectId,
		occurrenceId: begun.effect.occurrenceId,
		evidence: Object.freeze({
			kind: "tool-result",
			locator: "pi:tool-result:write-config-json",
			fingerprint: "d".repeat(64),
		}),
		statement: "The exact write tool returned without an error marker.",
		limitations: Object.freeze([
			"The return alone does not establish unrelated filesystem state.",
		]),
		provenance: Object.freeze({ kind: "tool", source: "pi:tool-result" }),
	});
	const effectCheckpoints: SdkActionLoopCheckpoint[] = [];
	const settled = await progressActionLoopWithSdk({
		request: "Settle the exact observed write Effect.",
		state: {
			...state,
			workCase: begun.state.workCase,
		},
		capabilities: [],
		effectObservations: [observation],
		actions: [writeAction],
		authorizeAction() {
			throw new Error("Effect settlement must not propose another Action.");
		},
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "observed-success",
						observation_status_0: "relied-on",
						observation_basis_0:
							"The exact current host Observation supports the intended Effect.",
						intended_status_0: "observed",
						intended_basis_0:
							"The exact write result explicitly supports the intended file Effect.",
						intended_0_observation_0: true,
						basis_json:
							'["Every current Observation and intended Effect is explicitly accounted for."]',
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			effectCheckpoints.push(checkpoint);
		},
	});
	assert.equal(settled.status, "effect-settled");
	if (settled.status !== "effect-settled") return;
	assert.equal(settled.outcome, "observed-success");
	assert.deepEqual(
		effectCheckpoints.map(({ kind }) => kind),
		["effect-settled"],
	);
	const effectCheckpoint = effectCheckpoints[0];
	if (effectCheckpoint?.kind !== "effect-settled") return;
	const effectEvent = sessionEventForSdkCheckpoint(effectCheckpoint);
	assert.equal(effectEvent.kind, "effect-settled");
	if (effectEvent.kind !== "effect-settled") return;
	const replayedSettlement = settleLiveEffect(
		Object.freeze({
			...begun.state,
			effectObservations: Object.freeze([observation]),
		}),
		effectEvent.effectId,
		effectEvent.proposal,
	);
	assert.notEqual(replayedSettlement.status, "invalid");
	if (replayedSettlement.status === "invalid") return;
	assert.equal(
		"effectSettlementId" in replayedSettlement.assessment
			? replayedSettlement.assessment.effectSettlementId
			: replayedSettlement.assessment.effectAssessmentId,
		effectEvent.expected.assessmentId,
	);
	const settledLive = reproduceSdkActionLoopCheckpoint(
		Object.freeze({
			...begun.state,
			effectObservations: Object.freeze([observation]),
		}),
		effectCheckpoint,
	);
	assert.equal(settledLive.workCase.currentEffectAssessments.length, 1);
	const postEffectCheckpoints: SdkActionLoopCheckpoint[] = [];
	const postEffect = await progressActionLoopWithSdk({
		request: "Continue after exact Effect settlement.",
		state: settled.state,
		capabilities: [],
		effectObservations: [observation],
		actions: [writeAction],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						...judgmentProposal,
						category: "Proportionate Intervention",
						subject: "Whether the settled Effect attained the Outcome",
						question:
							"Does current post-Effect evidence warrant another Action, Completion, or nonterminal continuity?",
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			postEffectCheckpoints.push(checkpoint);
		},
	});
	assert.equal(postEffect.status, "bounded-stop");
	if (postEffect.status !== "bounded-stop") return;
	assert.equal(postEffect.stage, "inventory");
	assert.deepEqual(
		postEffectCheckpoints.map(({ kind }) => kind),
		["judgment-opened"],
	);
	const postEffectJudgment = postEffectCheckpoints[0];
	if (postEffectJudgment?.kind !== "judgment-opened") return;
	assert.equal(
		postEffectJudgment.result.judgment.category,
		"Proportionate Intervention",
	);
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
