const protocolProgressEvents = new Set([
  "tool_execution_start",
  "tool_execution_end",
  "turn_end",
  "agent_end",
  "agent_settled",
]);

export function containsProtocolProgress(events) {
  return events.some((event) => protocolProgressEvents.has(event.type));
}

export function fixtureBudgetFailure({
  trace,
  fixture,
  elapsedMs,
  noProgressMs,
  fixtureTimeoutMs,
  noProgressTimeoutMs,
}) {
  const executions = trace.filter((event) => event.type === "tool_execution_start");
  const routeCount = executions.filter(
    (event) => event.toolName === "developer_route_question",
  ).length;
  const failedToolCount = trace.filter(
    (event) => event.type === "tool_execution_end" && event.isError,
  ).length;
  const maxRoutes = fixture.maxRoutes ?? 6;
  const maxToolCalls = fixture.maxToolCalls ?? 50;
  const maxToolErrors = fixture.maxToolErrors ?? 8;

  if (routeCount > maxRoutes) return `route budget ${routeCount}/${maxRoutes}`;
  if (executions.length > maxToolCalls) {
    return `tool-call budget ${executions.length}/${maxToolCalls}`;
  }
  if (failedToolCount > maxToolErrors) {
    return `tool-error budget ${failedToolCount}/${maxToolErrors}`;
  }
  if (elapsedMs > fixtureTimeoutMs) {
    return `wall-clock budget ${elapsedMs}/${fixtureTimeoutMs}ms`;
  }
  if (noProgressMs > noProgressTimeoutMs) {
    return `no-progress budget ${noProgressMs}/${noProgressTimeoutMs}ms`;
  }
  return undefined;
}

export function createFixtureBudgetMonitor({
  fixture,
  fixtureTimeoutMs,
  noProgressTimeoutMs,
  now = Date.now,
}) {
  const startedAt = now();
  let lastProgressAt = startedAt;

  return {
    observe(events) {
      if (containsProtocolProgress(events)) lastProgressAt = now();
    },
    failure(trace) {
      const current = now();
      return fixtureBudgetFailure({
        trace,
        fixture,
        elapsedMs: current - startedAt,
        noProgressMs: current - lastProgressAt,
        fixtureTimeoutMs,
        noProgressTimeoutMs,
      });
    },
  };
}
