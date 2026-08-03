const RESULT_PROTOCOL = "developer/v8-result";
const RUNTIME_STATES = new Set([
	"inactive",
	"blocked",
	"idle",
	"frame",
	"authorized",
]);

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if (
		actual.length !== wanted.length ||
		actual.some((key, index) => key !== wanted[index])
	) {
		throw new Error(`${label} has unexpected fields`);
	}
}

function nonEmptyString(value, label) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} must be a non-empty string`);
	}
	return value;
}

export function parseDeveloperRuntimeResultDetails(value) {
	if (!isRecord(value) || value.protocol !== RESULT_PROTOCOL) return null;
	exactKeys(
		value,
		["protocol", "workScopeId", "eventIds", "runtime"],
		"Developer v8 result details",
	);
	if (
		value.workScopeId !== null &&
		(typeof value.workScopeId !== "string" || value.workScopeId.length === 0)
	) {
		throw new Error("Developer v8 result workScopeId is invalid");
	}
	if (!Array.isArray(value.eventIds)) {
		throw new Error("Developer v8 result eventIds must be an array");
	}
	const eventIds = value.eventIds.map((eventId, index) =>
		nonEmptyString(eventId, `Developer v8 result eventIds[${index}]`),
	);
	if (!isRecord(value.runtime)) {
		throw new Error("Developer v8 result runtime must be an object");
	}
	exactKeys(
		value.runtime,
		["state", "reroutePending", "verificationPending"],
		"Developer v8 result runtime",
	);
	if (!RUNTIME_STATES.has(value.runtime.state)) {
		throw new Error("Developer v8 result runtime state is invalid");
	}
	if (
		typeof value.runtime.reroutePending !== "boolean" ||
		typeof value.runtime.verificationPending !== "boolean"
	) {
		throw new Error("Developer v8 result runtime debt flags must be boolean");
	}
	if (
		(value.runtime.state === "inactive" ||
			value.runtime.state === "blocked" ||
			value.runtime.state === "authorized") &&
		(value.runtime.reroutePending || value.runtime.verificationPending)
	) {
		throw new Error(
			`Developer v8 result ${value.runtime.state} state cannot carry landing debt`,
		);
	}
	return Object.freeze({
		protocol: RESULT_PROTOCOL,
		workScopeId: value.workScopeId,
		eventIds: Object.freeze(eventIds),
		runtime: Object.freeze({
			state: value.runtime.state,
			reroutePending: value.runtime.reroutePending,
			verificationPending: value.runtime.verificationPending,
		}),
	});
}

export function statusFromDeveloperEvents(events) {
	let latest;
	for (const event of events) {
		if (event.type !== "tool_execution_end" || event.isError) continue;
		const parsed = parseDeveloperRuntimeResultDetails(event.result?.details);
		if (parsed !== null) latest = parsed.runtime;
	}
	if (latest === undefined) {
		throw new Error(
			"Evaluation trace has no valid Developer v8 result details",
		);
	}
	return latest;
}

export function classifyEvalOutcome({ changes, status }) {
	const changed = changes.length > 0;
	const completionReady =
		status.state === "idle" &&
		status.reroutePending === false &&
		status.verificationPending === false;
	if (!changed) return completionReady ? "settled-unchanged" : "pending";
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
