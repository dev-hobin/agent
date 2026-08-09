import type { BoundPiCapabilityEntry } from "../pi/bind-pi-capability-inventory.ts";

/** Always-admitted evidence at the exact granularity of the delegated request. */
export const DELEGATED_REQUEST_EVIDENCE_FUNCTION =
	"Use the delegated request's admitted human-provenance pre-Action facts for this Requirement.";

export interface SdkJudgmentEvidenceCapability {
	readonly name: string;
	readonly entry: BoundPiCapabilityEntry;
}

export type SdkJudgmentEvidenceOperation =
	| {
			readonly kind: "delegated-request";
			readonly function: string;
	  }
	| {
			readonly kind: "host-observation";
			readonly function: string;
			readonly hostFunction: string;
	  }
	| {
			readonly kind: "skill";
			readonly function: string;
			readonly capabilityName: string;
			readonly matchedWhen: readonly string[];
	  };

function hostObservationFunction(hostFunction: string): string {
	return `Use admitted Host evidence function ${JSON.stringify(hostFunction)} for this Requirement.`;
}

function unstructuredSkillFunction(capabilityName: string): string {
	return `Use admitted Skill ${JSON.stringify(capabilityName)} with its sealed Context for this Requirement.`;
}

function structuredSkillFunction(
	capabilityName: string,
	when: string,
): string {
	return `Use admitted Skill ${JSON.stringify(capabilityName)} under its declared condition ${JSON.stringify(when)} with sealed Context for this Requirement.`;
}

/** Builds the finite evidence-operation domain that a Judgment may select. */
export function buildSdkJudgmentEvidenceOperations(input: {
	readonly capabilities: readonly SdkJudgmentEvidenceCapability[];
	readonly availableEvidenceFunctions?: readonly string[];
}): readonly SdkJudgmentEvidenceOperation[] {
	const operations: SdkJudgmentEvidenceOperation[] = [
		{
			kind: "delegated-request",
			function: DELEGATED_REQUEST_EVIDENCE_FUNCTION,
		},
	];
	for (const hostFunction of input.availableEvidenceFunctions ?? []) {
		const normalized = hostFunction.trim();
		if (!normalized) continue;
		operations.push({
			kind: "host-observation",
			function: hostObservationFunction(normalized),
			hostFunction: normalized,
		});
	}
	for (const { name, entry } of input.capabilities) {
		if (entry.routing === "structured") {
			for (const when of entry.capability.toc.when) {
				operations.push({
					kind: "skill",
					function: structuredSkillFunction(name, when),
					capabilityName: name,
					matchedWhen: Object.freeze([when]),
				});
			}
			continue;
		}
		operations.push({
			kind: "skill",
			function: unstructuredSkillFunction(name),
			capabilityName: name,
			matchedWhen: Object.freeze([]),
		});
	}
	const byFunction = new Map<string, SdkJudgmentEvidenceOperation>();
	for (const operation of operations) {
		if (!byFunction.has(operation.function)) {
			byFunction.set(operation.function, operation);
		}
	}
	return Object.freeze(
		[...byFunction.values()].sort((left, right) =>
			left.function.localeCompare(right.function),
		),
	);
}

/** Resolves one exact admitted operation without interpreting model prose. */
export function selectSdkJudgmentEvidenceOperation(
	operations: readonly SdkJudgmentEvidenceOperation[],
	contributionFunction: string,
): SdkJudgmentEvidenceOperation | undefined {
	return operations.find(
		(operation) => operation.function === contributionFunction,
	);
}
