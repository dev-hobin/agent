---
name: information-loss-judgment
description: "Judge whether a concrete data transformation adds, discards, or reorganizes information deliberately by tracing accrete, reduce, and reshape steps, preserved observers, equivalence classes, provenance, and recovery needs. Use when summaries, normalization, grouping, projections, metrics, serialization, or representation changes may erase consequential distinctions."
---

# Information Loss Judgment

Make information gain, loss, and reorganization explicit before a downstream
representation becomes authoritative.

## Core Question

Which distinctions does this transformation add, preserve, discard, or make
costly to observe, and is that change acceptable for the stated purpose?

## Judgment Spine

```text
accepted input distinctions + purpose
-> accrete / reduce / reshape trace
-> preserved and lost observers
-> induced equivalence classes and recovery boundary
-> preserve | expose | delay | retain-provenance | reject
```

A reduction is a decision that some distinct inputs may be treated as the same.
Correct arithmetic does not prove that the discarded distinctions were
irrelevant.

## Inputs

- Concrete input and output representations and transformation steps
- Downstream purpose, decisions, and observers
- Required provenance, audit, replay, explanation, or recovery behavior
- Examples that differ before transformation and may coincide afterward

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

Produce an information-flow table:

| Step | Input distinctions | Operation | Added | Discarded | Reshaped | Downstream observer |
| --- | --- | --- | --- | --- | --- | --- |

Add `Equivalent-after pairs`, `Provenance retained`, `Recovery path`, `Decision`,
and one counterexample. Use one decision: `preserve`, `make-explicit`,
`delay-reduction`, `retain-provenance`, `reshape`, `accept-loss`, `reject`, or
`defer`. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: information decision and the consequential distinction it preserves or loses
Basis: input/output examples, downstream observers, equivalence pairs, and recovery needs
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: information-flow table, equivalence witness, and recovery boundary
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when every consequential transformation step is classified, at least one
pair of distinct inputs tests each reduction, all required observers are traced,
and accepted irreversibility has an explicit owner. Revisit when downstream
purposes, audit requirements, or representations change.

## Method

1. Fix the downstream purpose and the input distinctions that purpose may need.
2. Trace each step and classify it as:
   - `accrete`: add derived or contextual information;
   - `reduce`: intentionally discard distinctions;
   - `reshape`: reorganize access without claiming semantic loss;
   - mixed: split into separately inspectable steps.
3. List observers available before and after each step. Include identity, order,
   multiplicity, precision, provenance, failure, and timing only when relevant.
4. For every reduction, provide two accepted inputs that become equivalent after
   the step. If no pair can be shown, the reduction claim is not yet explained.
5. For every reshape, identify abilities and costs that change even when domain
   meaning is intended to remain constant.
6. Locate the first irreversible step and the last point where provenance can be
   retained cheaply.
7. Test one downstream question that the output can answer and one that it can no
   longer answer.
8. Accept loss only when the purpose owns the equivalence. Otherwise preserve the
   distinction, delay reduction, or retain evidence that permits reconstruction.

## Missing Evidence

Return `needs-evidence` when downstream observers, representative inputs,
provenance requirements, or recovery costs can settle the judgment. Return
`blocked` when a human owner must decide which distinctions are meaningful.
Return `not-applicable` when no concrete transformation or possible information
change is under judgment.

## Boundary

Do not invent product equivalence, design the implementation API, choose a
storage technology, or claim semantic preservation from matching types alone.
State any unanswered meaning, design, or evidence question in the caller's
language.
