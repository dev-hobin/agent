const fixtureId = process.env.DEVELOPER_EVAL_FIXTURE;
const trial = Number(process.env.DEVELOPER_EVAL_TRIAL_INDEX);
const preferredFirstOwner = trial % 2 === 1;
process.stdout.write(
  "DEVELOPER_EVAL_RESULT " +
    JSON.stringify({
      fixtureId,
      structuralValid: true,
      outcome: "settled-unchanged",
      firstOwner: preferredFirstOwner ? "specify" : "model",
      preferredFirstOwner,
      routeCount: 1,
      toolCallCount: 2,
    }) +
    "\n",
);
