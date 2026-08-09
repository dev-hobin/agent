import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptClosureClaim,
	type ClosureClaimProposal,
} from "../src/action-loop/work/accept-closure-claim.ts";
import { completeWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import { prepareClosureTarget } from "../src/action-loop/work/prepare-closure-target.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";

function target() {
	const opened = openWorkCase({
		outcome: {
			statement:
				"The existing implementation already satisfies the delegation.",
			acceptanceConditions: ["The delegated behavior is present."],
			constraints: ["No unrelated artifact changes."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const intervention: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-no-action",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-no-action",
		category: "Proportionate Intervention",
		subject: "The existing implementation requires no Action.",
		contextRevisionId: "context-no-action",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current verification supports no change."]),
		answer: "The Outcome is already satisfied without an Action.",
		interventionDisposition: "no-action",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
	const recordedIntervention = recordWorkCaseConclusion(
		opened.value,
		intervention,
	);
	if (recordedIntervention.status !== "recorded") {
		throw new Error(recordedIntervention.status);
	}
	const conclusion: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-claim-assurance",
		workCaseId: opened.value.workCaseId,
		judgmentId: "judgment-claim-assurance",
		category: "Claim Assurance",
		subject: "The no-change completion claim is supported.",
		contextRevisionId: "context-claim-assurance",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current verification supports the bounded claim."]),
		answer: "The Outcome is already satisfied without an Action.",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
	const recorded = recordWorkCaseConclusion(
		recordedIntervention.value,
		conclusion,
	);
	if (recorded.status !== "recorded") throw new Error(recorded.status);
	const prepared = prepareClosureTarget(recorded.value);
	if (prepared.status !== "ready") throw new Error(prepared.status);
	return { workCase: recorded.value, target: prepared.value };
}

function proposal(
	overrides: Partial<ClosureClaimProposal> = {},
): ClosureClaimProposal {
	const fixture = target();
	return {
		workCaseId: fixture.target.workCaseId,
		closureTargetId: fixture.target.closureTargetId,
		mode: "no-change",
		obligationDispositions: fixture.target.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: fixture.target.conclusionIds,
			effectAssessmentIds: fixture.target.effectAssessmentIds,
			effectRemediationIds: fixture.target.effectRemediationIds,
			basis: [`Evidence satisfies: ${obligation.statement}`],
		})),
		basis: ["Every current Closure obligation and evidence item is accounted."],
		provenance: { kind: "model", source: "adapter-a" },
		...overrides,
	};
}

test("complete target accounting creates one immutable Closure Claim", () => {
	const fixture = target();
	const accepted = acceptClosureClaim(
		fixture.target,
		proposal({
			workCaseId: fixture.target.workCaseId,
			closureTargetId: fixture.target.closureTargetId,
			obligationDispositions: fixture.target.obligations.map((obligation) => ({
				closureObligationId: obligation.closureObligationId,
				conclusionIds: fixture.target.conclusionIds,
				effectAssessmentIds: [],
			effectRemediationIds: [],
				basis: [`Evidence satisfies: ${obligation.statement}`],
			})),
		}),
	);

	assert.equal(accepted.status, "accepted");
	if (accepted.status !== "accepted") return;
	assert.match(accepted.value.closureClaimId, /^closure_claim_[a-f0-9]{64}$/);
	assert.equal(accepted.value.workCaseRevisionId, fixture.workCase.revisionId);
	assert.equal(accepted.value.mode, "no-change");
	assert.equal("status" in accepted.value, false);
	assert.equal(Object.isFrozen(accepted.value), true);
	const completed = completeWorkCase(
		fixture.workCase,
		fixture.target,
		accepted.value,
	);
	assert.equal(completed.status, "completed");
	if (completed.status === "completed") {
		assert.equal(completed.value.status, "complete");
		assert.equal(completed.value.priorRevisionId, fixture.workCase.revisionId);
		assert.notEqual(completed.value.revisionId, fixture.workCase.revisionId);
		assert.equal(completed.value.closureClaim, accepted.value);
		assert.equal(fixture.workCase.status, "active");
	}
});

test("proposal order and evaluator provenance do not change Claim identity", () => {
	const fixture = target();
	const base = proposal({
		workCaseId: fixture.target.workCaseId,
		closureTargetId: fixture.target.closureTargetId,
		obligationDispositions: fixture.target.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: fixture.target.conclusionIds,
			effectAssessmentIds: [],
			effectRemediationIds: [],
			basis: [`Evidence satisfies: ${obligation.statement}`],
		})),
	});
	const first = acceptClosureClaim(fixture.target, base);
	const reordered = acceptClosureClaim(fixture.target, {
		...base,
		obligationDispositions: [...base.obligationDispositions].reverse(),
		provenance: { kind: "human", source: "reviewer" },
	});

	assert.equal(first.status, "accepted");
	assert.equal(reordered.status, "accepted");
	if (first.status === "accepted" && reordered.status === "accepted") {
		assert.equal(reordered.value.closureClaimId, first.value.closureClaimId);
		assert.notDeepEqual(reordered.value.provenance, first.value.provenance);
	}
});

test("omitted, duplicate, or evidence-free obligations are rejected", () => {
	const fixture = target();
	const base = proposal({
		workCaseId: fixture.target.workCaseId,
		closureTargetId: fixture.target.closureTargetId,
		obligationDispositions: fixture.target.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: fixture.target.conclusionIds,
			effectAssessmentIds: [],
			effectRemediationIds: [],
			basis: [
				"The current Claim Assurance Conclusion supports this obligation.",
			],
		})),
	});
	const first = base.obligationDispositions[0];
	if (first === undefined) throw new Error("Expected closure obligation");
	const fixtures: Array<{ value: ClosureClaimProposal; code: string }> = [
		{
			value: {
				...base,
				obligationDispositions: base.obligationDispositions.slice(1),
			},
			code: "obligation-accounting",
		},
		{
			value: { ...base, obligationDispositions: [first, first] },
			code: "obligation-accounting",
		},
		{
			value: {
				...base,
				obligationDispositions: [
					{
						...first,
						conclusionIds: [],
						effectAssessmentIds: [],
						effectRemediationIds: [],
					},
					...base.obligationDispositions.slice(1),
				],
			},
			code: "evidence-required",
		},
	];

	for (const fixtureCase of fixtures) {
		const result = acceptClosureClaim(fixture.target, fixtureCase.value);
		assert.equal(result.status, "invalid", fixtureCase.code);
		if (result.status === "invalid") {
			assert.equal(result.error.code, fixtureCase.code);
		}
	}
});

test("a new Work Case fact makes an accepted Closure Claim stale", () => {
	const fixture = target();
	const claimProposal = proposal({
		workCaseId: fixture.target.workCaseId,
		closureTargetId: fixture.target.closureTargetId,
		obligationDispositions: fixture.target.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: fixture.target.conclusionIds,
			effectAssessmentIds: [],
			effectRemediationIds: [],
			basis: [
				"The current Claim Assurance Conclusion supports this obligation.",
			],
		})),
	});
	const accepted = acceptClosureClaim(fixture.target, claimProposal);
	if (accepted.status !== "accepted") return;
	const laterConclusion: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-later",
		workCaseId: fixture.workCase.workCaseId,
		judgmentId: "judgment-later",
		category: "Claim Assurance",
		subject: "A later material fact changes the closure inventory.",
		contextRevisionId: "context-later",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Later evidence requires a fresh Closure Target."]),
		answer: "Reassess closure against the later evidence.",
		provenance: Object.freeze({ kind: "model", source: "later-evaluator" }),
	});
	const advanced = recordWorkCaseConclusion(fixture.workCase, laterConclusion);
	if (advanced.status !== "recorded") return;
	const completion = completeWorkCase(
		advanced.value,
		fixture.target,
		accepted.value,
	);

	assert.equal(completion.status, "refused");
	if (completion.status === "refused") {
		assert.equal(completion.refusal.code, "stale-closure-target");
	}
});

test("cross-target and undeclared evidence cannot create a Claim", () => {
	const fixture = target();
	const base = proposal({
		workCaseId: fixture.target.workCaseId,
		closureTargetId: fixture.target.closureTargetId,
		obligationDispositions: fixture.target.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: fixture.target.conclusionIds,
			effectAssessmentIds: [],
			effectRemediationIds: [],
			basis: [
				"The current Claim Assurance Conclusion supports this obligation.",
			],
		})),
	});
	const crossTarget = acceptClosureClaim(fixture.target, {
		...base,
		closureTargetId: "closure_target_other",
	});
	const undeclared = acceptClosureClaim(fixture.target, {
		...base,
		obligationDispositions: base.obligationDispositions.map(
			(disposition, index) =>
				index === 0
					? { ...disposition, conclusionIds: ["conclusion-other"] }
					: disposition,
		),
	});

	assert.equal(crossTarget.status, "invalid");
	assert.equal(undeclared.status, "invalid");
	if (crossTarget.status === "invalid") {
		assert.equal(crossTarget.error.code, "identity-mismatch");
	}
	if (undeclared.status === "invalid") {
		assert.equal(undeclared.error.code, "undeclared-evidence");
	}
});
