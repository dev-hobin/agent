function textContent(result) {
	return (result?.content ?? [])
		.filter((item) => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

export function summarizeSdkResumeRun(index, trace, waitResult) {
	const toolCalls = trace
		.filter((event) => event.type === "tool_execution_start")
		.map((event) => event.toolName);
	const protocolEnds = trace
		.filter(
			(event) =>
				event.type === "tool_execution_end" &&
				event.toolName === "developer_progress_action_loop_with_sdk",
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

export function classifySdkResumeRun(run) {
	if (run.agentErrors.length > 0) {
		return {
			status: "provider-blocked",
			reason: run.agentErrors.join(" | "),
		};
	}
	if (run.toolCalls.includes("developer_progress_action_loop_with_sdk")) {
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
