# Technical Reading Lens Library

Use this reference when the source's learning job is dense or mixed. A lens owns
a question and an explanatory artifact; it is not a mandatory stage.

## Lens Selection

Start with source intent. Add a lens only when it changes the explanation,
example, boundary, or practical consequence.

```text
Primary lens:
Supporting lens:
Why each is consequential:
Resulting artifact:
```

Common compositions:

- SQL as logic: conceptual model + data/invariant + boundary.
- `Promise.all`: API contract + operational semantics + edge cases.
- Type narrowing: operational semantics + misconception + practical judgment.
- Deployment guide: procedure + rationale + failure + verification.

## Source Intent

Recover:

- intended reader capability;
- default model or uncertainty being changed;
- new model, contract, procedure, or lookup structure;
- evidence in examples, caveats, terminology, visuals, and sequence;
- what compression would erase.

Artifact: a one-paragraph learning-job statement and the source evidence that
supports it.

## Conceptual Mental Model

Use when the source changes how the reader sees a problem or practice.

Ask what categories, distinctions, relations, or causal model replace the old
view; why examples appear in this order; and what later judgment becomes
possible.

Artifact: old/default model, new model, source teaching move, and changed
judgment.

## Operational Semantics

Use when the reader must predict execution, evaluation, resolution, checking,
ordering, concurrency, or failure.

Recover exact rules, a step trace, a plausible wrong prediction, precedence or
ordering constraints, and boundary conditions.

Artifact: notional machine or execution trace plus rules and counterexample.

## Contract And API

Use for APIs, CLIs, product docs, framework docs, and interface specifications.

Recover purpose, callers, inputs, outputs, effects, failures, compatibility,
preconditions, postconditions, guarantees, unsupported cases, and selection
criteria.

Artifact: compact contract table with normal use, boundary use, and misuse.

## Procedure And Workflow

Use for tutorials, setup, migration, debugging, and runbooks.

Recover target state, prerequisites, ordering, rationale, verification, failure
points, and recovery.

Artifact: procedure with reason and check for each consequential step.

## Data And Invariants

Use for data modeling, schemas, types, contracts, state machines, formal
methods, testing, and requirements.

Recover represented facts, relations, valid and invalid states, preserving and
breaking operations, and where each guarantee is enforced.

Artifact: invariant table and state or relation model when useful.

## Evidence And Examples

Use whenever examples do teaching work. State what each example makes visible,
which rule or misconception it discriminates, and the smallest variant that
would fail.

Artifact: example-to-claim map or contrast set.

## Boundary And Misreading

Use to prevent overgeneralization. Name assumptions, counterexamples,
implementation details that break a clean model, and conclusions the reader
must not draw.

Artifact: boundary and likely-misreading list tied to source evidence.

## Practical Judgment

Use only after the source model is clear. Derive a decision situation, use and
avoidance criteria, rationale, and one review or implementation question.

Artifact: criterion table whose reasons point back to the source model.

## Thinking Tool Boundary

Observing, comparing, pattern recognition, abstraction, modeling,
transformation, and synthesis may support any lens. Select them only when they
produce one of the artifacts above. Never turn them into a fixed learner-facing
pipeline.
