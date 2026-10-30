---
name: exercise
description: "Turns a learned concept, connection, pattern, reading insight, or repository study result into deliberate practice and observable mastery evidence. Use for prediction tasks, misconception diagnostics, worked and faded examples, contrast sets, repair tasks, transfer problems, tutor scripts, spaced retrieval plans, mastery rubrics, and optional plain Markdown workbooks. Not for first teaching a mechanism the learner has not seen, or explanation without an observable mastery objective."
argument-hint: "[the concept, pattern, or study result to practice, and where to save the result]"
---

# Exercise

Turn something already learned into practice that produces observable evidence the learner can
use it, not merely recognize its wording.

Practice target and save path: $ARGUMENTS (if empty, take them from the request)

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/exercise/method.md` before every run: it is the full
method, including Checkpoint Mode. The essentials are below.

## When this applies

- Use it when a large workbook, multi-stage progression, spaced plan, mastery rubric, or
  dialogue tutor is needed rather than one small drill; or when a big drill set or tutor script
  needs detailed prediction, worked-example, fading, contrast, repair, transfer, retrieval,
  rubric, and misconception-aware answer-key frames.
- Do not use it when there is no learned concept, connection, pattern, reading result, or
  repository study result to practice, or when the user wants only explanation or artifact
  extraction without an observable mastery objective. These exclusions win.
- Not for first teaching a mechanism the learner has not seen, generic quiz generation, or
  summaries.
- If practice exposes a wrong concept boundary or a missing pattern, do not quietly fix it:
  hand the evidence to `conceptualize` or `patternize`.

## Gotchas

- Do not ask for a prediction about knowledge that was never presented. For an unfamiliar
  mechanism, work one example all the way through, then ask for a prediction on a changed case.
- Ask for the mechanism, not just the term. Do not ask trivia about the source.
- Tell a wrong answer apart from a right answer with wrong reasoning.
- Mastery is evidence, not self-report.
- An AI tutor can be wrong. Guard against leaking the answer and over-answering.
- Practice one target at a time before mixing targets. If the combination itself is tested,
  name the new coordination.
- When given a source text, pull out only the claims, mechanisms, examples, assumptions, and
  counterexamples the practice needs; do not re-teach or translate it at length unless asked.
- Do not modify the input materials; write only the requested artifact.

## Procedure

1. **Read the input**: reading insights, repository study results, concept or pattern
   proposals, pasted notes, the learner's attempts or misconceptions. If the learner is in the
   middle of real work, use checkpoint mode.
2. **Write the design brief:** the target and its kind (single concept, concept connection,
   composition, diagnosis, transfer), the mental model, prior knowledge, common misconceptions,
   transfer targets, the mastery evidence needed, assumptions or gaps. Split a broad target
   into a short progression.
3. **Pick the practice shape:** a short diagnostic drill, a focused workbook, a multi-day
   retrieval plan, a dialogue tutor script, or a mastery assessment.
4. **Build the progression** from what is needed of: prediction → misconception trap → worked
   example → self-explanation → faded completion → contrast set → debug or repair → transfer →
   delayed retrieval → mastery check.
5. **Write the answer and coaching contract:** expected answer and mechanism, common wrong
   answers, diagnoses, hint ladder, retry conditions, a follow-up question that checks the
   model was repaired.
6. **Judge the evidence:** a new prediction, a causal explanation, a near-miss distinction, a
   verified repair, a transfer, a boundary statement.

## Output

- **Practice result** (default), the smallest useful form of:

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

  A reusable copy keeps the problems, answer explanations, diagnoses, transfer task, retrieval
  schedule, and rubric, not the whole conversation.
- **Checkpoint** (the learner is doing real work, one mechanism or decision model was just
  presented, and the next step is one learner action): the target, current evidence state, one
  checkpoint question, why this action was chosen, the evidence that would raise the state,
  common misconceptions, and one hint for a wrong first attempt. Stop and wait; give no answer
  before the learner responds. If no model has been presented, return `needs-model` with the
  smallest missing piece and the smallest example needed.
- **Evidence states:** `uncovered → covered → practiced → demonstrated → transferred`. A correct
  answer raises the state only when the reasoning is right; mere agreement stays `covered`.

If saving was requested, write a plain Markdown workbook, tutor script, diagnostic set,
retrieval plan, or rubric to the path the user gave, preserving the problems, answer
explanations, misconception diagnoses, transfer task, and mastery evidence; assume no archive
structure or metadata schema. In the file, keep the English headings and labels shown above (for
example `Exercise Design Brief`, `Answer keys and misconception diagnoses`) exactly as written,
because people and other tools find each part by label; if a part has no content, keep its label
and write "none" with the reason.

## Every result must

- Name the practice target and the observable learning objective.
- Include a prediction task before any new case is explained; for an unfamiliar mechanism, a
  worked example comes first.
- Include a misconception trap or near miss, and an answer key that explains why plausible
  wrong answers fail.
- Include a transfer task outside the original context, and a mastery rubric defined as
  observable behavior.
- Include hints and retry, simplify, or stop conditions.
- In checkpoint mode, ask exactly one question and show no answer before the learner answers.
- Leave the input materials unchanged.

## Reference files

Each is an independent candidate, not a requirement.

- `${CLAUDE_PLUGIN_ROOT}/knowledge/exercise/method.md` — always: the full method (core rules,
  practice-target model, checkpoint mode, default flow, input handling, output, delivery,
  quality bar, completion).
- `${CLAUDE_PLUGIN_ROOT}/knowledge/exercise/workbook-design.md` — when the user needs a
  substantial workbook, multi-stage progression, spaced plan, mastery rubric, or dialogue tutor
  rather than one tiny drill.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/exercise/exercise-patterns.md` — when a substantial drill
  set or tutor script needs detailed prediction, worked, faded, contrast, repair, transfer,
  retrieval, rubric, or misconception-aware answer-key templates.
