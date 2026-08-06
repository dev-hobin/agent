import assert from "node:assert/strict";
import test from "node:test";
import type { SkillContribution } from "../src/action-loop/contribution/accept-skill-contribution.ts";
import {
	assessNeedCoverage,
	type NeedCoverageProposal,
	type NeedCoverageTarget,
} from "../src/action-loop/need-coverage/assess-need-coverage.ts";

const target: NeedCoverageTarget = Object.freeze({
	workCaseId: "work-1",
	judgmentId: "judgment-1",
	contributionNeedId: "need-1",
});

function contribution(
	contributionId: string,
	localStatus: SkillContribution["localStatus"] = "resolved",
	overrides: Partial<SkillContribution> = {},
): SkillContribution {
	return Object.freeze({
		contributionId,
		workCaseId: target.workCaseId,
		judgmentId: target.judgmentId,
		contributionNeedId: target.contributionNeedId,
		assignmentId: `assign_${contributionId}`,
		capabilityId: `cap_${contributionId}`,
		capabilityRevisionId: `caprev_${contributionId}`,
		sealedContextId: `sealed_${contributionId}`,
		localStatus,
		result: `Bounded result from ${contributionId}.`,
		referenceApplications: Object.freeze([]),
		limitations: Object.freeze(
			localStatus === "partial" ? ["A material limitation remains."] : [],
		),
		residualNeeds: Object.freeze([]),
		provenance: Object.freeze({ kind: "model", source: "adapter:a" }),
		...overrides,
	});
}

const first = contribution("contribution_a");
const second = contribution("contribution_b");
const partial = contribution("contribution_partial", "partial");

function proposal(
	overrides: Partial<NeedCoverageProposal> = {},
): NeedCoverageProposal {
	return {
		...target,
		status: "covered",
		dispositions: [
			{
				contributionId: second.contributionId,
				status: "supports",
				basis: ["The second result independently supports the required input."],
			},
			{
				contributionId: first.contributionId,
				status: "supports",
				basis: ["The first result directly addresses the current Need."],
			},
		],
		conflicts: [],
		basis: ["Current support is sufficient to evaluate the related requirement."],
		provenance: { kind: "model", source: "coverage-adapter:a" },
		...overrides,
	};
}

test("Upper assessment accepts complete Contribution accounting", () => {
	const result = assessNeedCoverage(target, [first, second], proposal());

	assert.equal(result.status, "accepted");
	if (result.status !== "accepted") return;
	assert.match(result.value.coverageId, /^coverage_[a-f0-9]{64}$/);
	assert.equal(result.value.status, "covered");
	assert.deepEqual(
		result.value.dispositions.map(({ contributionId }) => contributionId),
		[first.contributionId, second.contributionId],
	);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.dispositions), true);
	assert.equal(Object.isFrozen(result.value.dispositions[0]?.basis), true);
	assert.equal("conclusion" in result.value, false);
});

test("proposal order and evaluator provenance do not alter Coverage identity", () => {
	const firstAssessment = assessNeedCoverage(target, [first, second], proposal());
	const secondAssessment = assessNeedCoverage(
		target,
		[second, first],
		proposal({
			dispositions: [...proposal().dispositions].reverse(),
			provenance: { kind: "human", source: "reviewer:coverage" },
		}),
	);

	assert.equal(firstAssessment.status, "accepted");
	assert.equal(secondAssessment.status, "accepted");
	if (
		firstAssessment.status !== "accepted" ||
		secondAssessment.status !== "accepted"
	) {
		return;
	}
	assert.equal(
		secondAssessment.value.coverageId,
		firstAssessment.value.coverageId,
	);
	assert.notDeepEqual(
		secondAssessment.value.provenance,
		firstAssessment.value.provenance,
	);
});

test("Coverage accepts a non-Skill Contribution through the same minimal projection", () => {
	const externalDecision = Object.freeze({
		...target,
		contributionId: "contribution_external_decision",
		localStatus: "resolved" as const,
	});
	const result = assessNeedCoverage(target, [externalDecision], {
		...proposal(),
		dispositions: [
			{
				contributionId: externalDecision.contributionId,
				status: "supports",
				basis: ["The external decision directly supplies the required input."],
			},
		],
		basis: ["A current external decision sufficiently addresses the Need."],
	});

	assert.equal(result.status, "accepted");
	if (result.status === "accepted") {
		assert.equal(result.value.status, "covered");
	}
});

test("limited support derives partially-covered instead of covered", () => {
	const partialProposal = proposal({
		status: "partially-covered",
		dispositions: [
			{
				contributionId: partial.contributionId,
				status: "limited-support",
				basis: ["The result is useful but its stated limitation remains material."],
			},
		],
		basis: ["Useful support exists, but a consequential limitation remains."],
	});
	const accepted = assessNeedCoverage(target, [partial], partialProposal);
	const overstated = assessNeedCoverage(target, [partial], {
		...partialProposal,
		status: "covered",
	});

	assert.equal(accepted.status, "accepted");
	if (accepted.status === "accepted") {
		assert.equal(accepted.value.status, "partially-covered");
	}
	assert.equal(overstated.status, "invalid");
	if (overstated.status === "invalid") {
		assert.equal(overstated.error.code, "status-mismatch");
	}
});

test("explicit material conflict takes precedence over support", () => {
	const conflictedProposal = proposal({
		status: "conflicted",
		conflicts: [
			{
				leftContributionId: second.contributionId,
				rightContributionId: first.contributionId,
				basis: ["The Contributions require incompatible verifier boundaries."],
			},
		],
		basis: ["Current Contributions support incompatible interpretations."],
	});
	const accepted = assessNeedCoverage(
		target,
		[first, second],
		conflictedProposal,
	);
	const hiddenConflict = assessNeedCoverage(target, [first, second], {
		...conflictedProposal,
		status: "covered",
	});

	assert.equal(accepted.status, "accepted");
	if (accepted.status === "accepted") {
		assert.equal(accepted.value.status, "conflicted");
		assert.deepEqual(accepted.value.conflicts[0], {
			leftContributionId: first.contributionId,
			rightContributionId: second.contributionId,
			basis: ["The Contributions require incompatible verifier boundaries."],
		});
	}
	assert.equal(hiddenConflict.status, "invalid");
});

test("zero or wholly not-relied-on Contributions derive missing", () => {
	const empty = assessNeedCoverage(target, [], {
		...proposal(),
		status: "missing",
		dispositions: [],
		basis: ["No current Contribution addresses the Need."],
	});
	const notReliedOn = assessNeedCoverage(target, [first], {
		...proposal(),
		status: "missing",
		dispositions: [
			{
				contributionId: first.contributionId,
				status: "not-relied-on",
				basis: ["The result does not observe the required boundary."],
			},
		],
		basis: ["No usable support remains for the Need."],
	});
	const falseMissing = assessNeedCoverage(target, [first], {
		...proposal(),
		status: "missing",
		dispositions: [
			{
				contributionId: first.contributionId,
				status: "supports",
				basis: ["This result is usable support."],
			},
		],
	});

	assert.equal(empty.status, "accepted");
	assert.equal(notReliedOn.status, "accepted");
	assert.equal(falseMissing.status, "invalid");
});

test("every current Contribution requires exactly one disposition", () => {
	const missing = proposal({ dispositions: proposal().dispositions.slice(0, 1) });
	const duplicate = proposal({
		dispositions: [
			proposal().dispositions[0]!,
			proposal().dispositions[0]!,
			proposal().dispositions[1]!,
		],
	});
	const unknown = proposal({
		dispositions: [
			...proposal().dispositions,
			{
				contributionId: "contribution_unknown",
				status: "supports",
				basis: ["Unknown input must not enter Coverage."],
			},
		],
	});

	for (const candidate of [missing, duplicate, unknown]) {
		const result = assessNeedCoverage(target, [first, second], candidate);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, "contribution-accounting");
		}
	}
});

test("cross-Need or duplicate current Contribution inventory is rejected", () => {
	const crossNeed = contribution("contribution_cross", "resolved", {
		contributionNeedId: "need-other",
	});
	const wrongNeed = assessNeedCoverage(target, [first, crossNeed], proposal());
	const duplicate = assessNeedCoverage(target, [first, first], proposal());

	assert.equal(wrongNeed.status, "invalid");
	assert.equal(duplicate.status, "invalid");
	if (wrongNeed.status === "invalid") {
		assert.equal(wrongNeed.error.code, "identity-mismatch");
	}
	if (duplicate.status === "invalid") {
		assert.equal(duplicate.error.code, "duplicate-contribution");
	}
});

test("partial Skill result cannot silently become full support", () => {
	const result = assessNeedCoverage(target, [partial], {
		...proposal(),
		dispositions: [
			{
				contributionId: partial.contributionId,
				status: "supports",
				basis: ["This incorrectly hides the local limitation."],
			},
		],
	});

	assert.equal(result.status, "invalid");
	if (result.status === "invalid") {
		assert.equal(result.error.code, "partial-as-full-support");
	}
});

test("conflicts must be unique relations between relied-on current Contributions", () => {
	const baseConflict = {
		leftContributionId: first.contributionId,
		rightContributionId: second.contributionId,
		basis: ["A material incompatibility exists."],
	};
	for (const conflicts of [
		[{ ...baseConflict, rightContributionId: first.contributionId }],
		[{ ...baseConflict, rightContributionId: "contribution_unknown" }],
		[baseConflict, { ...baseConflict }],
	]) {
		const result = assessNeedCoverage(target, [first, second], {
			...proposal(),
			status: "conflicted",
			conflicts,
		});
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, "invalid-conflict");
		}
	}
});

test("basis, disposition status, and provenance remain explicit", () => {
	for (const candidate of [
		proposal({ basis: [] }),
		proposal({ basis: ["Same.", " Same. "] }),
		proposal({
			dispositions: proposal().dispositions.map((disposition, index) =>
				index === 0
					? { ...disposition, status: "accepted" as "supports" }
					: disposition,
			),
		}),
		proposal({ provenance: { kind: "model", source: " " } }),
	]) {
		const result = assessNeedCoverage(target, [first, second], candidate);
		assert.equal(result.status, "invalid");
	}
});
