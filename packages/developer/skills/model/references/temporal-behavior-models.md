# Temporal Behavior Models

Use this reference when correct snapshots are insufficient and the judgment
depends on histories, retries, stale events, concurrency, or progress.

## Behavior Before State Names

Define a temporal model in this order:

```text
initial states
admitted actions and their enabling conditions
next-state effects and unchanged fields
safety: forbidden histories
progress: required eventual behavior
stuttering or termination semantics
fairness assumptions by action
observable refinement boundary
```

A list of enums is not a temporal model. Every action needs a frame condition so
omitted state does not change accidentally.

## Representative Retry Model

```text
Payment = Created
        | Authorizing(attempt, requestId)
        | Authorized(paymentId)
        | Failed(reason)

Authorize(id): Created -> Authorizing(1, id)
Retry(id2): Authorizing(n, _) -> Authorizing(n + 1, id2)
Approved(id, payment):
  Authorizing(_, id) -> Authorized(payment)
Approved(staleId, _):
  Authorizing(_, currentId) -> unchanged when staleId != currentId
```

```text
safety: authorization is recorded at most once
progress assumption: an enabled live attempt eventually receives a response,
                     and retries are finite
```

Exercise stale, duplicate, reordered, retry, cancellation, and concurrent traces.
One test per state cannot distinguish these histories.

## Stuttering, Termination, And Valid Behavior

State whether a completed system may stop or is modeled by repeated unchanged
steps. Exhibit at least one valid behavior so inconsistent assumptions cannot
make every implication vacuously true.

Fairness must name:

- the action it applies to;
- whether enablement must be continuous or only repeated;
- the environment assumption that makes the requirement plausible.

Safety does not imply progress. Fairness does not repair an action that is never
enabled.

## Refinement Observer

An implementation refines an abstract model only when each observable
implementation behavior is allowed by the abstract specification, possibly after
an explicit mapping. Declare which intermediate states, failures, timing, or
effects the observer can see. An abstract atomic action cannot justify visible
partial states without a refinement argument.

## Artifact

```text
State variables and initial states:
Actions, guards, effects, and frame conditions:
Representative valid trace:
Stale / duplicate / reordered / retry / concurrent traces:
Safety properties:
Progress properties:
Stuttering or termination semantics:
Fairness scope and environment assumptions:
Refinement mapping and observers:
Guarantee owners and verification targets:
```

## Stop And Separation

Stop when the model distinguishes all consequential histories and every safety or
progress claim has assumptions and a counterexample trace.

Hand off to `sketch` when state ownership or event APIs must be designed, to
`verify` when the model exists but traces are unexercised, and to
`planning-models` when the main question is finding one goal-directed action
sequence rather than admitting all valid behaviors.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapters 9-10, pp. 100-138, for bounded instances, actions, safety, liveness,
  stuttering, fairness, and refinement. Recorded beta defects are excluded.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 3.1
  and Section 3.4
  for history, identity, assignment, and allowed concurrent histories.
