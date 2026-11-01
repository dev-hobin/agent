---
name: technical-reading
description: "Studies technical prose whose primary evidence is a book, article, documentation page, specification, tutorial, PDF, or webpage. Use for faithful translation separated from coaching, source-intent reconstruction, source-grounded questions, and organizing a source's claims, examples, boundaries, and practical consequences into reusable insight candidates. Not for code-first repository study or designing practice exercises."
argument-hint: "[source to read (pasted text, file, or URL), its scope, and where to save the result]"
allowed-tools:
  - "Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs *)"
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "node \"${CLAUDE_PLUGIN_ROOT}/scripts/output-contract-hook.mjs\""
---

# Technical Reading

Read technical prose faithfully: recover what the source wants its reader to see, do,
explain, predict, or judge, and keep that learning visible with its evidence and limits.

Source, scope, and save path: $ARGUMENTS (if empty, take them from the request)

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/technical-reading/method.md` before every run: it is the
full method. The essentials are below.

## When this applies

- Use it when the source is dense, mixes kinds of work, or a local explanation does not
  resolve the reader's confusion; when it is a book chapter or section whose meaning depends
  on the book's structure; or when the user asks what they learned or what matters from
  several pieces of one source.
- Do not use it when the main evidence is an open source repository whose execution flow or
  implementation contract must be traced (use `opensource-reading`), or when the user wants
  practice or mastery evidence rather than faithful reading. These exclusions win.

## Gotchas

- Start from the source's intent, not a fixed output frame. The kind of source is evidence,
  not destiny: one passage can mix a conceptual argument, execution semantics, an API
  contract, an invariant, and a practical judgment.
- Do not force philosophical insight out of a manual or specification. Contracts, execution
  rules, edge cases, and selection criteria can be the useful result.
- Never mix coaching into translation. Unless a summary was requested, keep every chosen
  author sentence; do not bend target-language word order just to preserve a term.
- Do not trust extracted text alone when figures, tables, formulas, or layout carry part of
  the teaching.
- When copyright, source size, or response limits prevent covering the whole scope, shrink
  the chunk and translate or reconstruct that smaller unit first.
- Do not merge several insight bundles into one giant lesson.

## Procedure

1. **Take in the source** with an input method that preserves meaning: pasted text, a PDF's
   text and rendering, a scanned image, a web document's headings, tables, code, and warnings.
2. **Keep a reading cursor**: source location and kind, edition or version, current chapter,
   section, or page, terms already introduced, unresolved questions. "Continue" finds the next
   meaning unit from the previous endpoint. The cursor is not a permanent store.
3. **Reconstruct the source's intent**: what the reader should become able to do, what the
   source tries to change, what a summary would erase.
4. **Answer in the shape the request asks for** (below). Cut chunks by learning move
   (distinction, rule, example, cue, boundary, consequence), not by equal length.
5. **Hand off explicitly**: source-independent concepts to `conceptualize`, recurring case
   coordination to `patternize`, practice to `exercise`. The result is complete without a handoff.
6. **Deliver.** If saving was requested, write the finished result unchanged as plain Markdown
   to the path the user gave; if the path is unknown, ask only for the path. Assume no archive
   structure, metadata schema, lifecycle, or external integration. A saved result follows the
   output contract below.

## Output shapes

- **Reading progress** ("continue", "next", "read this section", "translate it"), in this
  order, with no interpretation, advice, quiz, or synthesis ahead of the reading:

  ```text
  1. Scope
  2. Reading chunk / translation
  3. Brief explanation
  4. Coaching
  5. Next reading move
  ```

- **Reader question**: answer directly in the first sentence or two, then add as needed a
  source-grounded refinement, a small example or contrast, a common misreading or boundary,
  and a move back to reading or synthesis.
- **Insight synthesis** (what was learned, what to carry away): source-bound entries, only the
  useful ones.

  ```text
  Source scope
  Source terms (the source's own key terms, verbatim, with its definitions)
  Faithful claim or model
  Insight
  Source evidence
  Example or contrast
  Boundary / likely misreading
  Practical consequence
  Unresolved question
  Evidence level: source claim | interpretation | hypothesis
  ```

Write headings and prose in the user's language; keep source titles, code, APIs, identifiers,
and exact technical terms when needed. Copy the terms the source defines into Source terms
exactly as the source writes them, and use those words, not paraphrases, in the insights.

## Output contract (saved results)

The required parts of a saved result are data in `assets/output-contract.json`. Start the
file from its skeleton, fill every part, and finish only when the check passes:

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs new ${CLAUDE_SKILL_DIR}/assets/output-contract.json <file>
node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs check ${CLAUDE_SKILL_DIR}/assets/output-contract.json <file>
```

Keep the skeleton's marker line and headings. If a part has nothing to report, keep it and
write "none" with the reason. A plugin hook also runs the same check on every write of a
result started from the skeleton and reports what to fix.

## Every result must

- (When saved) pass the output contract check.
- Name the source and the sections or pages covered.
- Mark the evidence level so source claims stay distinct from interpretation and hypothesis.
- Give each insight source evidence (section, sentence, or term), a boundary or likely
  misreading, and a practical consequence.
- State unresolved questions and what the source leaves undecided; do not hide them.
- In reading progress, put translation or reconstruction before interpretation and coaching.
- Leave the source file unchanged; write only the requested artifact.

## Reference files

Each is an independent candidate, not a requirement; read one only when its condition holds.

- `${CLAUDE_PLUGIN_ROOT}/knowledge/technical-reading/method.md` — always: the full method
  (orientation, taking in the source, reading continuity, intent, reading and question
  protocols, insight synthesis, delivery, completion).
- `${CLAUDE_PLUGIN_ROOT}/knowledge/technical-reading/lens-library.md` — when the source is
  dense, mixes several kinds of work, or a direct local explanation cannot resolve the
  reader's confusion.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/technical-reading/book-continuity.md` — when the source is
  a book chapter or section whose meaning, order, terminology, or examples materially depend
  on wider book structure.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/technical-reading/insight-synthesis.md` — when the user asks
  what was learned or what matters across several chunks, examples, questions, or visual
  explanations from one source.
