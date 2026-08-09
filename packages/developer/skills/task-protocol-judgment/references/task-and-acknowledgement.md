# Task And Acknowledgement

Use this reference when message receipt, command acceptance, progress, business
completion, and terminal failure may be confused. It supplies completion classes,
outstanding-work transitions, a worked failure trace, and stop.

## Accepted Judgment Context

Supply the accepted business task, task identity, entry command, effect boundary,
all response or acknowledgment messages, current outstanding-state owner,
terminal outcomes, and one lost or delayed response case.

## Classify Every Signal

```text
receipt:
  transport or process obtained bytes

acceptance:
  a participant assumed responsibility for attempting work

progress:
  a nonterminal observation about work

business completion:
  the accepted effect or domain outcome occurred

rejection:
  responsibility was not accepted

terminal failure:
  the protocol will not continue attempting this task under current ownership
```

Name acknowledgment by the event it proves. A generic `ok`, resolved future, or
successful HTTP status cannot prove more than its contract and evidence boundary.

## Outstanding-State Owner

Use explicit transitions:

```text
absent
  --entry accepted--> outstanding
outstanding
  --receipt/acceptance/progress--> outstanding
outstanding
  --business completion--> completed
outstanding
  --terminal failure--> failed
outstanding
  --accepted cancellation--> canceled
```

For each transition state who writes it, where it survives, which evidence
justifies it, and what happens when the update itself fails. An edge-held record
can simplify intermediate processes, but it is only a candidate owner until its
durability and recovery are established.

## Worked Case: Customer Refund

Task completion:

```text
the payment provider confirms the refund under refund identity R
```

Trace:

```text
1. client submits Refund(R)
2. API persists R as outstanding
3. worker receives message -> receipt only
4. provider accepts network request -> outcome may still be unknown
5. provider confirms refund R -> business completion evidence
6. outstanding owner records completed and reports completion
```

Failure trace:

```text
provider completes refund; completion response is lost
```

Consequences:

- a timeout cannot safely mark `failed` without reconciliation;
- blind retry may duplicate an effect unless provider identity semantics prevent it;
- receipt from the worker is not customer-visible completion;
- the task remains outstanding or unknown until authoritative evidence settles it.

Protocol card:

```text
receipt acknowledgment: worker received command
acceptance acknowledgment: optional, worker assumed attempt ownership
completion acknowledgment: provider-confirmed R recorded by outstanding owner
unknown outcome: retained as unresolved; never rewritten as confirmed failure
terminal failure: explicit non-retryable rejection or exhausted policy with known no-effect evidence
```

## Counterexample: Fire-And-Forget Notification

A best-effort telemetry event may define completion as local enqueue and explicitly
accept loss afterward. In that contract, enqueue acknowledgment can be business
completion. The equivalence is valid only because the accepted task meaning says
so, not because enqueue usually works.

## Artifact

```text
Task identity and accepted completion:
Effect boundary:
Signal classification table:
Outstanding-state owner and persistence:
Transition evidence:
Unknown-outcome behavior:
Terminal outcomes:
Lost or delayed response trace:
Decision:
```

## Stop And Separation

Stop when every signal proves exactly one named event, outstanding work has one
authoritative state owner, unknown outcomes remain distinguishable, and one lost
completion response cannot be mistaken for failure or success.

This reference does not define business completion, infer exactly-once behavior,
design persistence, or route open protocol work.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 112-119, for commands, task acknowledgment,
  outstanding-work ownership at an edge, and intermediate release. The source
  explicitly leaves complete system-level protocol design outside scope; durable
  state and unknown-outcome handling are qualified operational extensions here.
