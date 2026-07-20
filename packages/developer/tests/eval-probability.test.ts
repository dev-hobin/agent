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
    { classification: "preferred" },
    { classification: "preferred" },
    { classification: "admissible-non-preferred" },
    { classification: "inadmissible-result" },
  ];
  const summary = summarizeTrialObservations("fixture", observations);
  assert.equal(summary.accepted, 3);
  assert.equal(summary.preferred, 2);
  assert.equal(summary.admissibleNonPreferred, 1);
  assert.equal(summary.inadmissible, 1);
  assert.equal(summary.acceptanceRate, 0.75);
  assert.equal(summary.preferredRateAmongAccepted, 2 / 3);
  assert.equal(summary.acceptanceWilson95.length, 2);
  assert.deepEqual(wilsonInterval(0, 0), [0, 0]);
});

test("live failure classification keeps wrong answers distinct from ordinary variance", () => {
  assert.equal(
    classifyLiveFailure("structurally inadmissible first route"),
    "inadmissible-result",
  );
  assert.equal(classifyLiveFailure("wall-clock budget 10/1ms"), "budget-exhausted");
  assert.equal(classifyLiveFailure("Route ID mismatch"), "protocol-attempt-rejected");
  assert.equal(classifyLiveFailure("Pi exited 1"), "blocked-environment");
});

test("structured live results are parsed independently of human-readable output", () => {
  assert.deepEqual(
    parseEvalResult(
      'noise\nDEVELOPER_EVAL_RESULT {"fixtureId":"x","structuralValid":true,"preferredFirstOwner":false}\ndone',
    ),
    { fixtureId: "x", structuralValid: true, preferredFirstOwner: false },
  );
  assert.equal(parseEvalResult("no result marker"), undefined);
  assert.throws(
    () => parseEvalResult("DEVELOPER_EVAL_RESULT {broken}"),
    /Invalid live eval result/,
  );
});
