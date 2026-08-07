function semanticStatus(label) {
	const normalized = String(label).trim().toLowerCase();
	return {
		protocol: normalized || "unknown",
		active: normalized === "active" ? "active" : "none",
		checkpoint:
			normalized === "completed" || normalized === "idle" ? "ready" : "owned",
		verification: normalized === "completed" ? "current" : "unsettled",
		pending: ["paused", "waiting", "blocked", "unavailable"].includes(
			normalized,
		)
			? normalized
			: "none",
	};
}

export function parseDeveloperStatus(message) {
	const lines = String(message).split("\n");
	const first = lines[0] ?? "";
	const statusLabel = first.match(/^developer\s*·\s*(.+)$/i)?.[1];
	if (statusLabel) return semanticStatus(statusLabel);
	return semanticStatus("unknown");
}

function replayEventFrom(event) {
	if (event.type !== "tool_execution_end" || event.isError) return undefined;
	const details = event.result?.details;
	return details?.replayEvent ?? details;
}

export function statusFromDeveloperEvents(events) {
	let status = semanticStatus("idle");
	for (const event of events) {
		const replay = replayEventFrom(event);
		if (!replay || typeof replay.kind !== "string") continue;
		switch (replay.kind) {
			case "work-case-completed":
				status = semanticStatus("completed");
				break;
			case "work-case-paused":
				status = semanticStatus("paused");
				break;
			case "work-case-waiting":
				status = semanticStatus("waiting");
				break;
			case "work-case-blocked":
				status = semanticStatus("blocked");
				break;
			case "paused-work-case-resumed":
			case "waiting-work-case-resumed":
			case "blocked-work-case-resumed":
			case "work-case-opened":
			case "judgment-opened":
			case "capability-assessed":
			case "references-selected":
			case "unstructured-context-sealed":
			case "contribution-accepted":
			case "host-contribution-accepted":
			case "coverage-assessed":
			case "judgment-concluded":
			case "action-cleared":
			case "effect-begun":
			case "effect-observed":
			case "effect-settled":
			case "effect-remediated":
				status = semanticStatus("active");
				break;
		}
	}
	return status;
}

export function classifyEvalOutcome({ changes, status }) {
	const changed = changes.length > 0;
	const pending = status.pending !== "none";
	if (!changed) return pending ? "pending" : "settled-unchanged";
	return status.protocol === "completed"
		? "changed-verified"
		: "changed-paused";
}

export function assertAllowedOutcome(fixture, outcome) {
	const allowed = fixture.allowedOutcomes ?? [];
	if (!allowed.includes(outcome)) {
		throw new Error(
			`${fixture.id}: outcome ${outcome} is not allowed; expected one of ${allowed.join(", ") || "none"}`,
		);
	}
}
