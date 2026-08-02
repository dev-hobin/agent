import type {
	ContextCoverage,
	ContextContribution,
	ContextualJudgment,
	EmergentQuestion,
	NeedsEvidence,
	ContextSelection,
	SealedContext,
} from "@hobin/judgment";

import {
	developerContextBasisSha256,
	parseDeveloperContextBasis,
	type ContributionBasis,
	type DeveloperContextBasis,
} from "./protocol.ts";

function contributionBasis(value: ContextContribution): ContributionBasis {
	const common = {
		contributionId: value.contributionId,
		materialId: value.materialId,
		useAs: value.useAs,
		assurance: value.assurance,
	};
	if (value.assurance === "domain-verified") {
		return Object.freeze({
			...common,
			assurance: value.assurance,
			evaluator: value.evaluator,
		});
	}
	if (value.assurance === "user-accepted") {
		return Object.freeze({
			...common,
			assurance: value.assurance,
			userEventId: value.userEventId,
		});
	}
	return Object.freeze({ ...common, assurance: value.assurance });
}

export function contextBasisFromJudgment(input: {
	readonly selection: ContextSelection;
	readonly sealedContext: SealedContext;
	readonly coverage: ContextCoverage;
	readonly outcome: ContextualJudgment | NeedsEvidence | EmergentQuestion;
}): DeveloperContextBasis {
	if (
		input.selection.selectionSha256 !== input.sealedContext.selectionSha256 ||
		input.selection.selectionSha256 !== input.outcome.selectionSha256 ||
		input.sealedContext.sealedContextSha256 !==
			input.coverage.sealedContextSha256 ||
		input.sealedContext.sealedContextSha256 !==
			input.outcome.sealedContextSha256 ||
		input.coverage.coverageSha256 !== input.outcome.coverageSha256 ||
		input.selection.questionSha256 !== input.sealedContext.questionSha256 ||
		input.selection.questionSha256 !== input.coverage.questionSha256 ||
		input.selection.questionSha256 !== input.outcome.questionSha256
	) {
		throw new Error(
			"Developer context basis inputs do not belong to one Judgment lifecycle.",
		);
	}
	const members = input.sealedContext.members.map((member) => ({
		materialId: member.materialId,
		memberId: member.memberId,
		contentSha256: member.contentSha256,
	}));
	const contributions = input.coverage.contributions.map(contributionBasis);
	const basis = {
		judgmentId: input.selection.judgmentId,
		...(input.selection.policySha256
			? { policySha256: input.selection.policySha256 }
			: {}),
		questionSha256: input.selection.questionSha256,
		selectionSha256: input.selection.selectionSha256,
		sealedContextSha256: input.sealedContext.sealedContextSha256,
		coverageSha256: input.coverage.coverageSha256,
		outcomeSha256: input.outcome.outcomeSha256,
		members,
		contributions,
		conflictIds: input.coverage.conflicts.map(
			(conflict) => conflict.conflictId,
		),
		limitationIds: input.coverage.limitations.map(
			(limitation) => limitation.limitationId,
		),
	};
	return parseDeveloperContextBasis({
		...basis,
		contextBasisSha256: developerContextBasisSha256(basis),
	});
}
