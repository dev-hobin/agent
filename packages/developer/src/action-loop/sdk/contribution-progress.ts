import type {
	SkillContribution,
	SkillContributionContext,
} from "../contribution/accept-skill-contribution.ts";

export interface SdkContributionProgressInput {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contexts: readonly SkillContributionContext[];
	readonly contributions: readonly SkillContribution[];
}

export type SdkContributionProgress =
	| {
			readonly status: "pending";
			readonly pendingContexts: readonly SkillContributionContext[];
			readonly completedContributionIds: readonly string[];
	  }
	| {
			readonly status: "complete";
			readonly pendingContexts: readonly [];
			readonly completedContributionIds: readonly string[];
	  }
	| {
			readonly status: "invalid";
			readonly code:
				| "context-mismatch"
				| "duplicate-context"
				| "contribution-mismatch"
				| "duplicate-contribution";
			readonly message: string;
	  };

function invalid(
	code: Extract<SdkContributionProgress, { status: "invalid" }>["code"],
	message: string,
): SdkContributionProgress {
	return { status: "invalid", code, message };
}

/** Derives the next local Contribution only from canonical sealed Contexts. */
export function inspectContributionProgress(
	input: SdkContributionProgressInput,
): SdkContributionProgress {
	const contextsByAssignment = new Map<string, SkillContributionContext>();
	for (const context of input.contexts) {
		if (
			context.workCaseId !== input.workCaseId ||
			context.judgmentId !== input.judgmentId
		) {
			return invalid(
				"context-mismatch",
				`Sealed Context ${context.sealedContextId} does not belong to the current Work Case and Judgment.`,
			);
		}
		if (contextsByAssignment.has(context.assignmentId)) {
			return invalid(
				"duplicate-context",
				`Assignment ${context.assignmentId} has more than one sealed Context.`,
			);
		}
		contextsByAssignment.set(context.assignmentId, context);
	}

	const contributionsByAssignment = new Map<string, SkillContribution>();
	for (const contribution of input.contributions) {
		const context = contextsByAssignment.get(contribution.assignmentId);
		if (
			context === undefined ||
			contribution.workCaseId !== input.workCaseId ||
			contribution.judgmentId !== input.judgmentId ||
			contribution.contributionNeedId !== context.contributionNeedId ||
			contribution.capabilityRevisionId !== context.capabilityRevisionId ||
			contribution.sealedContextId !== context.sealedContextId
		) {
			return invalid(
				"contribution-mismatch",
				`Contribution ${contribution.contributionId} has no exact current sealed Context.`,
			);
		}
		if (contributionsByAssignment.has(contribution.assignmentId)) {
			return invalid(
				"duplicate-contribution",
				`Assignment ${contribution.assignmentId} has more than one Contribution.`,
			);
		}
		contributionsByAssignment.set(contribution.assignmentId, contribution);
	}

	const completedContributionIds = Object.freeze(
		[...contributionsByAssignment.values()]
			.map((contribution) => contribution.contributionId)
			.sort((left, right) => left.localeCompare(right)),
	);
	const pendingContexts = Object.freeze(
		input.contexts
			.filter(
				(context) => !contributionsByAssignment.has(context.assignmentId),
			)
			.sort((left, right) => left.assignmentId.localeCompare(right.assignmentId)),
	);
	if (pendingContexts.length > 0) {
		return { status: "pending", pendingContexts, completedContributionIds };
	}
	return {
		status: "complete",
		pendingContexts: Object.freeze([]),
		completedContributionIds,
	};
}
