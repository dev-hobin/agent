---
name: process-judgment
description: "Judge whether a concrete runtime flow can be understood independently by tracing generated work, data sharing, active and paused execution, pull-transform-push ownership, waiting, capacity, resources, effects, failure, retry, and cancellation. Use for request flows, callbacks, streams, jobs, workers, queues, and asynchronous pipelines."
---

# Process Judgment

Judge the execution produced by a procedure rather than inferring process shape
from source brevity or returned values.

## Core Question

Can this runtime flow be understood independently, and which data, wait,
capacity, resource, effect, and completion boundaries make that claim true?

## Judgment Spine

```text
trigger + promised completion
-> representative execution trace and generated work
-> data edges, active order, paused dependencies, and phase ownership
-> too-much/too-little, resource, effect, failure, and cancellation policy
-> bounded | coupled | under-specified | unsafe
```

A queue, callback, thread, or returned promise does not by itself define a
process boundary.

## Inputs

- Concrete trigger, procedure, promised result, failure, and completion
- Representative execution trace, data sources, effects, and collaborators
- Waiting, overlap, capacity, timeout, retry, cancellation, and resource behavior
- One overload, shortage, retention, partial-failure, or interruption case

## Supporting Materials

The core method is complete without supporting material. Supporting material may
refine the current question; it is guidance, not authority.

If the host has supplied a bounded selection for this invocation, use it as the
current selection. Apply each material only to the question it actually
addresses and preserve any visible mismatch as a limitation. Do not rediscover
alternatives unless the selection is explicitly incomplete.

Otherwise, inspect the colocated [Skill References](references.json). Use the root
`when` and `unless` conditions to confirm that this method applies; exclusions win. If an
exclusion applies, return `not-applicable` rather than forcing the method. Then
evaluate every Reference's `when` conditions and read the smallest materially
applicable set before producing the result. Broad topic similarity alone is not
sufficient. If no Reference applies, proceed with the core method alone.

## Output

Produce a process card:

```text
Trigger and promised completion:
Representative execution trace:
Generated work and continuation owner:
Data scope and sharing edges:
Active order and overlap:
Paused dependencies:
Too-much / too-little policy:
Time, space, queue, and retention bounds:
Resources, roots, handles, and release:
Pull / transform / push ownership:
Effects and failure surface:
Retry and cancellation:
Residual coupling:
Decision:
```

Use one decision: `bounded`, `coupled`, `under-specified`, `unsafe`, or `defer`.
When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: process decision and the execution boundary or hidden coupling behind it
Basis: procedure, execution trace, resource observations, failures, and policies
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: process card, execution trace, capacity case, and release check
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when generated work, data sharing, continuation, waits, capacity,
resources, effects, failure, and completion are explicit enough for one overload
or interruption case to falsify the claimed boundary. Revisit when topology,
load, resource lifetime, or external behavior changes.

## Method

1. State the trigger, promised completion, caller-visible result, and failures.
2. Trace one representative execution. Record generated work and what must happen
   after each nested or deferred step.
3. Map initial data, shared references, acquired input, retained objects, and new
   sharing edges.
4. Separate locally ordered active execution from paused dependencies on signals,
   resources, capacity, or other processes.
5. Classify pull, transform, and push only when the split matches ownership.
   Keep effectful acquisition enclosed by the owner of decoding, truncation,
   retry, and release.
6. State too-much and too-little behavior: reject, bound, queue, shed,
   backpressure, wait, timeout, retry, back off, fail, or report.
7. Identify roots, handles, release events, queue and stack bounds, overlap rules,
   partial failure, and cancellation transfer.
8. Test one overload, unavailable-input, retained-resource, or interrupted-effect
   case. Reject independent-understanding claims that rely on hidden surrounding
   behavior.

## Missing Evidence

Return `needs-evidence` when traces, runtime observations, load bounds, or failure
behavior can settle the judgment. Return `blocked` when completion or accepted
failure semantics are human-owned. Return `not-applicable` when no concrete
runtime flow is under judgment.

## Boundary

Do not invent product completion semantics, design an original process API,
claim system-wide delivery guarantees, implement concurrency, or prove
production capacity from a local trace. Preserve unresolved semantic, protocol,
design, and verification needs as gaps without routing them.
