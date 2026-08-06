import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptActionCandidate,
	type ActionCandidateProposal,
} from "../src/action-loop/action/accept-action-candidate.ts";

const fingerprint = "a".repeat(64);

function proposal(
	overrides: Partial<ActionCandidateProposal> = {},
): ActionCandidateProposal {
	return {
		workCaseId: "work-1",
		controlledAction: {
			kind: "pi-tool-call",
			fingerprint,
		},
		summary: "Write the bounded implementation change.",
		intendedEffects: [
			"The target implementation reflects the accepted contract.",
			"No unrelated artifact changes.",
		],
		requiredConclusionIds: ["conclusion-context", "conclusion-intervention"],
		provenance: { kind: "model", source: "adapter-a" },
		...overrides,
	};
}

test("exact controlled action and warrant requirements produce one candidate", () => {
	const first = acceptActionCandidate(proposal());
	const reordered = acceptActionCandidate(
		proposal({
			intendedEffects: [...proposal().intendedEffects].reverse(),
			requiredConclusionIds: [...proposal().requiredConclusionIds].reverse(),
			provenance: { kind: "human", source: "reviewer-one" },
		}),
	);

	assert.equal(first.status, "accepted");
	assert.equal(reordered.status, "accepted");
	if (first.status !== "accepted" || reordered.status !== "accepted") return;
	assert.match(first.value.actionCandidateId, /^action_candidate_[a-f0-9]{64}$/);
	assert.equal(reordered.value.actionCandidateId, first.value.actionCandidateId);
	assert.deepEqual(first.value.intendedEffects, [
		"No unrelated artifact changes.",
		"The target implementation reflects the accepted contract.",
	]);
	assert.deepEqual(first.value.requiredConclusionIds, [
		"conclusion-context",
		"conclusion-intervention",
	]);
	assert.notDeepEqual(first.value.provenance, reordered.value.provenance);
	assert.equal(Object.isFrozen(first.value), true);
	assert.equal(Object.isFrozen(first.value.controlledAction), true);
});

test("a different controlled action fingerprint cannot reuse candidate identity", () => {
	const first = acceptActionCandidate(proposal());
	const changed = acceptActionCandidate(
		proposal({
			controlledAction: {
				kind: "pi-tool-call",
				fingerprint: "b".repeat(64),
			},
		}),
	);

	assert.equal(first.status, "accepted");
	assert.equal(changed.status, "accepted");
	if (first.status === "accepted" && changed.status === "accepted") {
		assert.notEqual(changed.value.actionCandidateId, first.value.actionCandidateId);
	}
});

test("malformed, basis-free, or duplicate candidate content is rejected", () => {
	const fixtures: Array<{
		overrides: Partial<ActionCandidateProposal>;
		code: string;
	}> = [
		{ overrides: { workCaseId: " " }, code: "invalid-id" },
		{
			overrides: {
				controlledAction: { kind: "pi-tool-call", fingerprint: "not-a-hash" },
			},
			code: "invalid-fingerprint",
		},
		{ overrides: { summary: " " }, code: "empty-summary" },
		{ overrides: { intendedEffects: [] }, code: "missing-intended-effect" },
		{
			overrides: { intendedEffects: ["Changed.", " Changed. "] },
			code: "duplicate-value",
		},
		{ overrides: { requiredConclusionIds: [] }, code: "missing-conclusion" },
		{
			overrides: {
				requiredConclusionIds: ["conclusion-a", "conclusion-a"],
			},
			code: "duplicate-value",
		},
		{
			overrides: { provenance: { kind: "model", source: " " } },
			code: "invalid-provenance",
		},
	];

	for (const fixture of fixtures) {
		const result = acceptActionCandidate(proposal(fixture.overrides));
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid") {
			assert.equal(result.error.code, fixture.code);
		}
	}
});
