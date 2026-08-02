---
name: patternize
description: >-
  Discover and test a reusable operational pattern across several materials,
  cases, concepts, diagnostics, or repeated judgments. Use when recurring
  context and forces should become a workflow, decision path, diagnostic path,
  composition routine, checklist, or execution model with transfer and failure
  checks. Produce a complete pattern result and, when requested, a
  self-contained plain Markdown artifact.
---

# Patternize

Create a reusable operational pattern from repeated evidence.

The goal is not to make a broad topic note or another concept definition. Find
one recurring coordination axis across several cases, then express the context,
forces, moves, checks, consequences, and failure boundary that make the pattern
runnable.

## Core Question

What coordination recurs across these cases, and how can someone recognize,
execute, and check it elsewhere?

## Context Directions

This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.

Use the owning capability when at least one condition applies:

- At least two independent cases, concepts, diagnostics, or judgments appear to share a practical problem or successful movement and must be distinguished from a topic cluster.
- The pattern contains several semantic roles, branches, iterative feedback, state transitions, or a comparison matrix that is materially harder to execute from prose alone.

Do not use it when any exclusion applies; these exclusions win:

- The task asks to define or refine one atomic concept rather than a reusable pattern.
- There is no recurring axis coordinating multiple concepts, links, diagnostics, or judgments into an operational routine.

Prepared references are independent candidates, never requirements or authority:

### `references/pattern-visualization.md`

- The pattern contains several semantic roles, branches, iterative feedback, state transitions, or a comparison matrix that is materially harder to execute from prose alone. The reference can add this material distinction: Role, workflow, decision, feedback, state, and matrix visual selection constraints.

### `references/recurrence-and-forces.md`

- At least two independent cases, concepts, diagnostics, or judgments appear to share a practical problem or successful movement and must be distinguished from a topic cluster. The reference can add this material distinction: Recurrence, force, coordination-axis, move, check, and consequence tests.

## Inputs And Evidence Gate

Prefer at least two independent cases from different materials, projects,
domains, or occasions:

- source-bound insight bundles;
- concept results and connector relations;
- captured observations and working notes;
- repository study artifacts;
- repeated diagnostics, review judgments, or workflow failures;
- direct observations with known conditions.

A single case can produce a pattern hypothesis, not a reusable pattern claim.
Repeated vocabulary or folder membership does not count as recurrence.

## Core Distinctions

```text
Concept
  One reusable operation, distinction, relation, or judgment.

Pattern
  A recurring coordination under one axis. It states when the situation arises,
  which forces conflict, what moves to perform, what to check, and what follows.

Diagnostic
  A warning sign or review question without a full action path.

Exercise
  A practice structure that tests or internalizes a concept or pattern.
```

## Pattern Gate

Before constructing a workflow, establish:

```text
Case | Context | Problem | Forces | Successful move | Check | Failure if omitted
```

A pattern is justified only when one coordination mechanism explains the cases.
If the table reveals only a shared topic, return “no pattern yet.”

## Default Workflow

1. **Gather cases**
   - Preserve evidence source, conditions, observed result, and uncertainty.
   - Include failures or counterexamples when available.
2. **Name the recurring axis**
   - State the one criterion, tension, or transformation that makes the cases
     belong together.
   - Reject axes that are merely folder names or broad themes.
3. **Identify context and signals**
   - When does the pattern become useful?
   - What prerequisites and observable triggers apply?
   - What is out of scope?
4. **Extract forces**
   - Name tensions, constraints, and tradeoffs that prevent a trivial solution.
   - State the cost of overuse and underuse.
5. **Assign semantic roles**
   - inputs;
   - transformations;
   - controls or constraints;
   - checks;
   - outputs and feedback.
   Refer to concepts without duplicating their full explanations.
6. **Build the move sequence**
   - Each move has an input, action, output, and local check.
   - Use a decision path when conditions branch and a feedback loop when later
     evidence changes earlier judgment.
7. **Choose a visual when it lowers judgment cost**
   - role map, workflow, decision flow, feedback loop, state flow, or matrix.
   - Do not add a diagram that merely repeats prose.
8. **Test the pattern**
   - source case;
   - source-external transfer case;
   - boundary case where it should not be used;
   - failure case where one move is skipped;
   - counterevidence that would falsify recurrence.
9. **Return a complete pattern result**
   - State evidence strength and gaps.
   - Keep the pattern executable without any archive or external system.

## Selective Thinking Tools

Use observing, comparing, pattern recognition, abstraction, modeling,
transformation, and synthesis as a repertoire:

```text
observe cases
-> compare differences
-> recognize candidate recurrence
-> abstract the coordination axis
-> model roles and moves
-> transform into an inspectable workflow or visual
-> synthesize forces, checks, and consequences
```

This sequence describes available operations, not a mandatory user-facing
pipeline. Skip any operation that does not change the proposal.

## Output

Use this compact shape for the conversational result:

```text
Pattern candidate:
Evidence level:
Recurring context and signals:
Axis:
Cases compared:
Forces:
Roles:
Moves / decision path:
Checks and feedback:
Visual, if useful:
Transfer case:
Boundary and failure case:
Falsifier / evidence gap:
Handoff:
```

## Artifact Delivery

The pattern result must stand alone in conversation. When the user explicitly
asks to save it, write a self-contained plain Markdown pattern artifact to a
user-supplied target. Include context, cases, axis, forces, roles, moves, checks,
transfer, boundaries, and evidence gaps; assume no storage layout or metadata
schema.

## Quality Bar

A useful pattern proposal:

- is supported by repeated cases rather than one inspiring example;
- names one clear coordination axis;
- states context, signals, prerequisites, and exclusions;
- exposes forces and tradeoffs;
- provides executable moves or a decision path;
- includes local checks and feedback;
- does not duplicate concept explanations;
- survives a source-external transfer case;
- includes a boundary case, skipped-move failure, and falsifier;
- uses a visual only when it reveals relation, order, state, or feedback;
- remains complete without any external integration.

## Completion

Finish when recurrence is supported, contradicted, or left provisional by the
case table and transfer tests. A failed pattern gate is a useful result. Return
the diagnostic, concept handoff, or missing evidence rather than manufacturing a
workflow from a topic cluster.
