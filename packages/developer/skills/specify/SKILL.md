---
name: specify
description: "Clarify product meaning, scope, invariants, constraints, counterexamples, and blocking unknowns from a requirement, bug report, code behavior, or implementation request. Use when implementation could be mechanically correct while still being wrong about what must be true."
---

# Specify

Clarify what must be true without deciding how to build it.

## Core Question

What must be true, in scope, and not guessed?

## Inputs

- Requirement, product request, bug report, or policy
- Observed code or UI behavior
- Existing tests, examples, and accepted decisions
- Constraints, non-goals, and affected users when known

## Output

Lead with the user's product language; keep specification labels secondary.
Make the contract inspectable rather than burying it in prose. Default to:

- a scope table separating in scope, out of scope, and intentionally unchanged;
- a contract table with `Must be true`, `Evidence or owner`, and `Violating counterexample`;
- a short assumptions/decisions list that visibly distinguishes provisional facts
  from human-owned choices.

A single obvious invariant may use compact bullets, but multiple constraints or
scope boundaries must use the tables. Produce product meaning, invariant, scope
and non-scope, constraints, counterexamples, and blocking unknowns. When used
inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: the clarified product contract
Basis: request, behavior, examples, and explicit assumptions
Open questions: unresolved product decisions, or none
Artifacts: invariant, scope, constraints, and counterexamples
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when the product contract is precise enough that different reasonable
implementations would preserve the same meaning. Revisit when the user changes
scope or new behavior contradicts the invariant.

## Method

1. Separate desired outcome from proposed implementation.
2. State the product meaning in the user's language.
3. Mark in-scope, out-of-scope, and intentionally unchanged behavior.
4. State the invariant and turn it into checkable constraints.
5. Pair each important constraint with a violating counterexample.
6. Distinguish evidence-backed facts, provisional assumptions, and decisions
   only the user or product owner can make.
7. Ask the smallest clarification question only when guessing would materially
   change the contract.

## Missing Evidence

Return `needs-evidence` when repository or product evidence can answer the
question. Return `blocked` only when a human-owned product decision is required.
Return `not-applicable` when product meaning is already accepted and no scope or
invariant question remains. Bound non-consequential uncertainty with an
explicit provisional assumption.

## Boundary

Do not build a full condition model, design the implementation, schedule
structural work, mutate artifacts, or verify completion.
