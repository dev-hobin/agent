# Abstraction Review Field Card

Use this reference when a review should produce more than a paragraph of advice.
The goal is to turn a wished abstraction into an artifact with a stop check.

## Contents

- Operating Loop
- Field Card
- Source Modes
- Good Wish Test
- Recipe-Grade Gate
- Layer Router
- Minimal Output
- Self-Application Check

## Operating Loop

```text
pressure
  -> wish
  -> layer
  -> recipe card
  -> output artifact
  -> observable stop
  -> repair decision
```

The wish opens freedom; the stop check brings the review back to evidence.
Failure is not handled by a better name. Failure exposes a broken layer,
contract, or missing artifact.

## Field Card

Fill this card for serious reviews.

```text
Candidate:
  What wished interface, helper, boundary, condition model, or abstraction is
  being judged?

Source and confidence:
  Where did the candidate come from, and how strong is the evidence?

Pressure:
  What complexity, repetition, variation, history, or representation detail is
  this candidate supposed to remove?

Wish:
  In the better world, what would callers be able to say or do?

Mismatch:
  What currently breaks or might break that wish?

Timing:
  pre-implementation / post-implementation

Layer:
  Language / Unit / Law / Boundary / Engine / Time / Run

Recipe:
  Which narrow card is being executed?

Input artifact:
  What concrete input must be written before judgment?

Derivation:
  How does that input constrain the output?

Contract:
  What can callers or future users rely on?

Hidden detail:
  What representation, policy, timing, history, cost, or process detail should
  callers not depend on?

Output artifact:
  What table, graph, contract, invariant, trace, or decision remains?

Stop:
  What observable check decides pass/fail?

Evidence and gaps:
  What evidence supports the decision, and what would change it?

Decision:
  keep / revise-surface / revise-model / split / reject / defer

Open consequence:
  What remains unresolved after this review?
```

## Source Modes

Use the candidate source to choose evidence and timing.

| Source | Review pressure | Evidence to require |
| --- | --- | --- |
| design draft wished interface | Is the wish implementable and bounded? | caller contract, representative cases, hidden detail, planned stop |
| structural observation | Is the movement real abstraction or local churn? | before/after diff, repeated movement, condition relation |
| user-proposed API/helper | Is it domain language or implementation-shaped naming? | wished use, caller obligations, failure modes |
| existing implementation | Does code still match the abstraction promise? | tests, trace, cost, call sites, hidden coupling |
| skill/workflow update | Will future agents behave differently? | trigger wording, reference routing, realistic invocation |

## Good Wish Test

A wish is strong enough to review when it exposes a small language, not merely a
preferred name.

```text
primitive words:
  What operations can be trusted without re-opening implementation detail?

means of combination:
  How do smaller units produce larger valid units?

means of abstraction:
  How is a repeated composition or method given a reusable handle?
```

Reject or revise a wish when:

- it only renames current representation shape;
- it has no caller contract or failure mode;
- its result cannot be composed or intentionally finalized;
- no preserved meaning, invariant, or policy owner is visible;
- it hides cost, history, order, or mutation that callers must understand.

## Recipe-Grade Gate

A review is recipe-grade only when this sentence can be filled:

```text
Given <input artifact>,
derive <output artifact>
by <rule>,
then check <observable stop>.
If it fails, repair <layer, contract, or artifact>.
```

If the sentence cannot be filled:

| What it is | Missing | Review consequence |
| --- | --- | --- |
| Advice | trigger, artifact, stop check | keep as explanation; do not promote |
| Heuristic | derivation from input to output | read `repair-table.md` or expose the missing model |
| Candidate recipe | derivation is still loose | run one worked case |
| Recipe-grade | trigger, input, rule, output, stop, repair all exist | use in the review |

## Layer Router

| Symptom | Layer | First card |
| --- | --- | --- |
| The problem vocabulary is missing or misleading | Language | Notation As Data |
| Similar functions, workflows, or tests move together | Language/Unit | Movement Pattern Extraction |
| Operation results do not remain composable | Unit | Closure Composition Unit |
| A loop, state transition, or contract has no preserved meaning | Law | Invariant Iteration |
| Callers must know raw representation or hidden policy | Boundary | Data Abstraction Boundary |
| New variants keep changing old conditionals | Engine | Dispatch Registration |
| Conversion works but meaning loss is hidden | Engine/Law | Meaning-Preserving Path |
| Same call depends on past interaction | Time | History Placement |
| Event order changes correctness | Time/Run | Event Order Protection |
| Result is right but process, cost, sharing, or stack shape is wrong | Run | Procedure -> Process Reality Check |

When the symptom is clearer than the layer, open `repair-table.md`.

## Minimal Output

For a compact user-facing review, show:

```text
Candidate:
Source and confidence:
Layer:
Recipe:
Input artifact:
Derivation rule:
Contract:
Hidden detail:
Output artifact:
Stop check:
Evidence and gaps:
Decision:
Open consequence:
```

When this review is part of a larger task, return the decision and its open
consequence. The caller or orchestrator decides what happens next. Otherwise,
stop at the review result. The card must be complete enough that a later person
or agent can use it without reconstructing the reasoning.

## Self-Application Check

When the candidate is a skill, workflow, recipe, or reference update, review the
update with the same card.

Map the layers this way:

| Skill update surface | Review layer |
| --- | --- |
| trigger wording, user-facing command language | Language |
| skill responsibility and owned question | Boundary |
| recipe-grade invariant or stop condition | Law |
| progressive disclosure and reference routing | Engine |
| whether future agents actually read enough context | Run |

The stop check should be a realistic invocation, self-review card, or
forward-test prompt. If the review cannot name what future behavior changes, the
update is probably documentation, not a stable workflow abstraction.
