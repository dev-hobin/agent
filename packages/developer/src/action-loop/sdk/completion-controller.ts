import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	acceptClosureClaim,
	type ClosureClaim,
	type ClosureObligationDispositionProposal,
} from "../work/accept-closure-claim.ts";
import {
	completeWorkCase,
	type CompletedWorkCase,
} from "../work/complete-work-case.ts";
import {
	prepareClosureTarget,
	type ClosureTargetBlocker,
	type SealedClosureTarget,
} from "../work/prepare-closure-target.ts";
import type { ActiveWorkCase } from "../work/work-case.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { isSdkProposalObject } from "./proposal-object.ts";
import { renderSdkProposalPrompt } from "./proposal-prompt.ts";
import { decodeSdkProposalJson, decodeSdkStringList } from "./proposal-json.ts";

const completionModes = ["completed", "no-change"] as const;

interface CompletionDecision {
	readonly claim: ClosureClaim;
	readonly completed: CompletedWorkCase;
}

export type SdkWorkCaseCompletionResult =
	| {
			readonly status: "completed";
			readonly target: SealedClosureTarget;
			readonly claim: ClosureClaim;
			readonly workCase: CompletedWorkCase;
			readonly decision: SdkDecisionMetrics;
	  }
	| {
			readonly status: "not-ready";
			readonly blockers: readonly ClosureTargetBlocker[];
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

export interface SdkWorkCaseCompletionInput {
	readonly request: string;
	readonly workCase: ActiveWorkCase;
	readonly runner: SdkDecisionRunner;
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function completionParameters(target: SealedClosureTarget): TSchema {
	const fields: Record<string, TSchema> = {
		mode: StringEnum(completionModes),
		basis_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				"JSON array of one or more whole-Work-Case closure basis strings.",
		}),
	};
	for (const [index, obligation] of target.obligations.entries()) {
		fields[`obligation_${index}_conclusion_indices_json`] = Type.String({
			minLength: 2,
			maxLength: 32_768,
			description: "JSON array of current Conclusion indices applied here.",
		});
		fields[`obligation_${index}_effect_indices_json`] = Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				"JSON array of current Effect assessment indices applied here.",
		});
		fields[`obligation_${index}_remediation_indices_json`] = Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				"JSON array of current Effect remediation indices applied here.",
		});
		fields[`obligation_${index}_basis`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
			description: `${obligation.kind}: ${obligation.statement}`,
		});
	}
	return Type.Object(fields, { additionalProperties: false });
}

function decodeIndexList(input: {
	readonly value: unknown;
	readonly label: string;
	readonly inventory: readonly string[];
}):
	| { readonly ok: true; readonly value: readonly string[] }
	| { readonly ok: false; readonly message: string } {
	const decoded = decodeSdkProposalJson(input.value, input.label);
	if (!decoded.ok) return decoded;
	if (
		!Array.isArray(decoded.value) ||
		decoded.value.length > input.inventory.length ||
		decoded.value.some(
			(index) =>
				typeof index !== "number" ||
				!Number.isInteger(index) ||
				index < 0 ||
				index >= input.inventory.length,
		)
	) {
		return {
			ok: false,
			message: `${input.label} must encode only current inventory indices.`,
		};
	}
	const indices = decoded.value as number[];
	if (new Set(indices).size !== indices.length) {
		return {
			ok: false,
			message: `${input.label} cannot contain duplicate indices.`,
		};
	}
	return {
		ok: true,
		value: Object.freeze(indices.map((index) => input.inventory[index] ?? "")),
	};
}

function decodeObligationDisposition(input: {
	readonly raw: Record<string, unknown>;
	readonly index: number;
	readonly target: SealedClosureTarget;
}):
	| {
			readonly ok: true;
			readonly value: ClosureObligationDispositionProposal;
	  }
	| { readonly ok: false; readonly message: string } {
	const obligation = input.target.obligations[input.index];
	if (obligation === undefined) {
		return {
			ok: false,
			message: `Closure Obligation ${input.index} is unavailable.`,
		};
	}
	const prefix = `obligation_${input.index}`;
	const conclusionIds = decodeIndexList({
		value: input.raw[`${prefix}_conclusion_indices_json`],
		label: `${prefix}_conclusion_indices_json`,
		inventory: input.target.conclusionIds,
	});
	if (!conclusionIds.ok) return conclusionIds;
	const effectAssessmentIds = decodeIndexList({
		value: input.raw[`${prefix}_effect_indices_json`],
		label: `${prefix}_effect_indices_json`,
		inventory: input.target.effectAssessmentIds,
	});
	if (!effectAssessmentIds.ok) return effectAssessmentIds;
	const effectRemediationIds = decodeIndexList({
		value: input.raw[`${prefix}_remediation_indices_json`],
		label: `${prefix}_remediation_indices_json`,
		inventory: input.target.effectRemediationIds,
	});
	if (!effectRemediationIds.ok) return effectRemediationIds;
	const basis = input.raw[`${prefix}_basis`];
	if (typeof basis !== "string") {
		return {
			ok: false,
			message: `${prefix}_basis must be non-empty text.`,
		};
	}
	return {
		ok: true,
		value: {
			closureObligationId: obligation.closureObligationId,
			conclusionIds: conclusionIds.value,
			effectAssessmentIds: effectAssessmentIds.value,
			effectRemediationIds: effectRemediationIds.value,
			basis: [basis],
		},
	};
}

function decodeObligationDispositions(input: {
	readonly raw: Record<string, unknown>;
	readonly target: SealedClosureTarget;
}):
	| {
			readonly ok: true;
			readonly value: readonly ClosureObligationDispositionProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const dispositions: ClosureObligationDispositionProposal[] = [];
	for (const index of input.target.obligations.keys()) {
		const disposition = decodeObligationDisposition({ ...input, index });
		if (!disposition.ok) return disposition;
		dispositions.push(disposition.value);
	}
	return { ok: true, value: Object.freeze(dispositions) };
}

function completionTool(input: {
	readonly workCase: ActiveWorkCase;
	readonly target: SealedClosureTarget;
}): SdkProposalTool<CompletionDecision> {
	return {
		name: "submit_work_case_completion",
		label: "Submit complete current Work Case closure accounting",
		description:
			"Apply all current Conclusions, Effect assessments, and remediations to every closure obligation before atomic revalidation.",
		parameters: completionParameters(input.target),
		execute: async (raw) => {
			if (!isSdkProposalObject(raw)) {
				return rejected(
					"invalid-arguments",
					"Completion arguments must be an object.",
				);
			}
			if (raw.mode !== "completed" && raw.mode !== "no-change") {
				return rejected(
					"invalid-completion-mode",
					"mode must be completed or no-change.",
				);
			}
			const dispositions = decodeObligationDispositions({
				raw,
				target: input.target,
			});
			if (!dispositions.ok) {
				return rejected("invalid-obligation-accounting", dispositions.message);
			}
			const basis = decodeSdkStringList({
				value: raw.basis_json,
				label: "basis_json",
				allowEmpty: false,
				maximumItems: 32,
			});
			if (!basis.ok) return rejected("invalid-basis", basis.message);
			const claim = acceptClosureClaim(input.target, {
				workCaseId: input.workCase.workCaseId,
				closureTargetId: input.target.closureTargetId,
				mode: raw.mode,
				obligationDispositions: dispositions.value,
				basis: basis.value,
				provenance: { kind: "model", source: "pi:sdk-action-loop" },
			});
			if (claim.status === "invalid") {
				return rejected(claim.error.code, claim.error.message);
			}
			const completed = completeWorkCase(
				input.workCase,
				input.target,
				claim.value,
			);
			if (completed.status === "refused") {
				return rejected(completed.refusal.code, completed.refusal.message);
			}
			return {
				status: "accepted",
				value: { claim: claim.value, completed: completed.value },
				message: `Work Case completion accepted as ${claim.value.mode}.`,
				resultStatus: claim.value.mode,
			};
		},
	};
}

function completionProposalPrompt(input: {
	readonly request: string;
	readonly workCase: ActiveWorkCase;
	readonly target: SealedClosureTarget;
}) {
	const obligations = input.target.obligations.map(
		(obligation, index) =>
			`Obligation ${index} (${obligation.kind}): ${obligation.statement}`,
	);
	const conclusions = input.workCase.conclusions.map(
		(conclusion, index) =>
			`Conclusion ${index} (${conclusion.category}): ${conclusion.answer}`,
	);
	const effects = input.workCase.currentEffectAssessments.map(
		(assessment, index) =>
			`Effect assessment ${index}: ${assessment.outcome} — ${assessment.basis.join(" | ")}`,
	);
	const remediations = input.workCase.effectRemediations.map(
		(remediation, index) =>
			`Effect remediation ${index}: ${remediation.basis.join(" | ")}`,
	);
	return renderSdkProposalPrompt({
		stage: "work-case-completion",
		objective: "Account for one complete current Work Case closure target.",
		rules: [
			"Disposition every closure obligation.",
			"Apply every current Conclusion, Effect assessment, and remediation without inventing identities.",
			"Map every current evidence item to one or more obligations where it materially applies.",
		],
		sections: [
			{ name: "delegated_request", content: input.request },
			{ name: "outcome", content: input.workCase.outcome.statement },
			{ name: "closure_obligations", content: obligations },
			{ name: "current_conclusions", content: conclusions },
			{ name: "effect_assessments", content: effects },
			{ name: "effect_remediations", content: remediations },
		],
		decision:
			"Account for the complete current inventory. The controller will reject omitted, stale, duplicate, or caller-selected subsets and revalidate the current revision.",
	});
}

/** Prepares, accounts for, and atomically revalidates one current Work Case completion. */
export async function completeWorkCaseWithSdk(
	input: SdkWorkCaseCompletionInput,
): Promise<SdkWorkCaseCompletionResult> {
	const prepared = prepareClosureTarget(input.workCase);
	if (prepared.status === "invalid") {
		return {
			status: "invariant-failure",
			code: prepared.error.code,
			message: prepared.error.message,
		};
	}
	if (prepared.status === "not-ready") {
		return { status: "not-ready", blockers: prepared.blockers };
	}
	const decision = await input.runner.run({
		...completionProposalPrompt({ ...input, target: prepared.value }),
		tool: completionTool({
			workCase: input.workCase,
			target: prepared.value,
		}),
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
	const revalidated = completeWorkCase(
		input.workCase,
		prepared.value,
		decision.value.claim,
	);
	if (
		revalidated.status === "refused" ||
		revalidated.value.revisionId !== decision.value.completed.revisionId
	) {
		return {
			status: "invariant-failure",
			code:
				revalidated.status === "refused"
					? revalidated.refusal.code
					: "completion-identity-drift",
			message:
				revalidated.status === "refused"
					? revalidated.refusal.message
					: "Accepted Work Case completion did not reproduce its identity.",
			decision: decision.metrics,
		};
	}
	return {
		status: "completed",
		target: prepared.value,
		claim: decision.value.claim,
		workCase: revalidated.value,
		decision: decision.metrics,
	};
}
