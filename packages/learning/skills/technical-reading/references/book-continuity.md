# Book Continuity

Use this reference for chapters or sections in a longer book.

## Default Stance

Do not assume every book is cumulative. Default to omnibus or weak continuity until evidence says otherwise.

Continuity has one job: preserve the reader's sense of the book's flow. Do not turn it into a dependency database, exhaustive concept graph, or forced previous/next chapter report.

Classify the book structure as:

- cumulative argument or curriculum
- modular reference/manual
- anthology or essay collection
- unknown

If the book has a preface, introduction, "how to read this book" chapter, or author reading guide, use it as high-priority evidence for the intended structure.

## Evidence Order

Recover continuity from:

1. Author reading guide, preface, introduction, or "how to read this book" material.
2. Explicit cross-references to earlier chapters, pages, examples, or named concepts.
3. Chapter introductions, summaries, and transition paragraphs.
4. Repeated concepts that clearly affect the current chapter's meaning.
5. Existing chapter notes and `toc.md` in the learning archive.
6. Careful inference, marked as inference when the source does not state it directly.

Use only evidence that changes how the learner understands the chapter's role. Ignore incidental references.

## Saving Book Chapter Artifacts

When saving a book chapter artifact:

- Determine the book structure before imposing continuity; adjust it as more chapter artifacts accumulate.
- Look for `books/<source>/toc.md`, `table-of-contents.md`, `book-map.md`, `overview.md`, or `index.md`.
- If one exists, read it before finalizing the chapter note.
- If none exists and persistence is approved, create a seed `toc.md`; for weakly connected books, make it a light annotated index.
- If persistence is not approved, propose `toc.md` instead of silently skipping continuity.
- Read previous chapter artifacts only when the current chapter depends on them or the TOC is insufficient.
- Add a chapter continuity section only when it materially improves the note. Prefer one short paragraph over a detailed list.
- Do not let continuity weaken the chapter artifact's standalone explanation.
- Update the TOC only when the chapter changes the learner's view of the book's flow.

## TOC SSOT

For book sessions, treat `toc.md` as the continuity SSOT. It should be a lightweight annotated table of contents, not a full knowledge graph.

Good TOC entries are short:

```text
Chapter:
  one-sentence role in the book
  optional link to artifact
```

For cumulative books, the TOC may include a brief "flow so far" section. Keep it broad enough that a future reader can see the arc without reading a dense analysis.

For reference-like or anthology-like books, use a light annotated index organized by topic or chapter. Do not force a linear argument.

## Chapter Note Integration

Continuity inside a chapter note should usually be one of:

- no section, if the chapter stands alone
- a short "place in the book" paragraph near the top
- a brief transition sentence in the introduction or conclusion

Avoid long lists of previous concepts, exhaustive cross-chapter tracing, or mechanical "previous / this chapter / next" blocks unless the author explicitly structures the book that way.
