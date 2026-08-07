import assertModule from "node:assert";
import test from "node:test";

import { createEvalEventMonitor } from "../scripts/eval-event-monitor.mjs";

const assert: typeof assertModule.strict = assertModule.strict;
const fixture = {
	id: "stream",
	maxRoutes: 1,
	maxToolCalls: 2,
	maxToolErrors: 1,
};

function createMonitor(
	now: () => number,
	stops: Array<{ message: string }>,
	failures: Error[] = [],
) {
	return createEvalEventMonitor({
		fixture,
		fixtureTimeoutMs: 1_000,
		noProgressTimeoutMs: 50,
		now,
		onStop(stop: { message: string }) {
			stops.push(stop);
		},
		onFailure(error: Error) {
			failures.push(error);
		},
	});
}

test("JSON event monitoring is deterministic across chunking and drops token updates", () => {
	let current = 0;
	const failures: Error[] = [];
	const monitor = createMonitor(() => current, failures);
	monitor.push(
		'{"type":"message_update","delta":"a"}\n{"type":"tool_execution_',
	);
	current = 10;
	monitor.push('start","toolName":"read"}\n');
	monitor.end();

	assert.deepEqual(monitor.events, [
		{ type: "tool_execution_start", toolName: "read" },
	]);
	assert.deepEqual(failures, []);
});

test("JSON event monitoring reports structured budget stops without failures", () => {
	let current = 0;
	const stops: Array<{ message: string }> = [];
	const monitor = createMonitor(() => current, stops);
	monitor.push(
		[
			{ type: "tool_execution_start", toolName: "read" },
			{ type: "tool_execution_start", toolName: "read" },
			{ type: "tool_execution_start", toolName: "read" },
		]
			.map((event) => JSON.stringify(event))
			.join("\n") + "\n",
	);
	assert.match(stops[0]?.message ?? "", /tool-call budget 3\/2/);
	assert.equal(monitor.failure, undefined);

	current = 0;
	const stalledStops: Array<{ message: string }> = [];
	const stalled = createMonitor(() => current, stalledStops);
	current = 51;
	stalled.check();
	assert.match(stalledStops[0]?.message ?? "", /no-progress budget 51\/50ms/);
});

test("JSON event monitoring turns malformed records into bounded failures", () => {
	const stops: Array<{ message: string }> = [];
	const failures: Error[] = [];
	const monitor = createMonitor(() => 0, stops, failures);
	monitor.push('{"type":broken}\n');
	assert.match(failures[0]?.message ?? "", /invalid JSON event/);
	assert.match(failures[0]?.message ?? "", /record:/);
});
