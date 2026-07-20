import assertModule from "node:assert";
import test from "node:test";

import {
  containsProtocolProgress,
  createFixtureBudgetMonitor,
  fixtureBudgetFailure,
} from "../scripts/eval-budget.mjs";

const assert: typeof assertModule.strict = assertModule.strict;
const fixture = { id: "bounded", maxRoutes: 2, maxToolCalls: 4, maxToolErrors: 1 };
const budget = (trace: unknown[], elapsedMs = 10, noProgressMs = 10) =>
  fixtureBudgetFailure({
    trace,
    fixture,
    elapsedMs,
    noProgressMs,
    fixtureTimeoutMs: 100,
    noProgressTimeoutMs: 50,
  });

test("eval progress ignores token streaming and recognizes protocol movement", () => {
  assert.equal(containsProtocolProgress([{ type: "message_update" }]), false);
  assert.equal(containsProtocolProgress([{ type: "tool_execution_start" }]), true);
  assert.equal(containsProtocolProgress([{ type: "agent_settled" }]), true);
});

test("eval budgets stop route, tool, error, wall-clock, and no-progress loops", () => {
  const routes = Array.from({ length: 3 }, (_, index) => ({
    type: "tool_execution_start",
    toolName: "developer_route_question",
    toolCallId: `route:${index}`,
  }));
  assert.equal(budget(routes), "route budget 3/2");

  const calls = Array.from({ length: 5 }, (_, index) => ({
    type: "tool_execution_start",
    toolName: "read",
    toolCallId: `read:${index}`,
  }));
  assert.equal(budget(calls), "tool-call budget 5/4");

  const failures = Array.from({ length: 2 }, () => ({ type: "tool_execution_end", isError: true }));
  assert.equal(budget(failures), "tool-error budget 2/1");
  assert.equal(budget([], 101, 10), "wall-clock budget 101/100ms");
  assert.equal(budget([], 10, 51), "no-progress budget 51/50ms");
  assert.equal(budget([]), undefined);
});

test("the shared budget monitor ignores token streaming and resets only on protocol progress", () => {
  let current = 0;
  const monitor = createFixtureBudgetMonitor({
    fixture,
    fixtureTimeoutMs: 1_000,
    noProgressTimeoutMs: 50,
    now: () => current,
  });

  current = 40;
  monitor.observe([{ type: "message_update" }]);
  current = 51;
  assert.equal(monitor.failure([]), "no-progress budget 51/50ms");

  current = 60;
  const progressing = createFixtureBudgetMonitor({
    fixture,
    fixtureTimeoutMs: 1_000,
    noProgressTimeoutMs: 50,
    now: () => current,
  });
  current = 100;
  progressing.observe([{ type: "tool_execution_start" }]);
  current = 145;
  assert.equal(progressing.failure([]), undefined);
});
