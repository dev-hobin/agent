# Composition By Wished Operations

Use this reference after the data-driven recipe when one accepted purpose contains
several independently meaningful subproblems whose results must compose.

## Wish Before Helper Bodies

Write the product-level result first:

```text
publishableTasks(tasks):
  return sortByPriority(onlyReady(normalize(tasks)))
```

For each wished operation state:

```text
purpose and domain result
contract and failure behavior
representative examples
its own data-derived template
why it is an independent subproblem
```

A helper is earned when it solves a separately nameable domain problem, delegates
to another data definition, or exposes a required intermediate result. Length
alone is not a purpose.

## Composition Boundary

Check that adjacent results have compatible meaning, ordering, eagerness,
replayability, effects, and failure behavior. Acquisition, pure transformation,
and effects often deserve separate owners because their contracts differ, but do
not split an atomic invariant merely to obtain a neat pipeline.

## Artifact

```text
Top-level wished composition:
Subproblem purposes and contracts:
Intermediate result meanings:
Ordering, effect, and failure compatibility:
Independent examples and templates:
First composable implementation slice:
Deferred helpers:
```

## Stop And Separation

Stop when each wished operation can be designed and checked independently and the
top-level composition reads in product language without hiding an incompatible
process boundary.

Use `earned-abstraction` only after several completed correct designs expose
stable shared roles. Use process/state routes when the unresolved issue is
execution or history rather than decomposition.

## Source Trace

- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3,
  Chapter 11
  for wish lists, composition, and independently designed functions.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 1.1
  for wishful decomposition and black-box procedures.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11, Composition,
  public-manuscript pp. 98-115, calibrates composition units and phase ownership;
  process details remain on their dedicated route.
