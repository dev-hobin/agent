export function wilsonInterval(successes, trials) {
	if (trials === 0) return [0, 0];
	const z = 1.96;
	const probability = successes / trials;
	const denominator = 1 + (z * z) / trials;
	const center = (probability + (z * z) / (2 * trials)) / denominator;
	const margin =
		(z *
			Math.sqrt(
				(probability * (1 - probability)) / trials +
					(z * z) / (4 * trials * trials),
			)) /
		denominator;
	return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function classifyLiveFailure(output) {
	if (
		/structurally inadmissible|omitted required semantic term|without an exact canonical Action Clearance|mutation started before canonical Action Clearance|Effect was not settled|outcome .* is not allowed/.test(
			output,
		)
	) {
		return "inadmissible-result";
	}
	if (
		/Capability routing budget|tool-call budget|tool-error budget|wall-clock budget|no-progress budget/.test(
			output,
		)
	) {
		return "bounded-stop";
	}
	if (
		/removed compatibility tool|no canonical Work Case|no canonical Judgment|no applicable Capability|canonical sealed Reference was not loaded/.test(
			output,
		)
	) {
		return "protocol-attempt-rejected";
	}
	if (
		/requires PI_CODING_AGENT_DIR|Unknown DEVELOPER_EVAL_FIXTURE|Pi exited/.test(
			output,
		)
	) {
		return "blocked-environment";
	}
	return "runner-failure";
}

export function parseEvalResult(output) {
	const line = output
		.split(/\r?\n/)
		.find((candidate) => candidate.startsWith("DEVELOPER_EVAL_RESULT "));
	if (!line) return undefined;
	try {
		return JSON.parse(line.slice("DEVELOPER_EVAL_RESULT ".length));
	} catch (error) {
		throw new Error(
			`Invalid live eval result: ${error instanceof Error ? error.message : String(error)}`,
			{
				cause: error,
			},
		);
	}
}

function median(values) {
	if (values.length === 0) return null;
	const ordered = [...values].sort((left, right) => left - right);
	const middle = Math.floor(ordered.length / 2);
	return ordered.length % 2 === 0
		? (ordered[middle - 1] + ordered[middle]) / 2
		: ordered[middle];
}

export function summarizeTrialObservations(fixtureId, observations) {
	const trials = observations.length;
	const accepted = observations.filter(
		(observation) =>
			observation.classification === "preferred" ||
			observation.classification === "admissible-non-preferred",
	).length;
	const preferred = observations.filter(
		(observation) => observation.classification === "preferred",
	).length;
	const count = (classification) =>
		observations.filter(
			(observation) => observation.classification === classification,
		).length;
	const inadmissible = count("inadmissible-result");
	const boundedStops = count("bounded-stop");
	const activeIncomplete = count("active-incomplete");
	const idleIncomplete = count("idle-incomplete");
	const blockedEnvironment = count("blocked-environment");
	const runnerFailures = count("runner-failure");
	const numeric = (field) =>
		observations
			.map((observation) => observation[field])
			.filter((value) => Number.isFinite(value));
	return {
		fixtureId,
		trials,
		accepted,
		preferred,
		admissibleNonPreferred: accepted - preferred,
		inadmissible,
		boundedStops,
		activeIncomplete,
		idleIncomplete,
		blockedEnvironment,
		runnerFailures,
		acceptanceRate: trials > 0 ? accepted / trials : 0,
		acceptanceWilson95: wilsonInterval(accepted, trials),
		preferredRateAmongAccepted: accepted > 0 ? preferred / accepted : 0,
		preferredWilson95: wilsonInterval(preferred, accepted),
		medianToolCallAttempts: median(numeric("toolCallAttemptCount")),
		medianRouteAttempts: median(numeric("routeAttemptCount")),
		medianToolErrors: median(numeric("toolErrorCount")),
		observations,
	};
}
