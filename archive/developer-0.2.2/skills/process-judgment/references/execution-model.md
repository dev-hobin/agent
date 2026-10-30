# Execution Model

Use this reference when a process claim depends on overlap, too much or too little
input, waiting, queues, capacity, timeout, retry, backoff, failure, or
cancellation. It turns hidden environmental behavior into one bounded execution
policy.

## Accepted Judgment Context

Supply the trigger and completion, producers and consumers, offered and service
rates when known, ordering and overlap requirements, queue or buffer shape,
resource bounds, unavailable-input behavior, timeout/retry policy, cancellation,
and one overload and one shortage case.

## Environmental Cases

Every process needs explicit behavior for:

```text
input arrives within capacity
input arrives faster than service
input arrives slower than demand
input never arrives
input arrives late or duplicated
consumer pauses or fails
process is canceled while active or paused
resource limit is reached
```

Use only cases the accepted claim requires, but do not infer a default from the
presence of a queue, promise, stream, worker pool, or timeout library.

## Policy Vocabulary

```text
too much:
  ignore | reject | bound | queue | shed | sample | coalesce | backpressure

too little:
  wait | return partial | timeout | retry | back off | fail | report

overlap:
  serialize | permit | cap concurrency | replace | cancel previous | deduplicate

ordering:
  preserve | reorder within window | unordered | priority with starvation policy

cancellation:
  stop before effect | compensate | finish in flight | detach | report unknown
```

Name the owner and finite bound for every chosen policy. “Eventually” is not a
bound unless fairness and progress conditions are part of the accepted claim.

## Worked Case: Thumbnail Workers

Accepted process:

```text
submissions enter a bounded worker pool and each accepted image eventually
produces a thumbnail or terminal failure
```

Execution model:

```text
capacity:
  8 active conversions, 200 queued submissions
within capacity:
  accept and return task identity
overload:
  reject before ownership transfer; do not silently enqueue beyond 200
shortage:
  workers wait for input without holding image handles
timeout:
  acquisition and conversion have separate deadlines
retry:
  retry transient acquisition twice with bounded backoff; conversion defects do not retry
ordering:
  no completion-order guarantee
cancellation:
  queued work is removed; active conversion receives cancellation and releases files
completion:
  stored thumbnail metadata or terminal failure, not queue receipt
```

Overload test:

```text
209 submissions arrive while all workers are active
```

Expected: 8 active, at most 200 queued, one explicit rejection; memory and handles
remain bounded.

Shortage test:

```text
queue is empty for one hour
```

Expected: workers do not poll without bound or retain prior image resources.

## Counterexample: Unbounded Queue

An unbounded queue handles a short burst in a test and is called backpressure. It
actually transfers overload into memory and latency. Backpressure requires a
feedback or refusal boundary that constrains the producer or admitted work.

## Artifact

```text
Trigger and completion:
Producer / consumer / shared capacity:
Within-capacity behavior:
Too-much policy and finite bound:
Too-little policy and deadline:
Overlap and ordering:
Retry and backoff owner:
Cancellation and partial effect:
Resource release:
Overload trace:
Shortage trace:
Decision:
```

## Stop And Separation

Stop when overload and shortage traces terminate in explicit, bounded outcomes,
each queue and wait has an owner, and cancellation releases or reports every
owned resource and effect. A passing happy-path result is not sufficient.

This document does not set business completion, prove production throughput from
samples, or design a distributed protocol.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 98-112, for active and paused execution,
  waiting, downstream capacity, too-much/too-little behavior, timeout, retry,
  exponential backoff, and queue coupling.
- Complete cancellation, production capacity budgeting, fairness, and recovery
  protocols are operational extensions in this reference rather than claims
  attributed to the cited source.
