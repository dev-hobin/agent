export function collectActionLoopEventKinds(branch, extractReplayEvent) {
	const eventKinds = [];
	const eventErrors = [];
	for (const entry of branch) {
		const extracted = extractReplayEvent(entry);
		if (extracted.status === "absent") continue;
		if (extracted.status === "invalid") {
			eventErrors.push("Claimed Action Loop replay event is invalid");
			continue;
		}
		eventKinds.push(extracted.event.kind);
	}
	return { eventKinds, eventErrors };
}
