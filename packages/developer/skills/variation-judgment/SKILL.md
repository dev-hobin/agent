---
name: variation-judgment
description: "Judge the least-powerful indirection mechanism for an accepted variation surface by comparing direct use, references, conditionals, tables, registration, and dispatch. Use when variants and operations are concrete but ownership, openness, precedence, conflict, unsupported behavior, or extension cost is disputed."
---

# Variation Judgment

Choose or review an indirection mechanism without treating extensibility as an
unqualified good.

## Core Question

Which mechanism expresses the accepted variation while keeping choice,
conflicts, and unsupported cases under a truthful owner?

## Judgment Spine

```text
accepted variants + operations
-> choice owner and observed growth axis
-> direct/reference/conditional/table/dispatch alternatives
-> precedence, conflict, visibility, and failure obligations
-> least-powerful adequate mechanism
```

Indirection relocates a decision. It does not remove the need to own that
decision.

## Inputs

- Concrete variants, operations, callers, and supported combinations
- Which participant selects, registers, extends, or deploys each case
- Duplicate, overlap, precedence, load-order, and unsupported-case constraints
- Evidence of expected variant or operation growth

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

Show the accepted surface before recommending a mechanism:

| Variant | Operation A | Operation B | Operation C |
| --- | --- | --- | --- |
| Case 1 | | | |
| Case 2 | | | |

Then record `Choice owner`, `Growth axis`, `Conflict policy`, `Unsupported
result`, `Visibility/failure timing`, `Simpler alternative`, and `Decision`.
Use one decision: `direct`, `reference`, `conditional`, `table`, `dispatch`,
`retain-current`, or `defer`. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: selected or reviewed mechanism and the choice ownership it preserves
Basis: variant-operation matrix, callers, extension evidence, and conflict policy
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: matrix, decision path, conflict policy, and fake-extension check
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when every accepted combination and unsupported case has an owner, the
claimed growth axis survives one fake extension, and no weaker mechanism can
meet the same obligations. Revisit when participants, extension axes, conflict
semantics, or deployment boundaries change.

## Method

1. Fix the accepted variants and operations; do not infer product cases from a
   preferred dispatch mechanism.
2. Build the variant-operation matrix and mark unsupported combinations.
3. Identify the choice owner: caller, local policy, configuration, registration
   authority, or runtime dispatcher.
4. Distinguish a reference that conveys a choice from a conditional that decides
   among choices.
5. Compare mechanisms from direct use through reference, conditional, table, and
   dispatch. Account for startup, naming, inspection, precedence, duplicate,
   deployment, and failure obligations.
6. State whether growth is expected by variant, operation, both, or neither.
7. Add one fake variant and one fake operation. Require unchanged code only along
   the axis the candidate claims to open.
8. Prefer a local exhaustive conditional for small closed policy. Accept stronger
   indirection only when independent change pressure pays its extra ownership
   cost.

## Missing Evidence

Return `needs-evidence` when callers, accepted cases, extension history, or
conflict policy can settle the choice. Return `blocked` when product-owned cases
or precedence remain undecided. Return `not-applicable` when no concrete
variation surface or mechanism decision exists.

## Boundary

Do not invent product variants, public operations, role meaning, or creation
workflow. Do not approve a whole abstraction or implement registration. Preserve
those unresolved needs as explicit gaps without choosing another skill.
