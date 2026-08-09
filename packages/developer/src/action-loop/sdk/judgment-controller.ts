import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

import {
	openJudgment,
	type JudgmentOpeningProposal,
	type JudgmentRequirementProposal,
	type OpenJudgment,
} from "../judgment/open-judgment.ts";
import { recordWorkCaseJudgment } from "../work/record-work-case-judgment.ts";
import type { ActiveWorkCase } from "../work/work-case.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
} from "./decision-controller.ts";
import { isSdkProposalObject } from "./proposal-object.ts";
import { decodeSdkProposalJson, decodeSdkStringList } from "./proposal-json.ts";
import { renderSdkProposalPrompt } from "./proposal-prompt.ts";

const categories = [
	"Contextual Adequacy",
	"Proportionate Intervention",
	"Consequence Integrity",
	"Claim Assurance",
] as const;
export type SdkJudgmentCategory = (typeof categories)[number];
const MAX_REQUIREMENTS = 8;
const MAX_NEEDS_PER_REQUIREMENT = 8;
const MAX_BASIS_ITEMS = 16;

interface JudgmentDecision {
	readonly workCase: ActiveWorkCase;
	readonly judgment: OpenJudgment;
}

export type SdkJudgmentOpeningResult =
	| {
			readonly status: "opened" | "unchanged";
			readonly workCase: ActiveWorkCase;
			readonly judgment: OpenJudgment;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "active-judgment-exists";
			readonly judgment: OpenJudgment;
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

export interface SdkJudgmentOpeningInput {
	readonly request: string;
	readonly workCase: ActiveWorkCase;
	readonly contextRevisionId: string;
	readonly requiredCategory?: SdkJudgmentCategory;
	readonly availableEvidenceFunctions?: readonly string[];
	readonly controlledActionContracts?: readonly string[];
	readonly runner: SdkDecisionRunner;
}

function rejected<T>(code: string, message: string): SdkProposalAdmission<T> {
	return { status: "rejected", code, message };
}

function isCategory(value: unknown): value is (typeof categories)[number] {
	return categories.some((category) => category === value);
}

function decodeRequirements(value: unknown):
	| {
			readonly ok: true;
			readonly value: readonly JudgmentRequirementProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const decoded = decodeSdkProposalJson(value, "requirements_json");
	if (
		!decoded.ok ||
		!Array.isArray(decoded.value) ||
		decoded.value.length === 0 ||
		decoded.value.length > MAX_REQUIREMENTS
	) {
		return {
			ok: false,
			message: decoded.ok
				? `requirements_json must encode 1-${MAX_REQUIREMENTS} Requirement objects.`
				: decoded.message,
		};
	}
	const requirements: JudgmentRequirementProposal[] = [];
	for (const item of decoded.value) {
		if (!isSdkProposalObject(item)) {
			return {
				ok: false,
				message: "Every Requirement must be an object.",
			};
		}
		const keys = Object.keys(item).sort((left, right) =>
			left.localeCompare(right),
		);
		if (
			keys.length !== 2 ||
			keys[0] !== "contribution_needs" ||
			keys[1] !== "statement" ||
			typeof item.statement !== "string" ||
			!Array.isArray(item.contribution_needs) ||
			item.contribution_needs.length === 0 ||
			item.contribution_needs.length > MAX_NEEDS_PER_REQUIREMENT ||
			item.contribution_needs.some((need) => typeof need !== "string")
		) {
			return {
				ok: false,
				message:
					"Every Requirement must contain only statement and 1-8 string contribution_needs.",
			};
		}
		requirements.push({
			statement: item.statement,
			contributionNeeds: item.contribution_needs,
		});
	}
	return { ok: true, value: requirements };
}

/** Opens and records one upper Judgment without selecting a Capability. */
export async function openJudgmentWithSdk(
	input: SdkJudgmentOpeningInput,
): Promise<SdkJudgmentOpeningResult> {
	const existing = input.workCase.openJudgments[0];
	if (existing !== undefined) {
		return { status: "active-judgment-exists", judgment: existing };
	}
	const decision = await input.runner.run<JudgmentDecision>({
		...renderSdkProposalPrompt({
			stage: "judgment-opening",
			objective:
				"Propose one Category-scoped Judgment for the current unresolved Warrant Gap.",
			rules: [
				"Requirements state closure obligations. Contribution Needs state missing evidence or analysis functions, never Skill names, host tool names or availability, Actions, or controller protocol mechanics.",
				"Outcome, acceptance conditions, and constraints define the target specification, not evidence that the target is attained. Do not create Contribution Needs merely to reinterpret that specification, and never infer completion or no-action from target wording alone. Current Conclusions are trusted current-state facts.",
				"Treat explicit pre-Action facts in delegated_request as human-provenance evidence at their stated granularity. Do not demand unavailable lower-level fields merely to re-prove those facts unless current evidence disputes them; they never establish later Action or Effect success.",
				"When explicit delegated pre-Action facts already state that one external condition is unavailable and mutation is forbidden, use one aggregate Requirement with one Contribution Need interpreting that exact admitted human evidence. Do not split it into negative Needs that separately re-prove empty Action history, empty Conclusion history, or the same delegated wording.",
				"Every Contribution Need must be answerable by an assigned sealed Skill Context or an exact Host Observation available before the Conclusion.",
				"Do not require an evidence function absent from available_pre_conclusion_evidence. In particular, do not turn whole-workspace enumeration, checksum, shell execution, or unavailable byte metadata into a pre-Action Need when the listed evidence boundary cannot supply it.",
				"A listed exact-target controlled Action contract owns its collateral scope and is trusted controller evidence, not missing evidence. Never create a Contribution Need that asks a Skill, model, or Host Observation to restate or re-prove a supplied controlled Action contract. Fold contract-guaranteed collateral preservation into the target-specific Requirement, and ask only for target facts not guaranteed by that contract; do not require a whole-workspace pre-Action baseline merely to decide whether that exact-target Action is warranted.",
				"Every Requirement must be closable from evidence available before this Judgment's Conclusion; never require the future Action, Effect, or later controller response that the Conclusion would enable.",
				"For Claim Assurance after a no-action Conclusion, use one aggregate Requirement grounded in trusted current Conclusions and the absence of controlled Effects. Do not reopen previously settled target facts as unrelated new Needs.",
				"Proportionate Intervention decides whether current evidence warrants a next Action; it cannot require execution or observation of that same Action. Claim Assurance opens only when the trusted controller requires it after settled Effects or a no-action Proportionate Intervention Conclusion; it never opens first and cannot authorize an Action.",
				"requirements_json and basis_json contain JSON text without Markdown fences.",
			],
			sections: [
				{ name: "delegated_request", content: input.request },
				{ name: "current_outcome", content: input.workCase.outcome.statement },
				{
					name: "required_category",
					content:
						input.requiredCategory ??
						"choose the current unresolved Warrant Gap",
				},
				{
					name: "current_conclusions",
					content:
						input.workCase.conclusions.length > 0
							? input.workCase.conclusions
									.map(
										(conclusion) =>
											`${conclusion.category}: ${conclusion.answer}`,
									)
									.join("\n")
							: "none",
				},
				{
					name: "available_pre_conclusion_evidence",
					content:
						input.availableEvidenceFunctions?.join("\n") ??
						"No adapter-supplied Host Observation function is available.",
				},
				{
					name: "controlled_action_contracts",
					content:
						input.controlledActionContracts?.join("\n") ??
						"No controlled Action contract is available.",
				},
			],
			decision:
				"Open only one independently closable Judgment needed to advance this Outcome.",
		}),
		tool: {
			name: "submit_judgment",
			label: "Submit Judgment",
			description:
				"Submit one Judgment. requirements_json is an array of {statement, contribution_needs}; basis_json is a string array.",
			parameters: Type.Object(
				{
					category: StringEnum(
						input.requiredCategory ? [input.requiredCategory] : categories,
					),
					subject: Type.String({ minLength: 1, maxLength: 4_096 }),
					question: Type.String({ minLength: 1, maxLength: 4_096 }),
					requirements_json: Type.String({
						minLength: 2,
						maxLength: 32_768,
					}),
					basis_json: Type.String({ minLength: 2, maxLength: 32_768 }),
				},
				{ additionalProperties: false },
			),
			execute: async (raw) => {
				if (
					!isSdkProposalObject(raw) ||
					!isCategory(raw.category) ||
					(input.requiredCategory !== undefined &&
						raw.category !== input.requiredCategory) ||
					typeof raw.subject !== "string" ||
					typeof raw.question !== "string"
				) {
					return rejected(
						"invalid-arguments",
						"Judgment requires category, subject, question, requirements_json, and basis_json.",
					);
				}
				if (
					raw.category === "Claim Assurance" &&
					input.requiredCategory !== "Claim Assurance"
				) {
					return rejected(
						"claim-assurance-not-eligible",
						"Claim Assurance can open only when the trusted controller requires it after settled Effects or a no-action Proportionate Intervention Conclusion.",
					);
				}
				const requirements = decodeRequirements(raw.requirements_json);
				if (!requirements.ok) {
					return rejected("invalid-requirements", requirements.message);
				}
				const basis = decodeSdkStringList({
					value: raw.basis_json,
					label: "basis_json",
					allowEmpty: false,
					maximumItems: MAX_BASIS_ITEMS,
				});
				if (!basis.ok) return rejected("invalid-basis", basis.message);
				const proposal: JudgmentOpeningProposal = {
					workCaseId: input.workCase.workCaseId,
					contextRevisionId: input.contextRevisionId,
					category: raw.category,
					subject: raw.subject,
					question: raw.question,
					requirements: requirements.value,
					basis: basis.value,
					provenance: { kind: "model", source: "sdk:judgment-opening" },
				};
				const opened = openJudgment(proposal);
				if (opened.status === "invalid") {
					return rejected(opened.error.code, opened.error.message);
				}
				const recorded = recordWorkCaseJudgment(input.workCase, opened.value);
				if (recorded.status === "invalid") {
					return rejected(recorded.error.code, recorded.error.message);
				}
				return {
					status: "accepted",
					value: { workCase: recorded.value, judgment: opened.value },
					message: `Judgment accepted as ${recorded.status}.`,
					resultStatus: recorded.status,
				};
			},
		},
	});
	if (decision.status === "accepted") {
		return {
			status:
				decision.value.workCase.revisionId === input.workCase.revisionId
					? "unchanged"
					: "opened",
			workCase: decision.value.workCase,
			judgment: decision.value.judgment,
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
