---
name: sketch
description: "Shape an implementable design surface from a requirement, invariant, problem model, existing code, or representative cases using data definitions, templates, wished interfaces, collaborations, checks, and a small implementation queue. Use when ownership, boundaries, data flow, recursion, state, composition, responsibility, variation, or implementation shape remains unresolved. Prefer sketch when caller-facing operations or collaborations still need to be invented; review a candidate only after that concrete surface exists."
---

# Sketch

Turn accepted intent into an implementable design surface.

## Core Question

What design surface makes this intent implementable?

## Judgment Spine

```text
accepted intent and cases
-> data/state/ownership facts
-> one unresolved design question
-> wishful caller-visible surface
-> contract, owner, hidden detail, and falsifier
-> first executable item + explicit handoffs
```

A reference extends one arrow in this spine. It must not contribute unrelated
insights merely because they share a book or broad topic. If a question has its
own artifact and stop, select or create a separate route.

## Inputs

- Requirement, invariant, or problem model when available
- Existing code, API, data shape, UI flow, or failing behavior
- Representative normal, boundary, forbidden, and product-meaning cases
- Constraints and verification targets

## Reference Routing

The machine-readable [reference policy](reference-policy.json) is the routing
authority. Each route answers one narrower design question and declares the
judgment step, artifact, stop, and separation boundary it owns. Select a narrow
route instead of its fallback; select several only when each produces an
independent artifact needed by the same sketch. A co-required set means every
member is necessary for that route's one result, not that the documents share a
subject. Use the exemption only when no trigger applies and cite its evidence.

## Output

Lead with the user's product language; keep design labels secondary. A resolved
sketch must be inspectable as an implementation shape, not only narrated in
paragraphs. Produce:

1. a compact case/check table;
2. concrete data or state definitions;
3. wishful top-level code, pseudocode, or an interaction skeleton in a fenced
   code block;
4. a wished-interface table with contract, owner, hidden detail, and stop check;
5. a small ordered implementation queue and explicitly deferred abstractions;
6. an ASCII flow, relation map, state transition, or boundary diagram whenever
   two or more components, states, or collaborations are materially related.

Use prose only to explain why those artifacts have their shape. Route
`visualize` separately when choosing the visual form is itself consequential;
do not require that extra route for a straightforward inline table or ASCII
map. When used inside a larger task, return:

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
assumed. `resolved` is not valid for a prose-only sketch: the output must show
the code or interaction skeleton and the checks that make the first item
executable. Revisit when implementation evidence breaks the ownership or
data-flow assumptions.

## Method

1. Choose the strongest available source of intent and state its confidence.
2. State the design unit's purpose in the user's language.
3. Derive relevant data or state definitions and their ownership pressure.
4. List representative cases before choosing code shape.
5. Name each independently unresolved design question and select only its routed
   extension; keep disputed meaning in `model`.
6. Derive the needed template, composition, generation, invariant, level,
   process, state, dispatch, language, or responsibility artifact.
7. Write wishful top-level code, pseudocode, or interaction flow in a fenced
   code block. Show every wished interface in context rather than merely naming
   helpers in prose.
8. For each wished interface, state its purpose, contract, owner, hidden detail,
   and representative stop check in a table.
9. Draw the smallest inline map that exposes non-trivial data flow,
   collaboration, state movement, or ownership boundaries.
10. Separate design artifacts, implementation items, candidate reviews, and
    deferred questions. Keep the implementation queue small.

## Missing Evidence

Return `needs-evidence` when repository inspection or representative cases can
settle the design pressure. Return `blocked` when a product-owned choice would
materially change the surface. Return `not-applicable` when the local
implementation shape is already clear. Label all provisional design
assumptions.

## Boundary

Do not own product scope, decide model correctness, promote an abstraction,
schedule structural timing, implement the change, or verify completion. Creating
an original public operation set, representation boundary, ownership map, or
caller shape belongs here even when replacement pressure motivates it. Route
`abstraction-review` only after a concrete caller-facing candidate exists; route
`model` first only when unresolved cases or rules can materially change the
surface.
