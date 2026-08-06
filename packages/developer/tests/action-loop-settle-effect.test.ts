import assert from "node:assert/strict";
import test from "node:test";
import type { EffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import type { PendingEffect } from "../src/action-loop/effect/begin-effect.ts";
import {
	settleEffect,
	type EffectSettlementOutcome,
	type EffectSettlementProposal,
	type IntendedEffectDispositionStatus,
} from "../src/action-loop/effect/effect-settlement.ts";

function effect(intendedEffects = ["The target artifact changed."]): PendingEffect {
	return Object.freeze({
		effectId: "effect-1",
		workCaseId: "work-1",
		actionCandidateId: "action-candidate-1",
		actionClearanceId: "action-clearance-1",
		occurrenceId: "tool-call-1",
		controlledAction: Object.freeze({
			kind: "pi-tool-call",
			fingerprint: "a".repeat(64),
		}),
		intendedEffects: Object.freeze([...intendedEffects]),
		occurrenceSource: "pi:tool_call",
		status: "pending",
	});
}

function observation(id: string, currentEffect = effect()): EffectObservation {
	return Object.freeze({
		effectObservationId: id,
		workCaseId: currentEffect.workCaseId,
		effectId: currentEffect.effectId,
		occurrenceId: currentEffect.occurrenceId,
		evidence: Object.freeze({
			kind: "artifact-state",
			locator: `file:///workspace/${id}`,
			fingerprint: "b".repeat(64),
		}),
		statement: "The current artifact state was observed.",
		limitations: Object.freeze([]),
		provenance: Object.freeze({ kind: "tool", source: "fixture" }),
	});
}

function proposal(input: {
	readonly currentEffect: PendingEffect;
	readonly outcome: EffectSettlementOutcome;
	readonly intendedStatus: IntendedEffectDispositionStatus;
	readonly observations?: readonly EffectObservation[];
}): EffectSettlementProposal {
	const observations = input.observations ?? [];
	return {
		workCaseId: input.currentEffect.workCaseId,
		effectId: input.currentEffect.effectId,
		outcome: input.outcome,
		observationDispositions: observations.map((current) => ({
			effectObservationId: current.effectObservationId,
			status: "relied-on",
			basis: ["This observation bears directly on the intended Effect."],
		})),
		intendedEffectDispositions: input.currentEffect.intendedEffects.map(
			(intendedEffect) => ({
				intendedEffect,
				status: input.intendedStatus,
				observationIds: observations.map(
					(current) => current.effectObservationId,
				),
				basis: ["The cited evidence supports this Effect disposition."],
			}),
		),
		basis: ["All current observations and intended Effects are accounted."],
		provenance: { kind: "model", source: "settlement-adapter" },
	};
}

test("settled outcomes are derived from intended Effect dispositions", () => {
	for (const [status, outcome] of [
		["observed", "observed-success"],
		["not-observed", "observed-no-effect"],
		["failed", "failed"],
		["partially-observed", "partially-applied"],
	] as const) {
		const currentEffect = effect();
		const observations = [observation(`observation-${status}`, currentEffect)];
		const result = settleEffect(
			currentEffect,
			observations,
			proposal({
				currentEffect,
				outcome,
				intendedStatus: status,
				observations,
			}),
		);
		assert.equal(result.status, "settled", outcome);
		if (result.status === "settled") {
			assert.equal(result.value.outcome, outcome);
			assert.match(
				result.value.effectSettlementId,
				/^effect_settlement_[a-f0-9]{64}$/,
			);
		}
	}
});

test("pending and unknown remain explicit unsettled outcomes", () => {
	const currentEffect = effect();
	const pending = settleEffect(
		currentEffect,
		[],
		proposal({
			currentEffect,
			outcome: "pending",
			intendedStatus: "unknown",
		}),
	);
	const observations = [observation("observation-unknown", currentEffect)];
	const unknown = settleEffect(
		currentEffect,
		observations,
		proposal({
			currentEffect,
			outcome: "unknown",
			intendedStatus: "unknown",
			observations,
		}),
	);

	assert.equal(pending.status, "unsettled");
	assert.equal(unknown.status, "unsettled");
	if (pending.status === "unsettled") {
		assert.equal(pending.value.outcome, "pending");
	}
	if (unknown.status === "unsettled") {
		assert.equal(unknown.value.outcome, "unknown");
	}
});

test("mixed observed and absent Effects derive partially-applied", () => {
	const currentEffect = effect(["Artifact changed.", "Registry changed."]);
	const observations = [observation("observation-mixed", currentEffect)];
	const input = proposal({
		currentEffect,
		outcome: "partially-applied",
		intendedStatus: "observed",
		observations,
	});
	const result = settleEffect(currentEffect, observations, {
		...input,
		intendedEffectDispositions: [
			input.intendedEffectDispositions[0]!,
			{
				...input.intendedEffectDispositions[1]!,
				status: "not-observed",
			},
		],
	});

	assert.equal(result.status, "settled");
	if (result.status === "settled") {
		assert.equal(result.value.outcome, "partially-applied");
	}
});

test("proposal cannot overstate derived outcome or omit accounting", () => {
	const currentEffect = effect();
	const observations = [observation("observation-1", currentEffect)];
	const success = proposal({
		currentEffect,
		outcome: "observed-success",
		intendedStatus: "observed",
		observations,
	});
	const fixtures = [
		{
			proposal: { ...success, outcome: "observed-no-effect" as const },
			code: "outcome-mismatch",
		},
		{
			proposal: { ...success, observationDispositions: [] },
			code: "observation-accounting",
		},
		{
			proposal: {
				...success,
				intendedEffectDispositions: [
					{ ...success.intendedEffectDispositions[0]!, observationIds: [] },
				],
			},
			code: "evidence-required",
		},
		{
			proposal: { ...success, effectId: "effect-other" },
			code: "identity-mismatch",
		},
	] as const;

	for (const fixture of fixtures) {
		const result = settleEffect(currentEffect, observations, fixture.proposal);
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid") assert.equal(result.error.code, fixture.code);
	}
});
