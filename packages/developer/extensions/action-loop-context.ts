import type { BoundUnstructuredPiCapabilityEntry } from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import {
	sealUnstructuredSkillContext,
	type SealedUnstructuredSkillContext,
} from "../src/action-loop/io/seal-skill-context.ts";
import type { CapabilityAssignment } from "../src/action-loop/routing/accept-applicability.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

interface LiveUnstructuredCapability {
	readonly candidate: Pick<
		BoundUnstructuredPiCapabilityEntry["candidate"],
		"skillFilePath"
	>;
	readonly capability: BoundUnstructuredPiCapabilityEntry["capability"];
}

export type LiveUnstructuredContextResult =
	| {
			readonly status: "sealed" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly context: SealedUnstructuredSkillContext;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Acquires exactly one assigned unstructured Skill file and no References. */
export async function sealLiveUnstructuredCapability(
	state: LiveWorkCaseState,
	entry: LiveUnstructuredCapability,
	assignment: CapabilityAssignment,
): Promise<LiveUnstructuredContextResult> {
	const currentAssignment = state.capabilityAssignments.find(
		(candidate) => candidate.assignmentId === assignment.assignmentId,
	);
	if (
		currentAssignment === undefined ||
		assignment.workCaseId !== state.workCase.workCaseId ||
		assignment.capabilityRevisionId !==
			entry.capability.capabilityRevisionId
	) {
		return {
			status: "invalid",
			message:
				"Unstructured sealing requires the exact current Capability Assignment",
		};
	}
	const existing = state.sealedSkillContexts.find(
		(context) => context.assignmentId === currentAssignment.assignmentId,
	);
	if (existing !== undefined) {
		if ("routing" in existing && existing.routing === "unstructured") {
			return {
				status: "unchanged",
				state,
				context: existing,
			};
		}
		return {
			status: "invalid",
			message: "Assignment is already bound to a different Skill context mode",
		};
	}
	const sealed = await sealUnstructuredSkillContext({
		skillFilePath: entry.candidate.skillFilePath,
		capability: entry.capability,
		assignment: currentAssignment,
	});
	if (!sealed.ok) {
		return { status: "invalid", message: sealed.error.message };
	}
	const sealedSkillContexts = Object.freeze(
		[...state.sealedSkillContexts, sealed.value].sort((left, right) =>
			left.sealedContextId.localeCompare(right.sealedContextId),
		),
	);
	return {
		status: "sealed",
		state: Object.freeze({ ...state, sealedSkillContexts }),
		context: sealed.value,
	};
}
