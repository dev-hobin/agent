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

## Output

Lead with the user's product language; keep design labels secondary. A resolved
sketch must be inspectable as an implementation shape, not only narrated in
paragraphs. Produce:

1. a compact case/check table;
2. concrete data or state definitions, including raw and refined forms when an
   input's provenance is broader than the accepted domain;
3. wishful top-level code, pseudocode, or an interaction skeleton in a fenced
   code block;
4. a wished-interface table with contract, owner, hidden detail, and stop check;
   when raw and refined forms differ, show the parser or smart constructor whose
   input preserves the narrowest honest representation already established for
   callers, whose success returns the refined value, and whose failure precedes
   dependent effects;
5. a small ordered implementation queue and explicitly deferred abstractions.

Use prose to explain why those artifacts have their shape. Add a compact table
or text sketch only when it makes an actual relation easier to inspect; do not
make a visual an output requirement. When used inside a larger task, return:

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
assumed. If broader, external, persisted, legacy, or otherwise less-trusted data
enters the surface, `resolved` also requires an evidence-preserving transition to
the domain representation; validation followed by an assertion is not such a
transition. `resolved` is not valid for a prose-only sketch: the output must show
the code or interaction skeleton and the checks that make the first item
executable. Revisit when implementation evidence breaks the ownership or
data-flow assumptions.

## Method

1. Choose the strongest available source of intent and state its confidence.
2. State the design unit's purpose in the user's language.
3. Derive relevant data or state definitions and their ownership pressure. Mark
   provenance and the raw-to-refined boundary whenever callers cannot already
   supply an invariant-carrying value. Preserve structure established by prior
   boundaries instead of widening it merely to check it again; less trusted does
   not imply less typed. Treat unchecked narrowing as no evidence.
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

## Context Directions

This section is generated from [judgment.json](judgment.json). The owning skill method remains complete without reading a prepared reference. Root `unless` exclusions win. Each reference is an independent candidate, not a requirement or authority.

Use the owning capability when at least one condition applies:

- A closure property, higher-order role, conventional interface, observer/finalizer split, or operational composition assumption is consequential.
- A domain value needs representation-independent constructors, selectors, predicates, operations, laws, replacement, or leak checks.
- A real change exposes repeated arguments, data clumps, misplaced knowledge, feature envy, navigation leaks, participant assumptions, or responsibility-focused test pressure.
- Accepted representations must coexist through generic operations, data-directed dispatch, registration, or explicit unsupported capabilities.
- Accepted variants may share caller messages, substitution obligations, effects, failures, or unsupported cases.
- Accepted work needs conditional/ordered selection, object creation, factory/mapping/registration/discovery choice, or creation at the composition edge.
- An accepted language needs interpreter/VM/compiler lowering, calling convention, effect summaries, optimization guards, tail-space, roots, release, or mixed execution.
- An operation or event changes a source domain type into a target type with consequential preserved, consumed, retained, terminal, or failure semantics.
- At least two completed designs with stable purposes/data models expose aligned common movement and possible variation roles.
- Atomic, interval, itemized, structured, recursive, intertwined, multi-input, complex-output, or interactive data must determine the structural template.
- Correctness depends on prior interactions, identity, aliases, mutation, transitions, stale/duplicate/reordered/concurrent events, atomicity, streams, logs, replay, or demand history.
- Correctness depends on work, continuation/tail position, stack/queue/buffer cost, paused dependencies, overload, lazy acquisition, retention, acknowledgment, cancellation, or bounds without product history being primary.
- External, serialized, persisted, legacy, foreign, genuinely unknown at the current boundary, nullable, or overly broad input must become an accepted domain value; checks are repeated, return no refined value, occur after effects, or are followed by an assertion, cast, non-null claim, unchecked decode, or public raw construction.
- Mixed representation worlds need direct operation, coercion, canonicalization, explicit context, or rejection with visible precision/identity/order/capability loss.
- One accepted purpose contains several separately nameable subproblems with composable intermediate results.
- Product information, variants, examples, or tests should determine the function skeleton, and no narrower template, composition, generation, accumulator, or evidence-preserving boundary question is primary.
- Recursive calls are computed by an algorithm idea rather than immediate data fields, including numeric, randomized, divide-and-conquer, or backtracking processes.
- The design needs symbolic data, a DSL, query/workflow language, grammar, parser, evaluator, result/search shape, scope, order, effects, errors, or termination semantics.
- The sketch must choose a level, owner, environment/interface boundary, hidden choice, or dependency direction, and no narrower route is primary.
- Traversal recomputes work, loses original/path context, requires provenance/visited/cache knowledge, or needs a sufficient summary.

Do not use it when any exclusion applies; these exclusions win:

- A concrete caller-facing candidate already exists and only its stability must be reviewed.
- The unresolved issue is product meaning or condition semantics rather than implementation shape.

Prepared references are independent candidates, never requirements or authority:

### `references/accumulator-invariants.md`

- Traversal recomputes work, loses original/path context, requires provenance/visited/cache knowledge, or needs a sufficient summary. The reference can add this material distinction: Derives the original/current/accumulated relation, ownership, preservation, conclusion, and semantic/resource delta.

### `references/closure-and-conventional-interfaces.md`

- A closure property, higher-order role, conventional interface, observer/finalizer split, or operational composition assumption is consequential. The reference can add this material distinction: Derives composition membership, closed operations, finalizers, role contracts, and operational interface assumptions.

### `references/composition-by-wishes.md`

- One accepted purpose contains several separately nameable subproblems with composable intermediate results. The reference can add this material distinction: Derives independent wished-operation contracts, intermediate meanings, composition checks, and one executable slice.

### `references/data-driven-design.md`

- At least two completed designs with stable purposes/data models expose aligned common movement and possible variation roles. The reference can add this material distinction: Derives accepted data meaning, examples, purpose, behavior, structural template, completion, and checks.
- Atomic, interval, itemized, structured, recursive, intertwined, multi-input, complex-output, or interactive data must determine the structural template. The reference can add this material distinction: Derives accepted data meaning, examples, purpose, behavior, structural template, completion, and checks.
- One accepted purpose contains several separately nameable subproblems with composable intermediate results. The reference can add this material distinction: Derives accepted data meaning, examples, purpose, behavior, structural template, completion, and checks.
- Product information, variants, examples, or tests should determine the function skeleton, and no narrower template, composition, generation, accumulator, or evidence-preserving boundary question is primary. The reference can add this material distinction: Derives accepted data meaning, examples, purpose, behavior, structural template, completion, and checks.
- Recursive calls are computed by an algorithm idea rather than immediate data fields, including numeric, randomized, divide-and-conquer, or backtracking processes. The reference can add this material distinction: Derives accepted data meaning, examples, purpose, behavior, structural template, completion, and checks.
- Traversal recomputes work, loses original/path context, requires provenance/visited/cache knowledge, or needs a sufficient summary. The reference can add this material distinction: Derives accepted data meaning, examples, purpose, behavior, structural template, completion, and checks.

### `references/data-shape-template-catalog.md`

- Atomic, interval, itemized, structured, recursive, intertwined, multi-input, complex-output, or interactive data must determine the structural template. The reference can add this material distinction: Derives exact branches, selectors, natural recursions, delegations, and justified omissions from accepted data.

### `references/design-levels-and-boundaries.md`

- A closure property, higher-order role, conventional interface, observer/finalizer split, or operational composition assumption is consequential. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- A domain value needs representation-independent constructors, selectors, predicates, operations, laws, replacement, or leak checks. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- Accepted representations must coexist through generic operations, data-directed dispatch, registration, or explicit unsupported capabilities. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- An accepted language needs interpreter/VM/compiler lowering, calling convention, effect summaries, optimization guards, tail-space, roots, release, or mixed execution. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- Correctness depends on prior interactions, identity, aliases, mutation, transitions, stale/duplicate/reordered/concurrent events, atomicity, streams, logs, replay, or demand history. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- Correctness depends on work, continuation/tail position, stack/queue/buffer cost, paused dependencies, overload, lazy acquisition, retention, acknowledgment, cancellation, or bounds without product history being primary. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- Mixed representation worlds need direct operation, coercion, canonicalization, explicit context, or rejection with visible precision/identity/order/capability loss. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- The design needs symbolic data, a DSL, query/workflow language, grammar, parser, evaluator, result/search shape, scope, order, effects, errors, or termination semantics. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.
- The sketch must choose a level, owner, environment/interface boundary, hidden choice, or dependency direction, and no narrower route is primary. The reference can add this material distinction: Establishes caller vocabulary, levels, observers, guarantee owners, hidden choices, assumptions, drift, and falsifiers.

### `references/earned-abstraction.md`

- At least two completed designs with stable purposes/data models expose aligned common movement and possible variation roles. The reference can add this material distinction: Aligns completed designs into stable variation roles, migration boundaries, transfer evidence, and a candidate surface.

### `references/evidence-preserving-boundaries.md`

- External, serialized, persisted, legacy, foreign, genuinely unknown at the current boundary, nullable, or overly broad input must become an accepted domain value; checks are repeated, return no refined value, occur after effects, or are followed by an assertion, cast, non-null claim, unchecked decode, or public raw construction. The reference can add this material distinction: Supplies the Evidence-Preserving Boundaries distinctions, counterexamples, artifact obligations, and stop checks for this route.

### `references/generative-recursion.md`

- Recursive calls are computed by an algorithm idea rather than immediate data fields, including numeric, randomized, divide-and-conquer, or backtracking processes. The reference can add this material distinction: Derives generated subproblems, preservation, combination, progress measures, traces, and divergence boundaries.

### `references/generic-dispatch-systems.md`

- Accepted representations must coexist through generic operations, data-directed dispatch, registration, or explicit unsupported capabilities. The reference can add this material distinction: Derives variant-operation axes, dispatch ownership, conflict policy, extension checks, and simpler alternatives.

### `references/language-semantics.md`

- An accepted language needs interpreter/VM/compiler lowering, calling convention, effect summaries, optimization guards, tail-space, roots, release, or mixed execution. The reference can add this material distinction: Derives the language gate, semantic representation, evaluator/result contract, unsupported programs, and ordinary-data alternative.
- The design needs symbolic data, a DSL, query/workflow language, grammar, parser, evaluator, result/search shape, scope, order, effects, errors, or termination semantics. The reference can add this material distinction: Derives the language gate, semantic representation, evaluator/result contract, unsupported programs, and ordinary-data alternative.

### `references/meaning-preserving-conversions.md`

- Mixed representation worlds need direct operation, coercion, canonicalization, explicit context, or rejection with visible precision/identity/order/capability loss. The reference can add this material distinction: Derives conversion paths, preserved and lost observers, ambiguity, cycle policy, and unsupported checks.

### `references/process-shape-and-resources.md`

- Correctness depends on work, continuation/tail position, stack/queue/buffer cost, paused dependencies, overload, lazy acquisition, retention, acknowledgment, cancellation, or bounds without product history being primary. The reference can add this material distinction: Derives generated work, control, waits, bounds, roots, release, effects, acknowledgment, and residual risk.

### `references/representation-barriers.md`

- A domain value needs representation-independent constructors, selectors, predicates, operations, laws, replacement, or leak checks. The reference can add this material distinction: Derives public operations and laws, alternate representations, caller rewrite, replacement check, and leak search.

### `references/responsibility-and-collaboration.md`

- A real change exposes repeated arguments, data clumps, misplaced knowledge, feature envy, navigation leaks, participant assumptions, or responsibility-focused test pressure. The reference can add this material distinction: Supplies the Responsibility And Collaboration distinctions, counterexamples, artifact obligations, and stop checks for this route.

### `references/runtime-and-compilation.md`

- An accepted language needs interpreter/VM/compiler lowering, calling convention, effect summaries, optimization guards, tail-space, roots, release, or mixed execution. The reference can add this material distinction: Derives execution convention, live state, effects, guards, fallback, tail space, roots, release, and interoperation.

### `references/selection-and-creation.md`

- Accepted work needs conditional/ordered selection, object creation, factory/mapping/registration/discovery choice, or creation at the composition edge. The reference can add this material distinction: Supplies the Selection And Creation distinctions, counterexamples, artifact obligations, and stop checks for this route.

### `references/state-history-and-order.md`

- Correctness depends on prior interactions, identity, aliases, mutation, transitions, stale/duplicate/reordered/concurrent events, atomicity, streams, logs, replay, or demand history. The reference can add this material distinction: Derives history summary, transition/order law, stale/duplicate policy, identity, replay, and coordination scope.

### `references/type-transitions.md`

- An operation or event changes a source domain type into a target type with consequential preserved, consumed, retained, terminal, or failure semantics. The reference can add this material distinction: Supplies the Type Transitions distinctions, counterexamples, artifact obligations, and stop checks for this route.

### `references/variation-roles.md`

- Accepted variants may share caller messages, substitution obligations, effects, failures, or unsupported cases. The reference can add this material distinction: Supplies the Variation Roles distinctions, counterexamples, artifact obligations, and stop checks for this route.
