---
name: signal
description: "Inspect requirements, code, diffs, tests, UI states, names, or recent changes for observable structural movement and classify it as absent, horizontal, vertical, or ambiguous. Use when evidence suggests duplication, model-code mismatch, boundary pressure, or an emerging refactoring candidate."
---

# Signal

Observe structural movement without promoting or scheduling it.

## Core Question

What structural movement is actually visible in the evidence?

## Inputs

- Requirement, code slice, diff, tests, command output, or UI state
- Selected comparable artifacts
- Invariant or condition model when available
- Known callers when shared helpers, APIs, or boundaries are involved

## Reference Routing

Read [the flocking and structural movement reference](references/flocking-and-structural-movement.md)
when duplication, parallel branches, similar tests, repeated UI states,
conditionals, or a recent refactor need a behavior-preserving next move. Also
read it when the horizontal/vertical distinction is consequential or the
available checks may not keep a small movement green. A direct, evidence-backed
observation with no proposed movement does not need the reference.

## Output

Lead with the observed code or product pressure; keep signal labels secondary.
Produce a judgment of `no-signal`, `horizontal`, `vertical`, or `ambiguous`,
with confidence, evidence, selected comparison, smallest meaningful difference,
smallest behavior-preserving movement, model-code mismatch, and a concrete
review candidate only when vertical or ambiguous. When used inside a larger
task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: observed structural movement and confidence
Basis: selected artifacts, differences, callers, and model evidence
Open questions: stabilizing or rejecting evidence still needed, or none
Artifacts: horizontal movement or concrete review candidate
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when the smallest meaningful difference is visible and the evidence
supports a structural classification or an explicit evidence gap. Revisit after
a behavior-preserving change, new caller evidence, or a changed model reshapes
the comparison.

## Method

1. State the observed change pressure.
2. Select the two artifacts most alike by responsibility, vocabulary, state
   transition, failure mode, model element, or user-visible outcome.
3. Name their smallest meaningful difference.
4. Identify the smallest behavior-preserving movement that would expose whether
   the difference is incidental or meaningful.
5. Keep same-level alignment horizontal. Similarity alone is not evidence for a
   new abstraction.
6. Classify movement as vertical only when a nameable concept, policy, boundary,
   responsibility, or invariant remains after the difference is understood.
7. Check model-code mismatches, hidden caller policy, duplicated defaults,
   history, state, and misleading vocabulary.
8. For vertical or ambiguous movement, state the candidate, pressure, hidden
   detail, invariant risk, selected evidence, and evidence still needed.

## Missing Evidence

Return `needs-evidence` when another caller, comparison, diff, or model can
change the classification. Return `not-applicable` when no structural movement
is visible. Return `blocked` only when the relevant evidence cannot be accessed;
otherwise keep product-meaning claims provisional when no accepted model exists.

## Boundary

Do not implement the movement, promote a candidate, decide timing, or turn
horizontal similarity into a vertical abstraction.
