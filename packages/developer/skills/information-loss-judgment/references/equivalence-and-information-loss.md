# Equivalence And Information Loss

Use this reference when a summary, aggregate, normalization, deduplication,
rounding, truncation, bucketing, or lossy conversion makes distinct accepted
inputs indistinguishable. It supplies the equivalence test, observer audit,
recovery decision, worked case, and stop.

## Accepted Judgment Context

Supply the transformation, accepted input domain, downstream purpose, candidate
input distinctions, output observers, provenance and recovery requirements, and
at least two representative inputs.

## Reduction Defines Equivalence

For transformation `f`, define:

```text
x ~f y when f(x) = f(y)
```

Every output group is an equivalence class of inputs the transformation treats as
the same. The central question is not whether equal outputs are computed
correctly. It is whether the accepted downstream purpose may treat all members of
each class as equivalent.

Use a witness table:

| Input A | Input B | Equal after? | Lost distinction | Downstream consequence |
| --- | --- | --- | --- | --- |

Include equality semantics explicitly when identity, precision, order,
multiplicity, null, missing, invalid, or failure values are consequential.

## Observer Audit

For every downstream decision, ask:

```text
Can the output answer it directly?
Can retained provenance answer it?
Can the input be reconstructed exactly, approximately, or not at all?
Who owns the accepted inability?
When does loss become irreversible?
```

Recovery by querying another authoritative source is different from recovery
from the transformed output. State availability, consistency, retention, and
identity assumptions for that source.

## Worked Case: Daily Availability Percentage

Input samples record service identity, timestamp, region, status, and probe
failure reason. The transformation emits one daily availability percentage.

Witnesses:

| Input A | Input B | Equal after? | Lost distinction |
| --- | --- | --- | --- |
| one 60-minute outage | sixty 1-minute outages | yes | incident count and continuity |
| outage in region east | outage in region west | yes | affected region |
| service failure | probe failure | possibly | measurement validity |

The percentage may be sufficient for one monthly objective. It is insufficient
for incident response, regional diagnosis, or probe-quality assessment.

Decision artifact:

```text
accepted purpose: monthly objective calculation
accepted equivalence: timing and region differences only for that calculation
not accepted: service failure and probe failure as one status
retained evidence: per-region numerator/denominator and probe-failure count
recovery: raw samples retained for the agreed diagnostic window
first irreversible point: raw-sample expiration
```

A label such as `availability` does not restore discarded incident structure.

## Counterexample: Normalization That Preserves Needed Meaning

Canonicalizing case and surrounding whitespace in identifiers may make distinct
raw strings equivalent while preserving the accepted identifier meaning. If the
canonical rule, collision behavior, original-display need, and all construction
paths are explicit, the loss can be accepted. “Lossy” does not mean wrong; it
means the equivalence needs an owner.

## Ability And Guarantee

Record the trade:

```text
restriction or reduction:
guarantee or simplicity gained:
ability lost:
accepted purpose evidence:
provenance retained:
reversal or recovery limit:
```

A smaller representation often gains easier comparison, privacy, cost, or query
ability while losing detail. Do not call the trade safe until both sides are
visible.

## Artifact

```text
Transformation and input domain:
Output equality semantics:
Equivalence witnesses:
Downstream observers and decisions:
Ability gained and lost:
First irreversible point:
Provenance retained:
Recovery source and assumptions:
Accepted and rejected equivalences:
Decision:
```

## Stop And Separation

Stop when each consequential equivalence class has a witness, every downstream
observer is supported or explicitly lost, and recovery claims name an actual
source and limit. When the accepted purpose does not establish which distinctions
may be discarded, no loss decision follows.

This document does not establish product equivalence, choose a storage or privacy
policy, or implement aggregation.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 70-89, for models that treat some
  environmental differences as equivalent; and Composition, public-manuscript
  pp. 104-112, for deliberate reduction and reshaping.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04:
  Chapters 2-4, pp. 5-46, for explicit domains, relations, ability/guarantee
  tradeoffs, and counterexample-oriented specifications. Runtime equality and
  recovery remain separate operational obligations here.
