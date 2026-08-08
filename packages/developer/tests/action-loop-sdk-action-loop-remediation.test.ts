import assert from "node:assert/strict";
import test from "node:test";

import {
	applySdkActionLoopCheckpoint,
	sdkActionLoopCheckpointEvent,
} from "../extensions/action-loop-sdk-progression.ts";
import { acceptActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import { acceptActionClearance } from "../src/action-loop/action/action-clearance.ts";
import {
	beginEffect,
	type PendingEffect,
} from "../src/action-loop/effect/begin-effect.ts";
import type { EffectSettlement } from "../src/action-loop/effect/effect-settlement.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import {
	progressActionLoopWithSdk,
	type SdkActionLoopCheckpoint,
} from "../src/action-loop/sdk/action-loop-progression-controller.ts";
import type { SdkActionLoopState } from "../src/action-loop/sdk/action-loop-state.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { recordWorkCaseEffectAssessment } from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import {
	openWorkCase,
	type ActiveWorkCase,
} from "../src/action-loop/work/work-case.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

function intervention(
	workCaseId: string,
	name: string,
	disposition: "action-required" | "no-action" = "action-required",
): JudgmentConclusion {
	return Object.freeze({
		conclusionId: `conclusion-${name}`,
		workCaseId,
		judgmentId: `judgment-${name}`,
		category: "Proportionate Intervention",
		subject: `The ${name} intervention`,
		contextRevisionId: `context-${name}`,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze([`The ${name} intervention has explicit basis.`]),
		answer:
			disposition === "action-required"
				? `Apply the ${name} intervention.`
				: `No ${name} Action is proportionate.`,
		interventionDisposition: disposition,
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
	});
}

function addEffect(
	workCase: ActiveWorkCase,
	warrant: JudgmentConclusion,
	label: string,
): { readonly workCase: ActiveWorkCase; readonly effect: PendingEffect } {
	const candidate = acceptActionCandidate({
		workCaseId: workCase.workCaseId,
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint: (label === "adverse" ? "a" : "b").repeat(64),
		},
		summary: `Run ${label}.`,
		intendedEffects: [`${label} reaches its intended state.`],
		requiredConclusionIds: [warrant.conclusionId],
		provenance: { kind: "model", source: "sdk:test" },
	});
	if (candidate.status !== "accepted") throw new Error(candidate.error.message);
	const withCandidate = recordWorkCaseActionCandidate(
		workCase,
		candidate.value,
	);
	if (withCandidate.status !== "recorded")
		throw new Error(withCandidate.status);
	const clearance = acceptActionClearance(
		candidate.value,
		[warrant],
		{
			actionCandidateId: candidate.value.actionCandidateId,
			status: "granted",
			source: "pi:test-host",
			basis: ["The test host grants this exact bounded Action."],
		},
		{
			workCaseId: workCase.workCaseId,
			actionCandidateId: candidate.value.actionCandidateId,
			conclusionIds: [warrant.conclusionId],
			warrantBasis: ["The current Conclusion warrants this Action."],
			provenance: { kind: "model", source: "sdk:test" },
		},
	);
	if (clearance.status !== "cleared") throw new Error(clearance.status);
	const withClearance = recordWorkCaseActionClearance(
		withCandidate.value,
		clearance.value,
	);
	if (withClearance.status !== "recorded")
		throw new Error(withClearance.status);
	const effect = beginEffect(clearance.value, {
		occurrenceId: `occurrence-${label}`,
		actionClearanceId: clearance.value.actionClearanceId,
		controlledAction: clearance.value.controlledAction,
		source: "pi:tool_call",
	});
	if (effect.status !== "begun") throw new Error(effect.error.message);
	const recorded = recordWorkCaseEffect(withClearance.value, effect.value);
	if (recorded.status !== "recorded") throw new Error(recorded.status);
	return { workCase: recorded.value, effect: effect.value };
}

function settlement(
	effect: PendingEffect,
	outcome: EffectSettlement["outcome"],
): EffectSettlement {
	return Object.freeze({
		effectSettlementId: `settlement-${effect.effectId}-${outcome}`,
		workCaseId: effect.workCaseId,
		effectId: effect.effectId,
		actionClearanceId: effect.actionClearanceId,
		occurrenceId: effect.occurrenceId,
		outcome,
		observationDispositions: Object.freeze([]),
		intendedEffectDispositions: Object.freeze([]),
		basis: Object.freeze([`Current evidence accounts for ${effect.effectId}.`]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
	});
}

function remediationFixture(includeSuccess: boolean): {
	readonly state: SdkActionLoopState;
	readonly adverse: EffectSettlement;
	readonly successful?: EffectSettlement;
} {
	const opened = openWorkCase({
		outcome: {
			statement: "The adverse consequence is repaired without hiding history.",
			acceptanceConditions: ["The accepted final state is observed."],
			constraints: ["The failed occurrence remains accounted for."],
		},
		provenance: { kind: "human", source: "sdk:test" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const original = intervention(opened.value.workCaseId, "original");
	const concluded = recordWorkCaseConclusion(opened.value, original);
	if (concluded.status !== "recorded") throw new Error(concluded.status);
	const adverseEffect = addEffect(concluded.value, original, "adverse");
	const adverse = settlement(adverseEffect.effect, "partially-applied");
	const withAdverse = recordWorkCaseEffectAssessment(
		adverseEffect.workCase,
		adverse,
		null,
	);
	if (withAdverse.status !== "recorded") throw new Error(withAdverse.status);
	let workCase = withAdverse.value;
	let successful: EffectSettlement | undefined;
	if (includeSuccess) {
		const repairEffect = addEffect(workCase, original, "repair");
		successful = settlement(repairEffect.effect, "observed-success");
		const withSuccess = recordWorkCaseEffectAssessment(
			repairEffect.workCase,
			successful,
			null,
		);
		if (withSuccess.status !== "recorded") throw new Error(withSuccess.status);
		workCase = withSuccess.value;
	}
	return {
		state: {
			workCase,
			applicabilityAssessments: [],
			assignments: [],
			selections: [],
			contexts: [],
			contributions: [],
			coverages: [],
		},
		adverse,
		...(successful ? { successful } : {}),
	};
}

test("adverse Effect progression opens a fresh remediation intervention Judgment", async () => {
	const fixture = remediationFixture(false);
	const checkpoints: SdkActionLoopCheckpoint[] = [];
	const result = await progressActionLoopWithSdk({
		request: "Repair the partially applied change.",
		state: fixture.state,
		capabilities: [],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						category: "Proportionate Intervention",
						subject: "The unresolved partially applied Effect",
						question: "Which bounded remediation is proportionate?",
						requirements_json:
							'[{"statement":"The remediation addresses the exact adverse consequence.","contribution_needs":["A bounded repair candidate and its risks"]}]',
						basis_json:
							'["The current failed or partially-applied Effect blocks completion."]',
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

test("only the fresh remediation intervention can warrant the next Action", async () => {
	const fixture = remediationFixture(false);
	const fresh = intervention(fixture.state.workCase.workCaseId, "repair");
	const recorded = recordWorkCaseConclusion(fixture.state.workCase, fresh);
	if (recorded.status !== "recorded") throw new Error(recorded.status);
	const result = await progressActionLoopWithSdk({
		request: "Apply the bounded repair.",
		state: { ...fixture.state, workCase: recorded.value },
		capabilities: [],
		runner: scriptedSdkRunner([]),
		maxSteps: 1,
		checkpoint() {
			throw new Error("No checkpoint is expected before Action proposal.");
		},
	});

	assert.equal(result.status, "ready-for-action");
	if (result.status !== "ready-for-action") return;
	assert.deepEqual(result.conclusionIds, [fresh.conclusionId]);
});

test("no-action remediation disposition preserves a nonterminal adverse blocker", async () => {
	const fixture = remediationFixture(false);
	const noAction = intervention(
		fixture.state.workCase.workCaseId,
		"unsafe-repair",
		"no-action",
	);
	const recorded = recordWorkCaseConclusion(fixture.state.workCase, noAction);
	if (recorded.status !== "recorded") throw new Error(recorded.status);
	const result = await progressActionLoopWithSdk({
		request: "Do not accept the adverse state as completion.",
		state: { ...fixture.state, workCase: recorded.value },
		capabilities: [],
		runner: scriptedSdkRunner([]),
		maxSteps: 1,
		checkpoint() {
			throw new Error("No checkpoint is expected for an unresolved blocker.");
		},
	});

	assert.equal(result.status, "remediation-required");
	if (result.status !== "remediation-required") return;
	assert.deepEqual(result.adverseEffectIds, [fixture.adverse.effectId]);
});

test("successful repair is canonically remediated and checkpointed before projection mutation", async () => {
	const fixture = remediationFixture(true);
	const checkpoints: SdkActionLoopCheckpoint[] = [];
	const result = await progressActionLoopWithSdk({
		request: "Bind the successful repair to the partially applied Effect.",
		state: fixture.state,
		capabilities: [],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "remediate",
						adverse_effect: "adverse_0",
						remediation_effect: "success_0",
						basis_json:
							'["The successful repair Effect restores the state left partial by the adverse Effect."]',
						refusal_reasons_json: "[]",
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint(checkpoint) {
			checkpoints.push(checkpoint);
		},
	});

	assert.equal(result.status, "effect-remediated");
	if (result.status !== "effect-remediated") return;
	assert.equal(result.adverseEffectId, fixture.adverse.effectId);
	assert.equal(result.remediationEffectId, fixture.successful?.effectId);
	assert.deepEqual(
		checkpoints.map(({ kind }) => kind),
		["effect-remediated"],
	);
	const checkpoint = checkpoints[0];
	if (checkpoint?.kind !== "effect-remediated") return;
	const event = sdkActionLoopCheckpointEvent(checkpoint);
	assert.equal(event.kind, "effect-remediated");
	const applied = applySdkActionLoopCheckpoint(
		{
			workCase: fixture.state.workCase,
			openingBasis: ["The test owns this bounded Work Case."],
			applicabilityAssessments: [],
			capabilityAssignments: [],
			referenceSelections: [],
			sealedSkillContexts: [],
			contributions: [],
			needCoverages: [],
			piActionProposals: [],
			effectObservations: [],
		},
		checkpoint,
	);
	assert.equal(applied.workCase.effectRemediations.length, 1);
	assert.equal(applied.workCase.revisionId, checkpoint.workCase.revisionId);
});

test("failed remediation checkpoint leaves the acknowledged projection unchanged", async () => {
	const fixture = remediationFixture(true);
	const result = await progressActionLoopWithSdk({
		request: "Checkpoint the exact repair relation before dependent work.",
		state: fixture.state,
		capabilities: [],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "remediate",
						adverse_effect: "adverse_0",
						remediation_effect: "success_0",
						basis_json:
							'["The successful repair Effect restores the adverse state."]',
						refusal_reasons_json: "[]",
					},
				],
			},
		]),
		maxSteps: 1,
		checkpoint() {
			throw new Error("Pi branch remediation checkpoint failed");
		},
	});

	assert.equal(result.status, "checkpoint-failure");
	if (result.status !== "checkpoint-failure") return;
	assert.equal(result.stage, "remediation");
	assert.equal(result.pendingCheckpoint.kind, "effect-remediated");
	assert.equal(result.state?.workCase.effectRemediations.length, 0);
});
