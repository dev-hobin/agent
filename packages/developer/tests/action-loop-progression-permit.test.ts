import assert from "node:assert/strict";
import test from "node:test";

import {
	consumeActionLoopProgressionPermit,
	createActionLoopProgressionPermitState,
	openActionLoopProgressionPermit,
} from "../extensions/action-loop-progression-permit.ts";

test("progression runs at most once per trusted evidence boundary", () => {
	const initial = createActionLoopProgressionPermitState();
	const first = consumeActionLoopProgressionPermit(initial);
	assert.equal(first.status, "accepted");
	if (first.status !== "accepted") return;
	assert.equal(consumeActionLoopProgressionPermit(first.state).status, "refused");

	const afterObservedChange = openActionLoopProgressionPermit(first.state);
	const second = consumeActionLoopProgressionPermit(afterObservedChange);
	assert.equal(second.status, "accepted");
	if (second.status !== "accepted") return;
	assert.equal(consumeActionLoopProgressionPermit(second.state).status, "refused");
});

test("opening a new boundary does not consume it", () => {
	const opened = openActionLoopProgressionPermit(
		openActionLoopProgressionPermit(createActionLoopProgressionPermitState()),
	);
	assert.deepEqual(opened, { current: 2, lastUsed: -1 });
	const consumed = consumeActionLoopProgressionPermit(opened);
	assert.equal(consumed.status, "accepted");
	if (consumed.status !== "accepted") return;
	assert.deepEqual(consumed.state, { current: 2, lastUsed: 2 });
});
