import {
	sealSkillContext,
	sealUnstructuredSkillContext,
	type SealedSkillContext,
	type SealedUnstructuredSkillContext,
	type SkillContextSealErrorCode,
} from "../io/seal-skill-context.ts";
import type { BoundPiCapabilityEntry } from "../pi/bind-pi-capability-inventory.ts";
import type { CapabilityAssignment } from "../routing/accept-applicability.ts";
import type { BoundReferenceSelection } from "../routing/bind-reference-selection.ts";
import {
	selectStructuredReferencesWithSdk,
	type SdkRoutingDecisionMetric,
} from "./capability-routing-controller.ts";
import type {
	SdkDecisionRunner,
	SdkDecisionStopReason,
} from "./decision-controller.ts";

export type SdkCapabilityContextResult =
	| {
			readonly status: "sealed";
			readonly context: SealedSkillContext | SealedUnstructuredSkillContext;
			readonly selection?: BoundReferenceSelection;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "needs-context";
			readonly selection: BoundReferenceSelection;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "bounded-stop";
			readonly stage: "references";
			readonly reason: SdkDecisionStopReason;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "runtime-failure";
			readonly stage: "references";
			readonly message: string;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "invariant-failure";
			readonly stage: "assignment" | "references";
			readonly code: string;
			readonly message: string;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  }
	| {
			readonly status: "seal-failure";
			readonly code: SkillContextSealErrorCode;
			readonly message: string;
			readonly decisions: readonly SdkRoutingDecisionMetric[];
	  };

export interface SdkCapabilityContextInput {
	readonly request: string;
	readonly entry: BoundPiCapabilityEntry;
	readonly assignment: CapabilityAssignment;
	readonly runner: SdkDecisionRunner;
}

function assignmentFailure(
	input: SdkCapabilityContextInput,
): SdkCapabilityContextResult | undefined {
	if (
		input.assignment.capabilityId !== input.entry.capability.capabilityId ||
		input.assignment.capabilityRevisionId !==
			input.entry.capability.capabilityRevisionId
	) {
		return {
			status: "invariant-failure",
			stage: "assignment",
			code: "assignment-capability-mismatch",
			message:
				"Assignment does not belong to the supplied Capability revision.",
			decisions: Object.freeze([]),
		};
	}
	return undefined;
}

/** Seals exactly one assigned Capability Context without aggregate mutation. */
export async function sealCapabilityContextWithSdk(
	input: SdkCapabilityContextInput,
): Promise<SdkCapabilityContextResult> {
	const mismatch = assignmentFailure(input);
	if (mismatch !== undefined) return mismatch;
	if (input.entry.routing === "unstructured") {
		const sealed = await sealUnstructuredSkillContext({
			skillFilePath: input.entry.candidate.skillFilePath,
			capability: input.entry.capability,
			assignment: input.assignment,
		});
		if (sealed.ok) {
			return {
				status: "sealed",
				context: sealed.value,
				decisions: Object.freeze([]),
			};
		}
		return {
			status: "seal-failure",
			code: sealed.error.code,
			message: sealed.error.message,
			decisions: Object.freeze([]),
		};
	}

	const routed = await selectStructuredReferencesWithSdk({
		request: input.request,
		assignment: input.assignment,
		capability: input.entry.capability,
		toc: input.entry.capability.toc,
		runner: input.runner,
	});
	const decisions = Object.freeze([
		{ stage: "references" as const, metrics: routed.decision },
	]);
	if (routed.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "references",
			reason: routed.reason,
			decisions,
		};
	}
	if (routed.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "references",
			message: routed.message,
			decisions,
		};
	}
	if (routed.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "references",
			code: routed.code,
			message: routed.message,
			decisions,
		};
	}
	if (routed.selection.status === "needs-context") {
		return {
			status: "needs-context",
			selection: routed.selection,
			decisions,
		};
	}
	const sealed = await sealSkillContext({
		skillRootPath: input.entry.candidate.skillRootPath,
		capability: input.entry.capability,
		assignment: input.assignment,
		selection: routed.selection,
	});
	if (!sealed.ok) {
		return {
			status: "seal-failure",
			code: sealed.error.code,
			message: sealed.error.message,
			decisions,
		};
	}
	return {
		status: "sealed",
		context: sealed.value,
		selection: routed.selection,
		decisions,
	};
}
