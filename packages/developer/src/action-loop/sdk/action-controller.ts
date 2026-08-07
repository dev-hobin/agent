import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	acceptActionCandidate,
	type ActionCandidate,
	type ControlledActionIdentity,
} from "../action/accept-action-candidate.ts";
import {
	acceptActionClearance,
	type ActionClearance,
	type ActionClearanceAssessment,
	type ActionClearanceBlocker,
	type PermissionDecision,
} from "../action/action-clearance.ts";
import type { JudgmentConclusion } from "../judgment/close-judgment.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { decodeSdkProposalJson, decodeSdkStringList } from "./proposal-json.ts";

export interface SdkControlledActionBinding {
	readonly controlledAction: ControlledActionIdentity;
	readonly canonicalInput: string;
}

export type SdkControlledActionBindingResult =
	| { readonly status: "bound"; readonly value: SdkControlledActionBinding }
	| { readonly status: "invalid"; readonly message: string };

export interface SdkControlledActionAdapter {
	readonly name: string;
	readonly description: string;
	readonly bind: (
		input: Readonly<Record<string, unknown>>,
	) => SdkControlledActionBindingResult;
}

interface ActionDecision {
	readonly toolName: string;
	readonly toolInput: Readonly<Record<string, unknown>>;
	readonly canonicalInput: string;
	readonly candidate: ActionCandidate;
}

export type SdkActionCandidateResult =
	| {
			readonly status: "accepted";
			readonly toolName: string;
			readonly toolInput: Readonly<Record<string, unknown>>;
			readonly canonicalInput: string;
			readonly candidate: ActionCandidate;
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

export interface SdkActionCandidateInput {
	readonly request: string;
	readonly workCaseId: string;
	readonly conclusions: readonly JudgmentConclusion[];
	readonly actions: readonly SdkControlledActionAdapter[];
	readonly runner: SdkDecisionRunner;
}

export type SdkActionClearanceResult =
	| { readonly status: "cleared"; readonly clearance: ActionClearance }
	| {
			readonly status: "not-cleared";
			readonly assessment: ActionClearanceAssessment;
			readonly blockers: readonly ActionClearanceBlocker[];
	  }
	| {
			readonly status: "invariant-failure";
			readonly code: string;
			readonly message: string;
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function actionParameters(input: SdkActionCandidateInput): TSchema {
	const fields: Record<string, TSchema> = {
		tool_name: StringEnum(
			input.actions.map((action) => action.name),
			{
				description: input.actions
					.map((action) => `${action.name}: ${action.description}`)
					.join(" | "),
			},
		),
		tool_input_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				"Exact JSON object to pass to the selected controlled host tool.",
		}),
		summary: Type.String({ minLength: 1, maxLength: 2_048 }),
		intended_effects_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description: "JSON array of one or more intended Effect strings.",
		}),
	};
	for (const [index, conclusion] of input.conclusions.entries()) {
		fields[`requires_conclusion_${index}`] = Type.Boolean({
			description: `${conclusion.category}: ${conclusion.answer}`,
		});
	}
	return Type.Object(fields, { additionalProperties: false });
}

function selectedConclusionIds(
	raw: Record<string, unknown>,
	conclusions: readonly JudgmentConclusion[],
): readonly string[] {
	return Object.freeze(
		conclusions.flatMap((conclusion, index) =>
			raw[`requires_conclusion_${index}`] === true
				? [conclusion.conclusionId]
				: [],
		),
	);
}

function actionTool(
	input: SdkActionCandidateInput,
): SdkProposalTool<ActionDecision> {
	const actionsByName = new Map(
		input.actions.map((action) => [action.name, action]),
	);
	return {
		name: "submit_action_candidate",
		label: "Submit one exact controlled Action Candidate",
		description:
			"Propose exact host tool input and intended Effects without granting permission or executing the Action.",
		parameters: actionParameters(input),
		execute: async (raw) => {
			if (!isRecord(raw)) {
				return rejected(
					"invalid-arguments",
					"Action Candidate arguments must be an object.",
				);
			}
			if (typeof raw.tool_name !== "string") {
				return rejected(
					"invalid-tool-name",
					"tool_name must identify one available controlled Action.",
				);
			}
			const adapter = actionsByName.get(raw.tool_name);
			if (adapter === undefined) {
				return rejected(
					"unavailable-tool",
					`Controlled Action ${raw.tool_name} is unavailable.`,
				);
			}
			const decodedInput = decodeSdkProposalJson(
				raw.tool_input_json,
				"tool_input_json",
			);
			if (!decodedInput.ok || !isRecord(decodedInput.value)) {
				return rejected(
					"invalid-tool-input",
					decodedInput.ok
						? "tool_input_json must encode one JSON object."
						: decodedInput.message,
				);
			}
			if (typeof raw.summary !== "string") {
				return rejected("invalid-summary", "summary must be non-empty text.");
			}
			const intendedEffects = decodeSdkStringList({
				value: raw.intended_effects_json,
				label: "intended_effects_json",
				allowEmpty: false,
				maximumItems: 32,
			});
			if (!intendedEffects.ok) {
				return rejected("invalid-intended-effects", intendedEffects.message);
			}
			const conclusionIds = selectedConclusionIds(raw, input.conclusions);
			if (conclusionIds.length === 0) {
				return rejected(
					"missing-required-conclusion",
					"Action Candidate must identify at least one current required Conclusion.",
				);
			}
			const bound = adapter.bind(decodedInput.value);
			if (bound.status === "invalid") {
				return rejected("invalid-controlled-action", bound.message);
			}
			const accepted = acceptActionCandidate({
				workCaseId: input.workCaseId,
				controlledAction: bound.value.controlledAction,
				summary: raw.summary,
				intendedEffects: intendedEffects.value,
				requiredConclusionIds: conclusionIds,
				provenance: { kind: "model", source: "pi:sdk-action-loop" },
			});
			if (accepted.status === "invalid") {
				return rejected(accepted.error.code, accepted.error.message);
			}
			return {
				status: "accepted",
				value: {
					toolName: adapter.name,
					toolInput: Object.freeze({ ...decodedInput.value }),
					canonicalInput: bound.value.canonicalInput,
					candidate: accepted.value,
				},
				message:
					"Exact controlled Action Candidate accepted without permission.",
				resultStatus: "candidate",
			};
		},
	};
}

function actionPrompt(input: SdkActionCandidateInput): string {
	const conclusions = input.conclusions
		.map(
			(conclusion, index) =>
				`Conclusion ${index} (${conclusion.category}): ${conclusion.answer}`,
		)
		.join("\n");
	return [
		`Delegated request:\n${input.request}`,
		`Current Conclusions:\n${conclusions}`,
		"Propose one exact controlled Action only when it advances the delegated Outcome. This proposal grants no permission and executes nothing.",
	].join("\n\n");
}

/** Proposes and canonically admits one exact Action Candidate without permission. */
export async function proposeActionWithSdk(
	input: SdkActionCandidateInput,
): Promise<SdkActionCandidateResult> {
	if (input.actions.length === 0) {
		return {
			status: "invariant-failure",
			code: "empty-controlled-action-inventory",
			message: "At least one controlled host Action adapter is required.",
		};
	}
	if (input.conclusions.length === 0) {
		return {
			status: "invariant-failure",
			code: "empty-conclusion-inventory",
			message: "An Action Candidate requires at least one current Conclusion.",
		};
	}
	const actionNames = new Set(input.actions.map((action) => action.name));
	if (actionNames.size !== input.actions.length) {
		return {
			status: "invariant-failure",
			code: "duplicate-controlled-action",
			message: "Controlled Action adapter names must be unique.",
		};
	}
	const decision = await input.runner.run({
		systemPrompt: [
			"Propose one exact controlled host Action Candidate.",
			"Call the supplied decision tool exactly once.",
			"Select current required Conclusions and state intended Effects.",
			"Do not claim permission, execution, Effect success, or Work Case completion.",
			"The SDK controller owns exact input binding, canonical identity, retries, and stop decisions.",
		].join("\n"),
		prompt: actionPrompt(input),
		tool: actionTool(input),
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
	return {
		status: "accepted",
		...decision.value,
		decision: decision.metrics,
	};
}

/** Applies a separate host Permission Decision to one current Action Candidate. */
export function clearActionWithHostPermission(input: {
	readonly candidate: ActionCandidate;
	readonly conclusions: readonly JudgmentConclusion[];
	readonly permission: PermissionDecision;
}): SdkActionClearanceResult {
	const accepted = acceptActionClearance(
		input.candidate,
		input.conclusions,
		input.permission,
		{
			workCaseId: input.candidate.workCaseId,
			actionCandidateId: input.candidate.actionCandidateId,
			conclusionIds: input.candidate.requiredConclusionIds,
			warrantBasis: [
				"Every Conclusion required by the Action Candidate is present in the current canonical inventory.",
			],
			provenance: { kind: "external", source: input.permission.source },
		},
	);
	if (accepted.status === "invalid") {
		return {
			status: "invariant-failure",
			code: accepted.error.code,
			message: accepted.error.message,
		};
	}
	if (accepted.status === "not-cleared") {
		return {
			status: "not-cleared",
			assessment: accepted.assessment,
			blockers: accepted.blockers,
		};
	}
	return { status: "cleared", clearance: accepted.value };
}
