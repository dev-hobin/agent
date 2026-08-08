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
	return semanticStatus(statusLabel ?? "unknown");
}
