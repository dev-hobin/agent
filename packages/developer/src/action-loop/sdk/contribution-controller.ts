import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	acceptSkillContribution,
	type ReferenceApplicationProposal,
	type ResidualNeedProposal,
	type SkillContribution,
	type SkillContributionContext,
	type SkillContributionProposal,
} from "../contribution/accept-skill-contribution.ts";
import type { CapabilityAssignment } from "../routing/accept-applicability.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { decodeSdkProposalJson, decodeSdkStringList } from "./proposal-json.ts";

const localStatuses = ["resolved", "partial"] as const;
const applicationStatuses = ["applied", "limited"] as const;

interface ContributionDecision {
	readonly proposal: SkillContributionProposal;
	readonly contribution: SkillContribution;
}

export type SdkSkillContributionResult =
	| {
			readonly status: "accepted";
			readonly contribution: SkillContribution;
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

export interface SdkSkillContributionInput {
	readonly request: string;
	readonly contributionNeed: string;
	readonly assignment: CapabilityAssignment;
	readonly context: SkillContributionContext;
	readonly runner: SdkDecisionRunner;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function contributionParameters(context: SkillContributionContext): TSchema {
	const fields: Record<string, TSchema> = {
		local_status: StringEnum(localStatuses),
		result: Type.String({ minLength: 1, maxLength: 12_000 }),
		limitations_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description: "JSON array of zero or more explicit limitation strings.",
		}),
		residual_needs_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				'JSON array of {"kind":"residual"|"emergent","description":string,"basis":string[]} objects.',
		}),
	};
	for (const [index, path] of context.selectedPaths.entries()) {
		fields[`reference_status_${index}`] = StringEnum(applicationStatuses, {
			description: `Application status for selected Reference ${path}.`,
		});
		fields[`reference_application_${index}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
			description: `How selected Reference ${path} was applied or limited.`,
		});
	}
	return Type.Object(fields, { additionalProperties: false });
}

function decodeResidualNeeds(
	value: unknown,
):
	| { readonly ok: true; readonly value: readonly ResidualNeedProposal[] }
	| { readonly ok: false; readonly message: string } {
	const decoded = decodeSdkProposalJson(value, "residual_needs_json");
	if (!decoded.ok) return decoded;
	if (!Array.isArray(decoded.value) || decoded.value.length > 32) {
		return {
			ok: false,
			message: "residual_needs_json must encode at most 32 objects.",
		};
	}
	const residualNeeds: ResidualNeedProposal[] = [];
	for (const [index, item] of decoded.value.entries()) {
		if (
			!isRecord(item) ||
			(item.kind !== "residual" && item.kind !== "emergent") ||
			typeof item.description !== "string" ||
			!Array.isArray(item.basis) ||
			item.basis.length === 0 ||
			item.basis.length > 32 ||
			item.basis.some((basis) => typeof basis !== "string")
		) {
			return {
				ok: false,
				message: `Residual Need ${index} requires kind, description, and one or more basis strings.`,
			};
		}
		residualNeeds.push({
			kind: item.kind,
			description: item.description,
			basis: item.basis,
		});
	}
	return { ok: true, value: Object.freeze(residualNeeds) };
}

function decodeReferenceApplications(
	raw: Record<string, unknown>,
	context: SkillContributionContext,
):
	| {
			readonly ok: true;
			readonly value: readonly ReferenceApplicationProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const applications: ReferenceApplicationProposal[] = [];
	for (const [index, path] of context.selectedPaths.entries()) {
		const status = raw[`reference_status_${index}`];
		const application = raw[`reference_application_${index}`];
		if (
			(status !== "applied" && status !== "limited") ||
			typeof application !== "string"
		) {
			return {
				ok: false,
				message: `Selected Reference ${path} requires canonical application status and explanation.`,
			};
		}
		applications.push({ path, status, application });
	}
	return { ok: true, value: Object.freeze(applications) };
}

function canonicalProposal(input: {
	readonly raw: Record<string, unknown>;
	readonly assignment: CapabilityAssignment;
	readonly context: SkillContributionContext;
}):
	| { readonly ok: true; readonly value: SkillContributionProposal }
	| { readonly ok: false; readonly code: string; readonly message: string } {
	const localStatus = input.raw.local_status;
	if (localStatus !== "resolved" && localStatus !== "partial") {
		return {
			ok: false,
			code: "invalid-local-status",
			message: "local_status must be resolved or partial.",
		};
	}
	if (typeof input.raw.result !== "string") {
		return {
			ok: false,
			code: "invalid-result",
			message: "result must be non-empty text.",
		};
	}
	const applications = decodeReferenceApplications(input.raw, input.context);
	if (!applications.ok) {
		return {
			ok: false,
			code: "invalid-reference-applications",
			message: applications.message,
		};
	}
	const limitations = decodeSdkStringList({
		value: input.raw.limitations_json,
		label: "limitations_json",
		allowEmpty: true,
		maximumItems: 32,
	});
	if (!limitations.ok) {
		return {
			ok: false,
			code: "invalid-limitations",
			message: limitations.message,
		};
	}
	const residualNeeds = decodeResidualNeeds(input.raw.residual_needs_json);
	if (!residualNeeds.ok) {
		return {
			ok: false,
			code: "invalid-residual-needs",
			message: residualNeeds.message,
		};
	}
	return {
		ok: true,
		value: {
			workCaseId: input.assignment.workCaseId,
			judgmentId: input.assignment.judgmentId,
			contributionNeedId: input.assignment.contributionNeedId,
			assignmentId: input.assignment.assignmentId,
			capabilityId: input.assignment.capabilityId,
			capabilityRevisionId: input.assignment.capabilityRevisionId,
			sealedContextId: input.context.sealedContextId,
			localStatus,
			result: input.raw.result,
			referenceApplications: applications.value,
			limitations: limitations.value,
			residualNeeds: residualNeeds.value,
			provenance: { kind: "model", source: "pi:sdk-action-loop" },
		},
	};
}

function contributionTool(input: {
	readonly assignment: CapabilityAssignment;
	readonly context: SkillContributionContext;
}): SdkProposalTool<ContributionDecision> {
	return {
		name: "submit_skill_contribution",
		label: "Submit one source-bound Skill Contribution",
		description:
			"Propose one local result from the sealed Skill Context without claiming Need Coverage or a final Conclusion.",
		parameters: contributionParameters(input.context),
		execute: async (raw) => {
			if (!isRecord(raw)) {
				return rejected(
					"invalid-arguments",
					"Contribution arguments must be an object.",
				);
			}
			const proposal = canonicalProposal({ ...input, raw });
			if (!proposal.ok) return rejected(proposal.code, proposal.message);
			const accepted = acceptSkillContribution(
				input.assignment,
				input.context,
				proposal.value,
			);
			if (accepted.status === "invalid") {
				return rejected(accepted.error.code, accepted.error.message);
			}
			return {
				status: "accepted",
				value: {
					proposal: proposal.value,
					contribution: accepted.value,
				},
				message: `Skill Contribution accepted as ${accepted.value.localStatus}.`,
				resultStatus: accepted.value.localStatus,
			};
		},
	};
}

function contributionPrompt(input: SdkSkillContributionInput): string {
	const materials = input.context.materials
		.map(
			(material) =>
				`--- ${material.kind}: ${material.path} ---\n${material.content}`,
		)
		.join("\n\n");
	return [
		`Delegated request:\n${input.request}`,
		`Contribution Need:\n${input.contributionNeed}`,
		"Exact sealed Skill Context:",
		materials,
		"Produce only the local Contribution. Do not claim cross-Skill Coverage, permission, Effect success, or completion.",
	].join("\n\n");
}

/** Produces and canonically admits one local Contribution from one sealed Context. */
export async function contributeSkillWithSdk(
	input: SdkSkillContributionInput,
): Promise<SdkSkillContributionResult> {
	const decision = await input.runner.run({
		systemPrompt: [
			"Produce one source-bound local Skill Contribution.",
			"Call the supplied decision tool exactly once.",
			"Apply every selected Reference explicitly, preserve limitations, and expose residual or emergent Needs.",
			"The SDK controller owns identity, sealed bytes, canonical admission, retries, and stop decisions.",
		].join("\n"),
		prompt: contributionPrompt(input),
		tool: contributionTool(input),
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
	const reproduced = acceptSkillContribution(
		input.assignment,
		input.context,
		decision.value.proposal,
	);
	if (
		reproduced.status === "invalid" ||
		reproduced.value.contributionId !==
			decision.value.contribution.contributionId
	) {
		return {
			status: "invariant-failure",
			code:
				reproduced.status === "invalid"
					? reproduced.error.code
					: "contribution-identity-drift",
			message:
				reproduced.status === "invalid"
					? reproduced.error.message
					: "Accepted Contribution did not reproduce its canonical identity.",
			decision: decision.metrics,
		};
	}
	return {
		status: "accepted",
		contribution: reproduced.value,
		decision: decision.metrics,
	};
}
