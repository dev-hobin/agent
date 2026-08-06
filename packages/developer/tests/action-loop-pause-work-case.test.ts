import assert from "node:assert/strict";
import test from "node:test";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { acceptClosureClaim } from "../src/action-loop/work/accept-closure-claim.ts";
import { completeWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import { pauseWorkCase } from "../src/action-loop/work/pause-work-case.ts";
import { prepareClosureTarget } from "../src/action-loop/work/prepare-closure-target.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { resumePausedWorkCase } from "../src/action-loop/work/resume-paused-work-case.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";

function workCase() {
	const result = openWorkCase({
		outcome: {
			statement: "The delegated bounded work is completed.",
			acceptanceConditions: ["The result satisfies the delegated request."],
			constraints: [],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

test("explicit human decision pauses exactly one current Work Case revision", () => {
	const current = workCase();
	const result = pauseWorkCase(current, {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		reason: "Pause until the delegating user resumes the work.",
		decision: {
			kind: "human",
			decisionId: "user-message-pause-1",
			source: "delegating-user",
			basis: ["The user explicitly requested a pause."],
		},
	});

	assert.equal(result.status, "paused");
	if (result.status !== "paused") return;
	assert.equal(result.value.status, "paused");
	assert.equal(result.value.priorRevisionId, current.revisionId);
	assert.notEqual(result.value.revisionId, current.revisionId);
	assert.equal(result.value.effects, current.effects);
	assert.match(
		result.value.pause.workCasePauseId,
		/^work_case_pause_[a-f0-9]{64}$/,
	);
	assert.equal(current.status, "active");
});

test("explicit human resume creates a new active continuity revision", () => {
	const current = workCase();
	const paused = pauseWorkCase(current, {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		reason: "Pause until the delegating user resumes the work.",
		decision: {
			kind: "human",
			decisionId: "user-message-pause-1",
			source: "delegating-user",
			basis: ["The user explicitly requested a pause."],
		},
	});
	if (paused.status !== "paused") return;
	const resumed = resumePausedWorkCase(paused.value, {
		workCaseId: current.workCaseId,
		expectedRevisionId: paused.value.revisionId,
		decision: {
			kind: "human",
			decisionId: "user-message-resume-1",
			source: "delegating-user",
			basis: ["The user explicitly requested continuation."],
		},
	});

	assert.equal(resumed.status, "active");
	if (resumed.status !== "active") return;
	assert.notEqual(resumed.value.revisionId, current.revisionId);
	assert.notEqual(resumed.value.revisionId, paused.value.revisionId);
	assert.deepEqual(resumed.value.continuityIds, [
		paused.value.pause.workCasePauseId,
		resumed.value.continuityIds[1],
	]);
	assert.match(
		resumed.value.continuityIds[1] ?? "",
		/^work_case_resume_[a-f0-9]{64}$/,
	);
});

test("pre-pause Closure Claim is stale after resume", () => {
	const current = workCase();
	const assurance: JudgmentConclusion = Object.freeze({
		conclusionId: "conclusion-before-pause",
		workCaseId: current.workCaseId,
		judgmentId: "judgment-before-pause",
		category: "Claim Assurance",
		subject: "The current Outcome claim is assured.",
		contextRevisionId: "context-before-pause",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current bounded evidence supports the Outcome."]),
		answer: "The Outcome is currently supported.",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
	const withAssurance = recordWorkCaseConclusion(current, assurance);
	if (withAssurance.status !== "recorded") return;
	const target = prepareClosureTarget(withAssurance.value);
	if (target.status !== "ready") return;
	const claim = acceptClosureClaim(target.value, {
		workCaseId: withAssurance.value.workCaseId,
		closureTargetId: target.value.closureTargetId,
		mode: "no-change",
		obligationDispositions: target.value.obligations.map((obligation) => ({
			closureObligationId: obligation.closureObligationId,
			conclusionIds: target.value.conclusionIds,
			effectAssessmentIds: [],
			effectRemediationIds: [],
			basis: ["The current Claim Assurance supports this obligation."],
		})),
		basis: ["Every current closure obligation is accounted."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (claim.status !== "accepted") return;
	const paused = pauseWorkCase(withAssurance.value, {
		workCaseId: withAssurance.value.workCaseId,
		expectedRevisionId: withAssurance.value.revisionId,
		reason: "Pause before applying the completion transition.",
		decision: {
			kind: "human",
			decisionId: "user-pause-before-completion",
			source: "delegating-user",
			basis: ["The user explicitly paused completion."],
		},
	});
	if (paused.status !== "paused") return;
	const resumed = resumePausedWorkCase(paused.value, {
		workCaseId: paused.value.workCaseId,
		expectedRevisionId: paused.value.revisionId,
		decision: {
			kind: "human",
			decisionId: "user-resume-before-completion",
			source: "delegating-user",
			basis: ["The user explicitly resumed work."],
		},
	});
	if (resumed.status !== "active") return;
	const completion = completeWorkCase(resumed.value, target.value, claim.value);

	assert.equal(completion.status, "refused");
	if (completion.status === "refused") {
		assert.equal(completion.refusal.code, "stale-closure-target");
	}
});

test("model, stale, cross-Case, or basis-free pause attempts fail closed", () => {
	const current = workCase();
	const base = {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		reason: "Pause current work.",
		decision: {
			kind: "human",
			decisionId: "user-message-pause-1",
			source: "delegating-user",
			basis: ["The user explicitly requested a pause."],
		},
	};
	const fixtures = [
		{
			proposal: {
				...base,
				decision: { ...base.decision, kind: "model" },
			},
			code: "human-decision-required",
		},
		{
			proposal: { ...base, expectedRevisionId: "work_case_revision_stale" },
			code: "identity-mismatch",
		},
		{
			proposal: { ...base, workCaseId: "work_case_other" },
			code: "identity-mismatch",
		},
		{
			proposal: {
				...base,
				decision: { ...base.decision, basis: [] },
			},
			code: "invalid-pause-decision",
		},
	];

	for (const fixture of fixtures) {
		const result = pauseWorkCase(current, fixture.proposal);
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid")
			assert.equal(result.error.code, fixture.code);
	}
});
