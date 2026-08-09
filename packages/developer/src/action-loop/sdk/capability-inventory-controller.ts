import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TSchema } from "typebox";

import type { BoundPiCapabilityEntry } from "../pi/bind-pi-capability-inventory.ts";
import {
	acceptCapabilityApplicability,
	type AcceptedApplicabilityAssessment,
	type CapabilityAssignment,
} from "../routing/accept-applicability.ts";
import type {
	SdkDecisionMetrics,
	SdkDecisionRunner,
	SdkDecisionStopReason,
	SdkProposalAdmission,
} from "./decision-controller.ts";
import { isSdkProposalObject } from "./proposal-object.ts";
import { renderSdkProposalPrompt } from "./proposal-prompt.ts";

const applicabilityStatuses = [
	"applicable",
	"not-applicable",
	"needs-context",
] as const;

export interface SdkNamedCapability {
	readonly name: string;
	readonly entry: BoundPiCapabilityEntry;
}

export interface SdkCapabilityInventoryDisposition {
	readonly name: string;
	readonly assessment: AcceptedApplicabilityAssessment;
	readonly assignment?: CapabilityAssignment;
}

interface CapabilityInventoryDecision {
	readonly dispositions: readonly SdkCapabilityInventoryDisposition[];
}

export type SdkCapabilityInventoryResult =
	| {
			readonly status: "assessed";
			readonly dispositions: readonly SdkCapabilityInventoryDisposition[];
			readonly assignments: readonly CapabilityAssignment[];
			readonly decision?: SdkDecisionMetrics;
	  }
	| {
			readonly status: "invalid-inventory";
			readonly message: string;
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

export interface SdkCapabilityInventoryInput {
	readonly request: string;
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly contributionNeed: string;
	readonly capabilities: readonly SdkNamedCapability[];
	readonly runner: SdkDecisionRunner;
}

function isApplicabilityStatus(
	value: unknown,
): value is (typeof applicabilityStatuses)[number] {
	return applicabilityStatuses.some((status) => status === value);
}

function rejected<T>(code: string, message: string): SdkProposalAdmission<T> {
	return { status: "rejected", code, message };
}

function canonicalInventory(
	capabilities: readonly SdkNamedCapability[],
):
	| { readonly ok: true; readonly value: readonly SdkNamedCapability[] }
	| { readonly ok: false; readonly message: string } {
	const seenNames = new Set<string>();
	const seenRevisions = new Set<string>();
	const canonical: SdkNamedCapability[] = [];
	for (const capability of capabilities) {
		const name = capability.name.trim();
		const revision = capability.entry.capability.capabilityRevisionId;
		if (!name || name.length > 128) {
			return {
				ok: false,
				message: "Capability names must be bounded and nonblank.",
			};
		}
		if (seenNames.has(name) || seenRevisions.has(revision)) {
			return {
				ok: false,
				message: `Capability inventory contains a duplicate name or revision: ${name}`,
			};
		}
		seenNames.add(name);
		seenRevisions.add(revision);
		canonical.push({ name, entry: capability.entry });
	}
	canonical.sort((left, right) => left.name.localeCompare(right.name));
	return { ok: true, value: Object.freeze(canonical) };
}

function inventoryParameters(
	capabilities: readonly SdkNamedCapability[],
): TSchema {
	const fields: Record<string, TSchema> = {};
	for (const [index, { name, entry }] of capabilities.entries()) {
		const conditions =
			entry.routing === "structured"
				? `when: ${entry.capability.toc.when.join(" | ")}; unless: ${entry.capability.toc.unless.join(" | ") || "none"}`
				: "unstructured Capability without declared conditions";
		fields[`status_${index}`] = StringEnum(applicabilityStatuses, {
			description: `${name} — ${conditions}`,
		});
		fields[`basis_${index}`] = Type.String({
			minLength: 1,
			maxLength: 2_048,
			description: `Why ${name} has this status for the current Contribution Need.`,
		});
		fields[`missing_context_${index}`] = Type.Optional(
			Type.String({ maxLength: 2_048 }),
		);
		if (entry.routing !== "structured") continue;
		for (const [
			conditionIndex,
			condition,
		] of entry.capability.toc.when.entries()) {
			fields[`when_${index}_${conditionIndex}`] = Type.Boolean({
				description: `${name} when condition: ${condition}`,
			});
		}
		for (const [
			conditionIndex,
			condition,
		] of entry.capability.toc.unless.entries()) {
			fields[`unless_${index}_${conditionIndex}`] = Type.Boolean({
				description: `${name} unless condition: ${condition}`,
			});
		}
	}
	return Type.Object(fields, { additionalProperties: false });
}

function selectedConditions(input: {
	readonly raw: Record<string, unknown>;
	readonly prefix: "when" | "unless";
	readonly capabilityIndex: number;
	readonly conditions: readonly string[];
}):
	| { readonly ok: true; readonly value: readonly string[] }
	| { readonly ok: false; readonly message: string } {
	const selected: string[] = [];
	for (const [conditionIndex, condition] of input.conditions.entries()) {
		const field = `${input.prefix}_${input.capabilityIndex}_${conditionIndex}`;
		const value = input.raw[field];
		if (typeof value !== "boolean") {
			return { ok: false, message: `${field} must be boolean.` };
		}
		if (value) selected.push(condition);
	}
	return { ok: true, value: selected };
}

function inventoryTool(input: {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly capabilities: readonly SdkNamedCapability[];
}) {
	return {
		name: "submit_capability_inventory",
		label: "Submit Capability inventory",
		description:
			"Disposition every admitted Capability for one Contribution Need. The controller owns all names, conditions, identities, and complete accounting.",
		parameters: inventoryParameters(input.capabilities),
		execute: async (
			raw: unknown,
		): Promise<SdkProposalAdmission<CapabilityInventoryDecision>> => {
			if (!isSdkProposalObject(raw)) {
				return rejected(
					"invalid-arguments",
					"Capability inventory arguments must be an object.",
				);
			}
			const dispositions: SdkCapabilityInventoryDisposition[] = [];
			for (const [index, { name, entry }] of input.capabilities.entries()) {
				const status = raw[`status_${index}`];
				const basis = raw[`basis_${index}`];
				const missingContext = raw[`missing_context_${index}`];
				if (
					!isApplicabilityStatus(status) ||
					typeof basis !== "string" ||
					(missingContext !== undefined && typeof missingContext !== "string")
				) {
					return rejected(
						"invalid-capability-disposition",
						`Capability ${name} requires canonical status_${index}, basis_${index}, and optional missing_context_${index}.`,
					);
				}
				const matchedWhen =
					entry.routing === "structured"
						? selectedConditions({
								raw,
								prefix: "when",
								capabilityIndex: index,
								conditions: entry.capability.toc.when,
							})
						: { ok: true as const, value: [] as readonly string[] };
				if (!matchedWhen.ok) {
					return rejected("invalid-when-accounting", matchedWhen.message);
				}
				const matchedUnless =
					entry.routing === "structured"
						? selectedConditions({
								raw,
								prefix: "unless",
								capabilityIndex: index,
								conditions: entry.capability.toc.unless,
							})
						: { ok: true as const, value: [] as readonly string[] };
				if (!matchedUnless.ok) {
					return rejected("invalid-unless-accounting", matchedUnless.message);
				}
				const accepted = acceptCapabilityApplicability(
					{
						workCaseId: input.workCaseId,
						judgmentId: input.judgmentId,
						contributionNeedId: input.contributionNeedId,
						capability: entry.capability,
					},
					{
						workCaseId: input.workCaseId,
						judgmentId: input.judgmentId,
						contributionNeedId: input.contributionNeedId,
						capabilityRevisionId: entry.capability.capabilityRevisionId,
						status,
						matchedWhen: matchedWhen.value,
						matchedUnless: matchedUnless.value,
						basis: [basis],
						missingContext:
							status === "needs-context" && missingContext?.trim()
								? [missingContext.trim()]
								: [],
					},
				);
				if (accepted.status === "invalid") {
					return rejected(
						accepted.error.code,
						`${name}: ${accepted.error.message}`,
					);
				}
				dispositions.push({
					name,
					assessment: accepted.assessment,
					...(accepted.status === "assigned"
						? { assignment: accepted.assignment }
						: {}),
				});
			}
			return {
				status: "accepted",
				value: { dispositions: Object.freeze(dispositions) },
				message: "Complete Capability inventory accepted.",
				resultStatus: "assessed",
			};
		},
	};
}

function inventoryProposalPrompt(input: {
	readonly request: string;
	readonly contributionNeed: string;
	readonly capabilities: readonly SdkNamedCapability[];
}) {
	return renderSdkProposalPrompt({
		stage: "capability-inventory",
		objective:
			"Disposition every admitted Capability against one current Contribution Need.",
		rules: [
			"Account for every admitted Capability.",
			"Use needs-context rather than guessing. Adjacent subject matter is not applicability.",
		],
		sections: [
			{ name: "delegated_request", content: input.request },
			{ name: "contribution_need", content: input.contributionNeed },
			{
				name: "admitted_capabilities",
				content: input.capabilities.map(({ name, entry }, index) =>
					entry.routing === "structured"
						? `[${index}] ${name}; when: ${entry.capability.toc.when.join(" | ")}; unless: ${entry.capability.toc.unless.join(" | ") || "none"}`
						: `[${index}] ${name}; unstructured Capability`,
				),
			},
		],
		decision: "Submit one complete comparative applicability proposal.",
	});
}

/** Assesses every admitted Capability atomically for one current Need. */
export async function assessCapabilityInventoryWithSdk(
	input: SdkCapabilityInventoryInput,
): Promise<SdkCapabilityInventoryResult> {
	const inventory = canonicalInventory(input.capabilities);
	if (!inventory.ok) {
		return { status: "invalid-inventory", message: inventory.message };
	}
	if (inventory.value.length === 0) {
		return {
			status: "assessed",
			dispositions: Object.freeze([]),
			assignments: Object.freeze([]),
		};
	}
	const decision = await input.runner.run({
		...inventoryProposalPrompt({
			request: input.request,
			contributionNeed: input.contributionNeed,
			capabilities: inventory.value,
		}),
		tool: inventoryTool({
			workCaseId: input.workCaseId,
			judgmentId: input.judgmentId,
			contributionNeedId: input.contributionNeedId,
			capabilities: inventory.value,
		}),
	});
	if (decision.status === "accepted") {
		return {
			status: "assessed",
			dispositions: decision.value.dispositions,
			assignments: Object.freeze(
				decision.value.dispositions.flatMap(({ assignment }) =>
					assignment === undefined ? [] : [assignment],
				),
			),
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
