# Scope, State, And Effects

Use this reference when a convention tells readers whether code crosses scope,
observes or mutates state, defers work, interprets absence, or performs an effect.
It provides a self-contained operational-surprise audit.

## Accepted Judgment Context

Supply the code shape or convention, audience, claimed intent, values and state in
scope, external reads or writes, evaluation timing, absence states, and one case
where a reader could make a wrong prediction without opening the implementation.

## Returned Value Is Not The Whole Meaning

For the convention under judgment, record:

```text
inputs visible at the call site
values pulled from outside local scope
state snapshot or identity observed
work performed now versus later
values or effects pushed outward
absence states and their interpretations
failures, waits, and resources hidden by the shape
```

A compact expression may be idiomatic while still misleading if ordinary readers
cannot tell that it reads ambient state, retries I/O, starts deferred work,
mutates shared identity, or treats several absence states as equivalent.

## Operational Distinctions

| Distinction | Reader question | Failure when hidden |
| --- | --- | --- |
| local versus ambient input | Can the result be predicted from visible arguments? | stale, context-dependent, or test-order-sensitive behavior |
| snapshot versus live state | Which version is observed? | torn reads, inconsistent decisions, or stale writes |
| pure result versus pushed effect | Does evaluation cross the environment? | duplicate or reordered external action |
| eager versus deferred work | When can failure or resource use occur? | escaped lifetime, delayed exception, repeated work |
| absent versus invalid versus defaulted | Which missing states are equivalent? | policy applied in the wrong layer |
| atomic versus multi-step mutation | What can interleave? | invariant broken between steps |

The judgment is not that every distinction belongs in a long name. It is that the
chosen convention must let the intended audience predict the consequential ones.

## Worked Case: Ambient Reporting Window

A reporting operation accepts only an account identifier but reads a mutable
process-wide reporting window. Tests replace that global value temporarily.

Claimed convention:

```text
report(account) computes the report for the current reporting window
```

Violation trace:

```text
request A changes ambient window to April
request B changes ambient window to May
request A reads May
both calls return valid-looking reports
```

Judgment:

- the visible call shape implies the account is sufficient input;
- the ambient value has request scope but process-wide ownership;
- temporary replacement does not establish isolation;
- the failure is silent and may affect external reporting.

Decision artifact:

```text
decision: localize or enforce
required signal: reporting window is explicit in the bounded request context
state owner: one request snapshot
violation test: two overlapping requests cannot observe one another's window
```

This does not require a particular parameter, context object, dynamic binding, or
framework. It requires honest scope and state ownership.

## Counterexample: Conventional Clock In Diagnostics

A best-effort diagnostic message reads the current clock implicitly. If callers
do not rely on exact time, the value is not persisted as business state, and the
clock effect is locally obvious, an explicit clock parameter may add noise
without bounding a consequential failure. The convention may remain.

## Artifact

```text
Code shape and intended meaning:
Visible and ambient inputs:
State identity and snapshot:
Immediate and deferred work:
Outward effects:
Absence interpretations:
Wrong reader prediction:
Selected signal or enforcement:
Stop check:
```

## Stop And Separation

Stop when a reader can predict every consequential scope crossing, state
observation, effect, deferred failure, and absence interpretation from the
accepted convention plus its local context. A generic wrapper that merely hides
the mechanism is not a stop.

This document does not invent business semantics or require explicit parameters
for every dependency. Missing meaning or design limits the operational conclusion
that can be derived.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Names, public-manuscript pp. 7-26, for pull, transform, and push names that
  reveal scope crossing; and Idioms, public-manuscript pp. 30-61, for purity,
  dynamic scope, laziness, atomic state, narrow access, and bounded absence.
  Clojure-specific forms and calling conventions remain contextual.
