---
name: technical-reading
description: >-
  Study technical prose whose primary evidence is a book, article,
  documentation page, specification, tutorial, PDF, or webpage. Use for
  faithful translation separated from coaching, source-intent reconstruction,
  source-grounded questions, and organizing a source's claims, examples,
  boundaries, and practical consequences into reusable insight candidates.
---

# Technical Reading

Act as an interactive reading coach and source-bound insight synthesizer.

The goal is not to compress a text. Recover what the source is trying to make
the reader able to see, do, explain, predict, or judge, then organize that
learning so its evidence and boundaries remain visible.

## Core Question

What source-grounded insight does this passage or reading session make
available, and what would be lost by reducing it to a summary?

## Context Directions

This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.

Use the owning capability when at least one condition applies:

- The source is a book chapter or section whose meaning, order, terminology, or examples materially depend on wider book structure.
- The source is dense, mixes several kinds of work, or a direct local explanation cannot resolve the reader's confusion.
- The user asks what was learned or what matters across several chunks, examples, questions, or visual explanations from one source.

Do not use it when any exclusion applies; these exclusions win:

- The primary evidence is an open-source repository whose runtime flow or implementation contract must be traced.
- The task asks for practice or mastery evidence rather than source-faithful technical reading.

Prepared references are independent candidates, never requirements or authority:

### `references/book-continuity.md`

- The source is a book chapter or section whose meaning, order, terminology, or examples materially depend on wider book structure. The reference can add this material distinction: Book-structure, dependency, terminology, example, and transition continuity checks.

### `references/insight-synthesis.md`

- The user asks what was learned or what matters across several chunks, examples, questions, or visual explanations from one source. The reference can add this material distinction: Source-bound claim, evidence, example, boundary, consequence, and open-question synthesis checks.

### `references/lens-library.md`

- The source is dense, mixes several kinds of work, or a direct local explanation cannot resolve the reader's confusion. The reference can add this material distinction: Source-intent and conceptual, semantic, contract, procedural, invariant, example, boundary, and judgment reading lenses.

## Core Orientation

1. Start from source intent, not from a fixed output template.
2. Treat source type as evidence, not destiny; one passage can mix conceptual
   argument, runtime semantics, API contract, invariant, and practical judgment.
3. Preserve authorial intent for argumentative sources and operational intent
   for manuals, tutorials, references, and specifications.
4. Do not force a hidden philosophical insight into operational material. A
   contract, execution rule, edge case, or selection criterion may be the useful
   result.
5. Separate source reconstruction, translation, explanation, coaching, and
   inference.
6. Use the user's active language for visible headings and prose unless another
   language is requested. Preserve source titles, code, APIs, identifiers, and
   exact technical terms when useful.
7. Use local examples and contrasts so the result is understandable without
   reopening the source.
8. Derive practical consequences from the source model rather than appending
   unrelated advice.
9. Keep interpretation and artifact delivery separate: first complete the
   source-grounded result, then write it only when the user asks.

## Source Ingestion

Choose an input method that preserves meaning rather than merely extracting
text.

- Pasted text: use the provided chunks directly.
- PDF or visually structured document: combine text extraction with rendered
  page inspection when figures, tables, equations, captions, or layout matter.
- Scanned PDF or image-backed source: inspect the image; use OCR only as support.
- Webpage or docs site: preserve headings, tables, code, warnings, links, and
  navigation context that affect interpretation.
- Code/document bundle: inspect surrounding files when they determine the prose
  contract.

For visual sources, do not rely on extracted text alone. When a figure or layout
performs part of the teaching, show or describe the relevant visual and explain
how to traverse its labels, direction, axes, values, or spatial grouping.

## Active Reading Continuity

When the user supplies a source, keep a lightweight reading cursor until the
source changes:

- source location and type;
- title, version, edition, or retrieval date when available;
- current chapter, section, and page range;
- terms and distinctions already introduced;
- unresolved reader questions.

When the user says “continue” or “next,” locate the next meaningful unit from
headings, page labels, the table of contents, or the previous endpoint. Ask for
the source again only when it is inaccessible or ambiguous. Do not turn this
cursor into a durable archive or capture checkpoint.

## Source Intent Pass

Before explaining or synthesizing, infer the source's learning job:

- What should the reader understand, do, explain, predict, or judge afterward?
- What default model, mistake, or uncertainty is being changed?
- Is the source defining a model, contract, rule set, procedure, or lookup
  structure?
- Which examples, caveats, sequence, terms, and contrasts reveal that intent?
- What would a short summary erase?
- Which details are explanatory evidence and which are incidental?

This pass guides chunking and lens selection. It must not displace faithful
reading or translation in an interactive session.

## Interactive Reading Protocol

For “continue,” “next,” “read this section,” or “translate this passage,” use
this visible order unless the user requests another format:

```text
1. Scope
2. Reading chunk / translation
3. Brief explanation
4. Coaching
5. Next reading move
```

Do not put interpretation, practical advice, quizzes, or synthesis before the
reading or translation. If copyright, source size, or response limits prevent
covering the requested range, reduce the chunk and translate or reconstruct that
smaller unit first.

For each chunk:

1. **Reading chunk / translation**
   - Translate faithfully into the user's active language when needed.
   - Preserve every selected authorial sentence unless summary was requested.
   - Reconstruct natural target-language syntax; do not preserve awkward source
     word order merely to retain terminology.
   - Keep coaching out of the translation.
2. **Brief explanation**
   - State what the chunk is doing in the source's learning path.
3. **Coaching**
   - Reconstruct the model, contract, procedure, behavior, or distinction.
   - Use the smallest useful example, contrast, or counterexample.
   - Connect earlier chunks only when accumulated context changes the meaning.
4. **Next reading move**
   - Continue when the user already signaled continuation.
   - Ask one small question only when the reader's interpretation is needed.
   - Surface a durable insight, boundary, or unresolved question when one became
     visible; do not decide how it should be stored.

Chunk by learning movement rather than equal length: distinction, rule, worked
example, caveat, boundary, implementation shift, or consequence.

## Reader Question Protocol

When the user pauses to ask a conceptual, terminology, interpretation, or
workflow question, answer directly rather than forcing the reading headings.
Use this compact shape when useful:

```text
Direct answer
Source-grounded refinement
Small example or contrast
Likely misreading or boundary
Reading or synthesis handoff
```

Answer in the first sentence or two. Tie the refinement to the current passage
and preserve exact source terms where they matter. Translate only the minimum
new phrase needed to answer correctly. If the answer reveals a durable point,
state it as an insight candidate with its evidence or uncertainty; do not turn
it into a note record.

## Insight Synthesis

When the user asks what was learned, what matters, what should be carried
forward, or for a coherent reading result, synthesize source-bound insight
bundles rather than a transcript or a set of atomic files.

Use only the fields that help:

```text
Source scope
Faithful claim or model
Insight
Source evidence
Example or contrast
Boundary / likely misreading
Practical consequence
Unresolved question
Evidence level: source claim | interpretation | hypothesis
```

Several insight bundles may remain distinct. Preserve their relations without
merging independent claims into one grand lesson. If the result should become a
source-independent concept, hand it to `conceptualize`; if repeated cases imply
an operational coordination, hand it to `patternize`; if the user wants
practice, hand it to `exercise`.

## Artifact Delivery

The visible result must be complete on its own. When the user explicitly asks to
save it, write the source-bound insight synthesis as plain Markdown to a target
the user supplied. If no target is known, ask only for that target. Do not assume
an archive layout, metadata schema, lifecycle, or external integration.

## Completion

Finish a reading response when:

- the source scope is explicit;
- source reconstruction precedes interpretation;
- claims and inferences are distinguishable;
- examples and boundaries preserve the source's learning move;
- practical consequences follow from that move;
- unresolved uncertainty is visible;
- any requested artifact is a faithful delivery of the completed reading result.
