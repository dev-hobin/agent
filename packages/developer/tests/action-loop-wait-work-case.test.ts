import assert from "node:assert/strict";
import test from "node:test";
import { resumeWaitingWorkCase } from "../src/action-loop/work/resume-waiting-work-case.ts";
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

test("only satisfied current resume predicate returns waiting Work Case to active", () => {
	const current = workCase();
	const waiting = waitWorkCase(current, {
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
	if (waiting.status !== "waiting") return;
	const base = {
		workCaseId: current.workCaseId,
		expectedRevisionId: waiting.value.revisionId,
		assessment: {
			resumePredicate: waiting.value.wait.resumePredicate,
			status: "unknown" as const,
			observationKind: "tool",
			observationId: "registry-probe-2",
			source: "registry-client",
			basis: ["The current probe result remains inconclusive."],
		},
	};
	const unresolved = resumeWaitingWorkCase(waiting.value, base);
	const resumed = resumeWaitingWorkCase(waiting.value, {
		...base,
		assessment: {
			...base.assessment,
			status: "satisfied",
			basis: ["The bounded registry probe now succeeds."],
		},
	});

	assert.equal(unresolved.status, "waiting");
	assert.equal(resumed.status, "active");
	if (resumed.status === "active") {
		assert.notEqual(resumed.value.revisionId, current.revisionId);
		assert.equal(resumed.value.continuityIds.length, 2);
		assert.match(
			resumed.value.continuityIds[1] ?? "",
			/^work_case_wait_resume_[a-f0-9]{64}$/,
		);
	}
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
