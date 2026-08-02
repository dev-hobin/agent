---
name: conceptualize
description: >-
  Form and test one source-independent concept from several source-bound
  insights, materials, examples, or observations. Use for comparing source-local
  language, stripping accidental detail, finding a transferable operation or
  distinction, separating nearby concepts and connector relations, and testing
  the candidate with transfer cases and counterexamples. Produce a complete
  concept result and, when requested, a self-contained plain Markdown artifact.
---

# Conceptualize

Create a transferable concept from several source-bound insights.

The goal is not to summarize sources or atomize files. Find the operation,
relation, distinction, force, or judgment that remains stable as source-local
language and examples change, then test whether that semantic boundary deserves
one concept.

## Core Question

What one reusable concept survives the variation among these sources or cases?

## Context Directions

This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.

Use the owning capability when at least one condition applies:

- At least two independent sources, insight bundles, repository cases, or observations—or one source plus a genuine transfer case—are available for comparison.
- The candidate contains multiple verbs or practical questions, mixes concept and workflow, has uncertain transfer, or lacks a discriminating counterexample.

Do not use it when any exclusion applies; these exclusions win:

- The requested result is deliberate practice rather than concept extraction or revision.
- The task requires source-faithful reading or translation but not a source-independent durable concept or graph update.

Prepared references are independent candidates, never requirements or authority:

### `references/concept-boundaries.md`

- The candidate contains multiple verbs or practical questions, mixes concept and workflow, has uncertain transfer, or lacks a discriminating counterexample. The reference can add this material distinction: Semantic atomicity, role, transfer, near-miss, and falsifier checks.

### `references/cross-source-synthesis.md`

- At least two independent sources, insight bundles, repository cases, or observations—or one source plus a genuine transfer case—are available for comparison. The reference can add this material distinction: Cross-context comparison, accidental-scaffolding removal, and contradiction-preservation checks.

## Inputs

Prefer at least two independent evidence contexts:

- source-bound reading insights;
- repository study results;
- captured observations, working notes, or prior concept results;
- contrasting examples, direct observations, or prior concept candidates;
- one source plus a genuinely source-external transfer case.

When only one source-local example is available, a provisional concept
hypothesis is valid, but source independence remains an explicit evidence gap.

## Core Distinctions

```text
Source-bound insight
  Explains what one source or case made visible.

Concept candidate
  Names one operation, relation, distinction, or judgment that remains useful
  when the source vocabulary and example change.

Connector relation
  Names how two concepts interact; usually an edge or sentence, not another
  concept.

Operational pattern
  Coordinates several concepts or judgments into a repeatable action or
  decision path; owned by patternize.
```

Semantic atomicity is not file atomicity. Conceptualize decides whether one
meaning is present; optional file shape is only a delivery choice after that
semantic judgment is complete.

## Evidence Gate

Before naming a concept, build a compact comparison:

```text
Evidence context | Source-local expression | Example | Boundary | Candidate invariant
```

A concept is supported when the contexts share a mechanism or judgment rather
than only vocabulary or topic. Record contradictions instead of smoothing them
away.

## Default Workflow

1. **Gather source-bound observations**
   - Preserve source claims, interpretations, hypotheses, examples, and
     boundaries as different evidence kinds.
   - Ask for missing material only when it can change the concept boundary.
2. **Build the comparison table**
   - Identify repeated relations, operations, forces, and discriminating cases.
   - Note source-local terms and accidental implementation details.
3. **Classify candidate roles**
   - concept candidate;
   - connector relation;
   - operational pattern candidate;
   - source-local detail;
   - unresolved contradiction.
4. **Strip source scaffolding**
   - Replace proper nouns, chapter order, tool names, and local examples with
     portable roles only when the mapping preserves meaning.
   - Keep canonical technical terms as anchors when they are necessary for
     precision or retrieval.
5. **State the candidate**
   - Give a short provisional name and one-sentence definition.
   - State the practical question it answers.
   - Explain its mechanism rather than asserting importance.
6. **Run the boundary gate**
   - Split independent verbs, mechanisms, or practical questions.
   - Keep a connector as a relation unless the relation itself has reusable
     mechanics.
   - Route workflow-shaped coordination to `patternize`.
7. **Test transfer**
   - Apply the candidate to one source-external case.
   - Add one near miss or counterexample.
   - State assumptions and the first condition that would falsify the proposed
     generality.
8. **Return a complete concept result**
   - Preserve provenance and evidence gaps in the response.
   - Keep the concept understandable without any archive or external system.

## Portable Mental Model

When the concept is central, difficult, or explicitly requested as something to
carry forward, compress its mechanism into the smallest recallable form:

```text
sequence: A -> B -> C -> Check
axis: criterion x variants
loop: observation -> model -> action -> feedback
role table: part / job / failure if missing
relation map: concept A --relation--> concept B
```

The model must preserve the mechanism and failure boundary. If compression
reveals multiple independent axes, split the concept candidates.

## Output

Use the smallest useful subset:

```text
Concept candidate:
One-sentence definition:
Practical question answered:
Cross-source evidence:
Portable model:
Mechanism:
Technical anchors:
Transfer case:
Counterexample / boundary:
Related concepts and connector relations:
Evidence gap:
Handoff:
```

## Artifact Delivery

The concept result must stand alone in conversation. When the user explicitly
asks to save it, write a self-contained plain Markdown concept artifact to a
user-supplied target. Include definition, evidence, mechanism, transfer,
boundary, relations, and provenance; assume no storage layout or metadata
schema.

## Quality Bar

A useful concept proposal:

- is understandable without reopening any one source;
- is supported by variation across evidence contexts;
- is not a source term under a new heading;
- answers one practical question;
- has one mechanism rather than a topic umbrella;
- preserves contradictions and provenance;
- distinguishes concepts from connector relations and patterns;
- survives one source-external transfer case;
- includes a counterexample or boundary;
- makes the evidence gap explicit when only one source supports it;
- remains complete without any external integration.

## Completion

Finish when the candidate is supported, contradicted, split, or left
provisional by observable transfer and boundary evidence. A failed concept gate
is a valid result; do not polish it into a durable concept merely because the
user requested conceptualization.
