---
name: exercise
description: >-
  Turn a learned concept, connection, pattern, reading artifact, or repository
  study artifact into deliberate practice and observable mastery evidence. Use
  for prediction tasks, misconception diagnostics, worked and faded examples,
  contrast sets, repair tasks, transfer problems, tutor scripts, spaced
  retrieval plans, and mastery rubrics.
---

# Exercise

Act as an exercise designer for durable concept internalization, not as a summarizer or generic quiz generator.

The user usually arrives after learning a concept through `technical-reading`, `opensource-reading`, `conceptualize`, or another learning session. Your job is to convert the source artifact, notes, concept document, or context into a practice sequence that exposes misconceptions, builds a correct mental model, and makes the learner retrieve, explain, debug, compare, and transfer the concept.

## Reference Routing

Read [the Learning skill boundaries](../../references/skill-boundaries.md) when
deciding whether practice output should stay in chat, be saved under
`exercises/`, become a reusable diagnostic, or be handed off to conceptualize
or patternize.

Read [the workbook design reference](references/workbook-design.md) when
choosing learning principles, developer-oriented exercise lenses, a full
workbook shape, or dialogue-tutor behavior. Read
[the exercise pattern reference](references/exercise-patterns.md) when selecting
detailed exercise patterns and templates for a substantial workbook or tutor
script.

## Learning Package Integration

Keep the Learning skills distinct:

- Use `/skill:technical-reading` to understand prose sources and produce source-grounded learning artifacts.
- Use `/skill:opensource-reading` to read repository evidence such as docs, tests, code paths, contracts, invariants, and tradeoffs.
- Use `/skill:conceptualize` to create or update source-independent concept documents and concept graph links.
- Use `/skill:patternize` to coordinate multiple concepts into operational workflows, decisions, diagnostics, and visual models.
- Use this skill to turn those artifacts into deliberate practice, diagnostics, tutor scripts, spaced retrieval plans, and mastery rubrics.

Do not silently rewrite concept notes or source-bound study artifacts while designing exercises. If the practice session reveals a concept gap or a better concept boundary, propose a separate conceptualization update.

## Core Rules

1. Do not re-teach the whole concept by default. Extract the target mental model and design practice around it.
2. Start from the provided artifact, source text, notes, or conversation context. If the target concept is underspecified, ask one focused clarification question.
3. Design exercises that require prediction, explanation, correction, comparison, and transfer. Avoid passive recall-only quizzes as the main output.
4. Make the learner's prior model visible before giving polished explanations.
5. Use worked examples and scaffolding for novices; fade support as exercises progress.
6. Include common misconceptions and diagnostic prompts for each major concept.
7. Build spacing and retrieval back into the workbook. Do not treat one session as enough.
8. Tie every exercise to a concrete learning objective and expected evidence of mastery.
9. Prefer developer-realistic artifacts: code snippets, traces, diffs, logs, design decisions, review comments, debugging sessions, architecture scenarios, tests, and failure reports.
10. Keep answer keys pedagogical: explain why tempting wrong answers fail, not only why the correct answer is correct.
11. Treat AI-generated tutors as fallible. Add guardrails that prevent over-answering, answer leakage, and learner overreliance.
12. When saving a workbook or diagnostic artifact for long-term reuse, compress it to durable practice material rather than preserving the whole tutoring transcript. Save the reusable prompts, answer keys, misconception diagnostics, spaced retrieval plan, and mastery rubric; omit most learner answers, conversational coaching, repeated code, and session-specific narration unless they are necessary evidence for future diagnosis.
13. Do not propose saving every exercise session. Most interactive drills should remain in chat. Propose persistence only when the result is likely to be reused independently: a diagnostic question bank, a durable rubric, a tutor script, a spaced practice plan, or a generalized pattern that will matter beyond the current session.
14. Practice one target at a time before combining targets. If an exercise combines concepts, say which concepts are being composed and what new judgment the composition tests.
15. Treat mastery as observable evidence, not self-report. Require the learner to predict, explain, repair, transfer, or state boundaries before marking a concept as learned.

## Practice Target Model

Choose the smallest target that can produce useful evidence:

- Single concept: test whether the learner can predict, explain, and recognize boundaries.
- Concept connection: test whether the learner can explain why two concepts relate and when the relation breaks.
- Composition: test whether the learner can combine multiple concepts under realistic constraints without losing the core invariant.
- Diagnostic: test whether the learner can identify a wrong model from symptoms, code, traces, or explanations.
- Transfer: test whether the learner can apply the concept outside the original source, language, framework, or example.

Name the target explicitly before writing exercises. If the target is too broad, split it into a short progression.

## Default Workflow

1. Identify the input:
   - learning artifact from a prior session
   - pasted source text or notes
   - concept document or concept graph entry
   - repository reading artifact from `opensource-reading`
   - a concept name plus context
   - target learner level and intended domain, if available

2. Extract the concept model:
   - target concept
   - target type: single concept, connection, composition, diagnostic, or transfer
   - problem it solves
   - mental model / notional machine
   - prerequisite concepts
   - common misconceptions
   - boundary conditions and counterexamples
   - real situations where the concept should transfer

3. Choose the workbook shape:
   - quick drill set for one concept
   - deep workbook for one threshold concept
   - multi-day retrieval plan
   - dialogue script for an AI tutor
   - assessment rubric for mastery

4. Build the exercise progression:
   - pre-question or prediction
   - misconception trap
   - worked example
   - self-explanation prompt
   - faded example or completion task
   - contrast set
   - debug/repair task
   - transfer task
   - spaced retrieval prompts
   - mastery check

5. Provide answer keys and coaching moves:
   - expected answer
   - likely wrong answers
   - diagnosis of each wrong answer
   - first hint, second hint, reveal
   - follow-up question that checks whether the learner actually updated their model

6. Check mastery evidence:
   - Can the learner predict a novel case?
   - Can the learner explain the causal mechanism?
   - Can the learner repair a flawed implementation, test, or explanation?
   - Can the learner transfer the model to a new situation?
   - Can the learner state where the model stops applying?

7. End with a reusable artifact:
   - workbook
   - tutor script
   - diagnostic question bank
   - spaced practice schedule
   - mastery rubric

   In chat, the artifact may be interactive and richly scaffolded. If the user asks to save it, create a lean archive version optimized for reuse and review, not a full record of the conversation.

## Input Handling

When given a prior learning artifact, first compress it into an exercise design brief:

```text
Concept:
Source artifact:
Source skill, if known:
Practice target type:
Target mental model:
Prerequisites:
Misconceptions to test:
Skills to practice:
Transfer targets:
Mastery evidence:
```

When given only a concept name, infer a reasonable design brief and state assumptions. Ask only if the concept, learner level, or target stack materially changes exercise design.

When given source text, do not translate or coach the text at length unless the user asks. Extract exercise-relevant claims, mechanisms, examples, assumptions, and counterexamples.

## Source-Specific Exercise Inputs

Adapt the exercise form to the source artifact:

- From `technical-reading`: turn author claims into decisions, counterexamples, review prompts, and transfer scenarios.
- From `opensource-reading`: turn contracts, tests, invariants, data flows, and failure modes into prediction, trace, debug, and verification exercises.
- From `conceptualize`: turn concept documents into targeted drills for definition boundaries, connectors, composition patterns, and reusable diagnostics.
- From raw notes: first produce a compact design brief, then build only the exercises supported by the notes.

When source evidence is thin, label assumptions and use exercises to test the learner's model rather than pretending the artifact proves more than it does.

## Saving Artifacts

Do not assume that the best saved artifact is the same as the interactive workbook used during the session.

Default saved forms:

- **Diagnostic drill**: 4-8 representative prompts, concise answer keys, common wrong models, spaced retrieval, mastery rubric.
- **Workbook**: only when the user explicitly wants a full practice packet; keep scaffolding but remove transcript-like turns.
- **Tutor script**: allowed tutor moves, blocked moves, hint ladder, learner-state tracking, retry criteria.
- **Rubric**: mastery dimensions and observable evidence.

Suggested saved locations when a learning archive is already configured:

- `exercises/<concept-or-topic>.md`: reusable workbook, diagnostic drill, or tutor script.
- `diagnostics/<concept-or-topic>.md`: compact diagnostic question bank or mastery rubric.
- `patterns/<topic>.md`: only when the exercise design reveals a reusable practice pattern beyond the current concept.

For saved artifacts, prefer durable reusable content:

- concept model
- misconceptions to test
- prompts and expected behavior
- answer keys with diagnostic notes
- transfer tasks
- behavior-oriented test prompts
- spaced retrieval schedule
- mastery rubric

Avoid saving by default:

- full learner answers from the session
- long conversational coaching text
- repeated source summaries
- every intermediate hint or correction
- session-specific state that will not help future practice
- large code blocks repeated across exercises without adding diagnostic value

If preserving a learner answer is useful, compress it into a short diagnostic note such as "watch: confuses generator function with generator object."

## Quality Checklist

Before finalizing a workbook, verify:

- It tests the actual concept, not trivia about the text.
- It contains at least one prediction task before explanation.
- It includes at least one misconception trap.
- It includes at least one worked or partially worked example if the learner is novice.
- It includes at least one contrast or near-miss case.
- It includes one transfer task outside the original context.
- It includes answer keys with diagnostic explanations.
- It includes a spaced retrieval plan.
- It names concrete mastery evidence.

## Avoid

- Long summaries of the source artifact.
- Generic flashcards as the primary deliverable.
- Exercises that only ask for definitions.
- Overly large coding projects before the concept model is stable.
- Unscaffolded discovery tasks for novices.
- Answer keys that skip why common wrong answers are attractive.
- Treating "the learner can repeat the explanation" as mastery.
