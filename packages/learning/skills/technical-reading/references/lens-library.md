# Lens Library

Use this reference when the passage is dense, the source type is mixed, or the user wants coaching beyond a simple explanation.

## Contents

- Composite lens selection
- Source intent
- Conceptual mental model
- Operational semantics
- Contract and API
- Procedure and workflow
- Data and invariants
- Evidence and examples
- Boundaries and misreadings
- Practical judgment

## Composite Lens Selection

Do not pick only one lens unless the text is genuinely narrow. Name the selected lenses when useful:

```text
Primary lens: <main learning path>
Supporting lenses: <details needed for the artifact to work>
Why this composition fits: <short explanation>
```

Examples:

- SQL as logic: `Conceptual Mental Model` primary, with `Data/Invariant`, `Evidence/Example`, `Boundary`, and `Practical Judgment`.
- MDN `Promise.all`: `API Contract` + `Operational/Semantics`, with `Edge Cases`.
- Type narrowing chapter: `Operational/Semantics`, `Misconception`, `Practical Judgment`, `Boundary`.
- Deployment tutorial: `Procedure`, `Rationale`, `Failure Mode`, `Verification`.

## Source Intent Lens

Use for every task.

Recover:

- intended reader capability
- old/default model being corrected, if any
- new model, contract, procedure, or lookup structure
- evidence in examples, caveats, terminology, and sequence
- learning outcome to preserve

## Conceptual Mental Model Lens

Use when the source reshapes how the reader sees a problem, abstraction, domain, or practice.

Ask:

- What is the author trying to make the reader see?
- What shallow model or misconception is being replaced?
- What new categories, distinctions, or causal model does the text install?
- Why are the examples arranged this way?
- What later ideas become easier once this view is installed?

Artifact labels, localized to the user's active language:

```text
Core insight
Old/default model
New mental model
How the source makes the model visible
What this changes in judgment
```

## Operational/Semantics Lens

Use for programming language chapters, runtime behavior, algorithms, concurrency, parsing, evaluation, type systems, or any text where the reader must predict behavior.

Ask:

- What are the rules of execution, evaluation, resolution, or checking?
- What examples distinguish correct behavior from plausible but wrong behavior?
- Which terms have exact technical meanings?
- What edge cases, precedence rules, ordering rules, or failure modes matter?
- How should the reader reason step by step?

Artifact labels:

```text
Execution/interpretation model
Core rules
Representative examples
Likely misreadings
Boundary conditions
```

## Contract/API Lens

Use for MDN, API docs, library docs, CLI docs, framework docs, or interface descriptions.

Ask:

- What problem or use case is this interface for?
- What are inputs, outputs, side effects, errors, versions, compatibility constraints, and guarantees?
- What preconditions and postconditions matter?
- What examples show normal use, boundary use, and misuse?
- What criteria tell the reader when not to use it?

Artifact labels:

```text
Purpose and use case
Exact contract
Examples and counterexamples
Errors, exceptions, and compatibility
When to use it and when to avoid it
```

## Procedure/Workflow Lens

Use for tutorials, guides, recipes, setup instructions, migrations, debugging workflows, and runbooks.

Ask:

- What final state is the workflow trying to reach?
- Why does each step exist?
- What prerequisite, ordering, or environment assumption matters?
- How does the reader verify success?
- Where do failures happen, and how should they diagnose them?

Artifact labels:

```text
Target state
Procedure
Reason for each step
Verification method
Failure points and recovery
```

## Data/Invariant Lens

Use for database, data modeling, schema, type, contract, state machine, formal methods, testing, or requirements material.

Ask:

- What facts, relations, states, constraints, or invariants are represented?
- Which properties belong in types, contracts, tests, queries, or runtime validation?
- What changes when representation details are separated from logical conditions?
- What examples expose invalid states or missing constraints?
- What operations preserve or violate the invariant?

Artifact labels:

```text
Represented facts
Structural properties
Invariants
Where validation belongs
Breaking examples
```

## Evidence/Example Lens

Use whenever examples are doing teaching work.

Ask:

- What does each example make visible?
- What contrast does it create?
- What minimal variant would fail, and why?
- Is the example demonstrating a rule, boundary, misconception, or workflow?

## Boundary/Misreading Lens

Use to prevent overgeneralization.

Ask:

- Where does this idea stop applying?
- What assumptions does it rely on?
- What counterexample weakens it?
- What clean model can be broken by implementation details?
- What should the learner not conclude?

## Practical Judgment Lens

Use after the source model is clear.

Ask:

- What decision can the reader now make better?
- What criteria separate good use from misuse?
- Why do those criteria follow from the source model?
- What code review, design, testing, debugging, or AI-spec question should change?

Artifact labels:

```text
Decision situation
Use criteria
Avoidance criteria
Rationale
Example
Review questions
```
