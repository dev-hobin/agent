import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptEffectObservation,
	type EffectObservationProposal,
} from "../src/action-loop/effect/effect-observation.ts";
import type { PendingEffect } from "../src/action-loop/effect/begin-effect.ts";

const effect: PendingEffect = Object.freeze({
	effectId: "effect-1",
	workCaseId: "work-1",
	actionCandidateId: "action-candidate-1",
	actionClearanceId: "action-clearance-1",
	occurrenceId: "tool-call-1",
	controlledAction: Object.freeze({
		kind: "pi-tool-call",
		fingerprint: "a".repeat(64),
	}),
	intendedEffects: Object.freeze([
		"The target file contains the accepted implementation.",
	]),
	occurrenceSource: "pi:tool_call",
	status: "pending",
});

function proposal(
	overrides: Partial<EffectObservationProposal> = {},
): EffectObservationProposal {
	return {
		workCaseId: effect.workCaseId,
		effectId: effect.effectId,
		occurrenceId: effect.occurrenceId,
		evidence: {
			kind: "artifact-state",
			locator: "file:///workspace/src/target.ts",
			fingerprint: "b".repeat(64),
		},
		statement: "The target file contains the accepted implementation.",
		limitations: ["No external registry state was observed."],
		provenance: { kind: "tool", source: "filesystem-observer" },
		...overrides,
	};
}

test("exact evidence becomes one immutable Effect Observation", () => {
	const first = acceptEffectObservation(effect, proposal());
	const repeated = acceptEffectObservation(
		effect,
		proposal({ provenance: { kind: "human", source: "reviewer-one" } }),
	);

	assert.equal(first.status, "accepted");
	assert.equal(repeated.status, "accepted");
	if (first.status !== "accepted" || repeated.status !== "accepted") return;
	assert.match(
		first.value.effectObservationId,
		/^effect_observation_[a-f0-9]{64}$/,
	);
	assert.equal(
		repeated.value.effectObservationId,
		first.value.effectObservationId,
	);
	assert.notDeepEqual(first.value.provenance, repeated.value.provenance);
	assert.equal("settlement" in first.value, false);
	assert.equal("observedSuccess" in first.value, false);
	assert.equal(Object.isFrozen(first.value), true);
	assert.equal(Object.isFrozen(first.value.evidence), true);
});

test("tool result remains an Observation rather than implicit success", () => {
	const result = acceptEffectObservation(
		effect,
		proposal({
			evidence: {
				kind: "tool-result",
				locator: "pi:tool-result/tool-call-1",
				fingerprint: "c".repeat(64),
			},
			statement: "The tool returned exit status zero.",
			limitations: ["The intended artifact Effect has not been observed."],
		}),
	);

	assert.equal(result.status, "accepted");
	if (result.status === "accepted") {
		assert.equal(result.value.evidence.kind, "tool-result");
		assert.equal("status" in result.value, false);
	}
});

test("cross-Effect, malformed, or unbounded evidence is rejected", () => {
	const fixtures: Array<{
		overrides: Partial<EffectObservationProposal>;
		code: string;
	}> = [
		{ overrides: { effectId: "effect-other" }, code: "identity-mismatch" },
		{
			overrides: { occurrenceId: "tool-call-other" },
			code: "identity-mismatch",
		},
		{
			overrides: {
				evidence: {
					kind: "artifact-state",
					locator: "file:///workspace/src/target.ts",
					fingerprint: "not-a-hash",
				},
			},
			code: "invalid-evidence-fingerprint",
		},
		{ overrides: { statement: " " }, code: "empty-statement" },
		{
			overrides: { limitations: ["Bounded.", " Bounded. "] },
			code: "duplicate-value",
		},
		{
			overrides: { provenance: { kind: "tool", source: " " } },
			code: "invalid-provenance",
		},
	];

	for (const fixture of fixtures) {
		const result = acceptEffectObservation(effect, proposal(fixture.overrides));
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid") {
			assert.equal(result.error.code, fixture.code);
		}
	}
});
