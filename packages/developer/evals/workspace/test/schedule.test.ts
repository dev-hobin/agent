import assert from "node:assert/strict";
import test from "node:test";

import { isActiveAt, scheduleSummary, type Schedule } from "../src/schedule.ts";

const schedule: Schedule = ["UTC", 100, 200];

test("the representation-barrier fixture exposes the accepted tuple and callers", () => {
	assert.equal(isActiveAt(schedule, 150), true);
	assert.equal(isActiveAt(schedule, 200), false);
	assert.equal(scheduleSummary(schedule), "UTC:100-200");
});
