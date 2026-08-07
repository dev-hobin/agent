import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	closeJudgment,
	type ClosureRequirement,
	type ClosureRequirementDispositionProposal,
	type JudgmentClosureContract,
	type JudgmentClosureProposal,
	type JudgmentClosureRefusal,
	type JudgmentConclusion,
} from "../judgment/close-judgment.ts";
import type { NeedCoverage } from "../need-coverage/assess-need-coverage.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { decodeSdkStringList } from "./proposal-json.ts";

const closureOutcomes = ["conclude", "refuse"] as const;
const requirementStatuses = [
	"satisfied",
	"not-satisfied",
	"needs-context",
] as const;

interface ConclusionDecision {
	readonly proposal: JudgmentClosureProposal;
	readonly result:
		| { readonly status: "concluded"; readonly value: JudgmentConclusion }
		| { readonly status: "refused"; readonly value: JudgmentClosureRefusal };
}

export type SdkJudgmentConclusionResult =
	| {
			readonly status: "concluded";
			readonly conclusion: JudgmentConclusion;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "refused";
			readonly refusal: JudgmentClosureRefusal;
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

export interface SdkJudgmentConclusionInput {
	readonly request: string;
	readonly contract: JudgmentClosureContract;
	readonly coverages: readonly NeedCoverage[];
	readonly runner: SdkDecisionRunner;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function conclusionParameters(
	requirements: readonly ClosureRequirement[],
): TSchema {
	const fields: Record<string, TSchema> = {
		outcome: StringEnum(closureOutcomes),
		answer: Type.Optional(Type.String({ minLength: 1, maxLength: 12_000 })),
		refusal_reasons_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				"JSON array of explicit evaluator refusal reasons. Use [] unless refusing or preserving an additional blocker.",
		}),
		basis_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description: "JSON array of one or more synthesis basis strings.",
		}),
	};
	for (const [index, requirement] of requirements.entries()) {
		fields[`requirement_status_${index}`] = StringEnum(
			requirementStatuses,
			{ description: requirement.statement },
		);
		fields[`requirement_basis_${index}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
		});
	}
	return Type.Object(fields, { additionalProperties: false });
}

function mappedCoverageIds(
	requirement: ClosureRequirement,
	coverages: readonly NeedCoverage[],
): readonly string[] {
	const needIds = new Set(requirement.contributionNeedIds);
	return Object.freeze(
		coverages
			.flatMap((coverage) =>
				needIds.has(coverage.contributionNeedId)
					? [coverage.coverageId]
					: [],
			)
			.sort((left, right) => left.localeCompare(right)),
	);
}

function decodeRequirementDispositions(input: {
	readonly raw: Record<string, unknown>;
	readonly requirements: readonly ClosureRequirement[];
	readonly coverages: readonly NeedCoverage[];
}):
	| {
			readonly ok: true;
			readonly value: readonly ClosureRequirementDispositionProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const dispositions: ClosureRequirementDispositionProposal[] = [];
	for (const [index, requirement] of input.requirements.entries()) {
		const status = input.raw[`requirement_status_${index}`];
		const basis = input.raw[`requirement_basis_${index}`];
		if (
			(status !== "satisfied" &&
				status !== "not-satisfied" &&
				status !== "needs-context") ||
			typeof basis !== "string"
		) {
			return {
				ok: false,
				message: `Requirement ${index} requires a canonical status and basis.`,
			};
		}
		dispositions.push({
			requirementId: requirement.requirementId,
			status,
			coverageIds: mappedCoverageIds(requirement, input.coverages),
			basis: [basis],
		});
	}
	return { ok: true, value: Object.freeze(dispositions) };
}

function canonicalProposal(input: {
	readonly raw: Record<string, unknown>;
	readonly contract: JudgmentClosureContract;
	readonly coverages: readonly NeedCoverage[];
}):
	| { readonly ok: true; readonly value: JudgmentClosureProposal }
	| { readonly ok: false; readonly code: string; readonly message: string } {
	const outcome = input.raw.outcome;
	if (outcome !== "conclude" && outcome !== "refuse") {
		return {
			ok: false,
			code: "invalid-outcome",
			message: "outcome must be conclude or refuse.",
		};
	}
	if (input.raw.answer !== undefined && typeof input.raw.answer !== "string") {
		return {
			ok: false,
			code: "invalid-answer",
			message: "answer must be text when supplied.",
		};
	}
	const refusalReasons = decodeSdkStringList({
		value: input.raw.refusal_reasons_json,
		label: "refusal_reasons_json",
		allowEmpty: true,
		maximumItems: 32,
	});
	if (!refusalReasons.ok) {
		return {
			ok: false,
			code: "invalid-refusal-reasons",
			message: refusalReasons.message,
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
	const dispositions = decodeRequirementDispositions({
		raw: input.raw,
		requirements: input.contract.requirements,
		coverages: input.coverages,
	});
	if (!dispositions.ok) {
		return {
			ok: false,
			code: "invalid-requirement-dispositions",
			message: dispositions.message,
		};
	}
	return {
		ok: true,
		value: {
			workCaseId: input.contract.workCaseId,
			judgmentId: input.contract.judgmentId,
			category: input.contract.category,
			contextRevisionId: input.contract.contextRevisionId,
			outcome,
			...(typeof input.raw.answer === "string"
				? { answer: input.raw.answer }
				: {}),
			refusalReasons: refusalReasons.value,
			requirementDispositions: dispositions.value,
			basis: basis.value,
			provenance: { kind: "model", source: "pi:sdk-action-loop" },
		},
	};
}

function conclusionTool(input: {
	readonly contract: JudgmentClosureContract;
	readonly coverages: readonly NeedCoverage[];
}): SdkProposalTool<ConclusionDecision> {
	return {
		name: "submit_judgment_conclusion",
		label: "Submit one upper Judgment synthesis",
		description:
			"Synthesize complete current Need Coverage into a Conclusion or explicit bounded refusal.",
		parameters: conclusionParameters(input.contract.requirements),
		execute: async (raw) => {
			if (!isRecord(raw)) {
				return rejected(
					"invalid-arguments",
					"Conclusion arguments must be an object.",
				);
			}
			const proposal = canonicalProposal({ ...input, raw });
			if (!proposal.ok) return rejected(proposal.code, proposal.message);
			const closed = closeJudgment(
				input.contract,
				input.coverages,
				proposal.value,
			);
			if (closed.status === "invalid") {
				return rejected(closed.error.code, closed.error.message);
			}
			return {
				status: "accepted",
				value: { proposal: proposal.value, result: closed },
				message:
					closed.status === "concluded"
						? "Judgment Conclusion accepted."
						: "Judgment closure refusal accepted.",
				resultStatus: closed.status,
			};
		},
	};
}

function conclusionPrompt(input: SdkJudgmentConclusionInput): string {
	const coverageByNeed = new Map(
		input.coverages.map((coverage) => [coverage.contributionNeedId, coverage]),
	);
	const requirements = input.contract.requirements
		.map((requirement, index) => {
			const coverages = requirement.contributionNeedIds.map((needId) => {
				const coverage = coverageByNeed.get(needId);
				return coverage
					? `${needId}: ${coverage.status} — ${coverage.basis.join(" | ")}`
					: `${needId}: no current Coverage`;
			});
			return [
				`Requirement ${index}: ${requirement.statement}`,
				...coverages,
			].join("\n");
		})
		.join("\n\n");
	return [
		`Delegated request:\n${input.request}`,
		`Judgment subject:\n${input.contract.subject}`,
		`Category: ${input.contract.category}`,
		`Current Requirements and Need Coverage:\n${requirements}`,
		"Conclude only when every Requirement is supported by complete current Coverage. Otherwise return an explicit refusal and preserve blockers.",
	].join("\n\n");
}

/** Synthesizes current Need Coverage into one Conclusion or explicit refusal. */
export async function concludeJudgmentWithSdk(
	input: SdkJudgmentConclusionInput,
): Promise<SdkJudgmentConclusionResult> {
	const decision = await input.runner.run({
		systemPrompt: [
			"Make one upper Judgment synthesis from complete current Need Coverage.",
			"Call the supplied decision tool exactly once and disposition every Closure Requirement.",
			"Do not manufacture Coverage identities, permission, Effect success, or Work Case completion.",
			"The SDK controller owns exact Coverage citations, canonical admission, retries, and stop decisions.",
		].join("\n"),
		prompt: conclusionPrompt(input),
		tool: conclusionTool(input),
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
	const reproduced = closeJudgment(
		input.contract,
		input.coverages,
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
			code: "closure-outcome-drift",
			message: "Accepted Judgment closure did not reproduce its outcome.",
			decision: decision.metrics,
		};
	}
	if (reproduced.status === "refused") {
		if (
			decision.value.result.status !== "refused" ||
			reproduced.value.refusalId !== decision.value.result.value.refusalId
		) {
			return {
				status: "invariant-failure",
				code: "refusal-identity-drift",
				message: "Accepted Judgment refusal did not reproduce its identity.",
				decision: decision.metrics,
			};
		}
		return {
			status: "refused",
			refusal: reproduced.value,
			decision: decision.metrics,
		};
	}
	if (
		decision.value.result.status !== "concluded" ||
		reproduced.value.conclusionId !== decision.value.result.value.conclusionId
	) {
		return {
			status: "invariant-failure",
			code: "conclusion-identity-drift",
			message: "Accepted Judgment Conclusion did not reproduce its identity.",
			decision: decision.metrics,
		};
	}
	return {
		status: "concluded",
		conclusion: reproduced.value,
		decision: decision.metrics,
	};
}
