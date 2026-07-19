---
name: schedule
description: "Decide whether a concrete structural change or reviewed abstraction candidate belongs now, after, or never using invariant pressure, evidence, reversibility, nested-work pressure, behavior-versus-structure separation, and cost of delay. Use when the candidate is concrete and timing is consequential."
---

# Schedule

Decide when a concrete structural move belongs.

## Core Question

When should this candidate be done: now, after, or never?

## Inputs

- Concrete candidate and scope
- Evidence and accepted contract when available
- Current invariant pressure and nested-work pressure
- Reversibility, cost of delay, risk if done now, and risk if delayed

## Reference Routing

Read [the structural change timing reference](references/structural-change-timing.md)
when a behavior change and structural change compete, when `now` would remove
meaningful implementation freedom, or when reversibility, nested work, and cost
of delay point in different directions. Also read it when an `after` decision
needs an observable reopen condition. A small, reversible candidate whose
timing follows directly from the current invariant does not need the reference.

## Output

Lead with the user's current risk and cost of delay; keep timing labels secondary.
Produce `now`, `after`, or `never` with rationale, evidence, invariant pressure,
risks, and a reopen condition for deferred work. When used inside a larger task,
return:

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
