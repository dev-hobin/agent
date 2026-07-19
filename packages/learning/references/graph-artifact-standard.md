# Graph Artifact Standard

This is the shared source of truth for Learning artifacts that should be loaded
as one graph. Use it from `conceptualize` and `patternize` whenever saving,
revising, or validating graph-shaped artifacts.

## Contents

- Goal and shared context
- Node namespaces and type conventions
- Required common fields
- Typed relations
- Status rules
- Context updates
- Validation checklist

## Goal

`concepts/` and `patterns/` are different artifact families in one graph.

```text
concepts/
  reusable ideas, distinctions, operations, judgments, and concept relations

patterns/
  reusable workflows, decision routines, diagnostic paths, and composition
  routines that coordinate concept nodes
```

Do not create separate graph conventions for each folder. A graph renderer or
indexer should be able to read both folders and recover concept-pattern links
from frontmatter alone.

## Shared Context

Use one shared context file when the archive supports JSON-LD-style frontmatter:

```text
concepts/context.jsonld
```

Concept notes point to it directly:

```yaml
"@context": context.jsonld
```

Concept update notes point up to it:

```yaml
"@context": ../concepts/context.jsonld
```

Pattern notes point to the same shared context:

```yaml
"@context": ../concepts/context.jsonld
```

Avoid `patterns/context.jsonld` unless the archive intentionally separates
graphs. The default for a learning archive is one graph with several artifact
families.

## Node Namespaces

Use stable id prefixes:

```text
concept/<slug>
concept-update/<YYYY-MM-DD-source-slug>
concept-scheme/<archive-or-project>
pattern/<slug>
pattern-axis/<slug>
```

Use `id` and `type` as aliases for JSON-LD `@id` and `@type`.

`diagnostics/` and `exercises/` remain valid Learning archive folders, but this
graph contract does not define standalone diagnostic or exercise node schemas.
Do not claim that those artifacts have been graph-validated unless a later
shared contract defines their families and roles.

## Type Conventions

Use arrays when an artifact has both a broad family and a local role.

Concept documents:

```yaml
type:
  - Concept
  - Atomic
```

Concept-level composition:

```yaml
type:
  - Concept
  - Pattern
```

Saved workflow pattern:

```yaml
type:
  - Pattern
  - Workflow
```

Saved decision pattern:

```yaml
type:
  - Pattern
  - Decision
```

Saved diagnostic pattern:

```yaml
type:
  - Pattern
  - Diagnostic
```

Saved concept-composition workflow:

```yaml
type:
  - Pattern
  - Composition
```

The shared term `Pattern` can appear with `Concept` or by itself. Interpret the
combination by the full type array:

- `Concept + Pattern`: a concept-level composition pattern in `concepts/`.
- `Pattern + Workflow/Decision/Diagnostic/Composition`: a workflow-shaped
  pattern artifact in `patterns/`.

## Required Common Fields

Use these fields when saving graph-shaped artifacts:

```yaml
"@context": <context-path>
id: <namespace>/<stable-slug>
type:
  - <family>
  - <role>
prefLabel: <human-readable label>
inScheme: concept-scheme/<archive-or-project>
status: draft | active | retired
sourceIndependent: true | false
source:
  - <source-or-learning-artifact>
```

## Typed Relations

Prefer top-level typed properties over nested relation lists. This keeps
frontmatter directly graph-readable.

Common relations:

- `uses`: calls on another concept, pattern, diagnostic, or artifact.
- `requires`: must be present before this artifact applies.
- `references`: cites or points to supporting material.
- `replaces`: supersedes an older artifact.
- `source`: provenance or evidence.

Concept relations:

- `composes`: combines smaller concepts into a larger concept or pattern.
- `constrains`: limits the valid use of another concept or pattern.
- `refines`: sharpens or specializes another concept.
- `splits`: separates one concept into multiple concepts.
- `strengthens`: adds support or clearer evidence.

Pattern relations:

- `axis`: the vertical criterion or transformation that organizes the pattern.
- `transforms`: changes an input concept, representation, or source artifact
  into another form.
- `guides`: guides a workflow, review, implementation, or learning move.
- `checks`: uses a concept, diagnostic, or criterion as verification.
- `produces`: outputs an artifact, decision, test surface, spec, or learning
  result.
- `visualizes`: links to named visual sub-artifacts.

## Status Rules

- `draft`: plausible but not stable; limited evidence or not yet transferred.
- `active`: stable enough to guide future work; transfer or reuse evidence
  exists.
- `retired`: misleading, superseded, too broad, or no longer recommended.

When uncertain, use `draft`. Promote only after the artifact survives
source-external use or repeated successful application.

## Context Update Rule

If `concepts/context.jsonld` exists, inspect it before saving graph-shaped
artifacts. Reuse existing aliases and add only missing local terms.

If the archive lacks a context and the user asks to save graph-shaped artifacts,
create or propose `concepts/context.jsonld` with:

- `id` mapped to `@id`;
- `type` mapped to `@type`;
- standard terms from SKOS and Dublin Core where appropriate;
- local workflow terms only when standards do not cover them.

Do not add an artifact-specific field just because one skill needs it once.
Prefer existing typed relation names unless the relation is genuinely new and
reusable.

## Validation Checklist

Before saving a graph-shaped concept or pattern:

- The `id` prefix matches the folder and artifact family.
- The `type` array identifies both family and role.
- The artifact uses the shared context path.
- Relations are typed top-level fields, not an opaque nested list.
- Concept nodes do not duplicate pattern workflows.
- Pattern nodes link to concept nodes instead of copying their full content.
- Status reflects evidence level.
- Source provenance is preserved without making the artifact source-dependent.

When the Pi package extension is active, call `validate_learning_artifact` on
each saved graph-shaped Markdown file. A valid result proves only these
structural conventions; source quality, conceptual atomicity, transfer evidence,
and the chosen status remain judgment questions.
