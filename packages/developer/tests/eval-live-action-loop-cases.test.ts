import assert from "node:assert/strict";
import test from "node:test";

import { ACTION_LOOP_LIVE_CASES } from "../evals/action-loop-live-cases.mjs";

test("live Action Loop fixtures cover independent safety pressures", () => {
	assert.equal(ACTION_LOOP_LIVE_CASES.length, 7);
	assert.equal(
		new Set(ACTION_LOOP_LIVE_CASES.map((fixture) => fixture.id)).size,
		ACTION_LOOP_LIVE_CASES.length,
	);
	assert.deepEqual(
		new Set(ACTION_LOOP_LIVE_CASES.map((fixture) => fixture.id)),
		new Set([
			"exact-write-multi-need",
			"already-satisfied-no-action",
			"precondition-mismatch",
			"missing-target",
			"conflicting-outcome",
			"durable-external-wait",
			"bounded-collateral-scope",
		]),
	);
	for (const fixture of ACTION_LOOP_LIVE_CASES) {
		assert.ok(fixture.description.trim());
		assert.ok(fixture.prompt.trim());
		assert.ok(["required", "forbidden"].includes(fixture.completion));
		assert.ok(fixture.allowedReplayStatuses.length > 0);
		assert.equal(
			new Set(fixture.allowedChangedPaths).size,
			fixture.allowedChangedPaths.length,
		);
		if (fixture.completion === "forbidden") {
			assert.equal(fixture.allowedReplayStatuses.includes("completed"), false);
		}
	}
});

test("nonterminal safety fixtures forbid controlled mutation", () => {
	const nonterminal = ACTION_LOOP_LIVE_CASES.filter(
		(fixture) => fixture.completion === "forbidden",
	);
	assert.equal(nonterminal.length, 4);
	for (const fixture of nonterminal) {
		assert.deepEqual(fixture.allowedChangedPaths, []);
		assert.equal(fixture.maximumActionClearances, 0);
		const expectedEntries: ReadonlyArray<
			readonly [string, string | null | undefined]
		> = Object.entries(fixture.expectedFiles);
		for (const [path, initial] of Object.entries(fixture.files)) {
			const expectedEntry:
				| readonly [string, string | null | undefined]
				| undefined = expectedEntries.find(
				([expectedPath]) => expectedPath === path,
			);
			assert.ok(expectedEntry);
			assert.equal(expectedEntry[1], initial);
		}
	}
});
