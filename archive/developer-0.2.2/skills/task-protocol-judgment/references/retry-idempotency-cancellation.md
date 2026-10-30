# Retry, Idempotency, And Cancellation

Use this reference when an outstanding task may time out, repeat, overlap, arrive
late, be canceled, survive restart, or produce an uncertain effect. It supplies a
bounded protocol audit and failure matrix without claiming universal exactly-once
semantics.

## Accepted Judgment Context

Supply task and operation identity, accepted completion, effect boundary,
timeouts, retry authority, duplicate sources, ordering requirements, idempotency
scope, cancellation behavior, durable state and restart behavior, late-result
policy, and terminal stop.

## Start With Uncertainty

A timeout means an observation did not arrive within a bound. It does not by
itself mean:

```text
the command was not delivered
the participant did not start
the effect did not occur
the task failed
a retry is safe
```

Classify the current outcome as known-not-started, known-in-progress,
known-completed, known-failed-without-effect, partially applied, or unknown. Do
not collapse unknown into failure for control-flow convenience.

## Ownership Matrix

| Concern | Required statement |
| --- | --- |
| retry | who may retry, on which evidence, how often, and when to stop |
| duplicate | stable identity, detection window, and result for repeat commands |
| idempotency | which operation under which identity and state makes repeats equivalent |
| ordering | preserved, unordered, versioned, or rejected stale work |
| cancellation | request versus confirmed cancellation and effect race policy |
| late result | accept, reconcile, ignore with evidence, or conflict |
| durability | which outstanding and terminal states survive restart |
| recovery | how current truth is reconstructed after uncertain outcome |

Idempotency is scoped. Repeating `set status to paid` may be state-idempotent while
repeating `send paid notification` is not. One idempotency key cannot silently
cover several effects with different completion boundaries.

## Worked Case: Inventory Reservation

Task identity: reservation `R` for order `O`.

Protocol:

```text
entry:
  persist R as outstanding before sending Reserve(R, O, items)
retry:
  same R only after timeout; at most bounded attempts before reconciliation
participant behavior:
  first accepted R creates one reservation; duplicate R returns prior outcome
ordering:
  release version must not precede or overwrite a later replacement reservation
cancellation:
  Cancel(R) is a request; canceled is reported only after authoritative release
late completion:
  if Reserve(R) completes after cancel request, reconcile then release or report conflict
restart:
  outstanding R and terminal result survive; worker memory is not authoritative
stop:
  reserved, rejected-without-reservation, canceled-after-release, expired by owner,
  or explicit unresolved requiring reconciliation
```

Failure matrix:

| Event | Observation | Safe action |
| --- | --- | --- |
| request lost before participant | no acceptance; delivery evidence may be absent | retry same R under bound |
| response lost after reservation | timeout; effect unknown | query/reconcile R, not new identity |
| duplicate request | existing R found | return prior/current R outcome |
| cancel races with completion | both observed | apply declared reconciliation order |
| owner restarts | durable outstanding R exists | resume from durable state |

## Counterexample: Retry With New Identity

A timeout causes the caller to create a fresh reservation identity. The
participant cannot distinguish retry from a new business task, so both may
succeed. Calling the endpoint “idempotent” does not repair unstable identity.

## Cancellation Check

Distinguish:

```text
cancellation requested
participant observed request
future work stopped
in-flight effect prevented
partial effect compensated
resources released
cancellation confirmed
```

A local canceled future may only prove that the caller stopped waiting.

## Artifact

```text
Task and operation identity:
Outcome classes including unknown:
Retry evidence, authority, bound, and stop:
Duplicate detection and window:
Idempotency scope:
Ordering and stale work:
Cancellation transition and race:
Late-result policy:
Durable state and restart:
Recovery / reconciliation:
Failure matrix:
Decision:
```

## Stop And Separation

Stop when every retry preserves business identity, unknown outcomes remain
visible, duplicate and cancellation races have explicit transitions, authoritative
state survives to the claimed durability level, and every policy terminates or
names a bounded unresolved state.

This reference does not promise exactly-once delivery, invent completion policy,
choose infrastructure, implement compensation, or route missing work.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 98-119, for timeout, retry, backoff,
  outstanding tasks, acknowledgment, and the explicit boundary that full system
  protocol design remains out of scope.
- Stable idempotency identity, durable recovery, cancellation races,
  reconciliation, and complete failure matrices are operational extensions in
  this reference, not claims attributed to the cited source.
