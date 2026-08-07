import type {
	BoundStructuredPiCapabilityEntry,
	BoundUnstructuredPiCapabilityEntry,
} from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import {
	sealSkillContext,
	sealUnstructuredSkillContext,
	type SealedSkillContext,
	type SealedUnstructuredSkillContext,
} from "../src/action-loop/io/seal-skill-context.ts";
import type { CapabilityAssignment } from "../src/action-loop/routing/accept-applicability.ts";
import { bindReferenceSelection } from "../src/action-loop/routing/bind-reference-selection.ts";
import {
	selectDeclaredReferences,
	type ReferenceDisposition,
} from "../src/action-loop/routing/reference-selection.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export const ACTION_LOOP_SELECT_REFERENCES_TOOL = "developer_select_references";
export const ACTION_LOOP_LOAD_SELECTED_REFERENCE_TOOL =
	"developer_load_selected_reference";

interface LiveUnstructuredCapability {
	readonly candidate: Pick<
		BoundUnstructuredPiCapabilityEntry["candidate"],
		"skillFilePath"
	>;
	readonly capability: BoundUnstructuredPiCapabilityEntry["capability"];
}

interface LiveStructuredCapability {
	readonly candidate: Pick<
		BoundStructuredPiCapabilityEntry["candidate"],
		"skillRootPath"
	>;
	readonly capability: BoundStructuredPiCapabilityEntry["capability"];
}

export type LiveSelectedReferenceResult =
	| {
			readonly status: "loaded";
			readonly sealedContextId: string;
			readonly path: string;
			readonly content: string;
			readonly hash: string;
			readonly byteLength: number;
	  }
	| { readonly status: "invalid"; readonly message: string };

export type LiveStructuredContextResult =
	| {
			readonly status: "sealed" | "selected" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly selectionId: string;
			readonly context?: SealedSkillContext;
	  }
	| { readonly status: "invalid"; readonly message: string };

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
		assignment.capabilityRevisionId !== entry.capability.capabilityRevisionId
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

/** Returns one exact already-sealed selected Reference without filesystem reacquisition. */
export function loadLiveSelectedReference(
	state: LiveWorkCaseState,
	sealedContextId: string,
	path: string,
): LiveSelectedReferenceResult {
	const context = state.sealedSkillContexts.find(
		(candidate) => candidate.sealedContextId === sealedContextId,
	);
	if (context === undefined || "routing" in context) {
		return {
			status: "invalid",
			message:
				"Selected Reference requires a current structured sealed context",
		};
	}
	if (!context.selectedPaths.includes(path)) {
		return {
			status: "invalid",
			message: `Reference is not selected by this sealed context: ${path}`,
		};
	}
	const material = context.materials.find(
		(candidate) => candidate.kind === "reference" && candidate.path === path,
	);
	if (material === undefined) {
		return {
			status: "invalid",
			message: `Selected Reference material is unavailable: ${path}`,
		};
	}
	return {
		status: "loaded",
		sealedContextId: context.sealedContextId,
		path: material.path,
		content: material.content,
		hash: material.hash,
		byteLength: material.byteLength,
	};
}

/** Accounts for every declared Reference and atomically seals a ready selection. */
export async function selectAndSealLiveStructuredCapability(
	state: LiveWorkCaseState,
	entry: LiveStructuredCapability,
	assignment: CapabilityAssignment,
	dispositions: readonly ReferenceDisposition[],
): Promise<LiveStructuredContextResult> {
	const currentAssignment = state.capabilityAssignments.find(
		(candidate) => candidate.assignmentId === assignment.assignmentId,
	);
	if (
		currentAssignment === undefined ||
		assignment.workCaseId !== state.workCase.workCaseId ||
		assignment.capabilityRevisionId !== entry.capability.capabilityRevisionId
	) {
		return {
			status: "invalid",
			message:
				"Structured selection requires the exact current Capability Assignment",
		};
	}
	const selected = selectDeclaredReferences(
		entry.capability.toc.references.map(({ path }) => ({ path })),
		dispositions,
	);
	if (selected.status === "invalid") {
		const issue = selected.issues[0];
		return {
			status: "invalid",
			message: `Invalid Reference selection: ${issue.code} at ${issue.path}`,
		};
	}
	const bound = bindReferenceSelection(
		currentAssignment,
		entry.capability,
		selected,
	);
	if (!bound.ok) return { status: "invalid", message: bound.error.message };
	const existingSelection = state.referenceSelections.find(
		(selection) => selection.assignmentId === currentAssignment.assignmentId,
	);
	if (existingSelection !== undefined) {
		if (existingSelection.selectionId !== bound.value.selectionId) {
			return {
				status: "invalid",
				message:
					"Assignment already has a different Reference selection for this Context",
			};
		}
		const existingContext = state.sealedSkillContexts.find(
			(context) => context.assignmentId === currentAssignment.assignmentId,
		);
		return {
			status: "unchanged",
			state,
			selectionId: existingSelection.selectionId,
			...(existingContext && !("routing" in existingContext)
				? { context: existingContext }
				: {}),
		};
	}
	if (bound.value.status === "needs-context") {
		return {
			status: "selected",
			state: Object.freeze({
				...state,
				referenceSelections: Object.freeze([
					...state.referenceSelections,
					bound.value,
				]),
			}),
			selectionId: bound.value.selectionId,
		};
	}
	const sealed = await sealSkillContext({
		skillRootPath: entry.candidate.skillRootPath,
		capability: entry.capability,
		assignment: currentAssignment,
		selection: bound.value,
	});
	if (!sealed.ok) return { status: "invalid", message: sealed.error.message };
	const referenceSelections = Object.freeze(
		[...state.referenceSelections, bound.value].sort((left, right) =>
			left.selectionId.localeCompare(right.selectionId),
		),
	);
	const sealedSkillContexts = Object.freeze(
		[...state.sealedSkillContexts, sealed.value].sort((left, right) =>
			left.sealedContextId.localeCompare(right.sealedContextId),
		),
	);
	return {
		status: "sealed",
		state: Object.freeze({
			...state,
			referenceSelections,
			sealedSkillContexts,
		}),
		selectionId: bound.value.selectionId,
		context: sealed.value,
	};
}
