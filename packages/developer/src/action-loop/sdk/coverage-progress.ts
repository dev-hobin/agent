import type { ContributionNeed } from "../judgment/open-judgment.ts";
import type { NeedCoverage } from "../need-coverage/assess-need-coverage.ts";

export interface SdkCoverageProgressInput {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeeds: readonly ContributionNeed[];
	readonly coverages: readonly NeedCoverage[];
}

export type SdkCoverageProgress =
	| {
			readonly status: "pending";
			readonly pendingNeeds: readonly ContributionNeed[];
			readonly completedCoverageIds: readonly string[];
	  }
	| {
			readonly status: "complete";
			readonly pendingNeeds: readonly [];
			readonly completedCoverageIds: readonly string[];
	  }
	| {
			readonly status: "invalid";
			readonly code:
				| "duplicate-need"
				| "coverage-mismatch"
				| "duplicate-coverage";
			readonly message: string;
	  };

function invalid(
	code: Extract<SdkCoverageProgress, { status: "invalid" }>["code"],
	message: string,
): SdkCoverageProgress {
	return { status: "invalid", code, message };
}

/** Derives the next cross-Contribution Coverage assessment from current Need Coverage. */
export function inspectCoverageProgress(
	input: SdkCoverageProgressInput,
): SdkCoverageProgress {
	const needsById = new Map<string, ContributionNeed>();
	for (const need of input.contributionNeeds) {
		if (needsById.has(need.contributionNeedId)) {
			return invalid(
				"duplicate-need",
				`Contribution Need ${need.contributionNeedId} occurs more than once.`,
			);
		}
		needsById.set(need.contributionNeedId, need);
	}

	const coveragesByNeed = new Map<string, NeedCoverage>();
	for (const coverage of input.coverages) {
		if (
			coverage.workCaseId !== input.workCaseId ||
			coverage.judgmentId !== input.judgmentId ||
			!needsById.has(coverage.contributionNeedId)
		) {
			return invalid(
				"coverage-mismatch",
				`Need Coverage ${coverage.coverageId} has no exact current Contribution Need.`,
			);
		}
		if (coveragesByNeed.has(coverage.contributionNeedId)) {
			return invalid(
				"duplicate-coverage",
				`Contribution Need ${coverage.contributionNeedId} has more than one current Coverage assessment.`,
			);
		}
		coveragesByNeed.set(coverage.contributionNeedId, coverage);
	}

	const completedCoverageIds = Object.freeze(
		input.coverages
			.map((coverage) => coverage.coverageId)
			.sort((left, right) => left.localeCompare(right)),
	);
	const pendingNeeds = Object.freeze(
		input.contributionNeeds
			.filter((need) => !coveragesByNeed.has(need.contributionNeedId))
			.sort((left, right) =>
				left.contributionNeedId.localeCompare(right.contributionNeedId),
			),
	);
	if (pendingNeeds.length > 0) {
		return { status: "pending", pendingNeeds, completedCoverageIds };
	}
	return {
		status: "complete",
		pendingNeeds: Object.freeze([]),
		completedCoverageIds,
	};
}
