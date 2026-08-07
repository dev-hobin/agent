const fixtureId = process.env.DEVELOPER_EVAL_FIXTURE;
const trial = Number(process.env.DEVELOPER_EVAL_TRIAL_INDEX);
const preferredFirstTarget = trial % 2 === 1;
const forcedTrialOutcome = process.env.DEVELOPER_FAKE_TRIAL_OUTCOME;
process.stdout.write(
  "DEVELOPER_EVAL_RESULT " +
    JSON.stringify({
      fixtureId,
      structuralValid: true,
      trialOutcome: forcedTrialOutcome ?? "completed",
      outcome:
        forcedTrialOutcome === "bounded-stop"
          ? "active-unchanged"
          : "settled-unchanged",
      firstTarget: preferredFirstTarget ? "specify" : "model",
      preferredFirstTarget,
      routeCount: 1,
      routeAttemptCount: 2,
      toolCallCount: 2,
      toolCallAttemptCount: 6,
      toolErrorCount: forcedTrialOutcome === "bounded-stop" ? 1 : 0,
    }) +
    "\n",
);
