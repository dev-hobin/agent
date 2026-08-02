---
name: exercise
description: >-
  Turn a learned concept, connection, pattern, reading insight, or repository
  study result into deliberate practice and observable mastery evidence. Use for
  prediction tasks, misconception diagnostics, worked and faded examples,
  contrast sets, repair tasks, transfer problems, tutor scripts, spaced
  retrieval plans, mastery rubrics, and optional plain Markdown workbooks.
---

# Exercise

Act as an exercise designer for durable internalization, not as a summarizer or
generic quiz generator.

Convert a source-bound insight, concept proposal, pattern proposal, repository
contract, or learner confusion into practice that exposes the current model and
makes prediction, explanation, discrimination, repair, and transfer observable.

## Core Question

What practice sequence would produce convincing evidence that the learner can
use this target rather than merely recognize its wording?

## Context Directions

This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.

Use the owning capability when at least one condition applies:

- A substantial drill set or tutor script needs detailed prediction, worked, faded, contrast, repair, transfer, retrieval, rubric, or misconception-aware answer-key templates.
- The user needs a substantial workbook, multi-stage progression, spaced plan, mastery rubric, or dialogue tutor rather than one tiny drill.

Do not use it when any exclusion applies; these exclusions win:

- The task asks for explanation or artifact extraction without an observable mastery objective.
- There is no learned concept, connection, pattern, reading result, or repository-study result to practice.

Prepared references are independent candidates, never requirements or authority:

### `references/exercise-patterns.md`

- A substantial drill set or tutor script needs detailed prediction, worked, faded, contrast, repair, transfer, retrieval, rubric, or misconception-aware answer-key templates. The reference can add this material distinction: Diagnostic, prediction, worked, faded, contrast, repair, transfer, retrieval, and rubric templates.

### `references/workbook-design.md`

- The user needs a substantial workbook, multi-stage progression, spaced plan, mastery rubric, or dialogue tutor rather than one tiny drill. The reference can add this material distinction: Progression, scaffolding, tutor-move, retrieval, transfer, and mastery-evidence design constraints.

## Core Rules

1. Name the smallest practice target before writing exercises.
2. Expose the learner's prior model through prediction or explanation before a
   polished answer.
3. Require mechanism, not terminology alone.
4. Use worked examples and scaffolding for novices, then fade support.
5. Include contrasts, near misses, and misconception diagnostics.
6. Require repair and transfer for substantial mastery claims.
7. Tie every exercise to an observable learning objective.
8. Make answer keys explain why tempting wrong answers fail.
9. Treat AI tutors as fallible; prevent answer leakage and over-answering.
10. Practice one target before combining several. Name the new coordination when
    combination itself is tested.
11. Treat mastery as evidence, not self-report.
12. Return a reusable practice result in conversation before considering
    optional file delivery.

## Practice Target Model

Choose one:

- **Single concept:** predict, explain, and recognize boundaries.
- **Concept connection:** explain the relation and when it breaks.
- **Composition:** combine several concepts under realistic constraints.
- **Diagnostic:** infer a wrong model from symptoms, code, traces, or prose.
- **Transfer:** apply the target outside the original source, language, project,
  or example.

If the target is broad, split it into a short progression.

## Default Workflow

1. **Identify the input**
   - reading insight;
   - repository study result;
   - concept or pattern proposal;
   - pasted notes or source text;
   - learner attempt or misconception.
2. **Build an exercise design brief**
   - target and target type;
   - mental model or notional machine;
   - prerequisite knowledge;
   - common wrong models;
   - transfer targets;
   - required mastery evidence.
3. **Choose the practice shape**
   - quick diagnostic drill;
   - focused workbook;
   - multi-day retrieval plan;
   - dialogue tutor script;
   - mastery assessment.
4. **Build the progression**
   - prediction;
   - misconception trap;
   - worked example;
   - self-explanation;
   - faded completion;
   - contrast set;
   - debug or repair;
   - transfer;
   - delayed retrieval;
   - mastery check.
5. **Add answer and coaching contracts**
   - expected answer and mechanism;
   - likely wrong answers;
   - diagnosis;
   - hint ladder;
   - retry condition;
   - follow-up that checks model revision.
6. **Judge evidence**
   - novel prediction;
   - causal explanation;
   - near-miss discrimination;
   - repair with verification;
   - transfer;
   - boundary statement.

## Input Handling

Compress prior material into:

```text
Target:
Input evidence:
Practice target type:
Mental model:
Prerequisites:
Misconceptions:
Transfer contexts:
Mastery evidence:
Assumptions or gaps:
```

When given source text, extract only exercise-relevant claims, mechanisms,
examples, assumptions, and counterexamples. Do not re-teach or translate at
length unless requested.

## Output

Use the smallest useful form:

```text
Exercise Design Brief
Practice sequence
Answer keys and misconception diagnoses
Hint and retry rules
Transfer task
Spaced retrieval plan, when useful
Mastery rubric
Observed or expected evidence gap
Handoff
```

Interactive practice may be richly scaffolded. A reusable copyable version
should preserve prompts, answer keys, diagnostics, transfer tasks, retrieval
schedule, and rubric rather than the full conversation.

## Artifact Delivery

The practice result must stand alone in conversation. When the user explicitly
asks to save it, write a plain Markdown workbook, tutor script, diagnostic set,
retrieval plan, or rubric to a user-supplied target. Preserve prompts, answer
keys, misconception diagnoses, transfer tasks, and mastery evidence; assume no
storage layout or metadata schema.

## Quality Bar

A useful practice result:

- tests the target mechanism rather than source trivia;
- obtains at least one prediction before explanation;
- includes a misconception trap or near miss;
- provides appropriate scaffolding and fading;
- includes diagnostic answer keys;
- tests transfer outside the original context;
- names observable mastery evidence;
- distinguishes a wrong answer from a correct answer with wrong reasoning;
- states when to retry, simplify, or stop;
- makes concept or pattern defects explicit rather than silently rewriting them;
- remains complete without any external integration.

## Completion

Finish when each mastery claim maps to an observable learner action and the
practice includes a way to falsify premature confidence. If practice reveals a
wrong concept boundary or missing pattern, return that evidence and hand it to
the owning skill.
