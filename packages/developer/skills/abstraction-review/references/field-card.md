# Abstraction Candidate Review

Use this reference when an already-shaped interface, helper, boundary, role,
workflow rule, or structural unit needs an auditable keep/revise/split/reject/
defer decision.

This reference reviews a candidate. It does not create the original design,
extract movement, settle product rules, or choose timing.

## Judgment Spine

```text
concrete candidate and caller shape
-> pressure it claims to remove
-> promises callers would rely on
-> evidence and counterexample
-> observable stop
-> keep | revise-surface | revise-model | split | reject | defer
```

A polished name or familiar pattern is not evidence. Missing construction is a
handoff, not an invitation for this review to absorb another skill.

## Candidate Field Card

```text
Candidate and source:
  exact current or wished surface; where it came from

Pressure:
  accepted change, repeated movement, invariant, participant, or representation
  issue it is meant to remove

Caller contract:
  operations, inputs, outputs, failures, effects, and observers

Hidden detail:
  representation, policy, creation, history, ordering, or process callers may
  ignore

Owner and assumptions:
  owner of guarantees; environment facts required for usefulness

Representative cases:
  normal, boundary, forbidden, and transfer case

Replacement or variation:
  another implementation/caller/case the candidate claims to support

Counterexample:
  smallest plausible case that would pass a superficial review while breaking
  the promise

Stop check:
  observable evidence that decides this review

Evidence and gaps:
  callers, cases, code, tests, traces, costs, or human-owned policy

Decision:
  keep / revise-surface / revise-model / split / reject / defer

Open consequence and handoff:
```

## Review Promises

Select only promises the candidate actually makes.

| Promise | Evidence required | Pass-but-wrong shape | Handoff when the surface is missing |
| --- | --- | --- | --- |
| caller language hides representation | two representations or a leak search | new type name with raw fields still required | `sketch` barrier design |
| one responsibility owns a change | owner/message map and representative change | moved-method bag or generic service | `sketch` responsibility design |
| several implementations share a role | pre/post/failure compatibility | subtype needs stronger preconditions or different effects | `model` contract/replacement |
| composition remains in one value world | closed-operation and finalizer table | side effect disguised as chainable result | `sketch` closure design |
| additive extension is supported | row/column and fake-variant evidence | registry hides precedence or load-order policy | `sketch` generic operations |
| process remains truthful | trace, waits, cost, resource, failure ownership | same result with unbounded buffer or changed order | `sketch` process design |
| state/history has one owner | transition and order evidence | enum without stale/duplicate policy | `model` or `sketch` state work |
| name exposes stable sense | caller/audience/evolution evidence | rich word over unstable responsibility | `naming-judgment` |

A candidate can make several promises, but each must be evaluated against the
same caller contract. If the promises require independent surfaces or owners,
that is split evidence.

## Stability Tests

A candidate is stable enough to keep only when:

- its pressure is current and observable;
- callers can use its vocabulary without reopening hidden details;
- the contract includes relevant effects, failures, order, and resources;
- a realistic transfer case fits without flags that expose internals;
- lost abilities are acceptable for current and credible callers;
- the owner can enforce the promised invariant;
- the stop check can fail the candidate rather than merely exercise it.

Bias toward `defer` when pressure is plausible but examples or participant
independence are too weak. Choose `revise-model` when the candidate cannot be
judged because admitted meaning is unsettled. Choose `revise-surface` when the
meaning is accepted but the caller contract leaks or lies.

## Separation Router

Do not construct missing evidence inside this leaf:

```text
no concrete caller-facing surface -> sketch
unresolved product cases/rules -> model
only repeated movement is visible -> signal
surface is stable but timing is disputed -> schedule
word/sense is the issue -> naming-judgment
implementation claim needs evidence -> verify
```

Applicable conditional context inside this skill may deepen review, failure
localization, or calibration. Selected context must not reproduce the
construction methods owned by those leaves.

## Minimal Output

```text
Candidate:
Pressure:
Caller contract and hidden detail:
Promises under review:
Counterexample:
Stop check and evidence:
Decision:
Handoff or open consequence:
```

## Source Trace

This review spine is Developer synthesis over these bounded capabilities:

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, v2.2.2:
  Chapters 3-9, pp. 51-268, for pressure, movement, responsibility, roles,
  factories, and responsibility-level evidence.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 1.1,
  Section 1.3,
  Section 2.1,
  Section 2.2,
  Section 2.4,
  Section 3.1, and
  Section 3.4
  for black-box promises, barriers, closure, dispatch, history, and order.
- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3:
  Chapter 14,
  Chapter 15,
  Chapter 16,
  Chapter 19,
  and Chapter 20
  for completed examples, migrated clients, and model stability.
- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapter 5, pp. 47-60, for contract and observer-relative replacement.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 70-95, for participant pressure and
  interface calcification. Source-specific and universalized claims are excluded.
