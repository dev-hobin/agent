---
name: sketch
description: "Shape an implementable design surface from a requirement, invariant, problem model, existing code, or representative cases using data definitions, templates, wished interfaces, collaborations, checks, and a small implementation queue. Use when ownership, boundaries, data flow, recursion, state, composition, responsibility, variation, or implementation shape remains unresolved."
---

# Sketch

Turn accepted intent into an implementable design surface.

## Core Question

What design surface makes this intent implementable?

## Inputs

- Requirement, invariant, or problem model when available
- Existing code, API, data shape, UI flow, or failing behavior
- Representative normal, boundary, forbidden, and product-meaning cases
- Constraints and verification targets

## Reference Routing

Read [the data-driven design reference](references/data-driven-design.md) when
the information model, data variants, traversal, recursion, examples, or tests
should determine the function skeleton. Read it when a proposed sketch jumps
from prose to helpers without deriving cases and a template from the data.

Within that capability, read [the data-shape template catalog](references/data-shape-template-catalog.md)
when atomic, itemized, structured, recursive, intertwined, multi-input, output,
or interactive data must derive a template. Read
[composition, generative recursion, and accumulators](references/composition-generative-recursion-and-accumulators.md)
for wished auxiliaries, abstraction from completed functions, generated
subproblems and termination, or an invariant-bearing accumulator.

Read [the abstraction, composition, and state reference](references/abstraction-composition-and-state.md)
when wishful top-level design, representation independence, abstraction
barriers, compositional interfaces, module assumptions, environmental process
boundaries, state/history ownership, or levels of language carry consequential
judgment.

Within that capability, read [abstraction barriers and closure](references/abstraction-barriers-and-closure.md)
for a representation or combination boundary,
[processes, state, and time](references/processes-state-and-time.md) for runtime
shape, history, identity, streams, concurrency, or order, and
[generic operations and languages](references/generic-operations-and-languages.md)
for additive representations, coercion, symbolic data, a DSL, or an evaluator.

Read [the responsibility and variation reference](references/responsibility-and-variation.md)
when real change pressure exposes repeated arguments, data clumps, conditional
dispatch, misplaced knowledge, role substitution, object creation, factory
tradeoffs, or test-unit boundaries.

Read multiple references only when their questions genuinely combine: for
example, data shape may derive the operational skeleton while abstraction and
responsibility evidence determine its boundaries. A small local design whose
purpose, cases, data flow, and first item are already clear needs none.

## Output

Lead with the user's product language; keep design labels secondary.
Produce purpose, relevant data definitions, representative cases, a template,
wishful top level, wished interfaces, checks, a small implementation queue, and
explicitly deferred abstractions. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: the smallest implementable design surface
Basis: accepted intent, model, code, cases, and assumptions
Open questions: unresolved design consequences, or none
Artifacts: wished interfaces, checks, and implementation queue
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when the first implementation item is small enough to execute and check,
and non-local or invariant-bearing candidates are explicit rather than silently
assumed. Revisit when implementation evidence breaks the ownership or data-flow
assumptions.

## Method

1. Choose the strongest available source of intent and state its confidence.
2. State the design unit's purpose in the user's language.
3. Derive relevant data or state definitions and their ownership pressure.
4. List representative cases before choosing code shape.
5. Derive the template from data, state, traversal, or ownership flow.
6. Write wishful top-level code, pseudocode, or interaction flow.
7. For each wished interface, state its purpose, contract, owner, hidden detail,
   and representative stop check.
8. Separate design artifacts, implementation items, and deferred candidates.
9. Keep the queue small; do not turn the sketch into a project plan.

## Missing Evidence

Return `needs-evidence` when repository inspection or representative cases can
settle the design pressure. Return `blocked` when a product-owned choice would
materially change the surface. Return `not-applicable` when the local
implementation shape is already clear. Label all provisional design
assumptions.

## Boundary

Do not own product scope, decide model correctness, promote an abstraction,
schedule structural timing, implement the change, or verify completion.
