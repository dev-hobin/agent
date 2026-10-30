# Process Boundary

Use this reference when a procedure's returned value does not reveal its generated
work, data sharing, active order, paused dependencies, continuation, resource
lifetime, or completion. It supplies a standalone process trace and falsifier.

## Accepted Judgment Context

Supply the trigger, procedure promise, caller-visible result and failures, one
representative execution, initial and acquired data, collaborators, resources,
and one nested, delayed, interrupted, or retained-work case.

## Procedure Is Not Process

A procedure is a source-level operation. A process is the execution it generates
under an environment.

```text
procedure: retry(operation, 3)
process:
  attempt 1 -> retryable failure -> wait
  attempt 2 -> retryable failure -> wait
  attempt 3 -> success
```

Trace:

```text
work generated at each step
control and continuation owner
values retained across waits or calls
shared references and new sharing edges
locally ordered active execution
paused dependencies on signals, resources, or capacity
stack, queue, time, space, and retention bounds
failure and cancellation transfer
completion observer
```

Short or fluent source is not evidence of a simple process. A pipeline may
materialize several collections, and recursive syntax may generate constant or
growing space depending on deferred work.

## Boundary Map

```text
data scope:
  initial values, acquired input, created values, shared references

active execution:
  operations locally ordered while progress is possible

paused execution:
  external event, resource, lock, timer, response, or capacity required

continuation:
  work that must occur after a nested call, callback, wait, or result

lifetime:
  roots, handles, retained objects, release events, and terminal cleanup
```

Partial isolation is honest. A process may share data or wait on others, but each
edge must be visible enough that surrounding behavior is not mistaken for local
ownership.

## Worked Case: Document Conversion Job

Trigger: one accepted document is submitted for conversion.

Trace:

```text
1. acquire input stream and output reservation
2. decode pages incrementally
3. convert each page and append output chunk
4. wait when output capacity is unavailable
5. finalize output metadata
6. release input stream and reservation
7. report completed output or explicit failure
```

Boundary findings:

```text
data:
  document identity and page buffer are local; output reservation is shared
active:
  decode -> convert -> append is ordered per page
paused dependency:
  output capacity and storage response
continuation:
  metadata finalization must occur after the last append
lifetime:
  input stream and reservation survive waits and release on every terminal path
completion:
  finalized metadata, not job acceptance
```

Falsifier:

```text
storage remains unavailable after one page; the job must not retain an unbounded
buffer or leak the input stream
```

Decision: bounded only if wait timeout/backpressure, buffer limit, and release on
failure are explicit.

## Counterexample: Queue As Claimed Isolation

Two workers share a thread-safe queue. That proves coordinated access, not bounded
waiting, capacity, fairness, starvation freedom, independent data ownership, or
business completion. The queue is an edge in the process map, not the process
boundary itself.

## Artifact

```text
Procedure promise:
Representative execution trace:
Generated work:
Control and continuation owner:
Data scope and sharing edges:
Active and paused execution:
Stack, queue, time, and space bounds:
Roots, handles, retention, and release:
Failure, cancellation, and completion:
Falsifying execution:
Decision:
```

## Stop And Separation

Stop when one concrete execution and one interruption or retention case expose
all consequential work, continuations, edges, waits, resources, and completion.
A value-equality test alone is not a process stop.

This reference does not invent completion meaning, design process collaboration,
or select a capability for unresolved semantics or implementation.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 98-104 and 112-119, for processes as bounded
  reasoning units, partial data and execution isolation, shared edges, waiting,
  topology, and completion pressure.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Sections 1.2, 5.1, 5.2.4, and 5.3, for procedure/process distinction,
  continuations, process instrumentation, roots, identity, and reclamation.
