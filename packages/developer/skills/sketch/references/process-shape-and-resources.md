# Process Shape And Resources

Use this reference when returned values do not describe the generated work,
control, waits, capacity, lifetime, or effect boundary of a design. It is
self-contained and does not require another boundary reference.

## Accepted Boundary Context

Supply the procedure promise, caller-visible result and failures,
representative execution trace, admitted order/effect/resource observers,
control participants, environmental capacity assumptions, and one overload,
shortage, cancellation, or retention case.

This member contributes generated-work and continuation ownership, active/paused
dependencies, finite bounds, roots and release, effect-phase ownership,
acknowledgment semantics, and residual risk.

## Procedure Is Not Process

Trace representative execution:

```text
procedure: retry(operation, 3)
process:
  attempt 1 -> retryable failure -> wait 100 ms
  attempt 2 -> retryable failure -> wait 200 ms
  attempt 3 -> success
```

Record:

```text
work generated at each step
control owner and continuation
deferred work or stack growth
shared and retained data
active and paused execution
input shortage/overload behavior
time/space bounds
failure and cancellation surface
```

Short source text is not evidence of a simple process. A fluent pipeline may
materialize several collections; recursive syntax may generate constant-space or
growing-stack execution depending on continuation placement.

## Active, Paused, And Capacity Boundaries

```text
data scope:
  initial values, shared references, acquired input, new sharing edges
active execution:
  locally ordered operations while progress is possible
paused execution:
  external signal, resource, or capacity required
input excess:
  ignore, reject, bound, queue, shed, or backpressure
input shortage:
  wait, timeout, retry/back off, fail, or report
```

A thread-safe queue coordinates access; it does not prove bounded waiting,
starvation freedom, capacity, or independent understandability. Name the owner
and finite bound before claiming isolation.

## Control, Tail Position, And Retention

At every nested step state:

```text
what must happen after return
values live across the call
what may be clobbered
what is saved and where
maximum nesting and overflow policy
error/cancellation transfer
```

A call is in tail position only when the current computation has no deferred work
that requires a return frame. Verify stack and control claims with stack depth,
operation count, allocation, retained graph, or an adversarial bounded trace—not
with result equality alone.

For memory-sensitive work identify roots, reachable objects, release events,
external handles, identity rules, capacity, and out-of-memory behavior. Garbage
collection cannot repair an unintended root, cache, callback, stream prefix, or
unclosed handle.

## Pull, Transform, Push

Use this phase split only when it matches failure and ownership:

```text
pull:
  acquire and bound external information; own invalid/unavailable behavior
transform:
  compute a context-light domain result
push:
  interpret effect data; own idempotency and partial failure
apex:
  coordinate the whole outcome at the last responsible moment
```

If pull returns a lazy effectful producer, the pull owner must enclose
consumption, resource closure, retry, truncation, and decoding. Prefer inspectable
effect data until push. Reject this split when one atomic transaction or shared
invariant is the real boundary.

## Task Completion And Acknowledgment

For work crossing processes, distinguish message delivery from completed task:

```text
task identity and entry command
effect boundary where outcome becomes uncertain
completion acknowledgment and failure meaning
outstanding-work owner and durable state
retry owner, duplicate policy, cancellation, and stop
intermediate release point
```

An edge-held outstanding-task record is an ownership candidate, not an
exactly-once guarantee. Distributed durability and recovery require separate
protocol evidence.

## Artifact

```text
Procedure promise and representative process trace:
Generated work and continuation owner:
Shared data and new sharing edges:
Active/paused dependencies:
Too-much/too-little policy:
Stack, queue, time, space, and retention bounds:
Roots, identity, handles, and release:
Pull/transform/push ownership, if applicable:
Task acknowledgment and outstanding-work owner:
Failure, retry, duplicate, cancellation, and residual risk:
```

## Stop And Separation

Stop when work, control, wait, capacity, lifetime, failure, and completion are
owned and bounded enough to make the first implementation step honest.

Use `state-history-and-order` when previous interactions or event ordering define
meaning, and `runtime-and-compilation` when these obligations belong to an
interpreter/compiler convention rather than an ordinary process.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 1.2
  for process shape and resource growth;
  Section 5.1
  for control, continuations, registers, and stacks;
  Section 5.2.4
  for process instrumentation;
  Section 5.3
  for reachability, roots, identity, and storage reclamation; and
  Section 5.4.2
  for tail calls and retained frames.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 98-119, for partial data/execution isolation,
  waiting, overload, pull-transform-push, effectful lazy input, topology, and task
  acknowledgment.
- Complete production cancellation, recovery, capacity, and delivery protocols
  remain Developer adaptations.
