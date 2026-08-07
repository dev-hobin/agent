import assert from "node:assert/strict";
import test from "node:test";

import { sdkEffectSettledEvent } from "../extensions/action-loop-sdk-session.ts";
import type { PendingEffect } from "../src/action-loop/effect/begin-effect.ts";
import type { EffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import { settleEffectWithSdk } from "../src/action-loop/sdk/effect-controller.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const effect: PendingEffect = Object.freeze({
	effectId: "effect-sdk-settlement",
	workCaseId: "work-sdk-settlement",
	actionCandidateId: "candidate-sdk-settlement",
	actionClearanceId: "clearance-sdk-settlement",
	occurrenceId: "occurrence-sdk-settlement",
	controlledAction: Object.freeze({
		kind: "pi-tool-call:write",
		fingerprint: "c".repeat(64),
	}),
	intendedEffects: Object.freeze([
		"config.json contains the accepted enabled value.",
	]),
	occurrenceSource: "pi:tool-call",
	status: "pending",
});

const observation: EffectObservation = Object.freeze({
	effectObservationId: "observation-sdk-settlement",
	workCaseId: effect.workCaseId,
	effectId: effect.effectId,
	occurrenceId: effect.occurrenceId,
	evidence: Object.freeze({
		kind: "tool-result",
		locator: "pi:tool-result:occurrence-sdk-settlement",
		fingerprint: "d".repeat(64),
	}),
	statement:
		"The write tool returned exact content for config.json without an error marker.",
	limitations: Object.freeze([
		"The return alone does not prove the resulting filesystem state.",
	]),
	provenance: Object.freeze({ kind: "tool", source: "pi:tool-result" }),
});

test("SDK Effect settlement rejects implicit success and accepts complete accounting", async () => {
	const result = await settleEffectWithSdk({
		request: "Write and verify the accepted bounded configuration.",
		effect,
		observations: [observation],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "observed-success",
						observation_status_0: "relied-on",
						observation_basis_0: "The tool return is current exact evidence.",
						intended_status_0: "unknown",
						intended_basis_0:
							"Filesystem state has not yet been distinguished.",
						intended_0_observation_0: true,
						basis_json:
							'["The tool return is evidence but cannot overstate the intended Effect."]',
					},
					{
						outcome: "observed-success",
						observation_status_0: "relied-on",
						observation_basis_0:
							"The exact current host Observation supports the intended Effect.",
						intended_status_0: "observed",
						intended_basis_0:
							"The current Observation is explicitly relied on for this intended Effect.",
						intended_0_observation_0: true,
						basis_json:
							'["Every current Observation and intended Effect is explicitly accounted for."]',
					},
				],
			},
		]),
	});
	assert.equal(result.status, "settled");
	if (result.status !== "settled") return;
	assert.equal(result.settlement.outcome, "observed-success");
	assert.deepEqual(
		result.settlement.observationDispositions.map(
			({ effectObservationId }) => effectObservationId,
		),
		[observation.effectObservationId],
	);
	assert.equal(result.decision.toolCalls, 2);
	assert.equal(result.decision.toolErrors, 1);
	const event = sdkEffectSettledEvent({
		result,
		revisionId: "revision-after-effect-settlement",
	});
	assert.equal(event.kind, "effect-settled");
	assert.equal(
		event.expected.assessmentId,
		result.settlement.effectSettlementId,
	);
});

test("SDK Effect assessment preserves pending when no Observation has arrived", async () => {
	const result = await settleEffectWithSdk({
		request: "Determine the current Effect state.",
		effect,
		observations: [],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "pending",
						intended_status_0: "unknown",
						intended_basis_0:
							"No current exact Observation distinguishes the Effect.",
						basis_json:
							'["Absence of Observation is preserved as unknown rather than success."]',
					},
				],
			},
		]),
	});
	assert.equal(result.status, "unsettled");
	if (result.status !== "unsettled") return;
	assert.equal(result.assessment.outcome, "pending");
});
