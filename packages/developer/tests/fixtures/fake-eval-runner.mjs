const fixtureId = process.env.DEVELOPER_EVAL_FIXTURE;
const trial = Number(process.env.DEVELOPER_EVAL_TRIAL_INDEX);
const preferredFirstTarget = trial % 2 === 1;
process.stdout.write(
  "DEVELOPER_EVAL_RESULT " +
    JSON.stringify({
      fixtureId,
      structuralValid: true,
      outcome: "settled-unchanged",
      firstTarget: preferredFirstTarget ? "specify" : "model",
      preferredFirstTarget,
      routeCount: 1,
      toolCallCount: 2,
    }) +
    "\n",
);
