# Artifact Writing

Use this reference before writing or saving a standalone learning artifact.

## Contents

- Artifact standard
- Save flow
- Source-intent-specific artifact shapes
- Quality check

## Standard

Create a standalone explanatory document, not a report form or transcript.

The artifact should:

- Start with the source-specific learning thesis or goal as the first real section.
- Use selected composite lenses to create one cohesive learning path.
- Include only metadata that helps future retrieval; do not duplicate source introduction in prose.
- Omit a translation log unless the user explicitly wants a translation artifact.
- Use examples rich enough that a future reader can understand without reopening the source.
- Explain why examples, sequence, caveats, or terms matter.
- Include boundaries, common misreadings, and representative failure cases.
- Derive practical criteria from the explanation.
- End with a non-generic conclusion.
- Include `One-sentence memory hook` and `Meta-learning correction` when useful.

Avoid appendices whose only purpose is adding prompts or analysis debris. Add AI implementation prompts, open-source prompts, retrieval questions, or exercises only when requested or central to the artifact's purpose.

## Save Flow

1. Review accumulated chunks and user comments.
2. Reconstruct source intent and selected composite lenses.
3. For book chapters, apply `book-continuity.md` lightly; preserve the artifact's standalone explanation.
4. Select durable ideas for future learning.
5. Rewrite into a coherent document with explanation, examples, boundaries, practical criteria, and conclusion.
6. Persist to the configured learning location only after approval or when already configured.

## Artifact Shapes

Adapt headings to the source and localize them to the user's active language.

### Conceptual Chapter Or Essay

```text
# <Source> - <Topic> <localized learning note title>

- Source:
- Scope:
- Date:
- Type:
- Lens:

## <Reader change this source is trying to create>
## <Why this view matters>
## <Mental model the source installs>
## <Explanation flow and examples>
## <Boundaries and misreadings>
## <Practical judgment criteria>
## <Conclusion>
## One-sentence memory hook
## Meta-learning correction
```

If book continuity materially helps, add a short "place in the book" paragraph near the top or a transition sentence in the introduction/conclusion. Do not make it a required major section.

### Programming Language Or Runtime Text

```text
## <Behavior model this source teaches>
## <Core rules>
## <Step-by-step examples>
## <Likely misreadings>
## <Boundary conditions and exceptions>
## <Code writing/review criteria>
## <Conclusion>
```

### API, MDN, Or Product Documentation

```text
## <Usage model>
## <When to use it>
## <Exact contract>
## <Normal examples>
## <Boundary examples and misuse>
## <Errors, compatibility, and version notes>
## <Selection criteria>
## <Conclusion>
```

### Tutorial Or How-To

```text
## <Target state>
## <Overall flow>
## <Steps and rationale>
## <Verification method>
## <Failure points and recovery>
## <Transfer criteria for other situations>
## <Conclusion>
```

### Reference Or Spec

```text
## <Rules fixed by this source>
## <Core terms>
## <Normative requirements>
## <State, algorithm, or contract>
## <Examples and non-examples>
## <Implementation or usage caveats>
## <Conclusion>
```

## Quality Check

Before presenting or saving, revise until:

- The first real section states what the learner should now understand, do, explain, or judge.
- Selected lenses fit the source and are not artificially narrowed.
- The document reads as a complete explanation, not extracted fields.
- Examples are concrete enough to teach the idea locally.
- Practical criteria are visibly derived from the model, contract, semantics, or workflow.
- Boundaries and common misreadings are included.
- The conclusion is present and non-generic.
- Optional appendices are absent unless they serve the stated purpose.
