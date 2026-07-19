---
name: conceptualize
description: >-
  Turn source-bound learning into source-independent concepts and graph
  updates. Use for naming durable mental models, extracting atomic concepts,
  testing concept boundaries, recording add/refine/split/link/retire deltas,
  and creating complete concept documents or source-bound concept-update
  records.
---

# Conceptualize

Create and update source-independent concepts from source-bound learning material.

The goal is not to summarize a source. The goal is to recover the underlying structure, relation, force, tension, or operation that the source made visible, then restate it as a reusable concept in the user's own active language.

Conceptualize is not only a one-shot artifact generator. Treat the user's concepts as a living concept graph. Each new source may add a concept, reinforce one, refine it, split it, merge it with another, link concepts, weaken a concept, or retire it.

## Reference Routing

Read [the Learning skill boundaries](../../references/skill-boundaries.md) when
deciding whether a candidate artifact should stay source-bound, become a
concept, become a pattern, become an exercise, or be saved under another
learning archive folder.

Read [the graph artifact standard](../../references/graph-artifact-standard.md)
before saving, revising, or validating graph-shaped concept documents, concept
updates, structure notes, or pattern handoffs. That file is the shared source of
truth for graph frontmatter, typed relations, status values, and concept-pattern
links.

Read [the concept artifact reference](references/concept-artifacts.md) when
choosing a saved or conversational output shape, splitting multiple candidate
concepts, or checking whether the concept body remains source-independent.

## Core Distinction

Do not produce a reading note, chapter summary, or source explanation unless the user asks for that.

```text
Learning artifact:
  explains the source so the source can be remembered.

Conceptualization:
  uses the source as evidence to create a concept that survives without the source.
```

The concept body should stand alone. Source titles, sections, authors, and examples may appear in provenance, but should not be required to understand the concept.

Maintain two distinct artifact types:

```text
Concept document:
  a self-contained, source-independent explanation of a concept.
  A new reader must understand it without reading the source or update history.

Concept update:
  a source-bound change record explaining how a source changed the living concept graph.
  It may cite source sections, before/after states, source pressure, and evidence trail.
```

Never replace a complete concept document with an update note. Never make a concept document depend on provenance for understanding.

## Concept Containers

Use these principles for concept artifacts:

- Atomic but complete: one concept document should contain one reusable concept, but enough context for a new reader to understand and apply it.
- Concept-oriented, not source-oriented: organize by the concept's transferable operation, relation, or judgment, not by book chapter, author, project, or source term.
- Densely linked: when concepts remain separate, record explicit relations instead of merging them into a vague umbrella.
- Structure notes, not folders: a `concepts/README.md` or concept graph should act as an overview of relations among notes, not as a replacement for complete concept documents.
- Technical anchors: source-specific terms, APIs, examples, and canonical vocabulary belong in a `Technical anchors` / `기술 앵커` section or provenance, unless the term itself is the durable concept.
- Problem formulation over category: prefer names that express a reusable problem, operation, or distinction over broad categories such as "abstraction" or source-local labels such as a chapter heading.
- Note metadata: when writing durable artifacts, store JSON-LD-compatible address, type, status, provenance, and typed graph relations in frontmatter instead of repeating classification in the body.
- Portable mental model: when a concept is the user's "one thing to carry forward", the artifact must include a compact image, loop, axis map, table, or named sequence that can be recalled without rereading prose.

Do not treat "container" as a topic bucket. The container is the smallest durable concept that can travel across sources while preserving links back to the source vocabulary that revealed it.

## Atomicity, Combination, And Linking Gate

Concepts should be atomic enough to be reused, linked enough to gain meaning in a graph, and composable enough to form higher-level moves.

Ground this gate carefully when source traditions or named theories are involved:

- Skill vocabulary: "atomic concept", "composition pattern", and "connector edge" are operational categories for this skill, not quotes from the sources unless provenance says so.
- Keep source names, tradition names, and canonical terms out of the concept body unless the term itself is the durable concept.
- When a concept category is an operational adaptation rather than a source term, state that in the source-bound update or provenance, not in the reusable concept body.

Distinguish these roles before writing artifacts:

```text
Atomic concept:
  A single reusable operation or judgment.
  It should answer one practical question and have its own examples, boundaries, and failure modes.

Composition pattern:
  A reusable way to combine atomic concepts into a larger move.
  It should state how the parts combine, what becomes abstracted as a unit, and what the composition enables.
  It is not a vague umbrella or a mere topic cluster.

  Keep this inside `concepts/` only when the artifact is still a reusable
  concept. If it becomes a workflow, decision routine, diagnostic path,
  checklist, or visual execution model, hand it off to `/skill:patternize`
  and save it under `patterns/` as a graph-linked pattern node.

Connector edge:
  A named relation between concepts, such as enables, constrains, selects, tests, places, refines, splits, or composes.
  Usually record this as an edge in the structure note, not as a full concept document.

Source-local detail:
  Vocabulary, chapter flow, example material, or tool names that explain provenance but do not become a durable concept.
```

For saved concept documents, use graph-shaped YAML frontmatter from
[the graph artifact standard](../../references/graph-artifact-standard.md).
Prefer a shared context file in the concept archive so concept and pattern notes
load into the same graph.

```yaml
---
"@context": context.jsonld
id: concept/<stable-slug>
type:
  - Concept
  - Atomic | Pattern
prefLabel: <human-readable concept name>
inScheme: concept-scheme/<archive-or-project>
status: active | draft | retired
sourceIndependent: true
source:
  - ../concept-updates/<source-bound-update>.md
uses:
  - concept/<other-concept>
---
```

Do not add a separate concept-kind field. Persist the concept role as
`type: [Concept, Atomic]` or `type: [Concept, Pattern]`. Do not use a nested
relation-list field for saved artifacts; use typed properties from the shared
standard so the frontmatter is already a graph shape.

Do not add a body section whose only job is to say "this is an atomic concept" or "this is a composition pattern." Put that in `type`. Use the body for the definition, mechanism, boundaries, examples, judgment questions, and links. In a composition pattern, include a body section such as `Composition mechanism` / `조합 방식` only when it explains how smaller concepts combine.

Do not replace human reasoning links with metadata-only links. Machine-readable graph edges belong in typed frontmatter properties; explanatory paths still belong in `Related concepts`, source-neutral structure notes, and source-bound update records.

When a source suggests a cross-concept workflow, do not force it into a concept
document. Create or update the atomic concepts first, then offer a patternize
handoff so the workflow can become a `pattern/<slug>` node linked to the concepts
it uses, composes, checks, or constrains.

Before finalizing, run an atomicity pressure test:

- If one candidate concept contains two independent verbs, judgments, or practical questions, split it.
- If each subsection could have its own "when to use", examples, and boundaries, split it.
- If a concept mainly says "X is important" but not what reusable operation X performs, rename or split it.
- If a broad umbrella only groups topics, demote it to a structure-note relation map.
- Keep a composition pattern only when it has a mechanism for combining parts, not merely a theme that contains them.
- Keep a connector as an edge unless the relation itself has reusable mechanics worth teaching.

Good conceptualization should expose both the small pieces and the way they compose. Do not stop at an umbrella when the user's future practice depends on choosing or combining smaller moves.

## Portable Mental Model Gate

When the user asks for the essence, a core image, a central insight, a concept to keep in mind, or says the prose does not feel intuitive, add a portable mental model before finalizing.

Use the smallest shape that preserves the mechanism:

```text
Named sequence:
  A -> B -> C -> Check

Two-axis map:
  vertical criterion + horizontal variants

Loop:
  intention -> construction -> observation -> correction

Role table:
  part / job / failure if missing

Puzzle map:
  pieces, connection rule, illegal moves, repair moves
```

Treat this as a quality gate, not decoration:

- The model must encode the actual mechanism, not merely illustrate it.
- The model must be short enough to remember and reuse in a different domain.
- If a prose concept is correct but cannot be compressed into a recallable model, revise the concept boundary, split it, or add a composition pattern.
- If the model reveals multiple axes, such as layer-vs-variant boundaries, create separate concept nodes or explicit graph edges instead of burying the axis in provenance.
- If the model becomes a workflow, decision routine, diagnostic path, checklist, or visual execution model, recommend a `/skill:patternize` handoff after creating or updating the concept nodes.

## Structure Note Contract

When creating or updating `concepts/README.md`, a concept graph, or any structure note:

- Treat it as a navigation layer, not a learning summary, tutorial, or source recap.
- Keep it source-neutral and durable across future learning materials.
- Use functional section titles that describe the section's job, such as `Principles`, `Relation Map`, `Concept Index`, and `Update Questions` in the user's active language.
- Include only lightweight graph context: operating principles, relation map, concept index, and questions for future graph updates.
- Put detailed explanation inside each concept document, not in the structure note.
- Put source-specific flows, chapter-specific narratives, and source-local examples in concept updates or provenance, not in the structure note.
- Keep technical terms in a compact anchor/index role unless they are themselves concept names.
- If concept documents have `type` frontmatter, structure note role labels should be navigation labels derived from metadata, not duplicated concept explanations.
- Before finalizing, perform a heading-content fit check: every heading must name what the section actually does.

Avoid structure note sections such as `Practice Loop`, `Current Learning Flow`, `Chapter Core`, or `Main Insight` unless the file is explicitly source-bound. These titles often freeze a temporary source snapshot into a long-lived graph.

## Default Workflow

1. Gather the source-bound observations.
   - Use provided notes, active learning artifacts, pasted passages, prior session context, or configured learning archive files.
   - If the target material is ambiguous, ask the minimum clarifying question.
   - If enough context is present, proceed without asking.
   - When a learning archive has `concepts/`, existing concept documents, concept graphs, or concept updates, inspect the relevant files before creating a new concept.

2. Extract candidate signals.
   - Strong repeated examples
   - Surprising contrasts
   - Boundary cases
   - Authorial moves: why this example, why this wording, why this order
   - User confusions or "this feels important" moments
   - User requests for "one thing to carry", "mental model", "intuitive shape", "core image", or "what is the essence"
   - Terms that seem source-specific but point to a deeper relation

3. Classify the concept delta.
   - Add: a new reusable concept is needed
   - Reinforce: a source gives new evidence for an existing concept
   - Refine: a definition, mechanism, boundary, or judgment question must become sharper
   - Split: one concept is doing too much and should become several
   - Merge: separate concepts are actually one relation or operation
   - Link: concepts remain separate but need an explicit relation
   - Weaken: a concept is too broad, misleading, or less general than assumed
   - Retire: a concept should no longer be used

4. Strip source scaffolding.
   - Remove proper nouns, section numbering, tool names, and local examples from the candidate concept body unless they are essential.
   - Translate source-specific terms into portable roles such as state, boundary, preserved meaning, representation, signal, pressure, frame, transition, guarantee, or tradeoff.
   - Preserve technical terms in `Technical anchors` / `기술 앵커` when they are important for search, retrieval, or source continuity but should not dominate the concept name.
   - Keep technical terms in the main definition only when they are the concept itself, not merely the source's vocabulary.

5. Find the relational structure.
   - Ask what remains true if the original topic changes.
   - Prefer relations over objects, operations over labels, and constraints over anecdotes.
   - Use analogy only when the relation maps cleanly, not for decoration.
   - Do not force convergence into one master concept. If several reusable centers remain, keep them as separate concept nodes and describe their relations.
   - Name relation types when possible: enables, constrains, corrects, refines, splits, merges, replaces, provides evidence for, or creates pressure on.
   - Classify candidates as atomic concepts, composition patterns, connector edges, or source-local details before writing final artifacts.
   - Treat connector edges as first-class graph updates even when they do not deserve their own document.

6. Run the atomicity, combination, and linking gate.
   - Ask whether each candidate answers exactly one reusable practical question.
   - Split candidates that contain multiple independent mechanisms or multiple different ways of being useful.
   - Preserve the composition relation among split notes with explicit edges.
   - If a broad concept is still useful, make it a composition pattern only when it states how the atomic notes combine into a higher-level unit.

7. Name the concept.
   - Use the user's active language by default.
   - A good name should be short, memorable, and generative.
   - It may differ from the source's terminology.
   - Prefer a portable operation or judgment name, then preserve source terms as technical anchors.
   - Avoid both extremes: names so source-specific they cannot travel, and names so generic they lose the source's force.
   - If no name is clearly best, offer 2-4 candidates and choose one provisional working name.

8. Define and test the concept.
   - Give a one-sentence definition.
   - Describe the core image or felt structure.
   - Add a portable mental model when the concept is central, difficult, cross-cutting, or explicitly requested as something to keep in mind.
   - Explain the mechanism.
   - Test against at least two examples: one from the source and one outside the source.
   - Include non-examples or boundaries.
   - State what changed in the learner's seeing: what distinction, judgment, or correction became newly available?

9. Produce or update artifacts if requested.
   - Save only when the user asks to capture, save, persist, or add it to a learning archive.
   - If a learning archive is configured, prefer `concepts/<concept-slug>.md` for durable concept documents and `concept-updates/<YYYY-MM-DD>-<source-slug>.md` for source-bound update records.
   - When the source changes an existing concept, update the concept document only if the document itself should change; otherwise add a concept update.
   - When `validate_learning_artifact` is available, run it on each saved graph-shaped artifact. Repair structural errors and present warnings as unresolved judgment items.
   - Do not commit or push unless explicitly requested.

## Concept Quality Bar

A good conceptualization must satisfy these checks:

- It can be understood without reopening the source.
- It is not just a more abstract title for the source.
- It is not just the source's technical term with a new heading.
- It is atomic without being fragmentary: one concept, complete enough to use.
- It is not an umbrella hiding multiple atomic concepts that should be split.
- If it is a composition pattern, it explains how smaller concepts combine, what is abstracted as a unit, and what the composition enables.
- If it is only a relation, it is represented as a connector edge instead of inflated into a concept document.
- It explains why multiple source examples belong together.
- It applies to at least one source-external situation.
- It has boundaries: where it fails, misleads, or needs a different concept.
- It gives the learner a new way to notice future cases.
- If it is a central or cross-cutting concept, it includes a recallable mental model, visual compression, sequence, loop, or axis map.
- The mental model preserves the concept's mechanism and failure modes instead of acting as a decorative analogy.
- It preserves provenance without depending on provenance.
- It preserves important source vocabulary as anchors without letting that vocabulary become the concept's whole identity.
- It states links to nearby concepts when the concept depends on, enables, constrains, corrects, or refines them.
- If it is a structure note, it stays minimal, source-neutral, and navigation-focused.
- If it is a structure note, its section headings match durable functions rather than temporary source narratives.
- If it is a concept document, it is self-contained for a new reader.
- If it is a concept update, it clearly says which concepts were added, reinforced, refined, split, merged, linked, weakened, or retired.
- It records the source pressure: why the source forced this conceptual change rather than merely inspired a vague association.

If the draft fails these checks, revise before presenting it.

For detailed artifact shapes and candidate-splitting tests, use the routed
reference. In conversation, present the concept, its portable model, mechanism,
source and transfer examples, boundary, and capture handoff at the smallest
useful depth.
