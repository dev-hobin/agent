# Variation Roles

Use this reference when accepted variants may share one caller protocol without
exposing concrete type.

## Role And Substitution

State:

```text
caller messages
preconditions
result meaning
failure outcomes
effects and ordering
unsupported cases
implementations
```

Every implementation must preserve caller expectations. A variant requiring
stronger inputs or producing different result/effect meaning may need a narrower
role.

Conditionals remain appropriate when variants are local, finite, readable, and
owned together. Polymorphism is justified when accepted variants repeatedly
force old behavior owners to change and callers can remain ignorant of concrete
types.

## Artifact

```text
Accepted variation pressure:
Caller role contract:
Implementations:
Precondition/result/failure/effect substitution checks:
Unsupported cases:
Direct-conditional alternative:
Transfer implementation:
Deferred variants:
```

## Stop And Separation

Stop when every admitted implementation substitutes for all declared observers
and one transfer implementation fits without adding a type test or flag to the
caller contract.

Use `type-transitions` when one domain type becomes another,
`selection-and-creation` when choosing/constructing a variant is independent,
and `model/contract-replacement` when role compatibility itself is disputed.
Route a shaped role candidate to `abstraction-review` for promotion.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, Chapters 5-6, pp. 102-170, for responsibility separation, role
  substitution, and polymorphic movement.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, Chapter 5, pp. 47-60,
  calibrates caller-contract replacement and observer-relative preservation.
