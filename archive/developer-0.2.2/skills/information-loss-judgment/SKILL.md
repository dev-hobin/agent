---
name: information-loss-judgment
description: "Judges whether a concrete data transformation adds, discards, or reorganizes information deliberately by tracing accrete, reduce, and reshape steps, preserved observers, equivalence classes, provenance, and recovery needs. Use when summaries, normalization, grouping, projections, metrics, serialization, or representation changes may erase consequential distinctions. Not for choosing storage technology, designing the implementation API, or settling product equivalence that only an owner can decide."
---

# Information Loss Judgment

Make information gain, loss, and reorganization explicit before a downstream
representation becomes authoritative.

## Gotchas

- Scrubbing or rewriting data that is already stored is irreversible loss, not
  cleanup. Preserve it by default and name removal as an owner decision, even
  when the new representation no longer needs the field.

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

## When to read more

Before producing the result, read the colocated [Skill References](references.json).
If a root `unless` condition applies, return `not-applicable`. Otherwise read only
the References whose `when` condition materially applies; topic similarity is not
enough. A host-supplied selection replaces this lookup. With no applicable
Reference, the core method stands alone; References are guidance, not authority.

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
