# Accumulator Invariants

Use this reference when traversal loses knowledge needed later, repeats work, or
requires an explicit summary of the processed and remaining problem.

## Pressure Before Parameter

Do not start by adding an argument. Name the pressure:

- prior work is recomputed;
- an answer must be built in an order the natural return path cannot provide;
- branch-local provenance or visited knowledge is required;
- a tail-position process needs a sufficient summary;
- a cached fact must remain consistent with the represented value.

An extra parameter without a stated meaning is hidden state.

## Invariant First

Write a relation among original input, current remainder, and accumulated
knowledge:

```text
original meaning
= combine(processed meaning, remaining meaning)
```

For reverse:

```text
original == reverse(seenReversed) ++ remaining
```

Trace it:

```text
original [a,b,c], remaining [a,b,c], seenReversed []
original [a,b,c], remaining [b,c],   seenReversed [a]
original [a,b,c], remaining [c],     seenReversed [b,a]
original [a,b,c], remaining [],      seenReversed [c,b,a]
```

The invariant determines initialization, transition, and result.

## Three Obligations

1. **Initial:** identity values make the relation true before work.
2. **Preserve:** every structural or generated branch updates all related values
   so the relation remains true.
3. **Conclude:** the base condition plus the invariant implies the public result.

If one branch cannot preserve the relation, revise the invariant or the ownership
of accumulated knowledge rather than patching the update.

## Ownership Forms

Choose the smallest truthful owner:

- helper argument for traversal-local context;
- closure for stable original context;
- data field for cached facts behind a closed update boundary;
- branch-local value for path provenance;
- frontier or global structure for graph search;
- threaded result when one branch consumes another branch's output.

Path-local, frontier, and global visited sets are not interchangeable. A public
wrapper should hide private accumulator states when only one initialization
satisfies the public contract.

## Semantic And Resource Delta

An accumulator transformation may change:

- arithmetic association and floating-point result;
- item or branch order;
- failure versus divergence;
- totality on previously failing inputs;
- tail position and stack usage;
- lookup complexity and retained memory;
- cache consistency and alias behavior.

Treat optimization, totality repair, and behavior preservation as different
claims. Verify the observer each claim names.

## Artifact

```text
Observed lost knowledge or repeated work:
Original / current / accumulated relation:
Identity initialization:
Transition and preservation explanation:
Base condition and conclusion:
Accumulator owner and visibility:
Representative trace:
Arithmetic/order/failure/space delta:
Public wrapper and checks:
```

## Stop And Separation

Stop when the invariant mechanically determines initialization, update, and
result, and the semantic/resource delta is explicit.

Use `generative-recursion` when next problems are algorithmically produced,
`state-history-and-order` when accumulated knowledge is persistent product
history, and `abstraction-review` only after a concrete accumulator interface or
cached representation exists to judge.

## Source Trace

- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, living build 9.2.0.3:
  Chapter 31,
  Chapter 32,
  Chapter 33,
  and Chapter 34
  for accumulator pressure, invariants, wrappers, ownership variants, cached
  fields, provenance, and accumulator-as-result designs.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 1.2
  and Section 5.4.2
  for process shape, continuation placement, and tail-space behavior.
- Machine-resource gates, visited-scope taxonomy, and production cache checks are
  Developer adaptations of those invariant and process boundaries.
