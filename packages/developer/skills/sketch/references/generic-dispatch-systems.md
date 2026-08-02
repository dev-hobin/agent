# Generic Dispatch Systems

Use this reference when accepted representations must coexist additively through
operations whose selection should not expose representation fields to callers.
It is self-contained and does not require another boundary reference.

## Accepted Boundary Context

Supply the caller purpose, accepted representations and operations, current
variant-operation support matrix, observed growth axis, representation barrier,
and known duplicate/overlap/load-order/unsupported constraints.

This member contributes both extension axes, dispatch and registration ownership,
conflict policy, fake-row and new-column checks, and the simpler conditional
alternative.

## Two Axes Before Mechanism

| Representation | `charge` | `refund` | `describe` |
| --- | --- | --- | --- |
| Card | supported | supported | supported |
| Bank transfer | supported | unsupported | supported |
| Store credit | supported | supported | supported |

Distinguish representation growth (row) from operation growth (column). Classes,
visitors, multimethods, tables, and registries distribute those costs differently.
Select from observed growth pressure.

## Dispatch Ownership

State:

```text
dispatch key and operation key
who registers or enumerates variants
duplicate and overlap policy
precedence and load order
unsupported capability result
visibility and failure timing
```

Moving branches into registration data relocates precedence ownership; it does
not remove it. A local exhaustive conditional is often the smaller owner for a
few closed variants.

## Extension Check

Add a fake row and one new column. Existing callers and old variant modules should
remain unchanged only along the axis the design claims to support. A registry adds
startup, naming, reflection, deployment, duplicate, and failure obligations.

## Artifact

```text
Variant-operation matrix:
Observed growth axis:
Representation barrier:
Dispatch and registration owner:
Duplicate, overlap, precedence, load-order, and unsupported policy:
Fake-row and new-column checks:
Simpler conditional alternative:
```

## Stop And Separation

Stop when both axes and all dispatch policies are visible and the chosen mechanism
is no more powerful than current extension pressure requires.

Use `meaning-preserving-conversions` only when operations cross representation
worlds, the variation-role or selection-creation route when domain role/creation
ownership is primary, and `language-semantics` when registered data becomes
executable notation.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 2.4
  and Section 2.5
  for generic operations, data-directed dispatch, and extension axes.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11, Indirection,
  public-manuscript pp. 64-69, for ordered conditionals, table conflicts, and
  qualified openness cost.
- Sandi Metz et al., *99 Bottles of OOP*, Second Edition, v2.2.2, Chapters 6-7,
  pp. 155-187, calibrates role and factory pressure without making registration a
  universal destination.
