import { hashIdentity } from "../identity/hash-identity.ts";
import type { CapabilityAssignment } from "./accept-applicability.ts";
import type { BoundCapability } from "./bind-capability.ts";
import type {
	ReferenceDisposition,
	ReferenceSelection,
} from "./reference-selection.ts";

export const REFERENCE_SELECTION_VERSION = "developer-reference-selection/v1";

export interface BoundReferenceSelection {
	readonly status: "ready" | "needs-context";
	readonly selectionId: string;
	readonly assignmentId: string;
	readonly capabilityRevisionId: string;
	readonly dispositions: readonly ReferenceDisposition[];
	readonly selectedPaths: readonly string[];
	readonly unresolved: readonly ReferenceDisposition[];
}

export type SelectionBindingErrorCode =
	| "invalid-selection"
	| "assignment-capability-mismatch"
	| "declaration-mismatch"
	| "selection-invariant-failed";

export interface SelectionBindingError {
	readonly code: SelectionBindingErrorCode;
	readonly path: string;
	readonly message: string;
}

export type SelectionBindingResult =
	| { readonly ok: true; readonly value: BoundReferenceSelection }
	| { readonly ok: false; readonly error: SelectionBindingError };

function failure(
	code: SelectionBindingErrorCode,
	path: string,
	message: string,
): SelectionBindingResult {
	return { ok: false, error: { code, path, message } };
}

function checkAssignment(
	assignment: CapabilityAssignment,
	capability: BoundCapability,
): SelectionBindingResult | undefined {
	if (assignment.capabilityId !== capability.capabilityId) {
		return failure(
			"assignment-capability-mismatch",
			"assignment.capabilityId",
			"Assignment belongs to another Capability",
		);
	}
	if (assignment.capabilityRevisionId !== capability.capabilityRevisionId) {
		return failure(
			"assignment-capability-mismatch",
			"assignment.capabilityRevisionId",
			"Assignment belongs to another Capability revision",
		);
	}
	return undefined;
}

function copyDispositions(
	dispositions: readonly ReferenceDisposition[],
): readonly ReferenceDisposition[] {
	return Object.freeze(
		dispositions.map((disposition) =>
			Object.freeze({
				path: disposition.path,
				status: disposition.status,
				basis: Object.freeze([...disposition.basis]),
			}),
		),
	);
}

function checkDeclarations(
	capability: BoundCapability,
	dispositions: readonly ReferenceDisposition[],
): SelectionBindingResult | undefined {
	const declared = capability.toc.references;
	if (dispositions.length !== declared.length) {
		return failure(
			"declaration-mismatch",
			"selection.dispositions",
			"Selection must disposition the current TOC Reference inventory",
		);
	}
	for (let index = 0; index < declared.length; index += 1) {
		if (dispositions[index]?.path !== declared[index]?.path) {
			return failure(
				"declaration-mismatch",
				`selection.dispositions[${index}].path`,
				"Selection order and paths must match the current TOC",
			);
		}
	}
	return undefined;
}

function deriveSelection(dispositions: readonly ReferenceDisposition[]): {
	readonly selectedPaths: readonly string[];
	readonly unresolved: readonly ReferenceDisposition[];
} {
	const selectedPaths: string[] = [];
	const unresolved: ReferenceDisposition[] = [];
	for (const disposition of dispositions) {
		if (disposition.status === "selected") {
			selectedPaths.push(disposition.path);
		} else if (disposition.status === "needs-context") {
			unresolved.push(disposition);
		}
	}
	return {
		selectedPaths: Object.freeze(selectedPaths),
		unresolved: Object.freeze(unresolved),
	};
}

function sameStrings(
	actual: readonly string[],
	expected: readonly string[],
): boolean {
	return (
		actual.length === expected.length &&
		actual.every((value, index) => value === expected[index])
	);
}

function checkSelectionState(
	selection: Exclude<ReferenceSelection, { status: "invalid" }>,
	derived: ReturnType<typeof deriveSelection>,
): SelectionBindingResult | undefined {
	if (!sameStrings(selection.selectedPaths, derived.selectedPaths)) {
		return failure(
			"selection-invariant-failed",
			"selection.selectedPaths",
			"Selected paths must be derived from ordered dispositions",
		);
	}
	if (selection.status === "ready" && derived.unresolved.length > 0) {
		return failure(
			"selection-invariant-failed",
			"selection.status",
			"Ready selection cannot contain needs-context dispositions",
		);
	}
	if (selection.status === "needs-context" && derived.unresolved.length === 0) {
		return failure(
			"selection-invariant-failed",
			"selection.status",
			"Needs-context selection requires an unresolved disposition",
		);
	}
	return undefined;
}

function identityParts(
	assignment: CapabilityAssignment,
	dispositions: readonly ReferenceDisposition[],
): string[] {
	const parts = [assignment.assignmentId, assignment.capabilityRevisionId];
	for (const disposition of dispositions) {
		parts.push(
			"disposition",
			disposition.path,
			disposition.status,
			String(disposition.basis.length),
			...disposition.basis,
		);
	}
	return parts;
}

/** Binds complete Reference dispositions to exactly one Capability Assignment. */
export function bindReferenceSelection(
	assignment: CapabilityAssignment,
	capability: BoundCapability,
	selection: ReferenceSelection,
): SelectionBindingResult {
	const assignmentFailure = checkAssignment(assignment, capability);
	if (assignmentFailure !== undefined) return assignmentFailure;
	if (selection.status === "invalid") {
		return failure(
			"invalid-selection",
			"selection",
			"An invalid Reference selection cannot be bound",
		);
	}
	const declarationFailure = checkDeclarations(
		capability,
		selection.dispositions,
	);
	if (declarationFailure !== undefined) return declarationFailure;

	const dispositions = copyDispositions(selection.dispositions);
	const derived = deriveSelection(dispositions);
	const stateFailure = checkSelectionState(selection, derived);
	if (stateFailure !== undefined) return stateFailure;
	const selectionId = hashIdentity(
		"selection",
		REFERENCE_SELECTION_VERSION,
		identityParts(assignment, dispositions),
	);

	return {
		ok: true,
		value: Object.freeze({
			status: selection.status,
			selectionId,
			assignmentId: assignment.assignmentId,
			capabilityRevisionId: capability.capabilityRevisionId,
			dispositions,
			selectedPaths: derived.selectedPaths,
			unresolved: derived.unresolved,
		}),
	};
}
