---
name: visualize
description: "Choose and shape the smallest visual surface that materially lowers the cost of inspecting a decision, model, evidence set, architecture relation, UI state, quantitative comparison, or workflow. Use when relationships, cases, sequence, hierarchy, or repeated mappings are materially harder to judge in prose."
---

# Visualize

Make a judgment easier to inspect without making weak evidence look certain.

## Owned Question

What visual surface would materially lower judgment cost?

## Inputs

- Decision or inspection question
- Source facts, model, evidence, or relationships
- Audience and medium constraints
- Known uncertainty and interpretations to avoid

## Output

Use the user's concepts as labels; keep visualization terminology secondary.
Produce whether a visual is useful, the inspection question, recommended form,
visual content, what it reveals, and what it must not imply. When used inside a
larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: recommended visual form or a decision to use prose
Basis: structure of the decision and source evidence
Open questions: missing facts or uncertain relationships, or none
Artifacts: visual specification or completed visual
```

Return only this leaf's owned judgment; leave subsequent routing to the caller.

## Completion

Finish when the chosen surface answers the inspection question with less effort
than prose and uncertainty remains visible. Revisit when the underlying model,
evidence, or audience changes.

## Method

1. Name the decision the user needs to inspect.
2. Decline a visual when prose is smaller and clearer.
3. Match structure to form: table for finite mappings, state machine for allowed
   movement, timeline for order, relation map for dependencies, evidence matrix
   for claims and checks, tree for hierarchy, and layered diagram for boundaries.
4. Use the user's concepts as labels.
5. Preserve source semantics and mark inferred relationships.
6. State the overinterpretation the visual must not encourage.

## Missing Evidence

Return `needs-evidence` when missing facts determine the visual structure.
Return `not-applicable` when prose is the better surface. Return `blocked` when
the requested medium or source artifact is unavailable.

## Boundary

Do not invent architecture, evidence, product meaning, or certainty. Do not use
a visual to decorate the workflow or replace the judgment it should support.
