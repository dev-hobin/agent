import assert from "node:assert/strict";
import test from "node:test";
import {
	openWorkCase,
	type WorkCaseProposal,
} from "../src/action-loop/work/work-case.ts";

function proposal(overrides: Partial<WorkCaseProposal> = {}): WorkCaseProposal {
	return {
		outcome: {
			statement: "The package implements the delegated bounded behavior.",
			acceptanceConditions: [
				"The requested behavior is present.",
				"Relevant verification supports the completion claim.",
			],
			constraints: ["No unrelated package behavior changes."],
		},
		provenance: { kind: "model", source: "adapter-a" },
		...overrides,
	};
}

test("one bounded Outcome opens one deterministic active Work Case", () => {
	const first = openWorkCase(proposal());
	const reordered = openWorkCase(
		proposal({
			outcome: {
				statement: proposal().outcome.statement,
				acceptanceConditions: [
					...proposal().outcome.acceptanceConditions,
				].reverse(),
				constraints: [...proposal().outcome.constraints].reverse(),
			},
			provenance: { kind: "human", source: "delegating-user" },
		}),
	);

	assert.equal(first.status, "opened");
	assert.equal(reordered.status, "opened");
	if (first.status !== "opened" || reordered.status !== "opened") return;
	assert.match(first.value.workCaseId, /^work_case_[a-f0-9]{64}$/);
	assert.match(
		first.value.revisionId,
		/^work_case_revision_[a-f0-9]{64}$/,
	);
	assert.match(first.value.outcome.outcomeId, /^outcome_[a-f0-9]{64}$/);
	assert.equal(reordered.value.workCaseId, first.value.workCaseId);
	assert.equal(
		reordered.value.outcome.outcomeId,
		first.value.outcome.outcomeId,
	);
	assert.notDeepEqual(first.value.provenance, reordered.value.provenance);
	assert.equal(first.value.status, "active");
	assert.deepEqual(first.value.conclusions, []);
	assert.deepEqual(first.value.actionCandidates, []);
	assert.deepEqual(first.value.actionClearances, []);
	assert.deepEqual(first.value.effects, []);
	assert.deepEqual(first.value.currentSettlements, []);
	assert.equal(Object.isFrozen(first.value), true);
	assert.equal(Object.isFrozen(first.value.outcome), true);
});

test("Outcome change opens a different Work Case", () => {
	const first = openWorkCase(proposal());
	const changed = openWorkCase(
		proposal({
			outcome: {
				...proposal().outcome,
				statement: "The package remains unchanged because it already complies.",
			},
		}),
	);

	assert.equal(first.status, "opened");
	assert.equal(changed.status, "opened");
	if (first.status === "opened" && changed.status === "opened") {
		assert.notEqual(changed.value.workCaseId, first.value.workCaseId);
	}
});

test("blank, acceptance-free, duplicate, or malformed Outcome is rejected", () => {
	const fixtures: Array<{
		overrides: Partial<WorkCaseProposal>;
		code: string;
	}> = [
		{
			overrides: { outcome: { ...proposal().outcome, statement: " " } },
			code: "empty-outcome",
		},
		{
			overrides: {
				outcome: { ...proposal().outcome, acceptanceConditions: [] },
			},
			code: "missing-acceptance-condition",
		},
		{
			overrides: {
				outcome: {
					...proposal().outcome,
					acceptanceConditions: ["Verified.", " Verified. "],
				},
			},
			code: "duplicate-value",
		},
		{
			overrides: { provenance: { kind: "model", source: " " } },
			code: "invalid-provenance",
		},
	];

	for (const fixture of fixtures) {
		const result = openWorkCase(proposal(fixture.overrides));
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid")
			assert.equal(result.error.code, fixture.code);
	}
});
