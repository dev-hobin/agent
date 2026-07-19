---
name: model
description: "Model the condition space behind a requirement, invariant, bug, policy, workflow, or code behavior using cases, predicates, rules, forbidden states, transitions, objectives, guarantee placement, and verification targets. Use when correctness depends on combinations, absence or default semantics, contracts, replacement, state, time, or policy interaction."
---

# Model

Expose the condition space a valid implementation must satisfy.

## Core Question

Which cases, rules, states, or transitions make the claim precise?

## Inputs

- Requirement, invariant, policy, workflow, or code behavior
- Existing cases, tests, examples, and counterexamples
- Data shapes, states, transitions, and external constraints when relevant

## Output

Lead with the user's product language; keep modeling labels secondary.
Produce the lightest useful model: domain, predicates or cases, facts, rules,
forbidden cases, transitions or objectives when relevant, guarantee placement,
and verification targets. When used inside a larger task, return:

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
5. Model transitions separately from current-state validity when order matters.
6. Place each guarantee at the appropriate type, boundary, validation, test,
   property, proof, model check, or human decision.
7. Derive verification targets and the counterexample each target should catch.

## Missing Evidence

Return `needs-evidence` when code, data, or examples can settle a case. Return
`blocked` when resolving the model would require inventing product policy.
Return `not-applicable` when no consequential condition space remains to model.
Keep provisional rules visibly provisional.

## Boundary

Do not decide product scope, design the implementation surface, schedule
structural work, mutate artifacts, or make the final evidence judgment.

## Reference Routing

Read [the problem-modeling reference](references/problem-modeling.md) for
policy-heavy, stateful, optimization, safety-critical, or otherwise complex
condition spaces.

Read [the worked models and specialized techniques](references/worked-models-and-specialized-techniques.md)
when a boolean policy, relational constraint, replacement, temporal rule, proof
obligation, solver encoding, logic program, or plan needs a complete calibration
example rather than the compact procedure alone.
