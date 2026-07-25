# Selection And Creation

Use this reference when the accepted design must decide which concrete variant to
construct or supply at a boundary.

## Selection Policy

State:

```text
available variants and selection input
owner of dispatch key
predicate overlap and precedence
conflict/duplicate policy
unsupported case
visibility and load order
```

Moving predicates into data or registration relocates precedence ownership; it
does not remove it.

## Creation Continuum

Compare:

```text
local conditional
configurable mapping
registration
self-registration
automatic discovery
```

For each mechanism ask who knows variants, how a new one appears, how duplicates
and unsupported cases fail, and which reflection, naming, startup, deployment,
and test assumptions it adds.

Choose the least powerful mechanism satisfying real extension pressure. Moving
creation to the composition edge keeps concrete names out of domain collaboration
but does not eliminate selection responsibility or automatically eliminate a
factory.

## Artifact

```text
Accepted creation pressure:
Variants and selection input:
Selection owner:
Overlap, precedence, duplicate, unsupported, and load-order policy:
Creation mechanism and assumptions:
Local conditional/mapping/registration/discovery comparison:
Fake variant and startup-failure checks:
Deferred openness:
```

## Stop And Separation

Stop when selection has one owner, conflicts and failures are visible, and the
creation mechanism is no more open or operationally powerful than accepted
pressure requires.

Use `variation-roles-and-transitions` when the caller role itself is unresolved,
`generic-dispatch-systems` for a full representation-operation matrix, and
`abstraction-review` for promotion of a concrete factory/registry boundary.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, Chapters 6-8, pp. 155-225, for factories, dependency inversion,
  creation at the edge, forwarding, and the distinction between moving creation
  and eliminating a factory.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11, Indirection,
  public-manuscript pp. 64-69 and 90-95, for ordered dispatch conflicts,
  openness cost, participant pressure, and interface calcification.
- Automatic discovery, startup visibility, and deployment checks are Developer
  adaptations of those boundaries.
