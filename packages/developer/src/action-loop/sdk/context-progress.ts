import type { SkillContributionContext } from "../contribution/accept-skill-contribution.ts";
import type { CapabilityAssignment } from "../routing/accept-applicability.ts";
import type { BoundReferenceSelection } from "../routing/bind-reference-selection.ts";

export interface SdkCapabilityContextProgressInput {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly assignments: readonly CapabilityAssignment[];
	readonly selections: readonly BoundReferenceSelection[];
	readonly contexts: readonly SkillContributionContext[];
}

export type SdkCapabilityContextProgress =
	| {
			readonly status: "pending";
			readonly pendingAssignments: readonly CapabilityAssignment[];
			readonly unresolvedSelections: readonly BoundReferenceSelection[];
			readonly completedAssignmentIds: readonly string[];
	  }
	| {
			readonly status: "needs-context";
			readonly pendingAssignments: readonly [];
			readonly unresolvedSelections: readonly BoundReferenceSelection[];
			readonly completedAssignmentIds: readonly string[];
	  }
	| {
			readonly status: "complete";
			readonly pendingAssignments: readonly [];
			readonly unresolvedSelections: readonly [];
			readonly completedAssignmentIds: readonly string[];
	  }
	| {
			readonly status: "invalid";
			readonly code:
				| "assignment-mismatch"
				| "duplicate-assignment"
				| "selection-mismatch"
				| "duplicate-selection"
				| "context-mismatch"
				| "duplicate-context"
				| "inconsistent-context";
			readonly message: string;
	  };

type InvalidProgress = Extract<
	SdkCapabilityContextProgress,
	{ readonly status: "invalid" }
>;

type Indexed<T> =
	| { readonly ok: true; readonly value: ReadonlyMap<string, T> }
	| { readonly ok: false; readonly error: InvalidProgress };

function invalid(
	code: InvalidProgress["code"],
	message: string,
): InvalidProgress {
	return { status: "invalid", code, message };
}

function indexAssignments(
	input: SdkCapabilityContextProgressInput,
): Indexed<CapabilityAssignment> {
	const assignments = new Map<string, CapabilityAssignment>();
	for (const assignment of input.assignments) {
		if (
			assignment.workCaseId !== input.workCaseId ||
			assignment.judgmentId !== input.judgmentId ||
			assignment.contributionNeedId !== input.contributionNeedId
		) {
			return {
				ok: false,
				error: invalid(
					"assignment-mismatch",
					`Assignment ${assignment.assignmentId} does not belong to the requested Work Case, Judgment, and Contribution Need.`,
				),
			};
		}
		if (assignments.has(assignment.assignmentId)) {
			return {
				ok: false,
				error: invalid(
					"duplicate-assignment",
					`Assignment ${assignment.assignmentId} occurs more than once.`,
				),
			};
		}
		assignments.set(assignment.assignmentId, assignment);
	}
	return { ok: true, value: assignments };
}

function indexSelections(
	selections: readonly BoundReferenceSelection[],
	assignments: ReadonlyMap<string, CapabilityAssignment>,
): Indexed<BoundReferenceSelection> {
	const indexed = new Map<string, BoundReferenceSelection>();
	for (const selection of selections) {
		const assignment = assignments.get(selection.assignmentId);
		if (
			assignment === undefined ||
			selection.capabilityRevisionId !== assignment.capabilityRevisionId
		) {
			return {
				ok: false,
				error: invalid(
					"selection-mismatch",
					`Reference Selection ${selection.selectionId} has no exact current Assignment.`,
				),
			};
		}
		if (indexed.has(selection.assignmentId)) {
			return {
				ok: false,
				error: invalid(
					"duplicate-selection",
					`Assignment ${selection.assignmentId} has more than one Reference Selection.`,
				),
			};
		}
		indexed.set(selection.assignmentId, selection);
	}
	return { ok: true, value: indexed };
}

function matchingContext(
	input: SdkCapabilityContextProgressInput,
	context: SkillContributionContext,
	assignment: CapabilityAssignment | undefined,
): boolean {
	return (
		assignment !== undefined &&
		context.workCaseId === input.workCaseId &&
		context.judgmentId === input.judgmentId &&
		context.contributionNeedId === input.contributionNeedId &&
		context.capabilityRevisionId === assignment.capabilityRevisionId
	);
}

function matchingContextMode(
	context: SkillContributionContext,
	selection: BoundReferenceSelection | undefined,
): boolean {
	if ("routing" in context) return selection === undefined;
	return (
		selection !== undefined &&
		selection.status === "ready" &&
		selection.selectionId === context.selectionId
	);
}

function indexContexts(
	input: SdkCapabilityContextProgressInput,
	assignments: ReadonlyMap<string, CapabilityAssignment>,
	selections: ReadonlyMap<string, BoundReferenceSelection>,
): Indexed<SkillContributionContext> {
	const indexed = new Map<string, SkillContributionContext>();
	for (const context of input.contexts) {
		if (
			!matchingContext(input, context, assignments.get(context.assignmentId))
		) {
			return {
				ok: false,
				error: invalid(
					"context-mismatch",
					`Sealed Context ${context.sealedContextId} has no exact current Assignment.`,
				),
			};
		}
		if (indexed.has(context.assignmentId)) {
			return {
				ok: false,
				error: invalid(
					"duplicate-context",
					`Assignment ${context.assignmentId} has more than one sealed Context.`,
				),
			};
		}
		if (!matchingContextMode(context, selections.get(context.assignmentId))) {
			return {
				ok: false,
				error: invalid(
					"inconsistent-context",
					`Sealed Context ${context.sealedContextId} does not match its routing mode and Reference Selection.`,
				),
			};
		}
		indexed.set(context.assignmentId, context);
	}
	return { ok: true, value: indexed };
}

function validateSelections(
	selections: readonly BoundReferenceSelection[],
	contexts: ReadonlyMap<string, SkillContributionContext>,
): InvalidProgress | undefined {
	for (const selection of selections) {
		const hasContext = contexts.has(selection.assignmentId);
		if (selection.status === "ready" && !hasContext) {
			return invalid(
				"inconsistent-context",
				`Ready Reference Selection ${selection.selectionId} has no sealed Context.`,
			);
		}
		if (selection.status === "needs-context" && hasContext) {
			return invalid(
				"inconsistent-context",
				`Unresolved Reference Selection ${selection.selectionId} cannot have a sealed Context.`,
			);
		}
	}
	return undefined;
}

/**
 * Derives resumable Context work only from canonical Assignment, Selection, and
 * sealed Context records. It creates no parallel checkpoint or durable owner.
 */
export function inspectCapabilityContextProgress(
	input: SdkCapabilityContextProgressInput,
): SdkCapabilityContextProgress {
	const assignments = indexAssignments(input);
	if (!assignments.ok) return assignments.error;
	const selections = indexSelections(input.selections, assignments.value);
	if (!selections.ok) return selections.error;
	const contexts = indexContexts(input, assignments.value, selections.value);
	if (!contexts.ok) return contexts.error;
	const inconsistency = validateSelections(input.selections, contexts.value);
	if (inconsistency !== undefined) return inconsistency;

	const completedAssignmentIds = Object.freeze(
		[...contexts.value.keys()].sort((left, right) => left.localeCompare(right)),
	);
	const unresolvedSelections = Object.freeze(
		input.selections
			.filter((selection) => selection.status === "needs-context")
			.sort((left, right) =>
				left.assignmentId.localeCompare(right.assignmentId),
			),
	);
	const unresolvedAssignmentIds = new Set(
		unresolvedSelections.map((selection) => selection.assignmentId),
	);
	const pendingAssignments = Object.freeze(
		input.assignments
			.filter(
				(assignment) =>
					!contexts.value.has(assignment.assignmentId) &&
					!unresolvedAssignmentIds.has(assignment.assignmentId),
			)
			.sort((left, right) =>
				left.assignmentId.localeCompare(right.assignmentId),
			),
	);

	if (pendingAssignments.length > 0) {
		return {
			status: "pending",
			pendingAssignments,
			unresolvedSelections,
			completedAssignmentIds,
		};
	}
	if (unresolvedSelections.length > 0) {
		return {
			status: "needs-context",
			pendingAssignments: Object.freeze([]),
			unresolvedSelections,
			completedAssignmentIds,
		};
	}
	return {
		status: "complete",
		pendingAssignments: Object.freeze([]),
		unresolvedSelections: Object.freeze([]),
		completedAssignmentIds,
	};
}
