# Concept Artifact Shapes

Use this reference when writing durable concept artifacts, source-bound concept
updates, structure notes, or a multi-concept conversational result.

## Contents

- Complete concept document
- Concept update
- Structure note
- Conversational result
- Source-independent body
- Multiple candidates
- Failure checks

## Complete Concept Document

Use the graph fields defined by
[the graph artifact standard](../../../references/graph-artifact-standard.md).
The body should be understandable without opening its provenance.

```text
---
"@context": context.jsonld
id: concept/<stable-slug>
type:
  - Concept
  - Atomic | Pattern
prefLabel: <human-readable name>
inScheme: concept-scheme/<archive-or-project>
status: active
sourceIndependent: true
source:
  - ../concept-updates/<source-bound-update>.md
uses:
  - concept/<related-concept>
---

# <Concept Name>
## One-sentence definition
## Why this concept is needed
## Technical anchors
## Core image
## Portable mental model
## Mechanism
## When to use it
## Examples
## Non-examples and boundaries
## Common misconceptions it repairs
## Practical judgment questions
## Related concepts
## Provenance
```

Use only the sections needed for a complete, reusable explanation. Persist
atomic or composition roles in `type`, not in a body section that merely repeats
metadata.

## Concept Update

A concept update is a source-bound change record:

```text
---
"@context": ../concepts/context.jsonld
id: concept-update/<YYYY-MM-DD-source-slug>
type: ConceptUpdate
title: <Source or Session> Concept Update
prefLabel: <Source or Session> Concept Update
inScheme: concept-scheme/<archive-or-project>
status: active
sourceIndependent: false
source:
  - <source-or-learning-artifact>
---

# <Source or Session> Concept Update
## Source pressure
## Concept deltas
- Add / Reinforce / Refine / Split / Merge / Link / Weaken / Retire
## Before / after
## Misconceptions repaired
## Evidence trail
## Transfer tests
## Concept documents to update
## Practice hook
```

## Structure Note

Use a structure note when several concepts need a navigation graph. It maps
relations and indexes complete concept documents; it does not replace them.

```text
---
"@context": context.jsonld
id: concept-scheme/<archive-or-project>
type:
  - ConceptScheme
  - Structure
title: Concept Structure Note
prefLabel: Concept Structure Note
inScheme: concept-scheme/<archive-or-project>
status: active
sourceIndependent: true
source:
  - <concept-or-update-artifact>
---

# Concept Structure Note
## Principles
## Relation Map
<concept A> -> <typed relation> -> <concept B>
## Concept Index
## Update Questions
```

## Conversational Result

Use the smallest useful combination of:

- direct concept and one-sentence definition;
- concept graph when relations matter;
- portable mental model;
- why this is the reusable center;
- one source example and one source-external example;
- boundary or non-example;
- capture handoff.

## Source-Independent Body

State the reusable mechanism directly. Put chapter numbers, authors, project
names, and source-local examples in provenance or technical anchors unless they
are part of the durable concept itself.

For example, prefer “meaning-preserving state change: variables change while a
chosen expression preserves the represented value” over a definition that can
only be understood by reopening a named chapter. Provenance may still record
which examples revealed that mechanism.

## Multiple Candidates

Split when the material contains distinct reusable centers, such as:

- process shape versus resource growth;
- invariant preservation versus representation control;
- deterministic proof versus probabilistic evidence;
- boundary abstraction versus implementation hiding;
- atomic operation versus the mechanism that composes operations;
- concept node versus connector edge.

Use a short graph to preserve their relation. An umbrella can remain a
structure-note label when it helps navigation, but it should not erase the
smaller judgments the learner can apply.

Helpful roles are central, supporting, atomic, composition, connector,
neighboring, and source-local. Persist only graph-defined roles in frontmatter;
use conversational labels for scanning and explanation.

Before combining candidates, ask both questions:

1. Does one candidate preserve all major source signals without weakening any?
2. Is it still narrow enough to guide a future judgment or action?

A negative answer to either question is pressure to split and link.

## Failure Checks

Revise artifacts that are mainly:

- a source summary or chapter recap;
- source terminology under a new heading;
- a slogan without mechanism;
- several concepts collapsed into a grand abstraction;
- an update note presented as a complete concept;
- a structure note presented as a tutorial;
- an analogy whose relation does not transfer;
- a concept without a non-example or boundary;
- provenance that overwhelms the reusable body.

The reading artifact answers what the source teaches. The concept artifact
answers what the learner can carry forward without reopening that source.
