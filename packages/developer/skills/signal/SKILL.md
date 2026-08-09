---
name: signal
description: "Inspect requirements, code, diffs, tests, UI states, names, or recent changes for observable structural movement and classify it as absent, horizontal, vertical, or ambiguous. Use when duplication, model-code mismatch, boundary pressure, parallel cases, or an emerging refactoring candidate needs a smallest evidence-backed observation."
---

# Signal

Observe structural movement without promoting or scheduling it.

## Core Question

What structural movement is actually visible in the evidence?

## Judgment Spine

```text
current pressure
-> closest comparable pair
-> one smallest meaningful difference
-> one behavior-preserving falsifying move
-> no-signal | horizontal | vertical | ambiguous
```

The output is an observation and optional candidate, never a refactoring plan.

## Inputs

- Requirement, code slice, diff, tests, command output, or UI state
- Selected comparable artifacts
- Invariant or condition model when available
- Known callers when shared helpers, APIs, or boundaries are involved

## Supporting Materials

The core method is complete without supporting material. Supporting material may
refine the current question; it is guidance, not authority.

If the host has supplied a bounded selection for this invocation, use it as the
current selection. Apply each material only to the question it actually
addresses and preserve any visible mismatch as a limitation. Do not rediscover
alternatives unless the selection is explicitly incomplete.

Otherwise, inspect the colocated [Skill TOC](toc.json). Use its root `when` and
`unless` conditions to confirm that this method applies; exclusions win. If an
exclusion applies, return `not-applicable` rather than forcing the method. Then
evaluate every Reference's `when` conditions and read the smallest materially
applicable set before producing the result. Broad topic similarity alone is not
sufficient. If no Reference applies, proceed with the core method alone.

## Output

Lead with the observed code or product pressure; keep signal labels secondary.
Make the comparison visible. For two or more artifacts, use a table with
`Artifact`, `Same responsibility`, `Smallest difference`, and `Evidence`; then
show the proposed behavior-preserving movement as a compact before/after code
snippet or ASCII relation map when code or boundaries are involved. Finish with
a one-line classification card containing `no-signal`, `horizontal`, `vertical`,
or `ambiguous` plus confidence. Include model-code mismatch and a concrete
review candidate only when vertical or ambiguous. When used inside a larger
task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: observed structural movement and confidence
Basis: selected artifacts, differences, callers, and model evidence
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: horizontal movement or concrete review candidate
```

Return only this skill's judgment for the question at hand.

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
