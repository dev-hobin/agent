import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptActionCandidate,
	type ActionCandidate,
} from "../src/action-loop/action/accept-action-candidate.ts";
import {
	acceptActionClearance,
	type ActionClearance,
} from "../src/action-loop/action/action-clearance.ts";
import { beginEffect } from "../src/action-loop/effect/begin-effect.ts";
import { settleEffect } from "../src/action-loop/effect/effect-settlement.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import { recordWorkCaseActionCandidate } from "../src/action-loop/work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../src/action-loop/work/record-work-case-action-clearance.ts";
import { recordWorkCaseConclusion } from "../src/action-loop/work/record-work-case-conclusion.ts";
import { recordWorkCaseEffectAssessment } from "../src/action-loop/work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import {
	deriveWorkCaseRevisionId,
	openWorkCase,
} from "../src/action-loop/work/work-case.ts";

function openedWorkCase() {
	const result = openWorkCase({
		outcome: {
			statement: "The exact bounded change is implemented.",
			acceptanceConditions: ["The implementation satisfies the contract."],
			constraints: ["No unrelated artifact changes."],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

function conclusion(workCaseId: string): JudgmentConclusion {
	return Object.freeze({
		conclusionId: "conclusion-action-warrant",
		workCaseId,
		judgmentId: "judgment-action-warrant",
		category: "Proportionate Intervention",
		subject: "The bounded change is warranted.",
		contextRevisionId: "context-action-warrant",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["The intervention is proportionate."]),
		answer: "Proceed with the bounded change.",
		provenance: Object.freeze({ kind: "model", source: "test-evaluator" }),
	});
}

function candidate(
	workCaseId: string,
	requiredConclusionIds = ["conclusion-action-warrant"],
): ActionCandidate {
	const result = acceptActionCandidate({
		workCaseId,
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint: "a".repeat(64),
		},
		summary: "Apply the exact bounded change.",
		intendedEffects: ["The target artifact contains the bounded change."],
		requiredConclusionIds,
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (result.status !== "accepted") throw new Error(result.error.message);
	return result.value;
}

test("Action Candidate is recorded only after every required Conclusion", () => {
	const opened = openedWorkCase();
	const withConclusion = recordWorkCaseConclusion(
		opened,
		conclusion(opened.workCaseId),
	);
	if (withConclusion.status !== "recorded") return;
	const result = recordWorkCaseActionCandidate(
		withConclusion.value,
		candidate(opened.workCaseId),
	);

	assert.equal(result.status, "recorded");
	if (result.status !== "recorded") return;
	assert.notEqual(result.value.revisionId, withConclusion.value.revisionId);
	assert.equal(result.value.actionCandidates.length, 1);
	assert.equal(Object.isFrozen(result.value.actionCandidates), true);
});

test("recording rejects a revision-valid but relationally incoherent inventory", () => {
	const opened = openedWorkCase();
	const acceptedConclusion = conclusion(opened.workCaseId);
	const withConclusion = recordWorkCaseConclusion(opened, acceptedConclusion);
	if (withConclusion.status !== "recorded") return;
	const orphanClearance: ActionClearance = {
		actionClearanceId: "clearance-orphan",
		workCaseId: opened.workCaseId,
		actionCandidateId: "candidate-missing",
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint: "b".repeat(64),
		},
		intendedEffects: ["The orphan clearance is rejected."],
		conclusionIds: [acceptedConclusion.conclusionId],
		warrantBasis: ["This malformed fixture has no recorded Candidate."],
		permission: {
			actionCandidateId: "candidate-missing",
			status: "granted",
			source: "test:malformed-inventory",
			basis: ["The permission itself is not the tested defect."],
		},
		provenance: { kind: "human", source: "test:malformed-inventory" },
	};
	const malformedState = {
		...withConclusion.value,
		actionClearances: Object.freeze([orphanClearance]),
	};
	const revisionValidMalformedState = Object.freeze({
		...malformedState,
		revisionId: deriveWorkCaseRevisionId(malformedState),
	});

	const result = recordWorkCaseActionCandidate(
		revisionValidMalformedState,
		candidate(opened.workCaseId),
	);

	assert.equal(result.status, "invalid");
	if (result.status === "invalid") {
		assert.equal(result.error.code, "invalid-work-case-inventory");
		assert.match(result.error.message, /Candidate/i);
	}
});

test("Action Clearance requires its Candidate and Conclusions in the same inventory", () => {
	const opened = openedWorkCase();
	const acceptedConclusion = conclusion(opened.workCaseId);
	const withConclusion = recordWorkCaseConclusion(opened, acceptedConclusion);
	if (withConclusion.status !== "recorded") return;
	const acceptedCandidate = candidate(opened.workCaseId);
	const withCandidate = recordWorkCaseActionCandidate(
		withConclusion.value,
		acceptedCandidate,
	);
	if (withCandidate.status !== "recorded") return;
	const clearance = acceptActionClearance(
		acceptedCandidate,
		[acceptedConclusion],
		{
			actionCandidateId: acceptedCandidate.actionCandidateId,
			status: "granted",
			source: "delegation:current-user-request",
			basis: ["The delegated work permits this bounded Action."],
		},
		{
			workCaseId: opened.workCaseId,
			actionCandidateId: acceptedCandidate.actionCandidateId,
			conclusionIds: [acceptedConclusion.conclusionId],
			warrantBasis: ["The required Conclusion is current."],
			provenance: { kind: "model", source: "test-evaluator" },
		},
	);
	if (clearance.status !== "cleared") return;

	const recorded = recordWorkCaseActionClearance(
		withCandidate.value,
		clearance.value,
	);
	const missingCandidate = recordWorkCaseActionClearance(
		withConclusion.value,
		clearance.value,
	);

	assert.equal(recorded.status, "recorded");
	assert.equal(missingCandidate.status, "invalid");
	if (recorded.status === "recorded") {
		assert.equal(recorded.value.actionClearances.length, 1);
		const effect = beginEffect(clearance.value, {
			occurrenceId: "tool-call-work-case",
			actionClearanceId: clearance.value.actionClearanceId,
			controlledAction: clearance.value.controlledAction,
			source: "pi:tool_call",
		});
		if (effect.status !== "begun") return;
		const missingClearance = recordWorkCaseEffect(
			withCandidate.value,
			effect.value,
		);
		const withEffect = recordWorkCaseEffect(recorded.value, effect.value);
		assert.equal(missingClearance.status, "invalid");
		if (missingClearance.status === "invalid") {
			assert.equal(missingClearance.error.code, "missing-action-clearance");
		}
		assert.equal(withEffect.status, "recorded");
		if (withEffect.status === "recorded") {
			assert.equal(withEffect.value.effects.length, 1);
			assert.notEqual(withEffect.value.revisionId, recorded.value.revisionId);
			assert.equal(
				recordWorkCaseEffect(withEffect.value, effect.value).status,
				"unchanged",
			);
			const intendedEffect = effect.value.intendedEffects[0];
			if (intendedEffect === undefined) return;
			const assessment = settleEffect(effect.value, [], {
				workCaseId: opened.workCaseId,
				effectId: effect.value.effectId,
				outcome: "unknown",
				observationDispositions: [],
				intendedEffectDispositions: [
					{
						intendedEffect,
						status: "unknown",
						observationIds: [],
						basis: ["No decisive Observation is currently available."],
					},
				],
				basis: ["The Effect remains explicitly unsettled."],
				provenance: { kind: "model", source: "test-evaluator" },
			});
			if (assessment.status !== "unsettled") return;
			const withAssessment = recordWorkCaseEffectAssessment(
				withEffect.value,
				assessment.value,
				null,
			);
			assert.equal(withAssessment.status, "recorded");
			if (withAssessment.status === "recorded") {
				assert.equal(withAssessment.value.currentEffectAssessments.length, 1);
				assert.equal(
					recordWorkCaseEffectAssessment(
						withAssessment.value,
						assessment.value,
						null,
					).status,
					"unchanged",
				);
				const reassessment = settleEffect(effect.value, [], {
					workCaseId: opened.workCaseId,
					effectId: effect.value.effectId,
					outcome: "unknown",
					observationDispositions: [],
					intendedEffectDispositions: [
						{
							intendedEffect,
							status: "unknown",
							observationIds: [],
							basis: ["A second bounded check remains inconclusive."],
						},
					],
					basis: ["The later check still leaves the Effect unsettled."],
					provenance: { kind: "model", source: "test-evaluator" },
				});
				if (reassessment.status !== "unsettled") return;
				const staleReplacement = recordWorkCaseEffectAssessment(
					withAssessment.value,
					reassessment.value,
					null,
				);
				const replacement = recordWorkCaseEffectAssessment(
					withAssessment.value,
					reassessment.value,
					assessment.value.effectAssessmentId,
				);
				assert.equal(staleReplacement.status, "invalid");
				assert.equal(replacement.status, "recorded");
				if (staleReplacement.status === "invalid") {
					assert.equal(staleReplacement.error.code, "stale-effect-assessment");
				}
			}
		}
	}
	if (missingCandidate.status === "invalid") {
		assert.equal(missingCandidate.error.code, "missing-action-candidate");
	}
});

test("missing required Conclusion cannot remain outside Work Case inventory", () => {
	const opened = openedWorkCase();
	const result = recordWorkCaseActionCandidate(
		opened,
		candidate(opened.workCaseId),
	);

	assert.equal(result.status, "invalid");
	if (result.status === "invalid") {
		assert.equal(result.error.code, "missing-conclusion");
	}
});

test("duplicate Candidate is idempotent while stale or cross-Case input fails", () => {
	const opened = openedWorkCase();
	const withConclusion = recordWorkCaseConclusion(
		opened,
		conclusion(opened.workCaseId),
	);
	if (withConclusion.status !== "recorded") return;
	const accepted = candidate(opened.workCaseId);
	const first = recordWorkCaseActionCandidate(withConclusion.value, accepted);
	if (first.status !== "recorded") return;

	const duplicate = recordWorkCaseActionCandidate(first.value, accepted);
	const stale = recordWorkCaseActionCandidate(
		{ ...first.value, revisionId: "work_case_revision_stale" },
		accepted,
	);
	const crossCase = recordWorkCaseActionCandidate(
		first.value,
		candidate("work_case_other"),
	);

	assert.equal(duplicate.status, "unchanged");
	assert.equal(stale.status, "invalid");
	assert.equal(crossCase.status, "invalid");
	if (stale.status === "invalid") {
		assert.equal(stale.error.code, "stale-work-case");
	}
	if (crossCase.status === "invalid") {
		assert.equal(crossCase.error.code, "identity-mismatch");
	}
});
