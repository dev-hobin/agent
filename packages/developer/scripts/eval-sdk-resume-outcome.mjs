const RECOVERY_REQUIRED_PATTERNS = [
	/Action Loop session replay is unavailable/i,
	/cannot resume unavailable Action Loop state/i,
];

export function isSdkReplayRecoveryRequired(text) {
	return RECOVERY_REQUIRED_PATTERNS.some((pattern) => pattern.test(text));
}

function textContent(result) {
	return (result?.content ?? [])
		.filter((item) => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

const PRIMARY_CONTROLLER_TOOL =
	"developer_progress_action_loop_with_sdk";

export function repeatedPrimaryResultWithoutCheckpoint(trace, threshold = 8) {
	let repeatedStatus;
	let repetitions = 0;
	for (const event of trace) {
		if (event.type === "entry_appended" && event.entry?.data?.kind) {
			repeatedStatus = undefined;
			repetitions = 0;
			continue;
		}
		if (
			event.type !== "tool_execution_end" ||
			event.toolName !== PRIMARY_CONTROLLER_TOOL ||
			event.isError
		) {
			continue;
		}
		const status = event.result?.details?.status;
		if (typeof status !== "string") continue;
		if (status === repeatedStatus) repetitions += 1;
		else {
			repeatedStatus = status;
			repetitions = 1;
		}
		if (repetitions >= threshold) return status;
	}
	return undefined;
}

export function summarizeSdkResumeRun(index, trace, waitResult) {
	const toolCalls = trace
		.filter((event) => event.type === "tool_execution_start")
		.map((event) => event.toolName);
	const protocolEnds = trace
		.filter(
			(event) =>
				event.type === "tool_execution_end" &&
				event.toolName === PRIMARY_CONTROLLER_TOOL,
		)
		.map((event) => ({
			isError: event.isError,
			text: textContent(event.result).slice(0, 320),
			details: event.result?.details,
		}));
	const toolErrorSummaries = new Map();
	for (const event of trace.filter(
		(candidate) => candidate.type === "tool_execution_end" && candidate.isError,
	)) {
		const fullText = textContent(event.result);
		const contractText =
			fullText.split("\n\nReceived arguments:")[0] || fullText;
		const key = `${event.toolName}\n${contractText}`;
		const current = toolErrorSummaries.get(key);
		toolErrorSummaries.set(key, {
			toolName: event.toolName,
			text: contractText.slice(0, 500),
			count: (current?.count ?? 0) + 1,
			flattenedArguments: /"[^"\n]+\[\d+\](?:\.[^"\n]+)?"/.test(fullText),
		});
	}
	const checkpointKinds = trace
		.filter((event) => event.type === "entry_appended")
		.map((event) => event.entry?.data?.kind)
		.filter(Boolean);
	const agentErrors = trace
		.filter(
			(event) =>
				event.type === "message_end" &&
				event.message?.role === "assistant" &&
				event.message?.stopReason === "error",
		)
		.map((event) =>
			String(event.message.errorMessage || "unknown agent error"),
		);
	return {
		index,
		wait: waitResult,
		toolCalls,
		protocolEnds,
		checkpointKinds,
		agentErrors,
		toolErrors: [...toolErrorSummaries.values()],
	};
}

export function sdkResumeBudgetStop(runs, maximumRuns) {
	if (runs.length < maximumRuns) return undefined;
	const completed = runs.some((run) =>
		run.protocolEnds.some(
			(end) => end.details?.status === "completed" && !end.isError,
		),
	);
	return completed ? undefined : "evaluation-run-budget-exhausted";
}

export function classifySdkResumeRun(run) {
	const recoveryErrors = run.toolErrors.filter((error) =>
		isSdkReplayRecoveryRequired(error.text),
	);
	if (recoveryErrors.length > 0) {
		return {
			status: "recovery-required",
			reason: recoveryErrors
				.map((error) => `${error.toolName} (${error.count}): ${error.text}`)
				.join(" | "),
		};
	}
	if (run.wait.status === "usability-stalled") {
		return {
			status: "usability-stalled",
			reason: run.wait.reason,
		};
	}
	if (run.agentErrors.length > 0) {
		return {
			status: "provider-blocked",
			reason: run.agentErrors.join(" | "),
		};
	}
	if (run.toolCalls.includes(PRIMARY_CONTROLLER_TOOL)) {
		return { status: "continue" };
	}
	if (run.toolErrors.some((error) => error.flattenedArguments)) {
		return {
			status: "provider-blocked",
			reason: run.toolErrors
				.map((error) => `${error.toolName} (${error.count}): ${error.text}`)
				.join(" | "),
		};
	}
	if (run.toolErrors.length > 0) {
		return { status: "usability-stalled", reason: "tool-contract-rejected" };
	}
	return {
		status: "usability-stalled",
		reason: "primary-controller-not-invoked",
	};
}
