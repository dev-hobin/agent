---
name: schedule
description: "Decide whether a concrete structural change or reviewed abstraction candidate belongs now, after, or never using invariant pressure, evidence, reversibility, nested-work pressure, behavior-versus-structure separation, and cost of delay. Use when the candidate is concrete and timing is consequential."
---

# Schedule

Decide when a concrete structural move belongs.

## Core Question

When should this candidate be done: now, after, or never?

## Judgment Spine

```text
stable concrete candidate
-> current dependency and invariant pressure
-> guarantee gained / ability lost
-> reversibility, delay cost, and nested work
-> now | after(immediate/later + reopen) | never
```

Timing cannot stabilize a candidate whose meaning or surface is still unresolved.

## Inputs

- Concrete candidate and scope
- Evidence and accepted contract when available
- Current invariant pressure and nested-work pressure
- Reversibility, cost of delay, risk if done now, and risk if delayed

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

Lead with the user's current risk and cost of delay; keep timing labels secondary.
Use a compact timing matrix with `Pressure`, `Do now`, `Delay`, `Reversibility`,
and `Evidence`, followed by a prominent `now`, `after`, or `never` decision. For
`after`, show the reopen condition as an observable trigger; use a short timeline
only when ordering between behavior and structure is consequential. Produce the
rationale, invariant pressure, risks, and reopen condition for deferred work.
When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: now, after, or never with the decisive reason
Basis: candidate, evidence, current pressure, reversibility, and delay cost
Open questions: missing timing evidence, or none
Artifacts: timing decision and reopen condition
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when the current timing decision follows from observable pressure and
deferred work has a concrete reopen condition. Revisit only when that condition,
the invariant, reversibility, or cost of delay changes.

## Method

1. Restate the smallest concrete candidate and scope.
2. Ask whether the current invariant or accepted implementation is blocked
   without it.
3. Check whether the candidate is evidence-backed and stable enough to act on.
4. Compare the guarantee gained with the freedom and implementation paths lost.
5. Consider nested-work growth, reversibility, and cost of delay.
6. Decide:
   - `now`: required to protect the invariant or unblock accepted work;
   - `after`: useful but not required now;
   - `never`: speculative, harmful, or outside this scope.
7. For `after`, state evidence that should reopen the decision. For `never`,
   state whether any scope change could make it relevant.

## Missing Evidence

Return `not-applicable` when no concrete candidate exists. Return
`needs-evidence` when the candidate exists but present pressure or reversibility
cannot be assessed. Return `blocked` when timing depends on a human-owned
priority or risk choice that cannot be inferred. Bias away from `now` when
evidence is thin.

## Boundary

Do not discover a signal, form or review the abstraction, implement the change,
prioritize unrelated product work, or verify the final result.
