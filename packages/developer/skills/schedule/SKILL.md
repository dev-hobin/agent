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

## Reference Routing

The machine-readable [reference policy](reference-policy.json) is the routing
authority. Its routed extension refines the tradeoff step, declares the timing
artifact and stop, and names when an unstable candidate must be handed back. Use
the exemption only when no trigger applies and cite its evidence.

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
