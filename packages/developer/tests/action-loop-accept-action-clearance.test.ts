import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptActionCandidate,
	type ActionCandidate,
} from "../src/action-loop/action/accept-action-candidate.ts";
import {
	acceptActionClearance,
	type ActionClearanceProposal,
	type PermissionDecision,
} from "../src/action-loop/action/action-clearance.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";

function candidate(): ActionCandidate {
	const accepted = acceptActionCandidate({
		workCaseId: "work-1",
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint: "a".repeat(64),
		},
		summary: "Write the bounded implementation change.",
		intendedEffects: ["The target file contains the accepted implementation."],
		requiredConclusionIds: ["conclusion-context", "conclusion-intervention"],
		provenance: { kind: "model", source: "candidate-adapter" },
	});
	if (accepted.status !== "accepted") throw new Error(accepted.error.message);
	return accepted.value;
}

function conclusion(conclusionId: string): JudgmentConclusion {
	return Object.freeze({
		conclusionId,
		workCaseId: "work-1",
		judgmentId: `judgment-${conclusionId}`,
		category: "Proportionate Intervention",
		subject: "The bounded change is warranted.",
		contextRevisionId: "context-1",
		requirementDispositions: Object.freeze([]),
		coverageIds: Object.freeze([]),
		basis: Object.freeze(["The required warrant is closed."]),
		provenance: Object.freeze({ kind: "model", source: "fixture" }),
		answer: "Proceed within the bounded action scope.",
	});
}

function permission(
	currentCandidate: ActionCandidate,
	status: PermissionDecision["status"] = "granted",
): PermissionDecision {
	return {
		actionCandidateId: currentCandidate.actionCandidateId,
		status,
		source: "delegation:current-user-request",
		basis: ["The current delegation permits this bounded action."],
	};
}

function proposal(
	currentCandidate: ActionCandidate,
	overrides: Partial<ActionClearanceProposal> = {},
): ActionClearanceProposal {
	return {
		workCaseId: currentCandidate.workCaseId,
		actionCandidateId: currentCandidate.actionCandidateId,
		conclusionIds: [...currentCandidate.requiredConclusionIds],
		warrantBasis: ["All candidate-declared Judgment requirements are closed."],
		provenance: { kind: "model", source: "clearance-adapter-a" },
		...overrides,
	};
}

const conclusions = [
	conclusion("conclusion-context"),
	conclusion("conclusion-intervention"),
];

test("required Conclusions plus granted permission clear one exact Action", () => {
	const currentCandidate = candidate();
	const first = acceptActionClearance(
		currentCandidate,
		conclusions,
		permission(currentCandidate),
		proposal(currentCandidate),
	);
	const repeated = acceptActionClearance(
		currentCandidate,
		[...conclusions].reverse(),
		permission(currentCandidate),
		proposal(currentCandidate, {
			conclusionIds: [...currentCandidate.requiredConclusionIds].reverse(),
			provenance: { kind: "human", source: "reviewer-one" },
		}),
	);

	assert.equal(first.status, "cleared");
	assert.equal(repeated.status, "cleared");
	if (first.status !== "cleared" || repeated.status !== "cleared") return;
	assert.match(
		first.value.actionClearanceId,
		/^action_clearance_[a-f0-9]{64}$/,
	);
	assert.equal(repeated.value.actionClearanceId, first.value.actionClearanceId);
	assert.equal(
		first.value.controlledAction.fingerprint,
		currentCandidate.controlledAction.fingerprint,
	);
	assert.notDeepEqual(first.value.provenance, repeated.value.provenance);
	assert.equal(Object.isFrozen(first.value), true);
});

test("Conclusion cannot substitute for denied or unknown permission", () => {
	const currentCandidate = candidate();
	for (const status of ["denied", "unknown"] as const) {
		const result = acceptActionClearance(
			currentCandidate,
			conclusions,
			permission(currentCandidate, status),
			proposal(currentCandidate),
		);
		assert.equal(result.status, "not-cleared");
		if (result.status === "not-cleared") {
			assert.equal(result.assessment.permission.status, status);
			assert.equal(result.assessment.warrantSatisfied, true);
		}
	}
});

test("missing warrant remains not-cleared while malformed warrant is invalid", () => {
	const currentCandidate = candidate();
	const missing = acceptActionClearance(
		currentCandidate,
		conclusions.slice(0, 1),
		permission(currentCandidate),
		proposal(currentCandidate),
	);
	assert.equal(missing.status, "not-cleared");
	if (missing.status === "not-cleared") {
		assert.equal(missing.assessment.warrantSatisfied, false);
		assert.deepEqual(missing.blockers, [
			{ code: "missing-conclusion", conclusionId: "conclusion-intervention" },
		]);
	}

	const fixtures = [
		{
			current: [...conclusions, conclusion("conclusion-extra")],
			proposal: proposal(currentCandidate, {
				conclusionIds: [
					...currentCandidate.requiredConclusionIds,
					"conclusion-extra",
				],
			}),
			code: "unexpected-conclusion",
		},
		{
			current: [
				conclusions[0]!,
				{ ...conclusions[1]!, workCaseId: "work-other" },
			],
			proposal: proposal(currentCandidate),
			code: "cross-work-case-conclusion",
		},
		{
			current: conclusions,
			proposal: proposal(currentCandidate, {
				actionCandidateId: "action_candidate_stale",
			}),
			code: "identity-mismatch",
		},
	] as const;

	for (const fixture of fixtures) {
		const result = acceptActionClearance(
			currentCandidate,
			fixture.current,
			permission(currentCandidate),
			fixture.proposal,
		);
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid")
			assert.equal(result.error.code, fixture.code);
	}
});

test("permission must bind the candidate and retain explicit evidence", () => {
	const currentCandidate = candidate();
	for (const [currentPermission, code] of [
		[
			{
				...permission(currentCandidate),
				actionCandidateId: "action_candidate_other",
			},
			"identity-mismatch",
		],
		[{ ...permission(currentCandidate), basis: [] }, "empty-permission-basis"],
		[
			{ ...permission(currentCandidate), source: " " },
			"invalid-permission-source",
		],
	] as const) {
		const result = acceptActionClearance(
			currentCandidate,
			conclusions,
			currentPermission,
			proposal(currentCandidate),
		);
		assert.equal(result.status, "invalid", code);
		if (result.status === "invalid") assert.equal(result.error.code, code);
	}
});
