import { activationChanged, parseDeveloperEvent } from "../src/protocol.ts";
import {
	applyDeveloperEvent,
	developerProtocolState,
	initialDeveloperState,
} from "../src/transition.ts";

export function parseDeveloperStatus(message) {
	const lines = String(message).split("\n");
	const summary = lines[0] ?? "";
	const field = (name) =>
		lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2);
	const pendingCount = field("pending questions");
	return {
		protocol: summary.split(" · ").at(-1) ?? "unknown",
		active: field("active") ?? "unknown",
		checkpoint: field("checkpoint") ?? field("reroute") ?? "unknown",
		verification: field("verification") ?? "unknown",
		pending:
			pendingCount === "0"
				? "none"
				: (pendingCount ?? field("pending") ?? "unknown"),
	};
}

export function statusFromDeveloperEvents(events) {
	let state = applyDeveloperEvent(
		initialDeveloperState(),
		activationChanged(true),
	);
	for (const event of events) {
		if (event.type !== "tool_execution_end" || event.isError) continue;
		const details = event.result?.details;
		let parsed;
		try {
			parsed = parseDeveloperEvent(details);
		} catch {
			continue;
		}
		state = applyDeveloperEvent(state, parsed);
	}
	return {
		protocol: developerProtocolState(state),
		active:
			state.activeWork?.kind === "active-judgment"
				? state.activeWork.judgmentId
				: state.activeWork?.kind === "authorized-change"
					? state.activeWork.authorizationId
					: "none",
		checkpoint: state.obligations.rerouteRequired
			? "reroute required"
			: "ready",
		verification: state.obligations.verificationRequired
			? "required"
			: "current",
		pending:
			state.pendingQuestions.length > 0
				? state.pendingQuestions.map((question) => question.id).join(" | ")
				: "none",
	};
}

export function classifyEvalOutcome({ changes, status }) {
	const changed = changes.length > 0;
	const pendingProtocols = new Set([
		"blocked",
		"needs-answer",
		"needs-evidence",
		"needs-judgment-conclusion",
		"authorized-change",
	]);
	const pending =
		status.pending === "unknown"
			? pendingProtocols.has(status.protocol)
			: status.pending !== "none";
	if (!changed) return pending ? "pending" : "settled-unchanged";

	const explicitCompletionReady =
		status.active === "none" &&
		status.checkpoint === "ready" &&
		status.verification === "current" &&
		!pending;
	const completionReady = explicitCompletionReady || status.protocol === "idle";
	return completionReady ? "changed-verified" : "changed-paused";
}

export function assertAllowedOutcome(fixture, outcome) {
	const allowed = fixture.allowedOutcomes ?? [];
	if (!allowed.includes(outcome)) {
		throw new Error(
			`${fixture.id}: outcome ${outcome} is not allowed; expected one of ${allowed.join(", ") || "none"}`,
		);
	}
}
