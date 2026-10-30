<!-- Generated from sources/lenses/async-flow.md. Edit the source and run node scripts/sync-sources.mjs. -->
# Async Flow

Catches: a flow that reports work as done when only receipt happened, or whose timeout, retry, duplicate, late-response, cancellation, or overload path produces a duplicate effect, lost work, a leaked resource, or a stale overwrite.
Applies when: a change touches background jobs, queues, workers, webhooks, callbacks, streams, promises or futures, retries, timeouts, cancellation, polling, external effects (payment, notification, provider call), or state updated from an asynchronous response.
Skip when: the code runs synchronously in one process with no waits, no external effects, and no resources retained across a call.

## Gotchas
- A timeout means only that an observation did not arrive in time. It does not mean the command was not delivered, the effect did not happen, or a retry is safe. Treating an unknown outcome as a failure leads to duplicate effects.
- A retry that creates a fresh identity (new request id, idempotency key, or reservation id) looks like a new task to the participant, so both attempts can succeed. Calling the endpoint "idempotent" does not fix an unstable identity.
- Idempotency applies per effect. Setting a status is idempotent with respect to state; sending a notification is not. One key cannot cover several effects that complete at different points.
- A generic `ok`, a resolved promise, a 2xx status, or a successful enqueue proves only receipt or acceptance, unless the accepted contract explicitly defines that event as completion (for example, best-effort telemetry).
- A cancelled local future may prove only that the caller stopped waiting. The in-flight remote effect can still complete.
- An unbounded queue is not backpressure. It moves overload into memory and latency, and a short burst in a test will not show this.
- A lazy or deferred input (stream, cursor, lazy sequence) handed to a consumer moves I/O failure, decoding, resource closure, and retry into code that does not know it owns them.

## Distinctions
- **Signal classes**: receipt (bytes arrived), acceptance (someone took responsibility), progress, business completion (the accepted effect occurred), rejection, terminal failure. Each signal proves exactly one of these.
- **Unknown outcome**: the effect may or may not have happened. This state stays distinct from failed until reconciliation settles it.
- **Outstanding-work owner**: the single record that says whether a task is outstanding or terminal, and where that record survives a restart.
- **Idempotency scope**: the operation, identity, and state under which a repeat is equivalent to one execution.
- **Too-much / too-little policy**: reject, bound, shed, or backpressure when input exceeds capacity; wait with a deadline, retry with a bound, or fail when input is missing.
- **Cancellation requested vs confirmed**: a request is not confirmation that future work stopped, in-flight effects were prevented, and resources were released.
- **Stale result**: a response, event, or read that belongs to a superseded attempt, request, version, or snapshot.

## Questions
| Before building, decide | After building, find |
| --- | --- |
| Which event counts as business completion, and which signal proves it? | Find code that marks success, returns 2xx, or shows a success state on receipt, enqueue, or a resolved promise before the effect is confirmed. |
| On timeout or a lost response, how is the unknown outcome represented and reconciled? | Find timeout or catch branches that mark the task failed, roll back local state, or retry as if no effect happened, when the remote effect may have completed. |
| Does every retry reuse the same task identity, and what bounds the retries? | Find retries that generate a new id, key, or nonce per attempt, loops with no attempt or time bound, and retries of non-retryable defects. |
| For each external effect, what makes a repeat harmless? | Find a double submit, redelivered message, or replayed webhook path that performs a non-idempotent effect (charge, send, insert) twice. Name the missing dedup key, or the single key that covers several effects. |
| Which responses can arrive late or out of order, and what happens to them? | Find response handlers or event consumers that write state without checking that the result belongs to the current attempt, request, or version, so a stale response overwrites newer state. |
| Which state read before a wait must still hold after it? | Find check-then-act sequences that cross an `await`, queue hop, or transaction boundary where the checked state is not revalidated, locked, or version-checked before the write. |
| What does cancellation stop, and what does it report? | Find cancel paths that report "cancelled" while an in-flight effect can still complete, or that leave handles, reservations, locks, or subscriptions held. |
| What happens when input arrives faster than service, or never arrives? | Find queues, buffers, or concurrency with no bound or rejection, waits with no deadline, and polling with no stop condition. |
| Who releases each acquired resource on every terminal path? | Find streams, connections, reservations, timers, or listeners acquired before a wait and not released on failure, timeout, cancellation, or early exit. |
| Does the outcome type keep partial effects visible? | Find a single success boolean or status that hides partial completion, for example "persisted but notification failed". |
| Must outstanding work survive a restart? | Find outstanding tasks held only in memory (map, array, closure) in a flow that promises eventual completion or recovery. |
| Is a check-and-update one atomic invariant? | Find a check and its dependent update split across phases, jobs, or requests, so that two concurrent runs both pass the check. |

## Report a finding only when
- You can write a concrete event trace (for example: request sent, response lost, retry with new id) that ends in a wrong outcome at `file:line`: a duplicate effect, lost or orphaned work, false success, a leaked resource, or a stale overwrite.
- These do NOT count: "consider adding retries" or "use a queue"; a race already covered by a lock, transaction, unique constraint, or version check you can point to; capacity concerns with no load or shortage case; not providing exactly-once delivery when the contract never claims it.

## Sources
- `archive/developer-0.2.2/skills/process-judgment/SKILL.md` and references `process-boundary.md`, `execution-model.md`, `pull-transform-push.md`, `effect-data-boundary.md`.
- `archive/developer-0.2.2/skills/task-protocol-judgment/SKILL.md` and references `task-and-acknowledgement.md`, `retry-idempotency-cancellation.md`, `topology-resolution-routing.md` (stale route: re-resolve before ownership transfer).
- `archive/developer-0.2.2/skills/model/references/temporal-behavior-models.md` (stale, duplicate, reordered, retry traces; safety vs progress).
- `archive/developer-0.2.2/skills/sketch/references/state-history-and-order.md` (stale response ignored; read-check-write as one protected transition) and `process-shape-and-resources.md` (same process and acknowledgment obligations).
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11: Composition, public-manuscript pp. 98-119 (processes, waiting, too-much/too-little, timeout, retry, backoff, pull-transform-push, effects as data, acknowledgment, outstanding tasks, topology). Durable recovery, idempotency identity, cancellation races, and reconciliation are operational extensions in the source references and are not attributed to the book.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and Interpretation of Computer Programs*, Second Edition: Sections 1.2, 3.1, 3.4, 3.5, 5.1, 5.2.4, 5.3.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04: Chapters 9-10, pp. 100-138 (actions, safety, liveness, fairness, refinement).
