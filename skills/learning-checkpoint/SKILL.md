---
name: learning-checkpoint
description: Choose the next single learner action inside authentic work after one target mechanism or decision model has been adequately presented. Use only when the input identifies that prior worked model; do not auto-activate to teach, to diagnose a pre-model prediction request, or merely because learning is mentioned. Turn explanation into observable architecture, contract, debugging, evidence, or transfer judgment without requiring code typing. When explicitly invoked without an adequate model, return needs-model instead of asking the learner to guess.
metadata:
  version: "0.1.0"
---

# Learning Checkpoint

Create one small critical act that can change the evidence state of one learning target.

## Core Question

What is the next smallest learner action that would reveal whether the presented model can be used rather than merely recognized?

## Inputs

```text
Authentic current work:
One target capability:
Worked model or mechanism already presented:
Current evidence: uncovered | covered | practiced | demonstrated
Known confusion or wrong model:
Next implementation decision or observation:
```

The target must be one of:

- conceptual or causal model;
- contract or architecture judgment;
- code reading;
- failure diagnosis or debugging;
- evidence interpretation;
- tradeoff or acceptance judgment;
- transfer to a changed case.

## Activation and Model Gate

Auto-activate only when the input identifies a prior worked model or explanation and asks for the next learner action. Persistent collaboration policy, not this Skill, owns presenting a missing model before prediction.

When this Skill is explicitly invoked without enough structure for the learner to reason, return `needs-model`. State the smallest missing model, such as actors, state, causal sequence, invariant, or success/failure observer.

Do not use an unsupported prediction to diagnose knowledge that was never presented.

## Choose One Critical Act

After an adequate model, choose exactly one:

```text
predict       state the next behavior, state change, or failure
explain       name one causal edge or responsibility
critique      identify a defect in a recommendation
compare       choose between two viable alternatives using one criterion
interpret     state what an observed test/log/database result proves
repair        direct or perform one bounded correction and explain why
transfer      apply the model to one materially changed case
```

Prefer the act that participates in the next real project decision. Do not replace authentic work with a detached quiz.

## Output

When ready:

```text
Status: ready
Target:
Current evidence state:
Checkpoint prompt: one question or task only
Why this act fits the target:
Evidence that would advance the state:
Likely misconception to watch:
Hint if the first attempt fails:
Stop after learner response: yes
```

When the model is missing:

```text
Status: needs-model
Target:
Missing model:
Smallest worked example needed:
Do not ask for prediction yet.
```

Do not include the answer key before the learner responds. Do not create a workbook, multi-question quiz, spaced plan, or implementation assignment.

## Evidence Transition

A correct answer advances evidence only when its reasoning fits the target.

```text
uncovered -> covered
  a worked model was presented; no checkpoint required

covered -> practiced
  one supported critical act exposes the learner's current model

practiced -> demonstrated
  a similar act succeeds with materially reduced support

demonstrated -> transferred
  the target succeeds in a changed context
```

Acknowledgement such as “okay” does not by itself advance beyond `covered`.

## Stop Check

Resolve only when there is one target, an adequate prior model, exactly one critical act, no answer leakage, a stated evidence transition, and an explicit stop for the learner response.

Do not teach the missing model, implement code, verify system completion, or orchestrate later practice.
