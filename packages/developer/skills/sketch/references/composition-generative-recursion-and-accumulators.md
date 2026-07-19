# Composition, Generative Recursion, And Accumulators

Use this reference after the base data recipe when structure alone does not
finish the design. It distinguishes four moves that are often blurred together:
designing an auxiliary, abstracting completed designs, generating new
subproblems, and remembering knowledge that traversal would otherwise lose.

## Design By Composition

Write a wishful top level before helper bodies:

```text
publishableTasks(tasks):
  return sortByPriority(onlyReady(normalize(tasks)))
```

For each wished operation, run the full small recipe:

```text
purpose: what subproblem it solves
contract: input and output meanings
examples: representative success and boundary cases
template: derived from its data
reason: why it is a distinct subproblem
```

An auxiliary is earned when it solves a separate domain subproblem, processes a
referenced data definition, or generalizes a problem that the direct design
exposes. “The original function is long” is not an independent purpose.

## Abstraction From Completed Examples

Start with at least two correct concrete designs that share a template.

```text
sum(numbers):
  Empty -> 0
  Node(first, rest) -> first + sum(rest)

allReady(tasks):
  Empty -> true
  Node(first, rest) -> first.ready && allReady(rest)
```

Align corresponding positions:

| Role | `sum` | `allReady` |
| --- | --- | --- |
| base | `0` | `true` |
| item projection | identity | `task.ready` |
| combine | `+` | `&&` |

Only now is a fold-shaped candidate visible:

```text
fold(sequence, base, project, combine)
```

The shared template is evidence, not approval. Check that the roles have stable
meaning, old functions become simple calls, process/cost does not accidentally
change, and one realistic new case fits without adding flags. `abstraction-review`
owns the promotion decision.

## Structural Versus Generative Recursion

Structural recursion consumes pieces selected directly from the input data
definition. Generative recursion creates a new problem by domain knowledge.

```text
structural: totalEstimate(rest)
  // rest is a field in Node(Task, Tasks)

generative: binarySearch(sorted, lower, midpoint - 1)
  // the next interval is calculated, not selected from a data field
```

Misclassifying the second as structural hides the algorithm idea and its
termination obligation.

## Generative Recursion Recipe

Answer four questions before the body:

```text
trivial: which problems have a direct answer?
generate: how are new subproblems produced?
solve/combine: how do recursive answers form this answer?
terminate: why do generated problems approach a trivial case?
```

Worked binary-search sketch:

```text
search(sorted, target, low, high):
  if low > high:
    return NotFound                    // trivial

  mid = floor((low + high) / 2)        // generation knowledge
  if sorted[mid] == target:
    return Found(mid)                  // trivial
  if target < sorted[mid]:
    return search(sorted, target, low, mid - 1)
  return search(sorted, target, mid + 1, high)
```

Process examples must show generated intervals:

```text
[0, 6] -> [4, 6] -> [4, 4] -> Found(4)
[0, 0] -> [1, 0] -> NotFound
```

Termination measure: `high - low + 1` is a natural number for non-trivial
calls, and each recursive call strictly decreases it. If no decreasing measure
is known, state the possible non-termination boundary rather than asserting
that the input “gets smaller.”

## Accumulator Recipe

Do not begin by adding an extra parameter. First identify the lost knowledge or
repeated work in a conventional design.

Example pressure: repeatedly appending to the end while reversing a sequence
reprocesses prior results. Introduce `seenReversed` with an invariant:

```text
original == reverse(seenReversed) ++ remaining
```

Trace the relation:

```text
original [a,b,c], remaining [a,b,c], seenReversed []
original [a,b,c], remaining [b,c],   seenReversed [a]
original [a,b,c], remaining [c],     seenReversed [b,a]
original [a,b,c], remaining [],      seenReversed [c,b,a]
```

The invariant determines initialization, update, and result:

```text
reverse(items):
  loop(remaining, seenReversed):
    Empty -> seenReversed
    Node(first, rest) -> loop(rest, prepend(first, seenReversed))
  return loop(items, Empty)
```

Check the invariant at three points:

1. initialization relates the original input to the initial accumulator;
2. one transition preserves the relationship;
3. the base case plus the invariant implies the promised result.

Different invariants create different algorithms. Choose the simplest invariant
that solves observed pressure; an accumulator with no stated meaning is hidden
state.

## Iterative Refinement

When a required case cannot be expressed or a forbidden case remains possible,
change the data definition and propagate the change through:

```text
data examples
-> behavior examples
-> templates
-> implementations
-> tests
-> serialized/public compatibility surfaces
```

A local type edit is incomplete when old persisted forms or callers remain in
circulation.

## Failure Diagnosis

| Symptom | Repair |
| --- | --- |
| wished helper has no examples or independent purpose | inline it or run its own recipe |
| abstraction is derived from one function | complete another concrete design first |
| abstract parameters are implementation fragments | restate stable variation roles |
| generated recursive call lacks an algorithm idea | return to structural template or state generation rule |
| termination says only “smaller” | provide a well-founded measure or explicit divergence boundary |
| accumulator is added for style | show lost knowledge, repeated work, or process pressure |
| accumulator update is guessed | derive it from the invariant |

## Source Trace

- [*How to Design Programs*, official living edition](https://htdp.org/2026-5-28/Book/index.html):
  design by composition, abstraction from concrete functions, generative
  recursion and termination, accumulators and invariants, and iterative
  refinement.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  wishful procedure decomposition, higher-order abstraction, and process shape.
