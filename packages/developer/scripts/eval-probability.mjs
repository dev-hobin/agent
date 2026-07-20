export function wilsonInterval(successes, trials) {
  if (trials === 0) return [0, 0];
  const z = 1.96;
  const probability = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const center = (probability + (z * z) / (2 * trials)) / denominator;
  const margin =
    (z * Math.sqrt((probability * (1 - probability)) / trials + (z * z) / (4 * trials * trials))) /
    denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function classifyLiveFailure(output) {
  if (/structurally inadmissible|omitted required semantic term|outside a direct route|mutation started before a direct route|outcome .* is not allowed/.test(output)) {
    return "inadmissible-result";
  }
  if (/route budget|tool-call budget|tool-error budget|wall-clock budget|no-progress budget/.test(output)) {
    return "budget-exhausted";
  }
  if (/route result was an error|judgment result was an error|Route ID mismatch|Unknown pending question ID/.test(output)) {
    return "protocol-attempt-rejected";
  }
  if (/requires PI_CODING_AGENT_DIR|Unknown DEVELOPER_EVAL_FIXTURE|Pi exited/.test(output)) {
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
    throw new Error(`Invalid live eval result: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

export function summarizeTrialObservations(fixtureId, observations) {
  const trials = observations.length;
  const accepted = observations.filter(
    (observation) =>
      observation.classification === "preferred" ||
      observation.classification === "admissible-non-preferred",
  ).length;
  const preferred = observations.filter((observation) => observation.classification === "preferred").length;
  const inadmissible = observations.filter((observation) => observation.classification === "inadmissible-result").length;
  return {
    fixtureId,
    trials,
    accepted,
    preferred,
    admissibleNonPreferred: accepted - preferred,
    inadmissible,
    acceptanceRate: trials > 0 ? accepted / trials : 0,
    acceptanceWilson95: wilsonInterval(accepted, trials),
    preferredRateAmongAccepted: accepted > 0 ? preferred / accepted : 0,
    preferredWilson95: wilsonInterval(preferred, accepted),
    observations,
  };
}
