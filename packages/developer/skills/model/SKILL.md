---
name: model
description: "Model unresolved condition space behind a requirement, invariant, bug, policy, workflow, or code behavior using cases, predicates, rules, forbidden states, transitions, objectives, guarantee placement, and verification targets. Use when correctness depends on combinations, absence or default semantics, contracts, replacement, state, time, or policy interaction that must be settled before design. Supplied laws or invariants that only need an interface shape belong directly to sketch."
---

# Model

Expose the condition space a valid implementation must satisfy.

## Core Question

Which cases, rules, states, or transitions make the claim precise?

## Judgment Spine

```text
unresolved uncertainty
-> admitted domain and consequential distinctions
-> rules, forbidden cases, and assumptions
-> counterexamples and guarantee owners
-> model artifact that constrains later design
```

Choose representation from the uncertainty, not from a favorite formal tool.
Specialized references extend one modeling obligation; they do not turn the leaf
into a catalog of solvers or languages.

## Inputs

- Requirement, invariant, policy, workflow, or code behavior
- Existing cases, tests, examples, and counterexamples
- Data shapes, states, transitions, and external constraints when relevant

## Output

Lead with the user's product language; keep modeling labels secondary. Render
the lightest executable model, not a prose-only explanation. Choose the surface
that matches the condition space:

- case, decision, or truth table for finite combinations;
- state-transition table or ASCII state diagram when order matters;
- rules plus forbidden-state table for policy and invariants;
- guarantee map linking each rule to its owner and verification target.

Show predicates, data shapes, equations, or solver-like rules in a fenced code
block when they are part of the model. Produce domain, facts, rules, forbidden
cases, transitions or objectives when relevant, guarantee placement, and
verification targets. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: the condition model and its main consequences
Basis: requirement, invariant, code, tests, and explicit assumptions
Open questions: unresolved policy or evidence gaps, or none
Artifacts: case table, rules, transitions, or verification targets
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when plausible counterexamples can be classified by the model and each
important rule has an observable verification target. Revisit when new cases,
states, transitions, or policy decisions invalidate the model.

## Method

1. Use an accepted invariant when available; otherwise label a provisional one.
2. Choose the lightest sufficient depth:
   - `light`: cases, constraints, and verification targets;
   - `structured`: explicit rules, forbidden states, or transitions;
   - `formal`: exhaustive combinations, temporal behavior, or solver-like
     constraints when the cost of omission justifies it.
3. Separate facts, decisions, assumptions, properties, and helper predicates.
4. Make missing, undefined, null, empty, legacy, and configured states explicit
   when absence matters. Name the policy owner and misplaced-default cases.
5. Select one specialized model only when contract, relation, time, exhaustive
   evidence, or search has an independent artifact and stop condition.
6. State the ability lost and guarantee gained by the chosen representation.
7. Place each guarantee at the appropriate type, boundary, parser, constructor,
   database constraint, test, property, proof, model check, or human decision.
   A validation result that carries no refined value and an unchecked assertion,
   cast, non-null claim, or typed deserialization target cannot own a
   representable-state guarantee. When raw and admitted domains differ, require
   an evidence-bearing transition without designing its API.
8. Derive counterexamples and verification targets without designing the API.

## Missing Evidence

Return `needs-evidence` when code, data, or examples can settle a case. Return
`blocked` when resolving the model would require inventing product policy.
Return `not-applicable` when no consequential condition space remains to model.
Keep provisional rules visibly provisional.

## Boundary

Do not decide product scope, design the implementation surface, schedule
structural work, mutate artifacts, or make the final evidence judgment. Words
such as “law,” “invariant,” or “replacement” do not require a model route when
the requirement already fixes their meaning and asks only for public operations,
ownership, collaborators, or caller shape; route that original surface to
`sketch`.


## Context Directions

This section is generated from [judgment.json](judgment.json). The owning skill method remains complete without reading a prepared reference. Root `unless` exclusions win. Each reference is an independent candidate, not a requirement or authority.

Use the owning capability when at least one condition applies:

- A deductive implementation-conformance claim needs preconditions, postconditions, invariant initialization/preservation/conclusion, termination, or arithmetic/tool assumptions.
- Bounded counterexample search, satisfiability, feasibility, optimization, scope/configuration, or solver result-state interpretation is consequential.
- Caller/callee obligations, API or schema compatibility, old/new preconditions and postconditions, or observer-relative refinement are consequential.
- Correctness depends on entities, intervals, cross-record integrity, quantified relations, bidirectional constraints, SQL translation, or set-versus-bag semantics.
- Facts/rules, zero-one-many answers, proof multiplicity, duplicates, negation-as-failure, binding order, search fairness, cycles, or divergence are consequential.
- Initial state, goal, legal actions, intermediate-state invariants, action costs, equivalent plans, or no-plan meaning is consequential.
- Prose or isolated examples hide consequential combinations, quantifiers, absence/default meaning, ability-guarantee tradeoffs, or model/environment assumptions, and no specialized route below is primary.
- Snapshots are insufficient because retry, stale or duplicate events, lifecycle, concurrency, safety, progress, stuttering, fairness, or temporal refinement matters.

Do not use it when any exclusion applies; these exclusions win:

- The supplied laws or invariants are already settled and only an implementable interface shape must be designed.

Prepared references are independent candidates, never requirements or authority:

### `references/contract-and-replacement-models.md`

- Caller/callee obligations, API or schema compatibility, old/new preconditions and postconditions, or observer-relative refinement are consequential. The reference can add this material distinction: Derives caller/callee obligations, replacement implications, observer compatibility, and refinement targets.

### `references/logic-query-semantics.md`

- Facts/rules, zero-one-many answers, proof multiplicity, duplicates, negation-as-failure, binding order, search fairness, cycles, or divergence are consequential. The reference can add this material distinction: Defines answer/proof identity, duplicates, negation, search, cycles, completion, and outcome semantics.

### `references/planning-models.md`

- Initial state, goal, legal actions, intermediate-state invariants, action costs, equivalent plans, or no-plan meaning is consequential. The reference can add this material distinction: Defines actions, intermediate states, invariants, objective, plan equivalence, and no-plan meaning.

### `references/problem-modeling.md`

- A deductive implementation-conformance claim needs preconditions, postconditions, invariant initialization/preservation/conclusion, termination, or arithmetic/tool assumptions. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Bounded counterexample search, satisfiability, feasibility, optimization, scope/configuration, or solver result-state interpretation is consequential. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Caller/callee obligations, API or schema compatibility, old/new preconditions and postconditions, or observer-relative refinement are consequential. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Correctness depends on entities, intervals, cross-record integrity, quantified relations, bidirectional constraints, SQL translation, or set-versus-bag semantics. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Facts/rules, zero-one-many answers, proof multiplicity, duplicates, negation-as-failure, binding order, search fairness, cycles, or divergence are consequential. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Initial state, goal, legal actions, intermediate-state invariants, action costs, equivalent plans, or no-plan meaning is consequential. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Prose or isolated examples hide consequential combinations, quantifiers, absence/default meaning, ability-guarantee tradeoffs, or model/environment assumptions, and no specialized route below is primary. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.
- Snapshots are insufficient because retry, stale or duplicate events, lifecycle, concurrency, safety, progress, stuttering, fairness, or temporal refinement matters. The reference can add this material distinction: Establishes admitted domains, distinctions, predicates, rules, forbidden cases, assumptions, owners, and counterexample targets.

### `references/proof-obligations.md`

- A deductive implementation-conformance claim needs preconditions, postconditions, invariant initialization/preservation/conclusion, termination, or arithmetic/tool assumptions. The reference can add this material distinction: Derives initialization, preservation, conclusion, termination, trusted-boundary, and residual-observer obligations.

### `references/relational-constraint-models.md`

- Correctness depends on entities, intervals, cross-record integrity, quantified relations, bidirectional constraints, SQL translation, or set-versus-bag semantics. The reference can add this material distinction: Derives quantified relation constraints, identity, multiplicity, endpoint, contradiction, and runtime-translation obligations.

### `references/solver-result-boundaries.md`

- Bounded counterexample search, satisfiability, feasibility, optimization, scope/configuration, or solver result-state interpretation is consequential. The reference can add this material distinction: Bounds solver claims by variables, encoding, witness, scope, exact result state, and unmodeled observers.

### `references/temporal-behavior-models.md`

- Snapshots are insufficient because retry, stale or duplicate events, lifecycle, concurrency, safety, progress, stuttering, fairness, or temporal refinement matters. The reference can add this material distinction: Derives action/frame laws, representative histories, safety, progress, fairness, and refinement obligations.
