import { Type } from "typebox";

import { openWorkCase, type ActiveWorkCase } from "../work/work-case.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
} from "./decision-controller.ts";
import { isSdkProposalObject } from "./proposal-object.ts";
import { decodeSdkStringList } from "./proposal-json.ts";

const MAX_OUTCOME_ITEMS = 32;
const MAX_BASIS_ITEMS = 16;

interface WorkCaseDecision {
	readonly workCase: ActiveWorkCase;
	readonly basis: readonly string[];
}

export type SdkWorkCaseOpeningResult =
	| {
			readonly status: "opened";
			readonly workCase: ActiveWorkCase;
			readonly basis: readonly string[];
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
	  };

export interface SdkWorkCaseOpeningInput {
	readonly request: string;
	readonly runner: SdkDecisionRunner;
}

function rejected<T>(code: string, message: string): SdkProposalAdmission<T> {
	return { status: "rejected", code, message };
}

/** Opens one canonical Work Case from one bounded SDK proposal session. */
export async function openWorkCaseWithSdk(
	input: SdkWorkCaseOpeningInput,
): Promise<SdkWorkCaseOpeningResult> {
	const decision = await input.runner.run<WorkCaseDecision>({
		systemPrompt: [
			"Propose one bounded Outcome for the delegated request.",
			"Call the supplied tool exactly once.",
			"The SDK controller owns provenance, validation, identity, retries, and canonical opening.",
			"JSON text fields must contain JSON arrays of strings without Markdown fences.",
		].join("\n"),
		prompt: [
			`Delegated request: ${input.request}`,
			"State the desired observable Outcome, acceptance conditions, current constraints, and explicit opening basis.",
		].join("\n"),
		tool: {
			name: "submit_work_case_outcome",
			label: "Submit Work Case Outcome",
			description:
				"Submit one proposal. acceptance_conditions_json, constraints_json, and basis_json are JSON-encoded string arrays.",
			parameters: Type.Object(
				{
					statement: Type.String({ minLength: 1, maxLength: 4_096 }),
					acceptance_conditions_json: Type.String({
						minLength: 2,
						maxLength: 32_768,
					}),
					constraints_json: Type.String({
						minLength: 2,
						maxLength: 32_768,
					}),
					basis_json: Type.String({ minLength: 2, maxLength: 32_768 }),
				},
				{ additionalProperties: false },
			),
			execute: async (raw) => {
				if (!isSdkProposalObject(raw) || typeof raw.statement !== "string") {
					return rejected(
						"invalid-arguments",
						"Work Case proposal requires a statement and three JSON text fields.",
					);
				}
				const acceptanceConditions = decodeSdkStringList({
					value: raw.acceptance_conditions_json,
					label: "acceptance_conditions_json",
					allowEmpty: false,
					maximumItems: MAX_OUTCOME_ITEMS,
				});
				if (!acceptanceConditions.ok) {
					return rejected(
						"invalid-acceptance-conditions",
						acceptanceConditions.message,
					);
				}
				const constraints = decodeSdkStringList({
					value: raw.constraints_json,
					label: "constraints_json",
					allowEmpty: true,
					maximumItems: MAX_OUTCOME_ITEMS,
				});
				if (!constraints.ok) {
					return rejected("invalid-constraints", constraints.message);
				}
				const basis = decodeSdkStringList({
					value: raw.basis_json,
					label: "basis_json",
					allowEmpty: false,
					maximumItems: MAX_BASIS_ITEMS,
				});
				if (!basis.ok) return rejected("invalid-basis", basis.message);
				const opened = openWorkCase({
					outcome: {
						statement: raw.statement,
						acceptanceConditions: acceptanceConditions.value,
						constraints: constraints.value,
					},
					provenance: { kind: "model", source: "sdk:work-case-opening" },
				});
				if (opened.status === "invalid") {
					return rejected(opened.error.code, opened.error.message);
				}
				return {
					status: "accepted",
					value: { workCase: opened.value, basis: basis.value },
					message: "Canonical Work Case Outcome accepted.",
					resultStatus: "opened",
				};
			},
		},
	});
	if (decision.status === "accepted") {
		return {
			status: "opened",
			workCase: decision.value.workCase,
			basis: decision.value.basis,
			decision: decision.metrics,
		};
	}
	if (decision.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			reason: decision.reason,
			decision: decision.metrics,
		};
	}
	return {
		status: "runtime-failure",
		message: decision.message,
		decision: decision.metrics,
	};
}
