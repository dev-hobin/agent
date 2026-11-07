---
name: conceptualize
description: "Forms and tests one source-independent concept from several sources, notes, insights, talks, or examples. Use whenever the user asks what single idea several materials or mechanisms share, whether two named ideas are one concept or two, or to strip source-specific detail and keep what transfers, even when the answer seems known from general knowledge and even before the materials are shared. Tests the candidate with transfer cases and counterexamples and separates it from nearby concepts. Produces a complete concept result and, when requested, a self-contained plain Markdown artifact. Not for explaining or summarizing one source or one term, turning cases into a step-by-step procedure or decision path, practice problems, or domain modeling."
metadata:
  short-description: "Form and test one transferable concept from several sources"
---

# Conceptualize

Compare several source-bound materials and find the one operation, relation, distinction,
force, or judgment that survives when each source's vocabulary and examples change. Then test
whether it deserves to be a concept.

Read `references/method.md` in this skill's directory before every run: it is the full
method. The essentials are below.

## When this applies

- Use it when there are two or more independent sources, insight bundles, repository cases, or
  observations to compare (or one source plus a genuine transfer case outside it), or when a
  candidate holds several verbs or practical questions, mixes concept with workflow, has
  uncertain transfer, or lacks a discriminating counterexample.
- Do not use it when the wanted result is deliberate practice, or when faithful reading or
  translation of a source is all that is needed (use `exercise` or `technical-reading`).
  These exclusions win.
- Not for turning several cases into a repeatable workflow (use `patternize`).
- Failing the concept gate is a normal result. Do not polish something into a concept because
  the request said "conceptualize".

## Gotchas

- The same vocabulary or topic is not the same concept. Support a concept only when the
  sources share a mechanism or a judgment.
- Do not smooth over contradictions; record them.
- Semantic atomicity is not file atomicity. File shape is a delivery choice made after the
  meaning is settled.
- A relation between two concepts is usually a connector relation, not a third concept.
  Workflow-shaped coordination goes to `patternize`.
- Strip proper nouns, chapter order, and tool names only when meaning survives. Keep standard
  technical terms that precision or search needs as anchors.
- Do not modify the input materials; write only the requested artifact.

## Procedure

1. **Gather observations.** Keep source claims, interpretations, hypotheses, examples, and
   boundaries as different kinds of evidence. Ask only when missing material could change the
   concept's boundary.
2. **Build a comparison table:** `Evidence context | Source-local expression | Example |
   Boundary | Candidate invariant`.
3. **Classify roles:** concept candidate, connector relation, work-pattern candidate,
   source-local detail, unresolved contradiction.
4. **Strip source scaffolding.**
5. **State the candidate:** short name, one-sentence definition, the practical question it
   answers, the mechanism.
6. **Boundary gate.** Split anything that holds independent verbs, mechanisms, or questions.
7. **Transfer test:** one case outside the sources, one near miss or counterexample, the
   assumptions, and the first condition that would refute the generality.
8. **Return the result**, preserving provenance and evidence gaps; save it in the shape below
   if requested.

When the concept is central or something to carry away, compress the mechanism into a
Portable Mental Model as described in `method.md` (a sequence, axes, loop, role table, or
relation map).

## Output

Default: a complete concept result in the conversation. Use the smallest useful subset of:

```text
Concept candidate:
One-sentence definition:
Practical question answered:
Cross-source evidence:
Portable model:
Mechanism:
Technical anchors:
Transfer case:
Counterexample / boundary:
Related concepts and connector relations:
Evidence gap:
Handoff:
```

The result ends as one of: supported, refuted, split, or provisional.

If saving was requested, write a plain Markdown concept artifact to the path the user gave and
no other file. It holds the definition, evidence, mechanism, transfer, boundary, relations, and
sources, and assumes no archive structure or metadata schema. If the path is unknown, ask only
for the path.

## Output contract (saved results)

The required parts of a saved result are data in `assets/output-contract.json`. Start the
file from its skeleton, fill every part, and finish only when the check passes:

```text
node <this skill's directory>/scripts/output-contract.mjs new <this skill's directory>/assets/output-contract.json <file>
node <this skill's directory>/scripts/output-contract.mjs check <this skill's directory>/assets/output-contract.json <file>
```

Keep the skeleton's marker line and headings. If a part has nothing to report, keep it and
write "none" with the reason. The check is deterministic and says what to fix. Run both
from the directory this session started in or below it: they register the result for this
session, and a plugin hook checks it again when the session stops. If a command stops with
"No hobin-learning registry for this agent session", `cd` back there and run it again, and
follow the message if it says more.

## Every result must

- (When saved) pass the output contract check.
- (When saved) be readable Markdown at the user's path, with no other file written.
- Carry a definition, mechanism, per-source evidence with provenance, a transfer case, a
  counterexample or boundary, and related concepts and connector relations.
- When the evidence comes from one source only, state source independence as an evidence gap.
- Leave the input materials unchanged.

## Reference files

Each is an independent candidate, not a requirement.

- `references/method.md` — always: the full method
  (distinctions, evidence gates, default flow, portable mental model, output, quality bar,
  completion).
- `references/cross-source-synthesis.md` — when at least two
  independent sources, insight bundles, repository cases, or observations (or one source plus
  a genuine transfer case) are available for comparison.
- `references/concept-boundaries.md` — when the candidate
  contains multiple verbs or practical questions, mixes concept and workflow, has uncertain
  transfer, or lacks a discriminating counterexample.
