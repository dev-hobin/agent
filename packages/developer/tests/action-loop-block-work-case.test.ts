import assert from "node:assert/strict";
import test from "node:test";
import { acceptActionCandidate } from "../src/action-loop/action/accept-action-candidate.ts";
import { acceptActionClearance } from "../src/action-loop/action/action-clearance.ts";
import { beginEffect } from "../src/action-loop/effect/begin-effect.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { blockWorkCase } from "../src/action-loop/work/block-work-case.ts";
import { prepareClosureTarget } from "../src/action-loop/work/prepare-closure-target.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import { resumeBlockedWorkCase } from "../src/action-loop/work/resume-blocked-work-case.ts";
import { openWorkCase, type ActiveWorkCase } from "../src/action-loop/work/work-case.ts";

function conclusion(
	workCaseId: string,
	category: JudgmentConclusion["category"],
	id: string,
): JudgmentConclusion {
	return Object.freeze({
		conclusionId: id,
		workCaseId,
		judgmentId: `judgment-${id}`,
		category,
		subject: "The current bounded state supports this Conclusion.",
		contextRevisionId: `context-${id}`,
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["Current bounded evidence supports the Conclusion."]),
		answer: "There is no current closure path until the blocker changes.",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
}

function recordConclusion(
	workCase: ActiveWorkCase,
	value: JudgmentConclusion,
): ActiveWorkCase {
	const result = recordWorkCaseConclusion(workCase, value);
	if (result.status !== "recorded") throw new Error(result.status);
	return result.value;
}

function workCaseWithUnassessedEffect() {
	const opened = openWorkCase({
		outcome: {
			statement: "The delegated change is completed.",
			acceptanceConditions: ["The target artifact contains the change."],
			constraints: [],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (opened.status !== "opened") throw new Error(opened.error.message);
	const warrant = conclusion(
		opened.value.workCaseId,
		"Proportionate Intervention",
		"conclusion-warrant",
	);
	const assurance = conclusion(
		opened.value.workCaseId,
		"Claim Assurance",
		"conclusion-blocked",
	);
	let current = recordConclusion(opened.value, warrant);
	current = recordConclusion(current, assurance);
	const candidate = acceptActionCandidate({
		workCaseId: current.workCaseId,
		controlledAction: { kind: "pi-tool-call", fingerprint: "a".repeat(64) },
		summary: "Apply the bounded change.",
		intendedEffects: ["The target artifact contains the change."],
		requiredConclusionIds: [warrant.conclusionId],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (candidate.status !== "accepted") throw new Error(candidate.error.message);
	const withCandidate = recordWorkCaseActionCandidate(current, candidate.value);
	if (withCandidate.status !== "recorded") throw new Error(withCandidate.status);
	const clearance = acceptActionClearance(
		candidate.value,
		[warrant],
		{
			actionCandidateId: candidate.value.actionCandidateId,
			status: "granted",
			source: "delegation:current-user-request",
			basis: ["The current delegation permits the bounded Action."],
		},
		{
			workCaseId: current.workCaseId,
			actionCandidateId: candidate.value.actionCandidateId,
			conclusionIds: [warrant.conclusionId],
			warrantBasis: ["The intervention Conclusion is current."],
			provenance: { kind: "model", source: "test-evaluator" },
		},
	);
	if (clearance.status !== "cleared") throw new Error(clearance.status);
	const withClearance = recordWorkCaseActionClearance(
		withCandidate.value,
		clearance.value,
	);
	if (withClearance.status !== "recorded") throw new Error(withClearance.status);
	const effect = beginEffect(clearance.value, {
		occurrenceId: "tool-call-blocked",
		actionClearanceId: clearance.value.actionClearanceId,
		controlledAction: clearance.value.controlledAction,
		source: "pi:tool_call",
	});
	if (effect.status !== "begun") throw new Error(effect.error.message);
	const withEffect = recordWorkCaseEffect(withClearance.value, effect.value);
	if (withEffect.status !== "recorded") throw new Error(withEffect.status);
	return { workCase: withEffect.value, assurance };
}

test("Claim Assurance may block only by accounting every current blocker", () => {
	const fixture = workCaseWithUnassessedEffect();
	const closure = prepareClosureTarget(fixture.workCase);
	if (closure.status !== "not-ready") throw new Error(closure.status);
	const result = blockWorkCase(fixture.workCase, {
		workCaseId: fixture.workCase.workCaseId,
		expectedRevisionId: fixture.workCase.revisionId,
		claimAssuranceConclusionId: fixture.assurance.conclusionId,
		reason: "No current closure path exists until the Effect can be assessed.",
		blockerDispositions: closure.blockers.map((blocker) => ({
			code: blocker.code,
			subjectId: blocker.subjectId,
			basis: ["The Claim Assurance Conclusion accounts for this blocker."],
		})),
	});

	assert.equal(result.status, "blocked");
	if (result.status !== "blocked") return;
	assert.equal(result.value.status, "blocked");
	assert.equal(result.value.block.blockerDispositions.length, closure.blockers.length);
	assert.notEqual(result.value.revisionId, fixture.workCase.revisionId);
	const modelOnly = resumeBlockedWorkCase(result.value, {
		workCaseId: result.value.workCaseId,
		expectedRevisionId: result.value.revisionId,
		continuation: "Assess the Effect using the newly available evidence.",
		observation: {
			kind: "model",
			observationId: "proposal-only",
			source: "test-evaluator",
			statement: "Evidence may now be available.",
			basis: ["Model proposal only."],
		},
	});
	const resumed = resumeBlockedWorkCase(result.value, {
		workCaseId: result.value.workCaseId,
		expectedRevisionId: result.value.revisionId,
		continuation: "Assess the Effect using the newly available evidence.",
		observation: {
			kind: "tool",
			observationId: "effect-evidence-available-1",
			source: "effect-observer",
			statement: "Bounded Effect evidence is now available.",
			basis: ["The observer returned an exact evidence locator."],
		},
	});
	assert.equal(modelOnly.status, "invalid");
	assert.equal(resumed.status, "active");
	if (resumed.status === "active") {
		assert.notEqual(resumed.value.revisionId, fixture.workCase.revisionId);
		assert.equal(resumed.value.continuityIds.length, 2);
	}
});

test("ready closure, omitted blocker, or non-Assurance Conclusion cannot block", () => {
	const fixture = workCaseWithUnassessedEffect();
	const closure = prepareClosureTarget(fixture.workCase);
	if (closure.status !== "not-ready") return;
	const base = {
		workCaseId: fixture.workCase.workCaseId,
		expectedRevisionId: fixture.workCase.revisionId,
		claimAssuranceConclusionId: fixture.assurance.conclusionId,
		reason: "No current closure path exists.",
		blockerDispositions: closure.blockers.map((blocker) => ({
			code: blocker.code,
			subjectId: blocker.subjectId,
			basis: ["The blocker is current."],
		})),
	};
	const omitted = blockWorkCase(fixture.workCase, {
		...base,
		blockerDispositions: [],
	});
	const wrongConclusion = blockWorkCase(fixture.workCase, {
		...base,
		claimAssuranceConclusionId: "conclusion-warrant",
	});

	assert.equal(omitted.status, "invalid");
	assert.equal(wrongConclusion.status, "invalid");
	if (omitted.status === "invalid") {
		assert.equal(omitted.error.code, "blocker-accounting");
	}
	if (wrongConclusion.status === "invalid") {
		assert.equal(wrongConclusion.error.code, "claim-assurance-required");
	}

	const opened = openWorkCase({
		outcome: {
			statement: "The existing implementation is sufficient.",
			acceptanceConditions: ["The behavior is present."],
			constraints: [],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (opened.status !== "opened") return;
	const assurance = conclusion(
		opened.value.workCaseId,
		"Claim Assurance",
		"conclusion-ready",
	);
	const ready = recordConclusion(opened.value, assurance);
	const readyBlock = blockWorkCase(ready, {
		workCaseId: ready.workCaseId,
		expectedRevisionId: ready.revisionId,
		claimAssuranceConclusionId: assurance.conclusionId,
		reason: "Incorrectly claim blocked.",
		blockerDispositions: [],
	});
	assert.equal(readyBlock.status, "invalid");
	if (readyBlock.status === "invalid") {
		assert.equal(readyBlock.error.code, "closure-still-ready");
	}
});
