import assert from "node:assert/strict";
import test from "node:test";
import { acceptActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import { acceptActionClearance } from "../src/action-loop/action/action-clearance.ts";
import { acceptEffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import { settleEffect } from "../src/action-loop/effect/effect-settlement.ts";
import { beginEffect } from "../src/action-loop/effect/begin-effect.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";

const conclusion: JudgmentConclusion = Object.freeze({
	conclusionId: "conclusion-intervention",
	workCaseId: "work-action-slice",
	judgmentId: "judgment-intervention",
	category: "Proportionate Intervention",
	subject: "The bounded implementation action is warranted.",
	contextRevisionId: "context-action-slice",
	requirementDispositions: Object.freeze([]),
	coverageIds: Object.freeze([]),
	basis: Object.freeze(["The bounded action is proportionate to the Outcome."]),
	provenance: Object.freeze({ kind: "model", source: "slice-fixture" }),
	answer: "Proceed with the exact bounded implementation action.",
});

test("cleared Action reaches observed-success without implying completion", () => {
	const candidate = acceptActionCandidate({
		workCaseId: conclusion.workCaseId,
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint: "a".repeat(64),
		},
		summary: "Apply the exact bounded implementation change.",
		intendedEffects: ["The target artifact contains the accepted change."],
		requiredConclusionIds: [conclusion.conclusionId],
		provenance: { kind: "model", source: "slice-fixture" },
	});
	if (candidate.status !== "accepted") throw new Error(candidate.error.message);

	const clearance = acceptActionClearance(
		candidate.value,
		[conclusion],
		{
			actionCandidateId: candidate.value.actionCandidateId,
			status: "granted",
			source: "delegation:current-user-request",
			basis: ["The current delegation permits this bounded action."],
		},
		{
			workCaseId: candidate.value.workCaseId,
			actionCandidateId: candidate.value.actionCandidateId,
			conclusionIds: [conclusion.conclusionId],
			warrantBasis: ["The required intervention Judgment is concluded."],
			provenance: { kind: "model", source: "slice-fixture" },
		},
	);
	if (clearance.status !== "cleared") {
		throw new Error(`Expected clearance, received ${clearance.status}`);
	}

	const effect = beginEffect(clearance.value, {
		occurrenceId: "tool-call-action-slice",
		actionClearanceId: clearance.value.actionClearanceId,
		controlledAction: clearance.value.controlledAction,
		source: "pi:tool_call",
	});
	if (effect.status !== "begun") throw new Error(effect.error.message);

	const observation = acceptEffectObservation(effect.value, {
		workCaseId: effect.value.workCaseId,
		effectId: effect.value.effectId,
		occurrenceId: effect.value.occurrenceId,
		evidence: {
			kind: "artifact-state",
			locator: "file:///workspace/src/target.ts",
			fingerprint: "b".repeat(64),
		},
		statement: "The target artifact contains the accepted change.",
		limitations: [],
		provenance: { kind: "tool", source: "filesystem-observer" },
	});
	if (observation.status !== "accepted") {
		throw new Error(observation.error.message);
	}

	const intendedEffect = effect.value.intendedEffects[0];
	if (intendedEffect === undefined) throw new Error("Expected intended Effect");
	const settlement = settleEffect(effect.value, [observation.value], {
		workCaseId: effect.value.workCaseId,
		effectId: effect.value.effectId,
		outcome: "observed-success",
		observationDispositions: [
			{
				effectObservationId: observation.value.effectObservationId,
				status: "relied-on",
				basis: ["The exact artifact state bears on the intended Effect."],
			},
		],
		intendedEffectDispositions: [
			{
				intendedEffect,
				status: "observed",
				observationIds: [observation.value.effectObservationId],
				basis: ["The observed artifact state satisfies the intended Effect."],
			},
		],
		basis: ["Every current Observation and intended Effect is accounted."],
		provenance: { kind: "model", source: "slice-fixture" },
	});

	assert.equal(settlement.status, "settled");
	if (settlement.status === "settled") {
		assert.equal(settlement.value.outcome, "observed-success");
		assert.equal("workStatus" in settlement.value, false);
		assert.equal("closureClaim" in settlement.value, false);
	}
});
