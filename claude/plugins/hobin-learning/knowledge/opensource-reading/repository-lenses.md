# Repository Study Lenses

Use this reference to choose the smallest evidence lens that exposes the target
repository slice. A lens owns a question set and an artifact; it is not a fixed
stage in a workflow.

## Contents

- Lens selection
- C4 architecture
- Interface contract
- Tests as specification
- Invariants and failure modes
- ADR and tradeoff
- Visualization

## Lens Selection

Choose the initial lens for the learner, explain the choice briefly, and let the
learner override it. Combine lenses only when each one answers a distinct
question.

- Tiny library or public function: interface contract, tests as specification,
  and invariants.
- Small package: interface contract, module map, runtime flow, and tests.
- Framework, CLI, router, state manager, build tool, or plugin system: C4
  architecture, interface contract, runtime flow, tests, and tradeoffs when
  decision evidence exists.
- Stateful, concurrent, persistent, security-sensitive, or distributed slice:
  invariants and failure modes, runtime flow, and tests.
- Slice with RFCs, ADRs, design docs, or major issues: ADR/tradeoff plus the
  technical lens affected by the decision.

## C4 Architecture Lens

Use for multiple runtime units, packages, plugins, data stores, or significant
internal boundaries.

Questions:

- Who uses the system, and which external systems does it touch?
- Which deployable or executable units exist?
- Which responsibility groups live inside the target unit?
- Which files, types, functions, or modules implement them?
- Which dependencies cross a system, container, or component boundary?

Artifact: a Context/Container/Component/Code map focused on the current slice,
with a Mermaid hierarchy when spatial relations matter.

## Interface Contract Lens

Use for a public API, CLI, UI, SDK, config format, plugin API, file format, or
internal module boundary.

Questions:

- Who consumes the interface and what capability does it expose?
- Which inputs are accepted or rejected?
- Which outputs, errors, side effects, and state changes are guaranteed?
- Which behavior is intentionally unspecified?
- Which misuse does the interface prevent or permit?
- Where is the contract encoded: types, docs, tests, runtime checks, or examples?

Artifact: a contract table with consumer, operation, input, output, errors, side
effects, and evidence.

## Tests As Specification Lens

Use when tests or executable examples define important behavior.

Questions:

- Which requirement does each test imply?
- Which scenario and expected output, state, or side effect does it lock down?
- Would the test fail if the product requirement were broken?
- Does it check intended behavior or only the current implementation?
- Which important behavior remains uncovered?
- Which tests would an implementation agent need before changing the slice?

Classify evidence as example, contract, regression, property-like, snapshot, or
integration behavior. Artifact: a behavior-to-test map plus explicit test gaps.

## Invariants And Failure Modes Lens

Use for state, concurrency, persistence, security, permissions, money, user
data, external systems, caching, retries, queues, or distributed behavior.

Questions:

- What must always remain true?
- Which invalid state must be impossible or rejected quickly?
- Where is each invariant enforced?
- What can fail at the boundary or transition?
- Should the system retry, reject, log, surface, compensate, or ignore?
- Which failures are visible to users or callers?

Name the enforcement surface: type, constructor, parser, validator, runtime
branch, assertion, test, integration boundary, or human convention. Artifact: an
invariant/failure table, plus a state diagram when transitions matter.

## ADR And Tradeoff Lens

Use when RFCs, ADRs, design docs, issues, pull requests, commits, or visible
architecture choices provide decision evidence.

Questions:

- What decision was made, and which constraint or quality goal drove it?
- Which alternatives were available?
- What did the decision optimize for, and which cost did it accept?
- What future evidence would make it wrong?
- Where is the decision reflected in code boundaries, tests, docs, or APIs?

Artifact: a decision note and, when alternatives matter, a tradeoff table.

## Visualization

Choose a visual only when it lowers judgment cost:

- architecture: focused hierarchy or flowchart;
- interface: contract table or boundary diagram;
- tests: behavior-to-test matrix;
- invariants: state diagram, failure table, or sequence;
- tradeoff: decision matrix;
- runtime flow: sequence or left-to-right flow;
- transformation: pipeline.

Keep the visual scoped to the current slice and make it reveal order, boundary,
state, evidence, or tradeoff rather than repeat prose.
