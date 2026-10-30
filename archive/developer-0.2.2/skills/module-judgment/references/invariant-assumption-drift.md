# Invariant, Assumption, And Drift

Use this reference when a module claim confuses enforceable internal consistency
with continued agreement from an external environment. It supplies ownership,
observation, drift, and mitigation checks without requiring another reference.

## Accepted Judgment Context

Supply the module and purpose, internal state transitions or construction paths,
external participants and facts, claimed invariants, validations or health
checks, known mismatch history, and the consequence of stale belief.

## Classify Every Claim

```text
internal invariant:
  a relation the modeled owner can preserve across every admitted construction
  or transition

environmental assumption:
  an external fact omitted from the model but required for usefulness

external observation:
  evidence that an assumption held at an observed time under stated conditions

drift signal:
  evidence that the external relation may no longer hold

mitigation:
  reobserve, narrow use, revise the model, degrade explicitly, or accept failure
```

A startup check cannot permanently force an independently changing service,
policy, clock, schema, or physical system to remain aligned.

## Ownership Table

| Claim | Class | Owner or observer | Validity window | Drift signal | Mitigation |
| --- | --- | --- | --- | --- | --- |

For an internal invariant, enumerate every creation, update, migration,
deserialization, and recovery path that can affect it. For an assumption, name
the environmental participant that can change independently and the first
observable consequence of mismatch.

## Worked Case: Supported Region Cache

A module caches the regions supported by an external delivery service at startup
and admits orders only for cached regions.

Claims:

```text
I1: every admitted order contains one region from the module's current cache
A1: the cache still matches the delivery service's accepted regions
```

Classification:

```text
I1 internal invariant:
  owner: order admission path
  falsifier: migration or raw deserialization bypasses admission

A1 environmental assumption:
  observer: startup fetch
  validity: only at successful fetch time; no eternal guarantee
  drift: delivery rejection for a cached region or service version change
  mitigation: bounded refresh, explicit unavailable result, and stale-cache policy
```

A type that restricts orders to cached values can preserve `I1`. It cannot prove
`A1` after the external service changes.

Decision artifact:

```text
retain I1 as internal guarantee
rename or document A1 as time-bound observed support
make refresh and delivery-rejection behavior explicit
```

## Counterexample: Claimed Invariant Without Construction Audit

A comment says `balance >= 0`, but raw imports, direct field mutation, and replay
can create negative balances. The relation is neither an owned invariant nor an
environmental assumption; it is an unchecked wish. Classify it as an evidence gap
until all relevant transitions are known.

## Artifact

```text
Module purpose:
Claim table:
Internal construction and transition paths:
External participants:
Observation conditions and validity window:
Drift signals:
Mismatch consequence:
Mitigation and residual risk:
Decision:
```

## Stop And Separation

Stop when every consequential claim is classified, internal invariants have
complete enough path ownership, assumptions have time-bounded observations and
drift behavior, and no validation is presented as eternal control over an
independent environment.

This reference does not invent the accepted invariant, choose an API, build a
monitoring system, or route missing semantic or implementation work.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 70-89, for module assumptions,
  self-consistency, observation, environmental drift, and context-relative
  usefulness. The source's broad proof contrast is narrowed to ownership and
  observation boundaries.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, living build 9.2.0.3:
  Chapter 20, for prediction, observation, discrepancy, and explicit model
  refinement.
