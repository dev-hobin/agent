# Representation Barriers

Use this reference after [Design Levels And Boundaries](design-levels-and-boundaries.md)
when one accepted domain value needs public operations and laws that hide a
consequential representation choice.

## Build The Barrier

1. Name the domain value and interpretation.
2. List only supported constructors, selectors, predicates, and domain
   operations.
3. State laws callers may rely on.
4. Identify the one owner of validation, normalization, and simplification.
5. Write two materially different representations.
6. Rewrite one real caller using only public vocabulary.
7. Search for representation primitives outside the owner.

Do not expose a field alias merely because the representation contains the field.
Public operations come from caller purposes and stable laws.

## Worked Shape

```text
Rate = conversion relationship between two quantities

makeRate(numerator, denominator)
numeratorOf(rate)
denominatorOf(rate)
multiplyRate(left, right)

law: denominatorOf(makeRate(n, d)) > 0
law: Rate(1, 2) and Rate(2, 4) have equal domain meaning
```

Representation A normalizes at creation. Representation B stores raw terms and
normalizes at observation. `multiplyRate` and callers must not change. The
barrier preserves freedom about representation and normalization time.

## Artifact

```text
Domain meaning and caller purposes:
Public operations and laws:
Invariant/normalization owner:
Representations A and B:
Real caller rewritten:
Replacement check:
Leak search:
Unsupported raw access:
```

## Stop And Separation

Stop when a materially different representation changes only the owner and
adapters, one real caller uses only domain vocabulary, and leak search finds no
raw primitives.

Reject when no choice is hidden, callers still require layout, or operations are
only field aliases with no stable law. Use `closure-and-conventional-interfaces`
when composition of values is the independent question.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 2.1
  for data abstraction, selectors/constructors, laws, and representation
  independence.
- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3,
  Chapter 22
  for accessors over alternate positional encodings.
- Replacement and repository leak-search artifacts are Developer adaptations of
  those barriers.
