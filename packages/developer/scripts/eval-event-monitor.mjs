import { createFixtureBudgetMonitor } from "./eval-budget.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";

export function createEvalEventMonitor({
  fixture,
  fixtureTimeoutMs,
  noProgressTimeoutMs,
  now = Date.now,
  onFailure,
}) {
  const events = [];
  const budget = createFixtureBudgetMonitor({
    fixture,
    fixtureTimeoutMs,
    noProgressTimeoutMs,
    now,
  });
  let failure;

  const fail = (error) => {
    if (failure) return;
    failure = error;
    Object.defineProperty(error, "evalEvents", {
      value: [...events],
      enumerable: false,
    });
    onFailure?.(error);
  };
  const check = () => {
    const reason = budget.failure(events);
    if (!reason) return undefined;
    const recent = events.slice(-20).map((event) => event.type).join(", ") || "none";
    const error = new Error(`${fixture.id}: ${reason}; recent events: ${recent}`);
    fail(error);
    return error;
  };
  const decoder = createJsonlDecoder({
    onValue(event) {
      budget.observe([event]);
      if (event.type !== "message_update") events.push(event);
      check();
    },
    onError(error, record) {
      fail(
        new Error(
          `${fixture.id}: invalid JSON event: ${error instanceof Error ? error.message : String(error)}; record: ${record.slice(0, 200)}`,
          { cause: error },
        ),
      );
    },
  });

  return {
    events,
    push(chunk) {
      if (!failure) decoder.push(chunk);
    },
    end() {
      if (!failure) decoder.end();
    },
    check,
    get failure() {
      return failure;
    },
  };
}
