import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	assessNeedCoverage,
	type CoverageConflictProposal,
	type CoverageContributionDispositionProposal,
	type CoverageInputContribution,
	type NeedCoverage,
	type NeedCoverageProposal,
	type NeedCoverageTarget,
} from "../need-coverage/assess-need-coverage.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { decodeSdkProposalJson, decodeSdkStringList } from "./proposal-json.ts";

const coverageStatuses = [
	"covered",
	"partially-covered",
	"conflicted",
	"missing",
] as const;
const dispositionStatuses = [
	"supports",
	"limited-support",
	"not-relied-on",
] as const;

export interface SdkCoverageContribution extends CoverageInputContribution {
	readonly result: string;
	readonly limitations: readonly string[];
}

interface CoverageDecision {
	readonly proposal: NeedCoverageProposal;
	readonly coverage: NeedCoverage;
}

export type SdkNeedCoverageResult =
	| {
			readonly status: "assessed";
			readonly coverage: NeedCoverage;
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

export interface SdkNeedCoverageInput {
	readonly request: string;
	readonly contributionNeed: string;
	readonly target: NeedCoverageTarget;
	readonly contributions: readonly SdkCoverageContribution[];
	readonly runner: SdkDecisionRunner;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(code: string, message: string): SdkProposalAdmission<never> {
	return { status: "rejected", code, message };
}

function coverageParameters(
	contributions: readonly SdkCoverageContribution[],
): TSchema {
	const fields: Record<string, TSchema> = {
		status: StringEnum(coverageStatuses),
		conflicts_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description:
				'JSON array of {"left_index":integer,"right_index":integer,"basis":string[]} conflicts. Use [] when none.',
		}),
		basis_json: Type.String({
			minLength: 2,
			maxLength: 32_768,
			description: "JSON array of one or more synthesis basis strings.",
		}),
	};
	for (const [index, contribution] of contributions.entries()) {
		fields[`disposition_status_${index}`] = StringEnum(
			dispositionStatuses,
			{
				description: `Disposition for Contribution ${index} (${contribution.localStatus}).`,
			},
		);
		fields[`disposition_basis_${index}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
		});
	}
	return Type.Object(fields, { additionalProperties: false });
}

function decodeDispositions(
	raw: Record<string, unknown>,
	contributions: readonly SdkCoverageContribution[],
):
	| {
			readonly ok: true;
			readonly value: readonly CoverageContributionDispositionProposal[];
	  }
	| { readonly ok: false; readonly message: string } {
	const dispositions: CoverageContributionDispositionProposal[] = [];
	for (const [index, contribution] of contributions.entries()) {
		const status = raw[`disposition_status_${index}`];
		const basis = raw[`disposition_basis_${index}`];
		if (
			(status !== "supports" &&
				status !== "limited-support" &&
				status !== "not-relied-on") ||
			typeof basis !== "string"
		) {
			return {
				ok: false,
				message: `Contribution ${index} requires a canonical disposition and basis.`,
			};
		}
		dispositions.push({
			contributionId: contribution.contributionId,
			status,
			basis: [basis],
		});
	}
	return { ok: true, value: Object.freeze(dispositions) };
}

function decodeConflictItem(input: {
	readonly item: unknown;
	readonly index: number;
	readonly contributionCount: number;
}):
	| {
			readonly ok: true;
			readonly leftIndex: number;
			readonly rightIndex: number;
			readonly basis: readonly string[];
	  }
	| { readonly ok: false; readonly message: string } {
	const { item, index, contributionCount } = input;
	if (!isRecord(item)) {
		return { ok: false, message: `Conflict ${index} must be an object.` };
	}
	const leftIndex = item.left_index;
	const rightIndex = item.right_index;
	if (
		typeof leftIndex !== "number" ||
		typeof rightIndex !== "number" ||
		!Number.isInteger(leftIndex) ||
		!Number.isInteger(rightIndex) ||
		leftIndex < 0 ||
		rightIndex < 0 ||
		leftIndex >= contributionCount ||
		rightIndex >= contributionCount
	) {
		return {
			ok: false,
			message: `Conflict ${index} requires two current Contribution indices.`,
		};
	}
	if (
		!Array.isArray(item.basis) ||
		item.basis.length === 0 ||
		item.basis.length > 32 ||
		item.basis.some((basis) => typeof basis !== "string")
	) {
		return {
			ok: false,
			message: `Conflict ${index} requires one or more basis strings.`,
		};
	}
	return { ok: true, leftIndex, rightIndex, basis: item.basis };
}

function decodeConflicts(
	value: unknown,
	contributions: readonly SdkCoverageContribution[],
):
	| { readonly ok: true; readonly value: readonly CoverageConflictProposal[] }
	| { readonly ok: false; readonly message: string } {
	const decoded = decodeSdkProposalJson(value, "conflicts_json");
	if (!decoded.ok) return decoded;
	if (!Array.isArray(decoded.value) || decoded.value.length > 32) {
		return {
			ok: false,
			message: "conflicts_json must encode at most 32 conflicts.",
		};
	}
	const conflicts: CoverageConflictProposal[] = [];
	for (const [index, item] of decoded.value.entries()) {
		const decodedItem = decodeConflictItem({
			item,
			index,
			contributionCount: contributions.length,
		});
		if (!decodedItem.ok) return decodedItem;
		const left = contributions[decodedItem.leftIndex];
		const right = contributions[decodedItem.rightIndex];
		if (left === undefined || right === undefined) {
			return {
				ok: false,
				message: `Conflict ${index} references an unavailable Contribution.`,
			};
		}
		conflicts.push({
			leftContributionId: left.contributionId,
			rightContributionId: right.contributionId,
			basis: decodedItem.basis,
		});
	}
	return { ok: true, value: Object.freeze(conflicts) };
}

function canonicalProposal(input: {
	readonly raw: Record<string, unknown>;
	readonly target: NeedCoverageTarget;
	readonly contributions: readonly SdkCoverageContribution[];
}):
	| { readonly ok: true; readonly value: NeedCoverageProposal }
	| { readonly ok: false; readonly code: string; readonly message: string } {
	const status = input.raw.status;
	if (
		status !== "covered" &&
		status !== "partially-covered" &&
		status !== "conflicted" &&
		status !== "missing"
	) {
		return {
			ok: false,
			code: "invalid-coverage-status",
			message: "status must be a canonical Need Coverage status.",
		};
	}
	const dispositions = decodeDispositions(input.raw, input.contributions);
	if (!dispositions.ok) {
		return {
			ok: false,
			code: "invalid-dispositions",
			message: dispositions.message,
		};
	}
	const conflicts = decodeConflicts(
		input.raw.conflicts_json,
		input.contributions,
	);
	if (!conflicts.ok) {
		return {
			ok: false,
			code: "invalid-conflicts",
			message: conflicts.message,
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
			...input.target,
			status,
			dispositions: dispositions.value,
			conflicts: conflicts.value,
			basis: basis.value,
			provenance: { kind: "model", source: "pi:sdk-action-loop" },
		},
	};
}

function coverageTool(input: {
	readonly target: NeedCoverageTarget;
	readonly contributions: readonly SdkCoverageContribution[];
}): SdkProposalTool<CoverageDecision> {
	return {
		name: "submit_need_coverage",
		label: "Submit one cross-Contribution Need Coverage assessment",
		description:
			"Disposition every current Contribution and assess one Need without closing the Judgment.",
		parameters: coverageParameters(input.contributions),
		execute: async (raw) => {
			if (!isRecord(raw)) {
				return rejected(
					"invalid-arguments",
					"Coverage arguments must be an object.",
				);
			}
			const proposal = canonicalProposal({ ...input, raw });
			if (!proposal.ok) return rejected(proposal.code, proposal.message);
			const assessed = assessNeedCoverage(
				input.target,
				input.contributions,
				proposal.value,
			);
			if (assessed.status === "invalid") {
				return rejected(assessed.error.code, assessed.error.message);
			}
			return {
				status: "accepted",
				value: { proposal: proposal.value, coverage: assessed.value },
				message: `Need Coverage accepted as ${assessed.value.status}.`,
				resultStatus: assessed.value.status,
			};
		},
	};
}

function coveragePrompt(input: SdkNeedCoverageInput): string {
	const contributions = input.contributions
		.map((contribution, index) =>
			[
				`Contribution ${index} (${contribution.localStatus})`,
				`Result: ${contribution.result}`,
				`Limitations: ${contribution.limitations.join(" | ") || "none declared"}`,
			].join("\n"),
		)
		.join("\n\n");
	return [
		`Delegated request:\n${input.request}`,
		`Contribution Need:\n${input.contributionNeed}`,
		contributions.length > 0
			? `Current Contributions:\n${contributions}`
			: "Current Contributions: none",
		"Disposition every current Contribution. Coverage is cross-Contribution synthesis, not a final Judgment Conclusion.",
	].join("\n\n");
}

/** Assesses one Need from the complete current Contribution inventory. */
export async function assessNeedCoverageWithSdk(
	input: SdkNeedCoverageInput,
): Promise<SdkNeedCoverageResult> {
	const decision = await input.runner.run({
		systemPrompt: [
			"Assess one current Contribution Need comparatively.",
			"Call the supplied decision tool exactly once and disposition every current Contribution.",
			"Expose limitations and conflicts; do not create a final Judgment Conclusion.",
			"The SDK controller owns Contribution identities, complete accounting, canonical admission, retries, and stop decisions.",
		].join("\n"),
		prompt: coveragePrompt(input),
		tool: coverageTool(input),
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
	const reproduced = assessNeedCoverage(
		input.target,
		input.contributions,
		decision.value.proposal,
	);
	if (
		reproduced.status === "invalid" ||
		reproduced.value.coverageId !== decision.value.coverage.coverageId
	) {
		return {
			status: "invariant-failure",
			code:
				reproduced.status === "invalid"
					? reproduced.error.code
					: "coverage-identity-drift",
			message:
				reproduced.status === "invalid"
					? reproduced.error.message
					: "Accepted Coverage did not reproduce its canonical identity.",
			decision: decision.metrics,
		};
	}
	return {
		status: "assessed",
		coverage: reproduced.value,
		decision: decision.metrics,
	};
}
