---
name: naming-judgment
description: "Review or create code names by separating stable domain meaning from the current implementation. Use when variables, functions, types, modules, components, APIs, fields, or abstractions are generic, misleading, filler-like, implementation-shaped, or carrying multiple product senses."
---

# Naming Judgment

Choose names that preserve domain sense across implementation change.

## Owned Question

What domain sense should this name expose, what detail should it hide, and what
change boundary should it preserve?

## Inputs

- Current name and the code or artifact it identifies
- Nearby callers, callees, tests, and module context
- Product vocabulary, invariant, or model when available
- Audience: local helper, cross-module API, UI domain code, or integration

## Output

Lead with the user's product language; keep naming theory secondary.
Produce the naming pressure, current sense, hidden or overexposed detail,
failure mode, proposed name or placement move, affected scope, and intentionally
deferred names. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: the proposed name or boundary move and the sense it preserves
Basis: callers, behavior, domain vocabulary, and conventions
Open questions: unresolved domain meaning or boundary pressure, or none
Artifacts: rename map and affected scope
```

Return only this leaf's owned judgment; leave subsequent routing to the caller.

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

## References

Read [the naming reference](references/elements-of-clojure-naming.md) for
subtle, disputed, or recurring naming pressure.
