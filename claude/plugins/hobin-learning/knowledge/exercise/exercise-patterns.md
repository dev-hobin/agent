# Exercise Patterns

Load this reference when designing a substantial workbook, diagnostic set, or dialogue tutor script.

## Contents

- Predict before explain
- Worked example with checkpoints
- Faded example
- Contrast set
- Debug and repair
- Transfer task
- Retrieval schedule
- Mastery rubric
- Dialogue state machine
- Misconception-aware answer key

## Pattern 1: Predict Before Explain

Use when the learner may have an implicit or wrong mental model.

Template:

```text
Goal:
Expose the learner's current model before instruction.

Prompt:
Before reading the explanation, predict <output/state/order/decision>. Write the reason, not only the answer.

Expected correct model:
...

Likely wrong models:
- ...
- ...

Coaching:
If learner says <wrong model>, ask <targeted follow-up>.
If learner is close, ask them to account for <missing mechanism>.
```

Developer examples:

- predict JavaScript event loop ordering
- predict React render/state snapshots
- predict SQL transaction anomaly
- predict cache invalidation behavior
- predict ownership/borrowing behavior

## Pattern 2: Worked Example With Explanation Checkpoints

Use when intrinsic complexity is high or the learner is novice.

Template:

```text
Worked example:
<code/design/log/scenario>

Checkpoint 1:
What changed here?

Checkpoint 2:
Which rule or mechanism applies?

Checkpoint 3:
What would be different if <nearby condition> changed?

Self-explanation:
Explain the solution in four sentences:
1. Initial state
2. Mechanism
3. Result
4. Boundary or caveat
```

Design note:
Keep examples small enough that the target mechanism is the hardest part, not reading the prompt.

## Pattern 3: Faded Example

Use to move from studying to doing without a large jump.

Progression:

```text
Round 1: full worked example
Round 2: one missing decision
Round 3: several missing steps
Round 4: learner solves independently
Round 5: learner explains why an alternative fails
```

Developer variants:

- fill missing lines in a function
- complete a trace table
- choose the next debugging command
- fill missing test cases
- complete an API design decision record

## Pattern 4: Contrast Set

Use when concepts are confusable or overgeneralized.

Template:

```text
Cases:
A. <case>
B. <near miss>
C. <counterexample>

Task:
Classify each case, then name the discriminating feature.

Answer key:
- A works because ...
- B is tempting but fails because ...
- C is outside scope because ...
```

Good contrast dimensions:

- same syntax, different runtime behavior
- same symptom, different root cause
- same pattern, different scale constraint
- same API, different lifecycle
- same heuristic, different assumption

## Pattern 5: Debug And Repair

Use when the concept should become operational debugging skill.

Template:

```text
Bug report:
<symptom/log/code>

Task:
1. State the likely mechanism.
2. Identify the minimal failing case.
3. Propose a fix.
4. Write or describe a regression test.

Rubric:
- Mechanism identified:
- Evidence used:
- Fix addresses cause, not symptom:
- Verification is specific:
```

Tutor move:
If the learner jumps to a fix, ask for the mechanism and evidence before evaluating the fix.

## Pattern 6: Transfer Task

Use after initial accuracy improves.

Template:

```text
Original context:
<where the concept was learned>

New context:
<different language/framework/system/design situation>

Task:
Apply the same concept. What stays the same? What changes?

Rubric:
- maps deep structure, not surface words
- notes changed assumptions
- identifies failure modes
- avoids overgeneralization
```

Developer examples:

- from closure examples to React stale closures
- from local cache to distributed cache invalidation
- from single-thread race condition to database isolation
- from API abstraction to module boundary design
- from unit test heuristic to contract/integration testing

## Pattern 7: Retrieval Schedule

Use for any concept the user wants to internalize.

Template:

```text
Immediate:
One prediction and one self-explanation.

+2 days:
One short trace or classification problem without notes.

+7 days:
One mixed problem where the learner must choose whether this concept applies.

+14 days:
One transfer problem in a different domain or stack.

Refresh rule:
If the learner misses the mechanism, return to a worked example before adding harder transfer.
```

## Pattern 8: Mastery Rubric

Use to avoid mistaking familiarity for competence.

Rubric dimensions:

```text
Predict:
Can forecast behavior in a novel case.

Explain:
Can name the mechanism and causal chain.

Discriminate:
Can distinguish this concept from nearby concepts.

Repair:
Can fix a flawed implementation or explanation.

Transfer:
Can apply the model outside the original example.

Boundaries:
Can state when the heuristic or model stops applying.
```

Score simply:

```text
0 = absent
1 = recognizes with heavy cueing
2 = works with light cueing
3 = independent and transferable
```

## Pattern 9: Dialogue State Machine

Use when designing a Socratic or LLM tutor.

States:

```text
Elicit prediction
Diagnose response
Give targeted hint
Request self-explanation
Challenge with contrast
Ask transfer
Summarize updated model
Schedule retrieval
```

Transition rules:

- If no attempt: give a smaller prompt, not the answer.
- If vague terminology: ask for a mechanism.
- If correct answer with wrong reason: treat as not mastered.
- If wrong due to missing prerequisite: teach the prerequisite briefly with a worked example.
- If correct twice in same format: switch format or context.
- If correct in transfer: summarize the mental model and schedule retrieval.

## Pattern 10: Answer Key With Misconception Diagnosis

Use for every nontrivial exercise.

Template:

```text
Correct answer:
...

Why:
...

Tempting wrong answer:
...

Why it is tempting:
...

What misconception it reveals:
...

Corrective prompt:
...
```
