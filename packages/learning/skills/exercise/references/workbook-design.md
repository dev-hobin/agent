# Workbook And Tutor Design

Use this reference when the task needs a substantial workbook, a
developer-oriented exercise lens, or an interactive tutor contract.

## Contents

- Learning principles
- Developer exercise lenses
- Workbook shape
- Dialogue tutor contract

## Learning Principles

- Prior-model exposure: elicit a prediction or explanation before instruction.
- Cognitive-load control: start with focused snippets and worked examples.
- Self-explanation: ask what changed, why a step works, and what would break.
- Fading: move from worked examples to partial completion to independent work.
- Contrasting cases: pair near misses so the learner must discriminate.
- Interleaving: mix confusable concepts after initial grounding.
- Retrieval practice: revisit the model after delays and in new contexts.
- Transfer: require application outside the source context.
- Mastery learning: correct and retry before advancing.
- Evidence triangulation: use more than one task shape before judging mastery.

## Developer Exercise Lenses

Choose only the lenses that expose the practice target.

### Notional Machine

Use for runtime, language, framework, or system behavior. Ask the learner to
predict execution, draw state transitions, trace bindings or queues, and explain
observed output. Mastery means predicting a novel case, explaining the mechanism,
and identifying the relevant abstraction layer.

### Debugging

Use when the concept should diagnose failures. Present logs, symptoms, or a
flawed implementation; require a hypothesis, next check, repair, and regression
test. Mastery connects symptom to mechanism, fix, and verification.

### Design Judgment

Use for architecture, API, abstraction, testing, performance, reliability, or
tradeoffs. Compare designs under constraints, surface assumptions and failure
modes, and require evidence that could reverse the choice. Mastery includes the
heuristic's boundary.

### Reading To Practice

Use when the input is a book, essay, article, or documentation artifact. Turn
claims into decision scenarios, counterexamples, practical heuristics, review
comments, tests, or implementation criteria. Mastery converts the reading into
action without overgeneralizing it.

## Workbook Shape

Adapt this shape to the user and target:

```text
Exercise Design Brief
- Concept and target type
- Target mental model and prerequisites
- Common misconceptions
- Transfer targets and mastery evidence

Workbook
1. Diagnostic prediction
2. Worked example with explanation checkpoints
3. Faded practice with hints and answer key
4. Contrast set with near misses
5. Debug or repair task
6. Transfer task with rubric

Spaced Retrieval Plan
- +2 days
- +7 days
- +14 days

Mastery Rubric
- Predict
- Explain
- Discriminate
- Repair
- Transfer
- State boundaries
```

Each item names its goal, prompt, expected evidence, likely wrong model, and
coaching response. Answer keys explain why tempting wrong answers fail.

## Dialogue Tutor Contract

Allowed tutor moves:

- ask for prediction, explanation, or evidence;
- give the smallest useful hint or targeted correction;
- ask for transfer;
- summarize after a learner attempt.

Tutor guardrails:

- obtain an attempt before revealing the full answer;
- require mechanism rather than terminology alone;
- treat vague explanations as evidence still needed;
- provide prerequisites directly when continued questioning cannot unlock them.

Use a hint ladder:

1. Point to the relevant observation.
2. Name the mechanism or abstraction layer.
3. Show one partial worked step.
4. Reveal the answer and explain why the tempting model failed.

Track the suspected misconception, evidence from the learner response, next
corrective exercise, and retry condition. A tutor state change must be justified
by observable learner evidence.
