const fixtureId = process.env.DEVELOPER_EVAL_FIXTURE;
const trial = Number(process.env.DEVELOPER_EVAL_TRIAL_INDEX);
const preferredFirstTarget = trial % 2 === 1;
const forcedTrialOutcome = process.env.DEVELOPER_FAKE_TRIAL_OUTCOME;
const sdkMode = process.env.DEVELOPER_EVAL_MODE === "sdk";

function configuredSelectedTargets(encoded) {
	if (!encoded) return preferredFirstTarget ? ["specify"] : ["model"];
	try {
		const parsed = JSON.parse(encoded);
		if (
			!Array.isArray(parsed) ||
			parsed.length === 0 ||
			parsed.some((target) => typeof target !== "string")
		) {
			throw new Error("expected a nonempty string array");
		}
		return parsed;
	} catch (error) {
		throw new Error(
			`Invalid DEVELOPER_FAKE_SELECTED_TARGETS_JSON: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

const sdkSelectedTargets = configuredSelectedTargets(
	process.env.DEVELOPER_FAKE_SELECTED_TARGETS_JSON,
);
process.stdout.write(
	"DEVELOPER_EVAL_RESULT " +
		JSON.stringify({
			fixtureId,
			structuralValid: true,
			trialOutcome:
				forcedTrialOutcome ?? (sdkMode ? "routing-completed" : "completed"),
			outcome:
				forcedTrialOutcome === "bounded-stop"
					? "active-unchanged"
					: "settled-unchanged",
			firstTarget: sdkMode
				? sdkSelectedTargets[0]
				: preferredFirstTarget
					? "specify"
					: "model",
			...(sdkMode ? { selectedTargets: sdkSelectedTargets } : {}),
			preferredFirstTarget,
			...(sdkMode
				? {
						controllerDecisionCount: 2,
						decisionRetryCount: 0,
						recoveryCount: 0,
						timeBudgetStopCount: 0,
					}
				: { routeCount: 1, routeAttemptCount: 2, toolCallCount: 2 }),
			toolCallAttemptCount: sdkMode ? 2 : 6,
			toolErrorCount: forcedTrialOutcome === "bounded-stop" ? 1 : 0,
		}) +
		"\n",
);
