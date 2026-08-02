# State, History, And Order

Use this reference when identical explicit inputs can produce different outcomes
because of prior interactions, identity, aliases, event order, or retained
history. It is self-contained and does not require another boundary reference.

## Accepted Boundary Context

Supply the caller purpose, admitted states and events, relevant prior
interactions, identity and alias facts, known stale/duplicate/reordered/retried
cases, persistence or replay needs, and environmental concurrency assumptions.
Unsettled transition policy remains a model gap.

This member contributes the sufficient history summary, owner and writers,
transition and unchanged-field laws, order/atomicity scope, stream or log
meaning, alternative representation, and checks.

## State Is A History Summary

```text
account.withdraw(40) -> Accepted
account.withdraw(40) -> Rejected
```

If history explains the difference, fill:

```text
required history
sufficient current summary
owner and writers
identity and aliases
transition law
persistence or replay boundary
```

Do not store the whole past when a sufficient summary preserves all required
behavior. Do not claim a summary is sufficient when audit, replay, merge, or
causal evidence is a product requirement.

## Explicit Transition Surface

```text
Payment = Created | Authorizing(attempt, requestId)
        | Authorized(id) | Failed(reason)

transition(Created, Authorize) -> Authorizing(1, requestId)
transition(Authorizing(_, current), Approved(stale)) -> unchanged
transition(Authorizing(_, current), Approved(current)) -> Authorized(id)
```

State events, guards, next states, unchanged fields, invalid events, and
idempotency. A correct enum without transitions is not a correct history model.

Cover stale, duplicate, reordered, retried, and concurrent events. If those rules
are still product policy, return to `model` rather than choosing a mechanism.

## Identity, Aliases, And Mutation Graphs

Equal current values may denote different histories. Multiple references may
observe the same mutation. Record:

- identity rule;
- alias sources and newly introduced sharing edges;
- cycle and visited-scope policy;
- which transitions preserve or break sharing;
- cache or denormalized-field consistency.

A local mutation is modular only when a coherent history owner and its observer
boundary remain clear.

## Event Order And Atomicity

State the smallest required order law. For withdrawal:

```text
read balance -> check funds -> write next balance
```

must behave as one protected transition for one account. Do not begin with
“serialize everything.” Choose lock, transaction, queue, compare-and-swap, or
merge only after naming the forbidden interleaving, cross-resource scope,
waiting cost, and progress obligation.

Per-object protection cannot preserve an invariant spanning several resources
unless the coordination scope spans them or the model permits convergence.

## Streams And Logs

```text
events -> fold(transition, initialState) -> currentState
```

A log exposes history for replay, audit, merge, or time travel, but adds ordering,
versioning, retention, identity, and reconstruction costs. A stream of states and
an event log are different contracts.

For delayed streams record demand, memoization, producer/consumer pace, buffer or
backpressure, replayability, retained prefixes, effects, failure, and
cancellation. Laziness moves time obligations; it does not remove them.

## Artifact

```text
Required history and sufficient summary:
Owner, writers, identity, and aliases:
States, events, transitions, and unchanged fields:
Stale, duplicate, retry, reorder, and invalid policy:
Order/atomicity law and forbidden interleaving:
Cross-resource coordination scope:
Stream/log meaning, demand, retention, and replay:
Alternative local-state or explicit-history representation:
Checks and residual policy:
```

## Stop And Separation

Stop when the state representation explains every admitted history, one owner
controls each transition, and order/identity/log observers are explicit.

Use `process-shape-and-resources` for wait, capacity, stack, or lifetime without
product history; return to `model/temporal-behavior-models` when allowed histories
or fairness remain unresolved; use `verify` when the design exists but traces are
not exercised.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 3.1,
  Section 3.3,
  Section 3.4, and
  Section 3.5
  for history, identity, mutation graphs, concurrency, streams, demand, and
  memoization.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, Chapters 9-10, calibrates
  state/action, stale event, safety/progress, and refinement distinctions; the
  accepted temporal policy itself remains owned by `model`.
