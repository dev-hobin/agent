import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import type { PendingEffect } from "../effect/begin-effect.ts";
import type { EffectObservation } from "../effect/effect-observation.ts";
import {
	settleEffect,
	type EffectObservationDispositionProposal,
	type EffectSettlement,
	type EffectSettlementOutcome,
	type EffectSettlementProposal,
	type IntendedEffectDispositionProposal,
	type UnsettledEffectAssessment,
} from "../effect/effect-settlement.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { decodeSdkStringList } from "./proposal-json.ts";

const effectOutcomes = [
	"observed-success",
	"observed-no-effect",
	"failed",
	"partially-applied",
	"pending",
	"unknown",
] as const;
const observationStatuses = ["relied-on", "not-relied-on"] as const;
const intendedStatuses = [
	"observed",
	"not-observed",
	"failed",
	"partially-observed",
	"unknown",
] as const;

interface EffectDecision {
	readonly proposal: EffectSettlementProposal;
	readonly result:
		| { readonly status: "settled"; readonly value: EffectSettlement }
		| {
				readonly status: "unsettled";
				readonly value: UnsettledEffectAssessment;
		  };
}

export type SdkEffectSettlementResult =
	| {
			readonly status: "settled";
			readonly settlement: EffectSettlement;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "unsettled";
			readonly assessment: UnsettledEffectAssessment;
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
			readonly decision: SdkDecisionMetrics;
	  };

export interface SdkEffectSettlementInput {
	readonly request: string;
	readonly effect: PendingEffect;
	readonly observations: readonly EffectObservation[];
	readonly runner: SdkDecisionRunner;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEffectSettlementOutcome(
	value: unknown,
): value is EffectSettlementOutcome {
	return effectOutcomes.some((candidate) => candidate === value);
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function effectParameters(input: SdkEffectSettlementInput): TSchema {
	const fields: Record<string, TSchema> = {
		outcome: StringEnum(effectOutcomes),
		basis_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description: "JSON array of one or more Effect accounting basis strings.",
		}),
	};
	for (const [index, observation] of input.observations.entries()) {
		fields[`observation_status_${index}`] = StringEnum(observationStatuses, {
			description: observation.statement,
		});
		fields[`observation_basis_${index}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
		});
	}
	for (const [
		effectIndex,
		intendedEffect,
	] of input.effect.intendedEffects.entries()) {
		fields[`intended_status_${effectIndex}`] = StringEnum(intendedStatuses, {
			description: intendedEffect,
		});
		fields[`intended_basis_${effectIndex}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
		});
		for (const observationIndex of input.observations.keys()) {
			fields[`intended_${effectIndex}_observation_${observationIndex}`] =
				Type.Boolean({
					description:
						"Whether this exact current Observation supports the intended Effect disposition.",
				});
		}
	}
	return Type.Object(fields, { additionalProperties: false });
}

function decodeObservationDispositions(input: {
	readonly raw: Record<string, unknown>;
	readonly observations: readonly EffectObservation[];
}):
	| {
			readonly ok: true;
			readonly value: readonly EffectObservationDispositionProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const dispositions: EffectObservationDispositionProposal[] = [];
	for (const [index, observation] of input.observations.entries()) {
		const status = input.raw[`observation_status_${index}`];
		const basis = input.raw[`observation_basis_${index}`];
		if (
			(status !== "relied-on" && status !== "not-relied-on") ||
			typeof basis !== "string"
		) {
			return {
				ok: false,
				message: `Effect Observation ${index} requires a canonical disposition and basis.`,
			};
		}
		dispositions.push({
			effectObservationId: observation.effectObservationId,
			status,
			basis: [basis],
		});
	}
	return { ok: true, value: Object.freeze(dispositions) };
}

function selectedObservationIds(input: {
	readonly raw: Record<string, unknown>;
	readonly effectIndex: number;
	readonly observations: readonly EffectObservation[];
}): readonly string[] {
	return Object.freeze(
		input.observations.flatMap((observation, observationIndex) =>
			input.raw[
				`intended_${input.effectIndex}_observation_${observationIndex}`
			] === true
				? [observation.effectObservationId]
				: [],
		),
	);
}

function decodeIntendedDispositions(input: {
	readonly raw: Record<string, unknown>;
	readonly effect: PendingEffect;
	readonly observations: readonly EffectObservation[];
}):
	| {
			readonly ok: true;
			readonly value: readonly IntendedEffectDispositionProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const dispositions: IntendedEffectDispositionProposal[] = [];
	for (const [
		index,
		intendedEffect,
	] of input.effect.intendedEffects.entries()) {
		const status = input.raw[`intended_status_${index}`];
		const basis = input.raw[`intended_basis_${index}`];
		if (
			(status !== "observed" &&
				status !== "not-observed" &&
				status !== "failed" &&
				status !== "partially-observed" &&
				status !== "unknown") ||
			typeof basis !== "string"
		) {
			return {
				ok: false,
				message: `Intended Effect ${index} requires a canonical disposition and basis.`,
			};
		}
		dispositions.push({
			intendedEffect,
			status,
			observationIds: selectedObservationIds({
				raw: input.raw,
				effectIndex: index,
				observations: input.observations,
			}),
			basis: [basis],
		});
	}
	return { ok: true, value: Object.freeze(dispositions) };
}

function canonicalProposal(input: {
	readonly raw: Record<string, unknown>;
	readonly effect: PendingEffect;
	readonly observations: readonly EffectObservation[];
}):
	| { readonly ok: true; readonly value: EffectSettlementProposal }
	| { readonly ok: false; readonly code: string; readonly message: string } {
	const outcome = input.raw.outcome;
	if (!isEffectSettlementOutcome(outcome)) {
		return {
			ok: false,
			code: "invalid-effect-outcome",
			message: "outcome must be a canonical Effect settlement outcome.",
		};
	}
	const observationDispositions = decodeObservationDispositions(input);
	if (!observationDispositions.ok) {
		return {
			ok: false,
			code: "invalid-observation-dispositions",
			message: observationDispositions.message,
		};
	}
	const intendedEffectDispositions = decodeIntendedDispositions(input);
	if (!intendedEffectDispositions.ok) {
		return {
			ok: false,
			code: "invalid-intended-effect-dispositions",
			message: intendedEffectDispositions.message,
		};
	}
	const basis = decodeSdkStringList({
		value: input.raw.basis_json,
		label: "basis_json",
		allowEmpty: false,
		maximumItems: 32,
	});
	if (!basis.ok) {
		return { ok: false, code: "invalid-basis", message: basis.message };
	}
	return {
		ok: true,
		value: {
			workCaseId: input.effect.workCaseId,
			effectId: input.effect.effectId,
			outcome,
			observationDispositions: observationDispositions.value,
			intendedEffectDispositions: intendedEffectDispositions.value,
			basis: basis.value,
			provenance: { kind: "model", source: "pi:sdk-action-loop" },
		},
	};
}

function effectTool(
	input: SdkEffectSettlementInput,
): SdkProposalTool<EffectDecision> {
	return {
		name: "submit_effect_settlement",
		label: "Submit complete current Effect accounting",
		description:
			"Disposition every current Observation and intended Effect without treating tool return as implicit success.",
		parameters: effectParameters(input),
		execute: async (raw) => {
			if (!isRecord(raw)) {
				return rejected(
					"invalid-arguments",
					"Effect settlement arguments must be an object.",
				);
			}
			const proposal = canonicalProposal({ ...input, raw });
			if (!proposal.ok) return rejected(proposal.code, proposal.message);
			const settled = settleEffect(
				input.effect,
				input.observations,
				proposal.value,
			);
			if (settled.status === "invalid") {
				return rejected(settled.error.code, settled.error.message);
			}
			return {
				status: "accepted",
				value: { proposal: proposal.value, result: settled },
				message: `Effect accounting accepted as ${settled.value.outcome}.`,
				resultStatus: settled.value.outcome,
			};
		},
	};
}

function effectPrompt(input: SdkEffectSettlementInput): string {
	const observations = input.observations
		.map(
			(observation, index) =>
				`Observation ${index}: ${observation.statement}\nLimitations: ${observation.limitations.join(" | ") || "none declared"}`,
		)
		.join("\n\n");
	return [
		`Delegated request:\n${input.request}`,
		`Intended Effects:\n${input.effect.intendedEffects.map((effect, index) => `${index}: ${effect}`).join("\n")}`,
		observations.length > 0
			? `Exact current Effect Observations:\n${observations}`
			: "Exact current Effect Observations: none",
		"Tool return and exit status are evidence only. Derive settlement from complete explicit accounting.",
	].join("\n\n");
}

/** Produces complete canonical Effect accounting from current exact Observations. */
export async function settleEffectWithSdk(
	input: SdkEffectSettlementInput,
): Promise<SdkEffectSettlementResult> {
	const decision = await input.runner.run({
		systemPrompt: [
			"Assess one current Effect from exact host Observations.",
			"Call the supplied decision tool exactly once.",
			"Disposition every Observation and every intended Effect.",
			"A tool return is not implicit success; preserve pending, unknown, failure, and adverse evidence.",
			"The SDK controller owns identities, complete accounting, canonical admission, retries, and stop decisions.",
		].join("\n"),
		prompt: effectPrompt(input),
		tool: effectTool(input),
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
	const reproduced = settleEffect(
		input.effect,
		input.observations,
		decision.value.proposal,
	);
	if (reproduced.status === "invalid") {
		return {
			status: "invariant-failure",
			code: reproduced.error.code,
			message: reproduced.error.message,
			decision: decision.metrics,
		};
	}
	if (reproduced.status !== decision.value.result.status) {
		return {
			status: "invariant-failure",
			code: "effect-outcome-drift",
			message: "Accepted Effect accounting did not reproduce its outcome.",
			decision: decision.metrics,
		};
	}
	if (reproduced.status === "settled") {
		if (
			decision.value.result.status !== "settled" ||
			reproduced.value.effectSettlementId !==
				decision.value.result.value.effectSettlementId
		) {
			return {
				status: "invariant-failure",
				code: "effect-settlement-identity-drift",
				message: "Accepted Effect settlement did not reproduce its identity.",
				decision: decision.metrics,
			};
		}
		return {
			status: "settled",
			settlement: reproduced.value,
			decision: decision.metrics,
		};
	}
	if (
		decision.value.result.status !== "unsettled" ||
		reproduced.value.effectAssessmentId !==
			decision.value.result.value.effectAssessmentId
	) {
		return {
			status: "invariant-failure",
			code: "effect-assessment-identity-drift",
			message:
				"Accepted unsettled Effect assessment did not reproduce its identity.",
			decision: decision.metrics,
		};
	}
	return {
		status: "unsettled",
		assessment: reproduced.value,
		decision: decision.metrics,
	};
}
