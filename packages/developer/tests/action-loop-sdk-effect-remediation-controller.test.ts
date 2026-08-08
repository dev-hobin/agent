import assert from "node:assert/strict";
import test from "node:test";

import type { EffectSettlement } from "../src/action-loop/effect/effect-settlement.ts";
import { resolveEffectRemediationWithSdk } from "../src/action-loop/sdk/effect-remediation-controller.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

function settlement(
	effectId: string,
	outcome: EffectSettlement["outcome"],
): EffectSettlement {
	return Object.freeze({
		effectSettlementId: `settlement-${effectId}-${outcome}`,
		workCaseId: "work-case-remediation-sdk",
		effectId,
		actionClearanceId: `clearance-${effectId}`,
		occurrenceId: `occurrence-${effectId}`,
		outcome,
		observationDispositions: Object.freeze([]),
		intendedEffectDispositions: Object.freeze([]),
		basis: Object.freeze([`Current evidence accounts for ${effectId}.`]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
	});
}

test("SDK Effect remediation binds one exact adverse settlement to observed success", async () => {
	const result = await resolveEffectRemediationWithSdk({
		request: "Repair the partially applied configuration change.",
		workCaseId: "work-case-remediation-sdk",
		adverseSettlements: [settlement("effect-adverse", "partially-applied")],
		successfulSettlements: [settlement("effect-repair", "observed-success")],
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
	});

	assert.equal(result.status, "remediated");
	if (result.status !== "remediated") return;
	assert.equal(result.remediation.adverseEffectId, "effect-adverse");
	assert.equal(result.remediation.remediationEffectId, "effect-repair");
	assert.equal(result.decision.toolCalls, 1);
	assert.equal(result.decision.toolErrors, 0);
});

test("SDK Effect remediation preserves explicit refusal without mutation", async () => {
	const result = await resolveEffectRemediationWithSdk({
		request: "Determine whether current success repairs the failed Effect.",
		workCaseId: "work-case-remediation-sdk",
		adverseSettlements: [settlement("effect-adverse", "failed")],
		successfulSettlements: [settlement("effect-unrelated", "observed-success")],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "refuse",
						basis_json: "[]",
						refusal_reasons_json:
							'["The successful Effect concerns a different state and does not establish repair."]',
					},
				],
			},
		]),
	});

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.deepEqual(result.refusalReasons, [
		"The successful Effect concerns a different state and does not establish repair.",
	]);
});

test("SDK Effect remediation retries a non-canonical relation before acceptance", async () => {
	const adverse = settlement("effect-adverse", "partially-applied");
	const result = await resolveEffectRemediationWithSdk({
		request: "Bind only a distinct successful repair.",
		workCaseId: "work-case-remediation-sdk",
		adverseSettlements: [adverse],
		successfulSettlements: [
			{ ...adverse, outcome: "observed-success" },
			settlement("effect-repair", "observed-success"),
		],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "remediate",
						adverse_effect: "adverse_0",
						remediation_effect: "success_0",
						basis_json: '["An Effect cannot repair itself."]',
						refusal_reasons_json: "[]",
					},
					{
						outcome: "remediate",
						adverse_effect: "adverse_0",
						remediation_effect: "success_1",
						basis_json:
							'["The distinct repair Effect restores the partial state."]',
						refusal_reasons_json: "[]",
					},
				],
			},
		]),
	});

	assert.equal(result.status, "remediated");
	if (result.status !== "remediated") return;
	assert.equal(result.remediation.remediationEffectId, "effect-repair");
	assert.equal(result.decision.toolCalls, 2);
	assert.equal(result.decision.toolErrors, 1);
});
