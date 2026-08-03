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

const forbiddenLocalWorkflowTools = new Set([
	"mcp",
	"fetch_content",
	"source_check",
	"web_search",
]);

function executionFingerprint(event) {
	return `${event.toolName}:${JSON.stringify(event.args ?? null)}`;
}

export function workflowEfficiencyFailure({ trace, fixture }) {
	const executions = trace.filter(
		(event) => event.type === "tool_execution_start",
	);
	const forbidden = new Set([
		...forbiddenLocalWorkflowTools,
		...(fixture.forbiddenToolNames ?? []),
	]);
	const forbiddenExecution = executions.find((event) =>
		forbidden.has(event.toolName),
	);
	if (forbiddenExecution) {
		return `forbidden local-workflow tool ${forbiddenExecution.toolName}`;
	}
	const selfSessionRead = executions.find((event) => {
		const serialized = JSON.stringify(event.args ?? {});
		return (
			/\.pi\/agent\/sessions|PI_SESSION_FILE|sessions\/.*\.jsonl/iu.test(
				serialized,
			) ||
			(event.toolName === "bash" &&
				/\b(?:curl|wget)\b|https?:\/\//iu.test(serialized))
		);
	});
	if (selfSessionRead) {
		return `forbidden session/network escape via ${selfSessionRead.toolName}`;
	}
	const developerInternalsRead = executions.find((event) => {
		if (event.toolName !== "read") return false;
		const serialized = JSON.stringify(event.args ?? {});
		return /(?:node_modules\/@hobin\/developer|packages\/developer\/(?:extensions|src))\//u.test(
			serialized,
		);
	});
	if (developerInternalsRead && fixture.allowDeveloperInternalsRead !== true) {
		return "forbidden Developer implementation self-inspection";
	}
	const placeholder = executions.find((event) => {
		if (
			event.toolName !== "developer_open_judgment" ||
			!("question" in (event.args ?? {}))
		) {
			return false;
		}
		const question = String(event.args.question ?? "").trim();
		const obligations = Array.isArray(event.args?.obligations)
			? event.args.obligations
			: [];
		return (
			question.length < 8 ||
			/^conclude current frame\??$/iu.test(question) ||
			obligations.some(
				(obligation) => String(obligation?.statement ?? "").trim().length < 8,
			)
		);
	});
	if (placeholder) return "placeholder Developer frame";

	const failedIds = new Set(
		trace
			.filter(
				(event) =>
					event.type === "tool_execution_end" && event.isError === true,
			)
			.map((event) => event.toolCallId),
	);
	const failedFingerprints = new Set();
	for (const execution of executions) {
		if (!failedIds.has(execution.toolCallId)) continue;
		const fingerprint = executionFingerprint(execution);
		if (failedFingerprints.has(fingerprint)) {
			return `repeated failed call ${execution.toolName}`;
		}
		failedFingerprints.add(fingerprint);
	}
	const readPaths = new Set();
	for (const execution of executions) {
		if (execution.toolName !== "read") continue;
		const path = String(execution.args?.path ?? "");
		if (!path) continue;
		if (readPaths.has(path) && fixture.allowRepeatedReadPaths !== true) {
			return `duplicate file read ${path}`;
		}
		readPaths.add(path);
	}
	return undefined;
}

export function fixtureBudgetFailure({
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
	const decisionCount = executions.filter((event) =>
		["developer_open_judgment", "developer_authorize_change"].includes(
			event.toolName,
		),
	).length;
	const failedToolCount = trace.filter(
		(event) => event.type === "tool_execution_end" && event.isError,
	).length;
	const workflowFailure = workflowEfficiencyFailure({ trace, fixture });
	if (workflowFailure) return workflowFailure;
	const developerCallCount = executions.filter((event) =>
		String(event.toolName ?? "").startsWith("developer_"),
	).length;
	const maxDecisions = fixture.maxDecisions ?? 6;
	const maxToolCalls = fixture.maxToolCalls ?? 30;
	const maxDeveloperCalls = fixture.maxDeveloperCalls ?? 10;
	const maxToolErrors = fixture.maxToolErrors ?? 8;

	if (decisionCount > maxDecisions)
		return `decision budget ${decisionCount}/${maxDecisions}`;
	if (developerCallCount > maxDeveloperCalls) {
		return `Developer-call budget ${developerCallCount}/${maxDeveloperCalls}`;
	}
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
