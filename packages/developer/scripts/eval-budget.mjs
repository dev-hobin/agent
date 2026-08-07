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

export function fixtureBudgetStop({
	trace,
	fixture,
	elapsedMs,
	noProgressMs,
	fixtureTimeoutMs,
	noProgressTimeoutMs,
}) {
	const executions = trace.filter(
		(event) => event.type === "tool_execution_start",
	);
	const routeCount = executions.filter(
		(event) =>
			event.toolName === "developer_assess_capability" &&
			event.args?.status === "applicable",
	).length;
	const failedToolCount = trace.filter(
		(event) => event.type === "tool_execution_end" && event.isError,
	).length;
	const maxRoutes = fixture.maxRoutes ?? 6;
	const maxToolCalls = fixture.maxToolCalls ?? 50;
	const maxToolErrors = fixture.maxToolErrors ?? 8;

	if (routeCount > maxRoutes) {
		return {
			kind: "route-limit",
			observed: routeCount,
			limit: maxRoutes,
			message: `Capability routing budget ${routeCount}/${maxRoutes}`,
		};
	}
	if (executions.length > maxToolCalls) {
		return {
			kind: "tool-call-limit",
			observed: executions.length,
			limit: maxToolCalls,
			message: `tool-call budget ${executions.length}/${maxToolCalls}`,
		};
	}
	if (failedToolCount > maxToolErrors) {
		return {
			kind: "tool-error-limit",
			observed: failedToolCount,
			limit: maxToolErrors,
			message: `tool-error budget ${failedToolCount}/${maxToolErrors}`,
		};
	}
	if (elapsedMs > fixtureTimeoutMs) {
		return {
			kind: "wall-clock-limit",
			observed: elapsedMs,
			limit: fixtureTimeoutMs,
			message: `wall-clock budget ${elapsedMs}/${fixtureTimeoutMs}ms`,
		};
	}
	if (noProgressMs > noProgressTimeoutMs) {
		return {
			kind: "no-progress-limit",
			observed: noProgressMs,
			limit: noProgressTimeoutMs,
			message: `no-progress budget ${noProgressMs}/${noProgressTimeoutMs}ms`,
		};
	}
	return undefined;
}

export function fixtureBudgetFailure(input) {
	return fixtureBudgetStop(input)?.message;
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
		stop(trace) {
			const current = now();
			return fixtureBudgetStop({
				trace,
				fixture,
				elapsedMs: current - startedAt,
				noProgressMs: current - lastProgressAt,
				fixtureTimeoutMs,
				noProgressTimeoutMs,
			});
		},
		failure(trace) {
			return this.stop(trace)?.message;
		},
	};
}
