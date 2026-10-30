# Pattern Visualization

Use this reference when prose hides a pattern's roles, order, branches, state,
feedback, or comparison.

## Choose By Inspection Problem

- **Role map:** several concepts or judgments play input, transform, control,
  check, output, or feedback roles.
- **Workflow:** moves are mostly linear and order is consequential.
- **Decision flow:** different conditions select different moves.
- **Feedback loop:** later evidence revises earlier judgment.
- **State flow:** lifecycle state controls legal moves.
- **Matrix:** cases, forces, checks, or alternatives need comparison.

Use one visual when it is sufficient. Add a second only when it answers a
different inspection question.

## Construction Rules

- Label edges with meaningful relations or conditions.
- Keep source notes outside the operational core unless they are evidence nodes.
- Split dense visuals rather than shrinking them into unreadability.
- Do not duplicate whole prose sections inside nodes.
- Follow the visual with a short guide explaining entry point, traversal,
  branches, and stop.
- Use Mermaid in Markdown when supported; otherwise use an ASCII diagram or
  table that remains readable in the target medium.

## Visual Falsifier

A visual fails when:

- removing it loses no inspectable relation;
- it implies order or causality not supported by the pattern;
- branches lack discriminating conditions;
- feedback has no observation or stop;
- labels are decorative or ambiguous;
- the target width makes the result harder to inspect than prose.

## Source Trace

Operationally informed by concept maps as labeled node-edge relations and by
diagrammatic reasoning that lowers search cost when spatial arrangement matches
the task's relevant relations.
