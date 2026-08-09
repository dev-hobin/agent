# Earned Abstraction

Use this reference when at least two correct completed designs with stable
purposes and data models may share one common movement and variation-role set.
It is self-contained and does not require another design reference.

## Accepted Design Context

Supply at least two completed concrete designs, each purpose and data meaning,
representative checks, declared process observers, and one transfer case. Syntax
similarity without completed behavior is not admitted evidence.

This member contributes aligned common movement, a variation-role table,
candidate caller surface, migration boundary, transfer check, and the concrete
open question that remains before promotion.

## Align Completed Designs

```text
sum:      Empty -> 0;    Node(x, xs) -> x + sum(xs)
allReady: Empty -> true; Node(x, xs) -> x.ready && allReady(xs)
```

Align roles:

| Role | `sum` | `allReady` |
| --- | --- | --- |
| base | `0` | `true` |
| item projection | identity | readiness |
| combination | addition | conjunction |

Only then is a candidate such as `fold(sequence, base, project, combine)` visible.
The shared template locates a candidate; it does not approve it.

## Stability And Migration

Check:

- roles have domain or process meaning rather than syntax-fragment names;
- old designs become simple clients after migration;
- one realistic transfer case fits without flags exposing internals;
- evaluation order, effects, errors, numeric association, and resource shape are
  preserved for declared observers;
- the data interpretation is stable enough that difference is understood.

An abstraction is not a single point of control until intended clients migrate.
Stop at a candidate without approving it. Record the exact promise and falsifier
that remain open.

## Artifact

```text
Completed concrete designs and purposes:
Aligned common movement:
Variation-role table:
Candidate interface and caller examples:
Process and observer obligations:
Client migration boundary:
Transfer case:
Deferred or rejected abstraction:
```

## Stop And Separation

Stop when completed designs align under stable roles, migrated clients are
simple, and one transfer case fits without semantic drift. The result is a
candidate, not approval.

When only horizontal similarity is visible, no abstraction candidate follows
from this comparison. When data meaning is not established, stable variation
roles cannot be derived from the supplied cases. This document stops at a
candidate and does not approve it.

## Source Trace

- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3:
  Chapter 14,
  Chapter 15,
  and Chapter 16
  for completed examples, aligned roles, abstraction, and client use; Chapters
  19-20 calibrate model stability before simplification.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 1.3
  for higher-order procedure roles.
- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, Chapters 3-4, pp. 51-101, calibrates smallest difference, horizontal
  movement, stable landings, and the stop before promotion.
