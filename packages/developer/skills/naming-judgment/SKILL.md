---
name: naming-judgment
description: "Review or create code names by separating stable domain meaning from the current implementation. Use when variables, functions, types, modules, components, APIs, fields, or abstractions are generic, misleading, filler-like, implementation-shaped, effect-hiding, or carrying multiple product senses."
---

# Naming Judgment

Choose names that preserve domain sense across implementation change.

## Core Question

What domain sense should this name expose, what detail should it hide, and what
change boundary should it preserve?

## Judgment Spine

```text
callers and audience
-> sign / current referent / relied-upon sense
-> expected evolution and effect boundary
-> reveal/hide decision
-> bounded rename map + unchanged checks
```

If the sense cannot stabilize without redesigning responsibility or policy,
report the unresolved responsibility or meaning and stop instead of hiding that
work in a rename.

## Inputs

- Current name and the code or artifact it identifies
- Nearby callers, callees, tests, and module context
- Product vocabulary, invariant, or model when available
- Audience: local helper, cross-module API, UI domain code, or integration

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

Lead with the user's product language; keep naming theory secondary. Use a
rename map as the primary inspection surface:

| Current | What it says | What callers rely on | Proposed | Scope |
| --- | --- | --- | --- | --- |

For callable APIs or placement moves, add a minimal before/after caller snippet
showing how the proposed name reads in context. Keep prose for the decisive
sense boundary, hidden or overexposed detail, failure mode, and intentionally
deferred names. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: the proposed name or boundary move and the sense it preserves
Basis: callers, behavior, domain vocabulary, and conventions
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: rename map and affected scope
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when a reader can rely on the name's sense without inspecting the current
implementation, and the name neither admits invalid uses nor freezes incidental
detail. Revisit when callers, product vocabulary, or the named boundary changes.

## Method

1. Read nearby callers and callees before judging the word.
2. Identify the audience and the named thing's role.
3. Separate stable sense from current referent.
4. Classify the failure: overly general, overly specific, filler action, verb
   mismatch, false abstraction, or sense collision.
5. Choose a name shape appropriate to data, pure transformation, side effect,
   predicate, event glue, or public API.
6. Use module placement to supply context when an honest local name becomes too
   long, but do not invent a module solely to shorten a name.
7. Before editing, state: `<old> says <X>, but callers rely on <Y>`.
8. Bound an accepted rename as a mechanical follow-up and identify the callers
   and tests that must be verified.

## Missing Evidence

Return `needs-evidence` when callers or domain language can reveal the intended
sense. Return `blocked` when only a product owner can decide the concept. Return
`not-applicable` when the apparent naming problem is actually a model or design
problem.

## Boundary

Do not implement the rename, promote a new abstraction, invent product meaning,
rename external conventions, or replace every short name with a longer one.
Reuse does not prove that a generic name is sound.
