import assert from "node:assert/strict";
import test from "node:test";
import type { NeedCoverage } from "../src/action-loop/need-coverage/assess-need-coverage.ts";
import {
	closeJudgment,
	type JudgmentClosureContract,
	type JudgmentClosureProposal,
} from "../src/action-loop/judgment/close-judgment.ts";

const contract: JudgmentClosureContract = Object.freeze({
	workCaseId: "work-1",
	judgmentId: "judgment-1",
	category: "Claim Assurance",
	subject: "The package satisfies the declared integration contract.",
	contextRevisionId: "context-1",
	requirements: Object.freeze([
		Object.freeze({
			requirementId: "requirement-behavior",
			statement: "Accepted integration behavior is directly observed.",
			contributionNeedIds: Object.freeze(["need-behavior"]),
		}),
		Object.freeze({
			requirementId: "requirement-risk",
			statement: "Material pass-but-wrong risk is dispositioned.",
			contributionNeedIds: Object.freeze(["need-risk"]),
		}),
	]),
});

function coverage(
	contributionNeedId: string,
	status: NeedCoverage["status"] = "covered",
	overrides: Partial<NeedCoverage> = {},
): NeedCoverage {
	return Object.freeze({
		coverageId: `coverage_${contributionNeedId}`,
		workCaseId: contract.workCaseId,
		judgmentId: contract.judgmentId,
		contributionNeedId,
		status,
		dispositions: Object.freeze([]),
		conflicts: Object.freeze([]),
		basis: Object.freeze([`Coverage basis for ${contributionNeedId}.`]),
		provenance: Object.freeze({ kind: "model", source: "coverage-adapter:a" }),
		...overrides,
	});
}

const behaviorCoverage = coverage("need-behavior");
const riskCoverage = coverage("need-risk");

function proposal(
	overrides: Partial<JudgmentClosureProposal> = {},
): JudgmentClosureProposal {
	return {
		workCaseId: contract.workCaseId,
		judgmentId: contract.judgmentId,
		category: contract.category,
		contextRevisionId: contract.contextRevisionId,
		outcome: "conclude",
		answer:
			"The package claim is adequately assured for the declared integration boundary.",
		refusalReasons: [],
		requirementDispositions: [
			{
				requirementId: "requirement-risk",
				status: "satisfied",
				coverageIds: [riskCoverage.coverageId],
				basis: ["Pass-but-wrong risk has current covered evidence."],
			},
			{
				requirementId: "requirement-behavior",
				status: "satisfied",
				coverageIds: [behaviorCoverage.coverageId],
				basis: ["Accepted integration behavior has current covered evidence."],
			},
		],
		basis: ["Every Closure Requirement has current covered support."],
		provenance: { kind: "model", source: "closure-adapter:a" },
		...overrides,
	};
}

test("covered Needs and satisfied requirements produce one bounded Conclusion", () => {
	const result = closeJudgment(
		contract,
		[behaviorCoverage, riskCoverage],
		proposal(),
	);

	assert.equal(result.status, "concluded");
	if (result.status !== "concluded") return;
	assert.match(result.value.conclusionId, /^conclusion_[a-f0-9]{64}$/);
	assert.equal(result.value.category, "Claim Assurance");
	assert.deepEqual(
		result.value.requirementDispositions.map(
			({ requirementId }) => requirementId,
		),
		["requirement-behavior", "requirement-risk"],
	);
	assert.deepEqual(result.value.coverageIds, [
		behaviorCoverage.coverageId,
		riskCoverage.coverageId,
	]);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.requirementDispositions), true);
	assert.equal("permission" in result.value, false);
	assert.equal("actionClearance" in result.value, false);
});

test("input order and evaluator provenance do not alter Conclusion identity", () => {
	const first = closeJudgment(
		contract,
		[behaviorCoverage, riskCoverage],
		proposal(),
	);
	const second = closeJudgment(
		contract,
		[riskCoverage, behaviorCoverage],
		proposal({
			requirementDispositions: [
				...proposal().requirementDispositions,
			].reverse(),
			provenance: { kind: "human", source: "reviewer:closure" },
		}),
	);

	assert.equal(first.status, "concluded");
	assert.equal(second.status, "concluded");
	if (first.status !== "concluded" || second.status !== "concluded") return;
	assert.equal(second.value.conclusionId, first.value.conclusionId);
	assert.notDeepEqual(second.value.provenance, first.value.provenance);
});

test("partial Coverage turns an attempted Conclusion into explicit refusal", () => {
	const partialRisk = coverage("need-risk", "partially-covered");
	const result = closeJudgment(
		contract,
		[behaviorCoverage, partialRisk],
		proposal(),
	);

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.match(result.value.refusalId, /^refusal_[a-f0-9]{64}$/);
	assert.deepEqual(
		result.value.blockers.map(({ code }) => code),
		["coverage-not-covered"],
	);
	const blocker = result.value.blockers[0];
	if (blocker?.code === "coverage-not-covered") {
		assert.equal(blocker.coverageStatus, "partially-covered");
	}
});

test("conflicted and missing Coverage cannot close the Judgment", () => {
	for (const status of ["conflicted", "missing"] as const) {
		const result = closeJudgment(
			contract,
			[behaviorCoverage, coverage("need-risk", status)],
			proposal(),
		);
		assert.equal(result.status, "refused");
		if (result.status === "refused") {
			const blocker = result.value.blockers[0];
			assert.equal(blocker?.code, "coverage-not-covered");
			if (blocker?.code === "coverage-not-covered") {
				assert.equal(blocker.coverageStatus, status);
			}
		}
	}
});

test("missing required Coverage is preserved as a refusal blocker", () => {
	const dispositions = proposal().requirementDispositions.map((disposition) =>
		disposition.requirementId === "requirement-risk"
			? { ...disposition, coverageIds: [] }
			: disposition,
	);
	const result = closeJudgment(
		contract,
		[behaviorCoverage],
		proposal({ requirementDispositions: dispositions }),
	);

	assert.equal(result.status, "refused");
	if (result.status === "refused") {
		assert.deepEqual(result.value.blockers, [
			{
				code: "coverage-missing",
				requirementId: "requirement-risk",
				contributionNeedId: "need-risk",
			},
		]);
	}
});

test("unsatisfied or context-dependent Requirement refuses closure", () => {
	for (const status of ["not-satisfied", "needs-context"] as const) {
		const dispositions = proposal().requirementDispositions.map(
			(disposition) =>
				disposition.requirementId === "requirement-risk"
					? {
							...disposition,
							status,
							basis: ["The Requirement is not currently settled."],
						}
					: disposition,
		);
		const result = closeJudgment(
			contract,
			[behaviorCoverage, riskCoverage],
			proposal({ requirementDispositions: dispositions }),
		);

		assert.equal(result.status, "refused");
		if (result.status === "refused") {
			const blocker = result.value.blockers[0];
			assert.equal(blocker?.code, "requirement-unmet");
			if (blocker?.code === "requirement-unmet") {
				assert.equal(blocker.requirementStatus, status);
			}
		}
	}
});

test("evaluator may explicitly refuse even when structural closure is possible", () => {
	const result = closeJudgment(
		contract,
		[behaviorCoverage, riskCoverage],
		proposal({
			outcome: "refuse",
			answer: undefined,
			refusalReasons: ["The available basis is semantically inconclusive."],
		}),
	);

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.deepEqual(result.value.blockers, [
		{
			code: "evaluator-refused",
			reason: "The available basis is semantically inconclusive.",
		},
	]);
});

test("every Closure Requirement requires exactly one disposition", () => {
	const all = proposal().requirementDispositions;
	const candidates: JudgmentClosureProposal[] = [
		proposal({ requirementDispositions: all.slice(0, 1) }),
		proposal({ requirementDispositions: [all[0]!, all[0]!, all[1]!] }),
		proposal({
			requirementDispositions: [
				...all,
				{
					requirementId: "requirement-unknown",
					status: "satisfied",
					coverageIds: [],
					basis: ["Unknown requirement must not enter closure."],
				},
			],
		}),
	];

	for (const candidate of candidates) {
		const result = closeJudgment(
			contract,
			[behaviorCoverage, riskCoverage],
			candidate,
		);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, "requirement-accounting");
		}
	}
});

test("Coverage citations must be current, complete, and requirement-bounded", () => {
	const wrongCitation = proposal({
		requirementDispositions: proposal().requirementDispositions.map(
			(disposition) =>
				disposition.requirementId === "requirement-behavior"
					? { ...disposition, coverageIds: [riskCoverage.coverageId] }
					: disposition,
		),
	});
	const extraCoverage = coverage("need-unmapped");

	const wrong = closeJudgment(
		contract,
		[behaviorCoverage, riskCoverage],
		wrongCitation,
	);
	const unmapped = closeJudgment(
		contract,
		[behaviorCoverage, riskCoverage, extraCoverage],
		proposal(),
	);

	assert.equal(wrong.status, "invalid");
	assert.equal(unmapped.status, "invalid");
	if (wrong.status === "invalid") {
		assert.equal(wrong.error.code, "coverage-citation");
	}
	if (unmapped.status === "invalid") {
		assert.equal(unmapped.error.code, "unmapped-coverage");
	}
});

test("cross-Judgment or duplicate current Coverage is rejected", () => {
	const crossJudgment = coverage("need-risk", "covered", {
		judgmentId: "judgment-other",
	});
	const cross = closeJudgment(
		contract,
		[behaviorCoverage, crossJudgment],
		proposal(),
	);
	const duplicate = closeJudgment(
		contract,
		[behaviorCoverage, riskCoverage, riskCoverage],
		proposal(),
	);

	assert.equal(cross.status, "invalid");
	assert.equal(duplicate.status, "invalid");
	if (cross.status === "invalid") {
		assert.equal(cross.error.code, "identity-mismatch");
	}
	if (duplicate.status === "invalid") {
		assert.equal(duplicate.error.code, "duplicate-coverage");
	}
});

test("malformed contract or proposal cannot imply closure", () => {
	const invalidContract = {
		...contract,
		category: "Verification" as "Claim Assurance",
	};
	const candidates: Array<{
		contract: JudgmentClosureContract;
		proposal: JudgmentClosureProposal;
	}> = [
		{ contract: invalidContract, proposal: proposal() },
		{ contract, proposal: proposal({ answer: " " }) },
		{ contract, proposal: proposal({ basis: [] }) },
		{
			contract,
			proposal: proposal({
				outcome: "refuse",
				answer: undefined,
				refusalReasons: [],
			}),
		},
		{
			contract,
			proposal: proposal({ provenance: { kind: "model", source: " " } }),
		},
	];

	for (const candidate of candidates) {
		const result = closeJudgment(
			candidate.contract,
			[behaviorCoverage, riskCoverage],
			candidate.proposal,
		);
		assert.equal(result.status, "invalid");
	}
});
