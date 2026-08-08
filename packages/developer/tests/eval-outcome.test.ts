import assert from "node:assert/strict";
import test from "node:test";

import { parseDeveloperStatus } from "../scripts/eval-outcome.mjs";

test("Developer status parsing preserves terminal and held protocol states", () => {
	assert.deepEqual(parseDeveloperStatus("developer · Completed"), {
		protocol: "completed",
		active: "none",
		checkpoint: "ready",
		verification: "current",
		pending: "none",
	});
	assert.deepEqual(parseDeveloperStatus("developer · Waiting\nOutcome · Publish"), {
		protocol: "waiting",
		active: "none",
		checkpoint: "owned",
		verification: "unsettled",
		pending: "waiting",
	});
	assert.equal(parseDeveloperStatus("unrecognized").protocol, "unknown");
});
