# Learning Skill Boundaries

This is the shared source of truth for deciding which Learning skill owns a
task, which artifact family should be saved, and when to hand off between
skills.

Each skill must remain independently usable. Keep the core procedure inside the
skill's own `SKILL.md`; use this reference only for boundary, routing, and
archive decisions.

For graph frontmatter, typed relation names, status values, and shared
`concepts/` + `patterns/` graph conventions, use
[the graph artifact standard](graph-artifact-standard.md). This file decides
where an artifact belongs; the graph standard decides how graph-shaped
artifacts are represented.

## Contents

- Skill ownership
- Artifact routing
- Boundary tests
- Handoff rules
- Standalone skill behavior
- Persistence rules

## Skill Ownership

```text
technical-reading
  Source-bound prose learning.
  Use for books, articles, docs, specs, PDFs, tutorials, and technical writing.
  Output: reading sessions, source-grounded learning artifacts.

opensource-reading
  Source-bound repository learning.
  Use for open source code, tests, docs, examples, runtime flows, contracts,
  invariants, and architecture slices.
  Output: repository study artifacts and reconstructed specs.

conceptualize
  Source-independent concept formation.
  Use when learning notes should become durable concepts, concept updates,
  concept graph links, atomic concepts, or concept-level composition patterns.
  Output: `concepts/` and `concept-updates/`.

patternize
  Cross-concept operational pattern formation.
  Use when several concepts or judgments should become a reusable workflow,
  decision routine, diagnostic path, checklist, or visual execution model.
  Output: `patterns/`.

exercise
  Deliberate practice and mastery evidence.
  Use when a concept, pattern, or learning artifact should become drills,
  misconception diagnostics, transfer tasks, tutor scripts, spaced retrieval,
  or mastery rubrics.
  Output: `exercises/` and compact reusable diagnostics when appropriate.
```

## Artifact Routing

```text
books/
  source-bound prose learning artifacts.

open-source/
  source-bound repository reading artifacts.

concepts/
  reusable source-independent concepts.

concept-updates/
  source-bound records of concept graph changes.

patterns/
  workflow-shaped patterns that coordinate concepts.

diagnostics/
  warning signs, review questions, smell lists, rubrics, and confidence checks
  that do not require a full workflow.

exercises/
  deliberate practice material, tutor scripts, spaced retrieval plans, and
  mastery checks.
```

## Boundary Tests

Use these tests when an artifact feels ambiguous:

- If it explains one source, it belongs under `books/` or `open-source/`.
- If it names one reusable idea or distinction, it belongs under `concepts/`.
- If it records how a source changed the concept graph, it belongs under
  `concept-updates/`.
- If it coordinates several concepts into a repeatable action path, it belongs
  under `patterns/`.
- If it tests whether the learner can use a concept or pattern, it belongs
  under `exercises/`.
- If it is mainly a reusable warning sign or review question, it belongs under
  `diagnostics/`.

## Handoff Rules

Make handoffs explicit. Do not silently perform another skill's job inside the
current skill.

Common handoffs:

- `technical-reading -> conceptualize`: source insight should become a durable
  concept.
- `opensource-reading -> conceptualize`: repository lesson generalizes beyond
  the project.
- `conceptualize -> patternize`: several concepts form a workflow, decision
  routine, diagnostic path, or visual execution model.
- `patternize -> conceptualize`: a workflow exposes a missing atomic concept.
- `conceptualize/patternize -> exercise`: the user wants internalization,
  drills, mastery checks, or transfer practice.
- `exercise -> conceptualize`: practice reveals that the concept boundary is
  wrong or incomplete.
- `exercise -> patternize`: practice design reveals a reusable practice pattern,
  not just exercises for one concept.

## Standalone Skill Rule

Every Learning skill should still work when invoked alone:

- The skill's own `SKILL.md` must include its core workflow and output shape.
- Shared references should be loaded only when boundary, persistence, graph, or
  cross-skill decisions matter.
- A skill may recommend a handoff, but should not require another skill to
  produce a useful first response.
- When the user asks for saved artifacts, inspect the relevant archive files
  before writing new ones.

## Persistence Rule

Do not assume a learning archive path unless the user has provided one or it has
already been configured in the thread. When saving is requested:

1. Identify the artifact family using this reference.
2. Inspect existing files in the target folder.
3. Reuse shared graph conventions when saving `concepts/` or `patterns/`.
4. Save the smallest reusable artifact, not the full chat transcript.
5. Commit or push only when the user explicitly asks.
