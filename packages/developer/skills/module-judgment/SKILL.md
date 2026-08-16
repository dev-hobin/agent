---
name: module-judgment
description: "Judge whether a concrete module remains useful in its environment by separating model, interface, invariants, assumptions, drift, participant pressure, and replacement boundaries. Use when module cohesion, boundary size, shared assumptions, interface stability, split or merge pressure, or environmental mismatch is consequential."
---

# Module Judgment

Judge a module as an environment-relative model, not as a file or namespace
shape alone.

## Core Question

Does this module expose a useful interface while owning its internal invariants
and making its environmental assumptions and drift visible?

## Judgment Spine

```text
concrete module + current environment
-> represented model and public interface
-> internal invariants versus environmental assumptions
-> drift, participant, purpose, and replacement pressure
-> keep | narrow | broaden-model | split | merge | expose | defer
```

A self-consistent module may still be useless when its environment no longer
matches its assumptions.

## Inputs

- Concrete module, interface, callers, collaborators, and implementation boundary
- Current purpose, participants, deployment or replacement pressure
- Internal invariants and construction or transition owners
- Omitted environmental facts, known drift, and expected change

## Supporting Materials

The core method is complete without supporting material. Supporting material may
refine the current question; it is guidance, not authority.

If the host has supplied a bounded selection for this invocation, use it as the
current selection. Apply each material only to the question it actually
addresses and preserve any visible mismatch as a limitation. Do not rediscover
alternatives unless the selection is explicitly incomplete.

Otherwise, inspect the colocated [Skill References](references.json). Use the root
`when` and `unless` conditions to confirm that this method applies; exclusions win. If an
exclusion applies, return `not-applicable` rather than forcing the method. Then
evaluate every Reference's `when` conditions and read the smallest materially
applicable set before producing the result. Broad topic similarity alone is not
sufficient. If no Reference applies, proceed with the core method alone.

## Output

Produce a module card:

```text
Purpose and environment:
Model and admitted equivalences:
Interface and caller-visible sense:
Internal invariants and owners:
Environmental assumptions:
Drift signals and mitigation:
Participants and independent change pressure:
Hidden implementation choices:
Replacement boundary:
Decision:
```

Use one decision: `keep`, `narrow`, `broaden-model`, `split`, `merge`,
`expose-interface`, `collapse-interface`, or `defer`. When used inside a larger
task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: module decision and the environment mismatch or stable boundary behind it
Basis: interface, callers, invariants, assumptions, drift, and participant pressure
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: module card, assumption map, drift check, and boundary diagram
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when the module's usefulness can be falsified by an environmental case,
each enforceable invariant and unenforceable assumption is distinguished, and
the chosen boundary matches participant and replacement pressure. Revisit when
purpose, callers, assumptions, deployment, or environmental observations change.

## Method

1. Name the concrete module and current purpose without treating a directory or
   class as proof of a boundary.
2. Describe the relevant environment: users, peer systems, data sources,
   operators, and independently changing participants.
3. State the model: represented facets, ignored facets, and differences treated
   as equivalent.
4. State the interface in caller language and the implementation choices it
   allows callers to ignore.
5. Separate internal invariants from environmental assumptions. Name the owner
   of each invariant and the observation or drift signal for each assumption.
6. Group responsibilities that share purpose, assumptions, and failure modes.
   Mark boundaries where those pressures or replacement cycles diverge.
7. Test whether an interface has independent participant pressure or merely
   mirrors one current implementation. Account for calcification before external
   exposure.
8. Choose the smallest boundary change justified by a concrete mismatch. Do not
   broaden the model merely to resemble more of the world.

## Missing Evidence

Return `needs-evidence` when callers, environmental observations, drift history,
or invariant ownership can settle the judgment. Return `blocked` when current
purpose or accepted environmental behavior is human-owned. Return
`not-applicable` when no concrete module boundary is under judgment.

## Boundary

Do not invent product meaning, design an original interface, schedule or
implement a reorganization, or claim that internal consistency proves external
usefulness. State any unanswered meaning, design, timing, or evidence question in
the caller's language.
