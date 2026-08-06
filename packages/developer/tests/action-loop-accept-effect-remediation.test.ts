import assert from "node:assert/strict";
import test from "node:test";
import type { EffectSettlement } from "../src/action-loop/effect/effect-settlement.ts";
import {
	acceptEffectRemediation,
	type EffectRemediationProposal,
} from "../src/action-loop/effect/accept-effect-remediation.ts";

function settlement(
	effectId: string,
	outcome: EffectSettlement["outcome"],
	workCaseId = "work-case-remediation",
): EffectSettlement {
	return Object.freeze({
		effectSettlementId: `settlement-${effectId}-${outcome}`,
		workCaseId,
		effectId,
		actionClearanceId: `clearance-${effectId}`,
		occurrenceId: `occurrence-${effectId}`,
		outcome,
		observationDispositions: [],
		intendedEffectDispositions: [],
		basis: ["The settlement is test evidence."],
		provenance: { kind: "model" as const, source: "test-evaluator" },
	});
}

function proposal(
	adverse: EffectSettlement,
	remediation: EffectSettlement,
): EffectRemediationProposal {
	return {
		workCaseId: adverse.workCaseId,
		adverseEffectId: adverse.effectId,
		adverseEffectSettlementId: adverse.effectSettlementId,
		remediationEffectId: remediation.effectId,
		remediationEffectSettlementId: remediation.effectSettlementId,
		basis: [
			"The second Effect restored the consequence left adverse by the first.",
		],
		provenance: { kind: "model" as const, source: "test-evaluator" },
	};
}

test("a distinct observed-success Effect remediates one adverse settlement", () => {
	const adverse = settlement("effect-adverse", "partially-applied");
	const remediation = settlement("effect-remediation", "observed-success");
	const accepted = acceptEffectRemediation(
		adverse,
		remediation,
		proposal(adverse, remediation),
	);
	const anotherEvaluator = acceptEffectRemediation(adverse, remediation, {
		...proposal(adverse, remediation),
		provenance: { kind: "human", source: "reviewer" },
	});

	assert.equal(accepted.status, "accepted");
	assert.equal(anotherEvaluator.status, "accepted");
	if (accepted.status !== "accepted" || anotherEvaluator.status !== "accepted") {
		return;
	}
	assert.match(
		accepted.value.effectRemediationId,
		/^effect_remediation_[a-f0-9]{64}$/,
	);
	assert.equal(
		accepted.value.effectRemediationId,
		anotherEvaluator.value.effectRemediationId,
	);
	assert.equal(accepted.value.adverseEffectId, adverse.effectId);
	assert.equal(accepted.value.remediationEffectId, remediation.effectId);
	assert.ok(Object.isFrozen(accepted.value));
});

test("success cannot rewrite a non-adverse or same Effect as remediation", () => {
	const successful = settlement("effect-success", "observed-success");
	const noEffect = settlement("effect-no-effect", "observed-no-effect");
	const adverse = settlement("effect-adverse", "failed");
	const same = settlement("effect-adverse", "observed-success");

	assert.equal(
		acceptEffectRemediation(successful, noEffect, proposal(successful, noEffect))
			.status,
		"invalid",
	);
	assert.equal(
		acceptEffectRemediation(adverse, noEffect, proposal(adverse, noEffect)).status,
		"invalid",
	);
	assert.equal(
		acceptEffectRemediation(adverse, same, proposal(adverse, same)).status,
		"invalid",
	);
});

test("cross-Case, stale, or basis-free remediation fails closed", () => {
	const adverse = settlement("effect-adverse", "failed");
	const remediation = settlement("effect-remediation", "observed-success");
	const valid = proposal(adverse, remediation);

	for (const attempted of [
		{ ...valid, adverseEffectSettlementId: "settlement-stale" },
		{ ...valid, workCaseId: "work-case-other" },
		{ ...valid, basis: [] },
		{ ...valid, basis: ["same", " same "] },
	]) {
		assert.equal(
			acceptEffectRemediation(adverse, remediation, attempted).status,
			"invalid",
		);
	}
});
