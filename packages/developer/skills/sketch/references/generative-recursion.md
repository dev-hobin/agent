# Generative Recursion

Use this reference when the algorithm creates a new instance of the problem
rather than following an immediate self-reference in the data definition.

## Structural Or Generated

```text
structural call:
  consumes a field selected directly from one data clause

generative call:
  computes a new problem instance from domain or algorithm knowledge
```

A generated problem may happen to be a suffix or subinterval. What matters is
why it exists. Misclassifying it as structural hides both the algorithm idea and
its progress obligation.

## Generative Design Spine

```text
trivial: which instances have direct answers?
solve: what are those answers?
generate: how are next subproblems produced?
preserve: why do their solutions contribute to this problem?
combine: how are recursive answers and current facts assembled?
progress: what well-founded measure decreases on every branch?
failure: how are no-solution, exhausted search, error, and divergence distinct?
```

A preserving relation supports result correctness. A decreasing measure supports
termination. Neither implies the other.

## Process Trace

For binary search, record generated intervals rather than only input/output:

```text
[0, 6] -> [4, 6] -> [4, 4] -> Found(4)
[0, 0] -> [1, 0] -> NotFound
```

The measure `high - low + 1` decreases for every non-trivial call. The accepted
domain must also establish finite ordered bounds, valid indexing, and discrete
midpoint progress.

For every generated branch include:

```text
original problem
generation result
preserved relation
next measure
branch result and combination
```

## Machine, Numeric, Random, And Search Progress

Mathematical decrease can fail on a machine. State:

- exact versus inexact representation;
- rounding, overflow, underflow, and non-finite values;
- midpoint or update stagnation;
- tolerance meaning and iteration bounds;
- universal versus almost-sure termination for randomized progress;
- branch order, backtracking point, and visited-set scope for search.

Backtracking needs explicit failure and choice policy. Divergence in one branch is
not failure that permits the next candidate. Path-local, frontier, and global
visited sets preserve different meanings.

## Composition Boundary

A generative driver may use structurally recursive helpers. Do not label the
whole program generative or structural when collaborators have different process
obligations. Keep each helper's data recipe and the driver's generation recipe
separate.

## Artifact

```text
Problem domain and trivial instances:
Generation rule:
Preservation relation:
Combination rule:
Well-founded measure by branch:
Representative generated traces:
Machine/numeric/random progress limits:
Failure, exhaustion, error, and divergence:
Search order and visited scope, if relevant:
```

## Stop And Separation

Stop when every recursive branch has a generated-instance explanation, a
preservation argument, and a progress or explicit divergence boundary.

Use `accumulator-invariant` when the main issue is remembered traversal knowledge,
the `model` logic-query route when answer/search policy is unresolved, and
`process-shape-and-resources` when the algorithm is accepted but stack, work, or
storage behavior needs a design surface.

## Source Trace

- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, living build 9.2.0.3:
  Chapter 25,
  Chapter 26,
  Chapter 27,
  Chapter 28,
  Chapter 29,
  and Chapter 30
  for generated problems, preservation, termination, numerics, and backtracking;
  and Intermezzo 4
  for exact/inexact arithmetic and machine limits.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 1.2
  for generated process shape and resource growth; and
  Section 4.3
  for explicit choice, failure, rollback, and search-order pressure.
