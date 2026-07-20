import {
  PROTOCOL,
  applyDeveloperEvent,
  initialState,
  protocolState,
} from "../extensions/state.ts";

export function parseDeveloperStatus(message) {
  const lines = String(message).split("\n");
  const summary = lines[0] ?? "";
  const field = (name) => lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2);
  return {
    protocol: summary.split(" · ").at(-1) ?? "unknown",
    active: field("active") ?? "unknown",
    checkpoint: field("checkpoint") ?? "unknown",
    verification: field("verification") ?? "unknown",
    pending: field("pending") ?? "unknown",
  };
}

export function statusFromDeveloperEvents(events, mode) {
  let state = applyDeveloperEvent(initialState(), {
    protocol: PROTOCOL,
    kind: "mode",
    mode,
  });
  for (const event of events) {
    if (event.type !== "tool_execution_end" || event.isError) continue;
    const details = event.result?.details;
    if (!details || (details.kind !== "route" && details.kind !== "judgment")) continue;
    state = applyDeveloperEvent(state, details);
  }
  return {
    protocol: protocolState(state),
    active: state.activeRoute?.routeId ?? "none",
    checkpoint: state.rerouteRequired ? "reroute required" : "ready",
    verification: state.verificationRequired ? "required" : "current",
    pending: state.pendingQuestions.length > 0
      ? state.pendingQuestions.map((question) => question.id).join(" | ")
      : "none",
  };
}

export function classifyEvalOutcome({ changes, status }) {
  const changed = changes.length > 0;
  const pendingProtocols = new Set(["blocked", "needs-answer", "needs-evidence"]);
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
