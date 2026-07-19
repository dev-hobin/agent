import assert from "node:assert/strict";
import test from "node:test";

import {
  createContract,
  normalizeCreateSchedule,
  normalizeUpdateSchedule,
} from "../src/contracts.ts";

test("creates a contract without a schedule", () => {
  assert.deepEqual(createContract("Example"), { title: "Example", schedule: null });
});

test("keeps omitted update schedules unchanged", () => {
  assert.equal(normalizeUpdateSchedule(undefined), undefined);
});

test("normalizes explicit empty schedules to null", () => {
  assert.equal(normalizeCreateSchedule({}), null);
  assert.equal(normalizeUpdateSchedule({}), null);
});
