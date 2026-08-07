import assertModule from "node:assert";
import test from "node:test";

import {
	classifyLiveFailure,
	parseEvalResult,
	summarizeTrialObservations,
	wilsonInterval,
} from "../scripts/eval-probability.mjs";

const assert: typeof assertModule.strict = assertModule.strict;

test("probabilistic reports separate admissibility from preferred decisions", () => {
	const observations = [
		{
			classification: "preferred",
			toolCallAttemptCount: 10,
			routeAttemptCount: 2,
			toolErrorCount: 0,
		},
		{
			classification: "preferred",
			toolCallAttemptCount: 14,
			routeAttemptCount: 4,
			toolErrorCount: 2,
		},
		{ classification: "admissible-non-preferred" },
		{ classification: "inadmissible-result" },
		{ classification: "bounded-stop" },
		{ classification: "active-incomplete" },
	];
	const summary = summarizeTrialObservations("fixture", observations);
	assert.equal(summary.accepted, 3);
	assert.equal(summary.preferred, 2);
	assert.equal(summary.admissibleNonPreferred, 1);
	assert.equal(summary.inadmissible, 1);
	assert.equal(summary.boundedStops, 1);
	assert.equal(summary.activeIncomplete, 1);
	assert.equal(summary.acceptanceRate, 0.5);
	assert.equal(summary.medianToolCallAttempts, 12);
	assert.equal(summary.medianRouteAttempts, 3);
	assert.equal(summary.medianToolErrors, 1);
	assert.equal(summary.preferredRateAmongAccepted, 2 / 3);
	assert.equal(summary.acceptanceWilson95.length, 2);
	assert.deepEqual(wilsonInterval(0, 0), [0, 0]);
});

test("live failure classification keeps wrong answers distinct from ordinary variance", () => {
	assert.equal(
		classifyLiveFailure("structurally inadmissible first Capability"),
		"inadmissible-result",
	);
	assert.equal(classifyLiveFailure("wall-clock budget 10/1ms"), "bounded-stop");
	assert.equal(
		classifyLiveFailure("no canonical Judgment followed Work Case opening"),
		"protocol-attempt-rejected",
	);
	assert.equal(classifyLiveFailure("Pi exited 1"), "blocked-environment");
});

test("structured live results are parsed independently of human-readable output", () => {
	assert.deepEqual(
		parseEvalResult(
			'noise\nDEVELOPER_EVAL_RESULT {"fixtureId":"x","structuralValid":true,"preferredFirstTarget":false}\ndone',
		),
		{ fixtureId: "x", structuralValid: true, preferredFirstTarget: false },
	);
	assert.equal(parseEvalResult("no result marker"), undefined);
	assert.throws(
		() => parseEvalResult("DEVELOPER_EVAL_RESULT {broken}"),
		/Invalid live eval result/,
	);
});
