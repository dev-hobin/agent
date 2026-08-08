import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	acceptEffectRemediation,
	type EffectRemediation,
} from "../effect/accept-effect-remediation.ts";
import type { EffectSettlement } from "../effect/effect-settlement.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { isSdkProposalObject } from "./proposal-object.ts";
import { decodeSdkStringList } from "./proposal-json.ts";

const remediationOutcomes = ["remediate", "refuse"] as const;

interface EffectRemediationDecision {
	readonly outcome: (typeof remediationOutcomes)[number];
	readonly remediation?: EffectRemediation;
	readonly refusalReasons: readonly string[];
}

export type SdkEffectRemediationResult =
	| {
			readonly status: "remediated";
			readonly remediation: EffectRemediation;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "refused";
			readonly refusalReasons: readonly string[];
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "bounded-stop";
			readonly reason: SdkDecisionStopReason;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "runtime-failure";
			readonly message: string;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "invariant-failure";
			readonly code: string;
			readonly message: string;
			readonly decision?: SdkDecisionMetrics;
	  };

export interface SdkEffectRemediationInput {
	readonly request: string;
	readonly workCaseId: string;
	readonly adverseSettlements: readonly EffectSettlement[];
	readonly successfulSettlements: readonly EffectSettlement[];
	readonly runner: SdkDecisionRunner;
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function remediationParameters(input: SdkEffectRemediationInput): TSchema {
	return Type.Object(
		{
			outcome: StringEnum(remediationOutcomes),
			adverse_effect: Type.Optional(
				StringEnum(
					input.adverseSettlements.map((_, index) => `adverse_${index}`),
				),
			),
			remediation_effect: Type.Optional(
				StringEnum(
					input.successfulSettlements.map((_, index) => `success_${index}`),
				),
			),
			basis_json: Type.String({
				minLength: 2,
				maxLength: 32_768,
				description:
					'JSON text string encoding a basis array, for example ["Current evidence supports this exact relation."]. Use [] only when refusing.',
			}),
			refusal_reasons_json: Type.String({
				minLength: 2,
				maxLength: 32_768,
				description:
					"JSON text string encoding refusal reasons. Use [] when outcome is remediate; provide one or more strings when outcome is refuse.",
			}),
		},
		{ additionalProperties: false },
	);
}

function selectedIndex(
	value: unknown,
	prefix: string,
	length: number,
): number | undefined {
	if (typeof value !== "string" || !value.startsWith(prefix)) return undefined;
	const index = Number(value.slice(prefix.length));
	return Number.isInteger(index) && index >= 0 && index < length
		? index
		: undefined;
}

function remediationTool(
	input: SdkEffectRemediationInput,
): SdkProposalTool<EffectRemediationDecision> {
	return {
		name: "submit_effect_remediation",
		label: "Submit one Effect remediation disposition",
		description:
			"Bind one exact adverse settlement to one distinct observed-success settlement, or refuse when current evidence does not support that relation.",
		parameters: remediationParameters(input),
		execute: async (raw) => {
			if (!isSdkProposalObject(raw)) {
				return rejected(
					"invalid-arguments",
					"Effect remediation arguments must be an object.",
				);
			}
			const refusalReasons = decodeSdkStringList({
				value: raw.refusal_reasons_json,
				label: "refusal_reasons_json",
				allowEmpty: true,
				maximumItems: 32,
			});
			if (!refusalReasons.ok) {
				return rejected("invalid-refusal-reasons", refusalReasons.message);
			}
			if (raw.outcome === "refuse") {
				if (refusalReasons.value.length === 0) {
					return rejected(
						"missing-refusal-reason",
						"Refusal requires at least one bounded reason.",
					);
				}
				return {
					status: "accepted",
					value: {
						outcome: "refuse",
						refusalReasons: refusalReasons.value,
					},
					message: "Effect remediation was explicitly refused.",
					resultStatus: "refused",
				};
			}
			if (raw.outcome !== "remediate") {
				return rejected(
					"invalid-outcome",
					"outcome must be remediate or refuse.",
				);
			}
			if (refusalReasons.value.length > 0) {
				return rejected(
					"unexpected-refusal-reasons",
					"A remediation proposal cannot include refusal reasons.",
				);
			}
			const adverseIndex = selectedIndex(
				raw.adverse_effect,
				"adverse_",
				input.adverseSettlements.length,
			);
			const remediationIndex = selectedIndex(
				raw.remediation_effect,
				"success_",
				input.successfulSettlements.length,
			);
			if (adverseIndex === undefined || remediationIndex === undefined) {
				return rejected(
					"missing-effect-selection",
					"Remediation must select one current adverse and one current successful Effect.",
				);
			}
			const basis = decodeSdkStringList({
				value: raw.basis_json,
				label: "basis_json",
				allowEmpty: false,
				maximumItems: 32,
			});
			if (!basis.ok) return rejected("invalid-basis", basis.message);
			const adverse = input.adverseSettlements[adverseIndex];
			const remediation = input.successfulSettlements[remediationIndex];
			if (!adverse || !remediation) {
				return rejected(
					"missing-effect-selection",
					"Selected Effect is not in the current bounded inventory.",
				);
			}
			const accepted = acceptEffectRemediation(adverse, remediation, {
				workCaseId: input.workCaseId,
				adverseEffectId: adverse.effectId,
				adverseEffectSettlementId: adverse.effectSettlementId,
				remediationEffectId: remediation.effectId,
				remediationEffectSettlementId: remediation.effectSettlementId,
				basis: basis.value,
				provenance: { kind: "model", source: "pi:sdk-effect-remediation" },
			});
			if (accepted.status === "invalid") {
				return rejected(accepted.error.code, accepted.error.message);
			}
			return {
				status: "accepted",
				value: {
					outcome: "remediate",
					remediation: accepted.value,
					refusalReasons: Object.freeze([]),
				},
				message: "Exact Effect remediation accepted.",
				resultStatus: "remediated",
			};
		},
	};
}

function remediationPrompt(input: SdkEffectRemediationInput): string {
	const adverse = input.adverseSettlements
		.map(
			(settlement, index) =>
				`adverse_${index}: ${settlement.outcome}; ${settlement.basis.join(" ")}`,
		)
		.join("\n");
	const successful = input.successfulSettlements
		.map(
			(settlement, index) =>
				`success_${index}: ${settlement.outcome}; ${settlement.basis.join(" ")}`,
		)
		.join("\n");
	return [
		`Delegated request:\n${input.request}`,
		`Current unresolved adverse Effects:\n${adverse}`,
		`Current observed-success Effects:\n${successful}`,
		"Bind exactly one causal repair only when current evidence supports it. Otherwise refuse; do not accept an adverse Effect as completion.",
	].join("\n\n");
}

/** Proposes and canonically admits one current adverse-to-success remediation. */
export async function resolveEffectRemediationWithSdk(
	input: SdkEffectRemediationInput,
): Promise<SdkEffectRemediationResult> {
	if (input.adverseSettlements.length === 0) {
		return {
			status: "invariant-failure",
			code: "missing-adverse-effect",
			message: "Effect remediation requires a current adverse settlement.",
		};
	}
	if (input.successfulSettlements.length === 0) {
		return {
			status: "invariant-failure",
			code: "missing-successful-effect",
			message:
				"Effect remediation requires a distinct observed-success settlement.",
		};
	}
	const decision = await input.runner.run({
		systemPrompt: [
			"Assess one exact adverse Effect remediation relation.",
			"Call the supplied decision tool exactly once.",
			"Select only current indexed settlements and provide a source-bound causal basis, or refuse. Fields ending in _json require JSON encoded as a string, not a native array.",
			"The SDK controller owns identities, outcome eligibility, canonical admission, retries, and stop decisions.",
		].join("\n"),
		prompt: remediationPrompt(input),
		tool: remediationTool(input),
	});
	if (decision.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			reason: decision.reason,
			decision: decision.metrics,
		};
	}
	if (decision.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			message: decision.message,
			decision: decision.metrics,
		};
	}
	if (decision.value.outcome === "refuse") {
		return {
			status: "refused",
			refusalReasons: decision.value.refusalReasons,
			decision: decision.metrics,
		};
	}
	if (!decision.value.remediation) {
		return {
			status: "invariant-failure",
			code: "missing-remediation",
			message: "Accepted remediation decision has no canonical remediation.",
			decision: decision.metrics,
		};
	}
	return {
		status: "remediated",
		remediation: decision.value.remediation,
		decision: decision.metrics,
	};
}
