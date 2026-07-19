# Processes, State, And Time

Use this reference when returned values alone do not describe correctness. The
same procedure text can generate recursive, iterative, tree-shaped, delayed, or
stateful processes with different time, space, order, and failure behavior.

## Procedure Versus Process

Trace a representative execution:

```text
procedure: retry(operation, 3)
process:
  attempt 1 -> retryable failure -> wait 100 ms
  attempt 2 -> retryable failure -> wait 200 ms
  attempt 3 -> success
```

Record:

```text
result
work generated at each step
deferred work or stack growth
state retained or duplicated
time/space scale
ordering and failure surface
```

A recursive tree walk and an iterative queue walk may return the same nodes but
have different stack, ordering, and memory contracts. A fluent one-line pipeline
may materialize three full collections. Short procedure text is not evidence of
a cheap or simple process.

## State Means History Matters

Compare two calls with identical explicit input:

```text
account.withdraw(40) -> Accepted
account.withdraw(40) -> Rejected
```

If prior interactions explain the difference, state is part of the contract.
Fill:

```text
required history: accepted deposits and withdrawals
sufficient summary: current balance
owner: account instance
writers: deposit and withdraw
identity: two equal balances may be different accounts
aliases: references that observe the same mutation
order law: sufficient-funds check and balance update are one transition
```

Local state is modular when it hides a coherent history behind a small
interface. It is hazardous when aliases, retries, concurrency, or persistence
make the history owner unclear.

## Explicit State Machine Alternative

Represent time as data when transitions need review, replay, or distribution:

```text
Payment = Created | Authorizing(attempt) | Authorized(id) | Failed(reason)

transition(Created, Authorize) -> Authorizing(1)
transition(Authorizing(n), Retryable) -> Authorizing(n + 1)
transition(Authorizing(_), Approved(id)) -> Authorized(id)
transition(Authorized(_), Approved(_)) -> invalid or idempotent policy
```

State the unchanged part of each transition and cover stale, duplicate,
reordered, retried, and concurrent events. A correct enum is not a correct
history model.

## Event Order And Atomicity

For concurrent withdrawal, the forbidden interleaving is:

```text
A reads 100
B reads 100
A writes 20 after withdrawing 80
B writes 20 after withdrawing 80
```

Both calls appear accepted although 160 was withdrawn. The order law is not
“serialize everything”; it is:

```text
read balance -> check funds -> write next balance
```

must behave as one protected transition for a given account. Choose a lock,
transaction, queue, compare-and-swap loop, or merge policy only after stating
that law and its waiting/fairness cost.

## Streams And Logs

An explicit stream/log represents successive states or events:

```text
events -> fold(transition, initialState) -> currentState
```

It improves replay, audit, time travel, merge reasoning, and functional
composition. It also creates retention, ordering, identity, versioning, and
reconstruction-cost obligations. Choose it when history is product evidence,
not merely because mutation is unfashionable.

For delayed streams also record demand:

```text
producer pace
consumer pace
buffer/backpressure
single-use versus replayable
failure and cancellation
```

## Pull, Transform, Push Process Check

```text
pull: where external time and failure enter
transform: domain computation and its data contract
push: effect interpretation, idempotency, and partial failure
apex: coordinator that owns the whole process outcome
```

The separation is false when pull retries silently alter transform semantics or
push performs an unreported partial success. Conversely, splitting one atomic
transaction into these phases may violate the actual invariant.

## Process/State Artifact

```text
Procedure promise:
Representative process trace:
Shape and time/space cost:
Required history and sufficient summary:
State or log owner and writers:
Identity and alias behavior:
Order/atomicity law:
Retry, stale, duplicate, and concurrency policy:
Alternative representation considered:
Evidence and residual risk:
```

## Failure Diagnosis

- Result tests pass but stack, buffering, or order matters: add a process-shaped
  verifier.
- Same call changes but no history is named: revise the state contract.
- A state machine lists states but not events and next states: derive the
  transition relation.
- All work is serialized: narrow the protected order law.
- A log is proposed without replay/audit/merge pressure: local state may be the
  smaller honest model.
- A pipeline stage hides effects: expose the phase or rename the process
  honestly.

## Source Trace

- *Structure and Interpretation of Computer Programs*, Second Edition,
  chapters 1 and 3: procedure/process distinction, state and assignment,
  identity and sharing, concurrency, constraints, delayed evaluation, and
  streams.
- Zachary Tellman, *Elements of Clojure*, 2019: units of computation and the
  construction of pull-transform-push processes.
