# Abstraction Review Calibration Cases

Use one case when a concrete candidate surface and caller contract exist but the
decision remains ambiguous. These examples calibrate review; they do not require
another reference and do not supply a missing candidate surface.

## Accepted Input And Contribution

Supply the candidate, current pressure, caller-visible promise, hidden detail,
representative case, counterexample, observable stop, and evidence gap. If these
facts cannot be stated locally, hand off rather than treating an example as the
missing design.

This member contributes one promise-matched calibration case and its falsifier.
It assumes the supplied surface is concrete, not that a particular field-card
format was completed. Its output is a calibrated keep/revise/split/reject/defer
judgment that remains subordinate to the candidate's own evidence.

## Example Selector

| Candidate pressure | Calibration |
| --- | --- |
| repeated movement exposed a helper | Retry Helper |
| additive provider or type extension | Provider Registry |
| representation should be hidden | Schedule Boundary |
| local state claims to simplify callers | Stateful Account |
| fluent operations claim closure | Query Builder |

## Retry Helper

```text
Candidate:
  withRetry(operation, shouldRetry, delayStrategy, maxAttempts)
Pressure:
  three request workflows already share attempt -> classify -> wait -> retry
Caller contract:
  execute one operation under explicit retry classification, delay, and limit
Hidden detail:
  loop mechanics, attempt bookkeeping, wait scheduling
Counterexample:
  payment retry requires idempotency and stale-response ownership not represented
  by the generic contract
Stop:
  old workflows become simple calls; process trace, total wait, cancellation, and
  failure are explicit; one transfer case fits without a new flag
Decision:
  keep only if variation roles and process observers are genuinely shared;
  otherwise split by product retry semantics
```

The helper is reviewable because its caller shape and three concrete sources
already exist. If only duplication exists and the interface must still be
invented, return to `signal` and `sketch`.

## Provider Registry

```text
Candidate:
  registerProvider(kind, { charge, refund })
Pressure:
  accepted providers repeatedly edit central dispatch
Promise:
  a provider can be added without changing old callers or provider modules
Counterexample:
  duplicate registration silently overwrites a provider based on load order
Stop:
  fake provider addition plus explicit duplicate, unsupported, visibility, and
  startup-failure behavior
Decision:
  revise-surface until precedence and failure ownership are public; reject when a
  local exhaustive conditional remains the cheaper truthful owner
```

## Schedule Boundary

```text
Candidate:
  Schedule.create(input), schedule.isActiveAt(epoch), schedule.summary()
Pressure:
  callers currently depend on tuple positions
Promise:
  callers rely on interval behavior, not representation fields
Counterexample:
  summary or membership is reimplemented outside the owner using raw fields
Stop:
  object-slot and private-tuple implementations satisfy the same caller contract;
  leak search finds no indexes, destructuring, or raw construction
Decision:
  keep if only supported operations are public; reject field-alias getters that
  hide no consequential choice
```

## Stateful Account

```text
Candidate:
  account.withdraw(amount)
Pressure:
  caller should not thread balance manually
Promise:
  local state is a sufficient summary of accepted transaction history
Counterexample:
  audit/replay or concurrent withdrawal is required but no event/order contract
  exists
Stop:
  owner, writers, identity, aliases, transition law, and concurrency scope match
  admitted cases
Decision:
  keep for bounded local history; revise-model when audit, replay, or concurrent
  histories are product meaning
```

## Query Builder

```text
Candidate:
  query.where(...).orderBy(...).limit(...).execute()
Pressure:
  query transformations should compose
Promise:
  builder operations remain in the Query world
Counterexample:
  execute is treated as another Query while performing I/O and returning rows
Stop:
  where/order/limit are Query -> Query; execute is an explicit finalizer with
  failure and resource semantics
Decision:
  keep after the finalizer boundary is visible
```

## Calibration Boundary

Do not select the example whose surface looks most similar. Select the one whose
**promise and falsifier** match. If no case matches, use the field card directly
or hand off; do not expand this file into another design catalog.

## Source Trace

These are source-independent Developer calibration cases. Their review promises
and counterexamples are derived from the sources traced in
Abstraction Candidate Review. No example is a copied source API.
