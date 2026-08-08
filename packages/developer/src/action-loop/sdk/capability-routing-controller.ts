import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import {
	acceptCapabilityApplicability,
	type ApplicabilityAcceptanceResult,
	type ApplicabilityTarget,
	type CapabilityAssignment,
} from "../routing/accept-applicability.ts";
import type { BoundCapability } from "../routing/bind-capability.ts";
import {
	bindReferenceSelection,
	type BoundReferenceSelection,
} from "../routing/bind-reference-selection.ts";
import type { ParsedToc } from "../routing/parse-toc.ts";
import {
	selectDeclaredReferences,
	type ReferenceDisposition,
} from "../routing/reference-selection.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionResult,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
	SdkProposalTool,
} from "./decision-controller.ts";
import { isSdkProposalObject } from "./proposal-object.ts";

type AssignedApplicability = Extract<
	ApplicabilityAcceptanceResult,
	{ readonly status: "assigned" }
>;

type NonAssignedApplicability = Extract<
	ApplicabilityAcceptanceResult,
	{ readonly status: "not-applicable" | "needs-context" }
>;

interface ApplicabilityDecision {
	readonly result: Exclude<
		ApplicabilityAcceptanceResult,
		{ readonly status: "invalid" }
	>;
	readonly basis: string;
}

interface ReferenceDecision {
	readonly dispositions: readonly ReferenceDisposition[];
}

export interface SdkRoutingDecisionMetric {
	readonly stage: "applicability" | "references";
	readonly metrics: SdkDecisionMetrics;
}

export type SdkCapabilityRoutingResult =
	| {
			readonly status: "routed";
			readonly applicability: AssignedApplicability;
			readonly selection: BoundReferenceSelection;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "not-assigned";
			readonly applicability: NonAssignedApplicability;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "bounded-stop";
			readonly stage: "applicability" | "references";
			readonly reason: SdkDecisionStopReason;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "runtime-failure";
			readonly stage: "applicability" | "references";
			readonly message: string;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "invariant-failure";
			readonly stage: "references";
			readonly code: string;
			readonly message: string;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  };

export interface SdkCapabilityRoutingInput {
	readonly request: string;
	readonly target: ApplicabilityTarget & {
		readonly capability: BoundCapability;
	};
	readonly toc: ParsedToc;
	readonly runner: SdkDecisionRunner;
}

export interface SdkStructuredReferenceSelectionInput {
	readonly request: string;
	readonly assignment: CapabilityAssignment;
	readonly capability: BoundCapability;
	readonly toc: ParsedToc;
	readonly runner: SdkDecisionRunner;
}

export type SdkStructuredReferenceSelectionResult =
	| {
			readonly status: "selected";
			readonly selection: BoundReferenceSelection;
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

const applicabilityParameters = Type.Object(
	{
		status: StringEnum([
			"applicable",
			"not-applicable",
			"needs-context",
		] as const),
		matches_when: Type.Boolean(),
		matches_unless: Type.Boolean(),
		basis: Type.String({ minLength: 1, maxLength: 2_048 }),
		missing_context: Type.Optional(Type.String({ maxLength: 2_048 })),
	},
	{ additionalProperties: false },
);

const referenceStatuses = ["selected", "not-needed", "needs-context"] as const;

function isApplicabilityStatus(
	value: unknown,
): value is "applicable" | "not-applicable" | "needs-context" {
	return (
		value === "applicable" ||
		value === "not-applicable" ||
		value === "needs-context"
	);
}

function isReferenceStatus(
	value: unknown,
): value is ReferenceDisposition["status"] {
	return (
		value === "selected" || value === "not-needed" || value === "needs-context"
	);
}

function rejected<T>(code: string, message: string): SdkProposalAdmission<T> {
	return { status: "rejected", code, message };
}

function applicabilityTool(
	target: SdkCapabilityRoutingInput["target"],
	toc: ParsedToc,
): SdkProposalTool<ApplicabilityDecision> {
	return {
		name: "submit_capability_applicability",
		label: "Submit capability applicability",
		description:
			"Submit one semantic applicability decision; the SDK controller supplies exact canonical conditions and identities.",
		parameters: applicabilityParameters,
		execute: async (raw) => {
			if (!isSdkProposalObject(raw)) {
				return rejected(
					"invalid-arguments",
					"Applicability arguments must be an object.",
				);
			}
			if (
				!isApplicabilityStatus(raw.status) ||
				typeof raw.matches_when !== "boolean" ||
				typeof raw.matches_unless !== "boolean" ||
				typeof raw.basis !== "string" ||
				(raw.missing_context !== undefined &&
					typeof raw.missing_context !== "string")
			) {
				return rejected(
					"invalid-arguments",
					"Applicability requires status, matches_when, matches_unless, basis, and optional missing_context with their declared scalar types.",
				);
			}
			const missingContext =
				typeof raw.missing_context === "string"
					? raw.missing_context.trim()
					: "";
			const result = acceptCapabilityApplicability(target, {
				workCaseId: target.workCaseId,
				judgmentId: target.judgmentId,
				contributionNeedId: target.contributionNeedId,
				capabilityRevisionId: target.capability.capabilityRevisionId,
				status: raw.status,
				matchedWhen: raw.matches_when ? toc.when : [],
				matchedUnless: raw.matches_unless ? toc.unless : [],
				basis: [raw.basis],
				missingContext:
					raw.status === "needs-context" && missingContext
						? [missingContext]
						: [],
			});
			if (result.status === "invalid") {
				return rejected(result.error.code, result.error.message);
			}
			return {
				status: "accepted",
				value: { result, basis: raw.basis },
				message: `Applicability accepted as ${result.status}.`,
				resultStatus: result.status,
			};
		},
	};
}

function referenceParameters(toc: ParsedToc): TSchema {
	const fields: Record<string, TSchema> = {};
	for (const [index, reference] of toc.references.entries()) {
		fields[`status_${index}`] = StringEnum(referenceStatuses, {
			description: `${reference.path} — ${reference.when.join(" | ")}`,
		});
		fields[`basis_${index}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
			description: `Why ${reference.path} is selected, not needed, or needs context relative to every other declared Reference.`,
		});
	}
	return Type.Object(fields, { additionalProperties: false });
}

function referenceTool(toc: ParsedToc): SdkProposalTool<ReferenceDecision> {
	return {
		name: "submit_reference_dispositions",
		label: "Submit comparative Reference dispositions",
		description:
			"Disposition every declared Reference in one comparative proposal; the SDK controller maps flat fields to canonical paths.",
		parameters: referenceParameters(toc),
		execute: async (raw) => {
			if (!isSdkProposalObject(raw)) {
				return rejected(
					"invalid-arguments",
					"Reference arguments must be an object.",
				);
			}
			const dispositions: ReferenceDisposition[] = [];
			for (const [index, reference] of toc.references.entries()) {
				const status = raw[`status_${index}`];
				const basis = raw[`basis_${index}`];
				if (!isReferenceStatus(status) || typeof basis !== "string") {
					return rejected(
						"invalid-reference-disposition",
						`Reference disposition ${index} requires canonical status_${index} and non-empty basis_${index}.`,
					);
				}
				dispositions.push({ path: reference.path, status, basis: [basis] });
			}
			const selected = selectDeclaredReferences(toc.references, dispositions);
			if (selected.status === "invalid") {
				return rejected(
					"invalid-reference-selection",
					`Reference dispositions are invalid: ${selected.issues
						.map((issue) => `${issue.code}:${issue.path}`)
						.join(" | ")}`,
				);
			}
			return {
				status: "accepted",
				value: { dispositions: Object.freeze(dispositions) },
				message: `Comparative Reference dispositions accepted as ${selected.status}.`,
				resultStatus: selected.status,
			};
		},
	};
}

function routingPrompt(request: string, toc: ParsedToc): string {
	return [
		`User request: ${request}`,
		"Compare all declared Reference conditions before deciding:",
		...toc.references.map(
			(reference, index) =>
				`[${index}] ${reference.path} — ${reference.when.join(" | ")}`,
		),
		"For every index, submit status_N and basis_N. Select only materially necessary References.",
	].join("\n");
}

function stoppedResult(
	stage: "applicability" | "references",
	result: Exclude<SdkDecisionResult<unknown>, { readonly status: "accepted" }>,
	decisions: readonly SdkRoutingDecisionMetric[],
): SdkCapabilityRoutingResult {
	if (result.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage,
			reason: result.reason,
			decisions,
		};
	}
	return {
		status: "runtime-failure",
		stage,
		message: result.message,
		decisions,
	};
}

/** Selects and binds every declared Reference for one existing Assignment. */
export async function selectStructuredReferencesWithSdk(
	input: SdkStructuredReferenceSelectionInput,
): Promise<SdkStructuredReferenceSelectionResult> {
	const decision = await input.runner.run({
		systemPrompt: [
			"Make one comparative local Reference routing proposal.",
			"Call the supplied decision tool exactly once and disposition every declared Reference.",
			"Choose the smallest set whose declared conditions materially apply; adjacent subject matter alone is not enough.",
			"The SDK controller owns exact paths, complete inventory, validation, retry limits, and canonical binding.",
		].join("\n"),
		prompt: routingPrompt(input.request, input.toc),
		tool: referenceTool(input.toc),
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
	const selection = selectDeclaredReferences(
		input.toc.references,
		decision.value.dispositions,
	);
	if (selection.status === "invalid") {
		return {
			status: "invariant-failure",
			code: "accepted-selection-became-invalid",
			message:
				"An accepted Reference proposal did not reproduce its canonical selection.",
			decision: decision.metrics,
		};
	}
	const bound = bindReferenceSelection(
		input.assignment,
		input.capability,
		selection,
	);
	if (!bound.ok) {
		return {
			status: "invariant-failure",
			code: bound.error.code,
			message: bound.error.message,
			decision: decision.metrics,
		};
	}
	return {
		status: "selected",
		selection: bound.value,
		decision: decision.metrics,
	};
}

/**
 * Routes one structured Capability through proposal-only SDK decisions and
 * binds only canonically admitted results to the supplied target.
 */
export async function routeStructuredCapabilityWithSdk(
	input: SdkCapabilityRoutingInput,
): Promise<SdkCapabilityRoutingResult> {
	const decisions: SdkRoutingDecisionMetric[] = [];
	const applicability = await input.runner.run({
		systemPrompt: [
			"Make one bounded semantic applicability proposal.",
			"Call the supplied decision tool exactly once. Do not copy condition text into tool arguments.",
			"The SDK controller owns identities, exact conditions, validation, retry limits, and state transitions.",
		].join("\n"),
		prompt: [
			`User request: ${input.request}`,
			`Capability when: ${input.toc.when.join(" | ")}`,
			`Capability unless: ${input.toc.unless.join(" | ") || "none"}`,
			"Decide only whether the Capability applies to this request.",
		].join("\n"),
		tool: applicabilityTool(input.target, input.toc),
	});
	decisions.push({ stage: "applicability", metrics: applicability.metrics });
	if (applicability.status !== "accepted") {
		return stoppedResult("applicability", applicability, decisions);
	}
	if (applicability.value.result.status !== "assigned") {
		return {
			status: "not-assigned",
			applicability: applicability.value.result,
			decisions: Object.freeze(decisions),
		};
	}

	const references = await selectStructuredReferencesWithSdk({
		request: input.request,
		assignment: applicability.value.result.assignment,
		capability: input.target.capability,
		toc: input.toc,
		runner: input.runner,
	});
	decisions.push({ stage: "references", metrics: references.decision });
	if (references.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "references",
			reason: references.reason,
			decisions: Object.freeze(decisions),
		};
	}
	if (references.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "references",
			message: references.message,
			decisions: Object.freeze(decisions),
		};
	}
	if (references.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "references",
			code: references.code,
			message: references.message,
			decisions: Object.freeze(decisions),
		};
	}
	return {
		status: "routed",
		applicability: applicability.value.result,
		selection: references.selection,
		decisions: Object.freeze(decisions),
	};
}
