---
name: convention-judgment
description: "Judge whether a concrete coding convention should remain a shared expectation or be strengthened through clearer signaling, localization, static enforcement, construction control, or runtime enforcement. Use when code shape is expected to communicate intent but violations, hidden effects, scope, state, absence, or enforcement cost are consequential."
---

# Convention Judgment

Decide how strongly one concrete code-shape-to-intent mapping must be owned.

## Core Question

May this expectation safely remain conventional, or must a stronger boundary
make violations harder or observable?

## Judgment Spine

```text
concrete convention + audience
-> intended code-shape-to-meaning mapping
-> violation consequence and observer
-> available enforcement strengths and escape paths
-> retain | clarify | localize | enforce | reject
```

A convention is not weak merely because it is unenforced. It is weak when the
cost of a plausible violation exceeds the convention's ability to make that
violation visible and repairable.

## Inputs

- The concrete convention and code shapes it accepts or rejects
- Audience, scope, and affected boundary
- Intended meaning, effects, state, absence, or ordering assumptions
- Known violations, failure consequences, and enforcement constraints

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

Lead with the expectation and concrete violation, not a style label. Produce a
convention card:

| Field | Result |
| --- | --- |
| Intended mapping | |
| Audience and scope | |
| Plausible violation | |
| Consequence and observer | |
| Current signal or enforcement | |
| Escape paths | |
| Stronger alternatives and cost | |
| Decision | |

Use one decision: `retain-convention`, `clarify-signal`, `localize`, `enforce`,
`reject`, or `defer`. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: convention decision and the violation it controls
Basis: code shapes, audience, failures, conventions, and enforcement evidence
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: convention card, violation example, and enforcement boundary
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when the intended mapping, violation observer, consequence, escape paths,
and proportional enforcement decision are explicit. Revisit when the audience,
failure cost, construction paths, or available enforcement mechanism changes.

## Method

1. State the mapping as: `this code shape tells this audience this intent`.
2. Separate semantic convention from formatting preference and ecosystem syntax.
3. Identify the smallest plausible violation and who can observe it.
4. Classify the consequence: local confusion, delayed defect, invalid state,
   hidden effect, security boundary, or irreversible external action.
5. Inventory current signals and every construction, mutation, bypass, and escape
   path that matters.
6. Compare the least costly credible strengths: naming and documentation,
   localization, automated static checks, restricted construction, runtime
   rejection, or atomic ownership.
7. Prefer the weakest level that makes the accepted failure visible and bounded;
   prefer stronger ownership when a violation is costly, remote, or unrecoverable.
8. Test the decision against one compliant case and one violation. Do not call a
   convention enforced when ordinary code can bypass it silently.

## Missing Evidence

Return `needs-evidence` when callers, violations, incident history, or enforcement
feasibility can settle the decision. Return `blocked` when the accepted meaning
or failure tolerance is human-owned. Return `not-applicable` when there is no
concrete convention or consequential mapping under judgment.

## Boundary

Do not settle product meaning, invent a new API, impose a preferred style guide,
or treat language syntax as a universal rule. Report unresolved meaning,
design, or verification needs as explicit gaps without selecting the next
capability.
