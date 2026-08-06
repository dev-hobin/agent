import assert from "node:assert/strict";
import test from "node:test";
import { waitWorkCase } from "../src/action-loop/work/wait-work-case.ts";
import { openWorkCase } from "../src/action-loop/work/work-case.ts";

function workCase() {
	const result = openWorkCase({
		outcome: {
			statement: "The package is published after the registry is available.",
			acceptanceConditions: ["The registry contains the accepted package."],
			constraints: [],
		},
		provenance: { kind: "human", source: "delegating-user" },
	});
	if (result.status !== "opened") throw new Error(result.error.message);
	return result.value;
}

test("observed external condition and resume predicate enter waiting", () => {
	const current = workCase();
	const result = waitWorkCase(current, {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		externalCondition: "The package registry is unavailable.",
		resumePredicate: "A bounded registry probe succeeds.",
		observation: {
			kind: "tool",
			observationId: "registry-probe-1",
			source: "registry-client",
			basis: ["The bounded registry probe returned unavailable."],
		},
	});

	assert.equal(result.status, "waiting");
	if (result.status !== "waiting") return;
	assert.equal(result.value.status, "waiting");
	assert.equal(result.value.priorRevisionId, current.revisionId);
	assert.notEqual(result.value.revisionId, current.revisionId);
	assert.equal(result.value.wait.resumePredicate, "A bounded registry probe succeeds.");
	assert.match(result.value.wait.workCaseWaitId, /^work_case_wait_[a-f0-9]{64}$/);
});

test("model-only, predicate-free, or stale wait attempts fail closed", () => {
	const current = workCase();
	const base = {
		workCaseId: current.workCaseId,
		expectedRevisionId: current.revisionId,
		externalCondition: "The package registry is unavailable.",
		resumePredicate: "A bounded registry probe succeeds.",
		observation: {
			kind: "tool",
			observationId: "registry-probe-1",
			source: "registry-client",
			basis: ["The bounded registry probe returned unavailable."],
		},
	};
	const fixtures = [
		{
			proposal: { ...base, observation: { ...base.observation, kind: "model" } },
			code: "observation-required",
		},
		{
			proposal: { ...base, resumePredicate: " " },
			code: "invalid-wait-condition",
		},
		{
			proposal: { ...base, expectedRevisionId: "work_case_revision_stale" },
			code: "identity-mismatch",
		},
	];

	for (const fixture of fixtures) {
		const result = waitWorkCase(current, fixture.proposal);
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid") assert.equal(result.error.code, fixture.code);
	}
});
