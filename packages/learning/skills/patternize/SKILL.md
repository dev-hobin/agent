---
name: patternize
description: >-
  Coordinate multiple concepts, graph links, diagnostics, or repeated judgments
  under one axis into a reusable operational pattern. Use when they should
  become a workflow, decision routine, diagnostic path, composition routine,
  checklist, concept-role map, or visual execution model, including when a
  mature result should be saved as a graph-linked pattern artifact.
---

# Patternize

Create reusable operational patterns from concepts and learning artifacts.

The goal is not to create another concept note. The goal is to find a vertical
axis that cuts across concepts, then turn that axis into a repeatable way of
seeing, deciding, acting, checking, and learning.

## Reference Routing

Read [the Learning skill boundaries](../../references/skill-boundaries.md) when
deciding whether a candidate artifact belongs in `concepts/`, `patterns/`,
`diagnostics/`, `exercises/`, or a source-bound folder.

Read [the pattern foundations](references/pattern-foundations.md) when:

- the user asks for the research basis of this skill;
- creating or revising the saved pattern artifact schema;
- deciding whether a candidate belongs in `concepts/`, `patterns/`,
  `diagnostics/`, or `exercises/`;
- designing an important visual model.

Do not load the reference for a tiny conversational sketch.

Read [the graph artifact standard](../../references/graph-artifact-standard.md)
before saving, revising, or validating graph-shaped pattern artifacts or
concept-pattern links. That file is the shared source of truth for graph
frontmatter, typed relations, status values, and concept-pattern integration.

## Learning Package Integration

Keep the Learning skills distinct:

- Use `/skill:technical-reading` for prose source study.
- Use `/skill:opensource-reading` for repository evidence and source-bound
  code reading.
- Use `/skill:conceptualize` for source-independent concept nodes and graph
  edges.
- Use `/skill:exercise` for drills, diagnostics, transfer tasks, and mastery
  rubrics.
- Use this skill for workflow-shaped patterns that coordinate concepts into a
  reusable practice.

Patternize usually happens after conceptualization, but it can also start from
repeated learning artifacts, diagnostics, code review notes, or development
workflow observations.

## Core Distinction

```text
Concept:
  A reusable idea, operation, distinction, or judgment.

Exercise:
  A practice structure that tests and internalizes a concept.

Pattern:
  A reusable coordination of concepts under one axis.
  It says when the situation arises, what forces conflict, which concepts play
  which roles, what moves to perform, what to check, and what visual model helps
  the user execute the practice.
```

Save a pattern only when the artifact is more than a topic cluster. A pattern
must produce an action path, decision path, diagnostic path, or composition path.

## Core Rules

1. Start from a pattern axis, not from a folder name.
2. Do not turn every broad theme into a pattern. A pattern needs a recurring
   context, a practical problem, forces, moves, checks, and consequences.
3. Do not duplicate concept documents. Link to concepts and describe the roles
   they play inside the pattern.
4. Prefer workflow-shaped artifacts over abstract essays.
5. Include visual structure by default. At minimum, provide a concept-role map
   and either a workflow, decision flow, state flow, or feedback loop.
6. Keep patterns source-independent, but preserve source-bound evidence in
   provenance.
7. Treat pattern status as evidence-based: draft when plausible, active when
   used successfully across cases, retired when misleading or superseded.
8. If the pattern exposes a missing atomic concept, propose a separate
   conceptualization update instead of hiding the missing concept in the pattern.
9. If the pattern mainly tests learner understanding, route to `/skill:exercise`.
10. If the pattern mainly names a reusable warning sign or review question,
    consider `diagnostics/` unless it also gives an execution workflow.

## Default Workflow

1. Gather inputs.
   - Concept documents or concept graph notes.
   - Source-bound learning artifacts.
   - Existing `patterns/` and `diagnostics/` files.
   - Repeated user judgments, workflow pain, or development routines.

2. Name the pattern axis.
   - What single criterion, tension, or transformation runs through the inputs?
   - What would the user be able to do repeatedly after learning this pattern?
   - Example axes: requirements as logic, evidence-to-test, boundary-to-contract,
     source-reading-to-spec, tidy-before-behavior, invariant-to-verification.

3. Identify the recurring context.
   - When does this pattern become useful?
   - What signals tell the user to apply it?
   - What must already be true before it applies?
   - What is out of scope?

4. Extract forces.
   - What tensions must be balanced?
   - What tradeoffs or risks make the pattern nontrivial?
   - What failure modes appear if the user overuses, underuses, or misapplies it?

5. Assign concept roles.
   - Input concepts: what the pattern starts from.
   - Transform concepts: what changes representation or framing.
   - Control concepts: what constrains the moves.
   - Check concepts: what verifies correctness or confidence.
   - Output concepts: what artifact or judgment results.

6. Build the move sequence.
   - Each move should have an input, action, output, and check.
   - Keep the sequence small enough to run during real work.
   - If the pattern branches, represent it as a decision flow instead of prose.

7. Visualize.
   - Concept-role map: which concepts participate and how.
   - Workflow or decision flow: what to do in what order.
   - Optional: feedback loop, state diagram, evidence table, or matrix.

8. Test the pattern.
   - Source example: the case that revealed the pattern.
   - Transfer example: a different domain or coding situation.
   - Boundary example: a case where the pattern should not be used.
   - Failure example: what goes wrong when a move is skipped.

9. Save only when requested.
   - Prefer `patterns/<stable-slug>.md` for reusable workflow patterns.
   - Prefer `diagnostics/<stable-slug>.md` for warning signs or rubrics without
     a workflow.
   - Prefer `exercises/<stable-slug>.md` for practice material.
   - Prefer `concepts/<stable-slug>.md` when the artifact is really one concept.
   - When `validate_learning_artifact` is available, run it on each saved
     graph-shaped artifact. Repair structural errors and present warnings as
     unresolved judgment items.

## Pattern Artifact Contract

For saved pattern artifacts, use
[the shared graph standard](../../references/graph-artifact-standard.md). If no
context file exists, keep the frontmatter simple and do not invent a full graph
system unless the user asks.

Patterns must participate in the same graph as concepts. Do not create a
separate pattern graph if the archive already has `concepts/context.jsonld` or a
concept graph convention. Reuse that context and add only the missing local
terms needed for patterns.

```yaml
---
"@context": ../concepts/context.jsonld
id: pattern/<stable-slug>
type:
  - Pattern
  - Workflow
prefLabel: <human-readable pattern name>
inScheme: concept-scheme/<archive-or-project>
status: draft
sourceIndependent: true
axis: pattern-axis/<stable-axis-slug>
uses:
  - concept/<concept-slug>
composes:
  - concept/<concept-slug>
transforms:
  - concept/<input-concept-slug>
produces:
  - <artifact-or-output-name>
guides:
  - <artifact-or-workflow-name>
checks:
  - concept/<check-concept-slug>
source:
  - <source-learning-artifact>
visualizes:
  - pattern/<stable-slug>#concept-role-map
  - pattern/<stable-slug>#workflow
visuals:
  - concept-role-map
  - workflow
---
```

Use `type: [Pattern, Workflow]` for execution sequences,
`type: [Pattern, Decision]` for decision routines,
`type: [Pattern, Diagnostic]` for diagnostic flows, and
`type: [Pattern, Composition]` for concept-composition patterns.

## Graph Integration Rules

Treat `concepts/` and `patterns/` as two artifact families in one graph. Use the
typed relation names from
[the graph artifact standard](../../references/graph-artifact-standard.md).

When updating a concept because a new pattern uses it, prefer adding typed graph
edges to the concept frontmatter only if the concept document itself needs the
backlink for navigation. Otherwise, keep the forward relation on the pattern and
update a structure note or pattern index.

Default body shape:

```text
# <Pattern Name>

## Intent
## When To Use
## Pattern Axis
## Concept Roles
## Forces
## Workflow
## Visual Model
## Checks
## Examples
## Boundaries And Failure Modes
## Related Concepts
## Provenance
```

## Visualization Contract

Every substantial pattern should include at least two visual forms:

1. Concept-role map:
   - shows concepts as nodes;
   - labels edges with roles such as input, transforms, constrains, checks,
     produces, or feeds back;
   - keeps source notes out of the core map unless they are evidence nodes.

2. Execution visual:
   - workflow for linear action;
   - decision flow for branching judgment;
   - feedback loop for iterative practices;
   - state diagram for lifecycle patterns;
   - matrix for comparing forces, checks, or cases.

Use Mermaid for saved Markdown unless the target archive already prefers another
format. Keep diagrams inspectable:

- Split large maps instead of creating a dense graph.
- Prefer meaningful edge labels over many unlabeled arrows.
- Do not make the diagram a duplicate of the prose; it should reveal order,
  dependency, tension, or feedback.
- Follow the diagram with a short reading guide explaining how to traverse it.

## Status Rules

- `draft`: plausible pattern, limited evidence, not yet applied across cases.
- `active`: used in at least one source-external case or stable enough to guide
  future work.
- `retired`: misleading, superseded, too broad, or replaced by sharper patterns.

When uncertain, use `draft`. Promote only when the pattern has transfer evidence.

## Conversational Output

When not saving a file, use a compact shape:

```text
Pattern candidate:
Axis:
When to use:
Concept roles:
Workflow:
Visual sketch:
Checks:
Boundary:
Capture recommendation:
```

## Quality Bar

A useful pattern must:

- coordinate multiple concepts or judgments under one clear axis;
- describe a recurring context and practical problem;
- name the forces that make the pattern necessary;
- provide an executable move sequence or decision path;
- include checks that prevent wishful thinking;
- include visual structure;
- show at least one transfer case;
- state boundaries and failure modes;
- link to concept documents without replacing them;
- be reusable without reopening the original source.

If the draft is mostly a summary, rename it as a learning artifact. If it is
mostly one concept, route to `/skill:conceptualize`. If it is mostly practice,
route to `/skill:exercise`.
