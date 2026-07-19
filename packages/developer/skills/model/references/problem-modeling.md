# Problem Modeling Reference

Use this reference when condition modeling needs more than a light invariant.

This reference models conditions only. It does not choose capability routing or
task ownership.

## Contents

- Core Question
- Requirement Normalization
- Lens Selection
- Problem Shape Router
- Modeling Tool Selection
- Modeling Rules
- Guarantee Placement
- Common Failure Signals
- Verification Target Derivation
- Stop Checks
- AI Delegation Boundary

## Core Question

Model the condition space under judgment:

```text
What facts, rules, constraints, forbidden cases, transitions, and objectives must
be true for any acceptable solution?
```

Do not model the whole real-world domain. Include only the facts that affect the
current invariant, product decision, or verification target.

## Requirement Normalization

When starting from natural language, lower the prose into condition-space parts
before choosing a modeling tool:

```text
1. Nouns become domain facts: user, document, cart, item, order, state, event.
2. Actions and judgments become predicates: canEdit, canCheckout, isValidTransition.
3. Quantity words become quantifiers: all, at least one, none, exactly one, at most one.
4. Conditional words become implication: if, only if, unless, whenever.
5. Implications become counterexamples: P => Q means the failure shape is P && !Q.
6. Finite policy combinations become decision spaces.
7. Time words become transition or temporal questions.
8. Unspecified domain choices become open policy questions.
```

Do not skip this step when a requirement contains words such as valid, ready,
allowed, all, any, never, always, unless, only if, after, retry, or timeout.
Those words are often the actual problem.

## Lens Selection

Use multiple lenses when the task mixes concerns.

| Lens | Use when | Output emphasis |
| --- | --- | --- |
| `predicate-logic` | hidden booleans, quantifiers, implication, rewrite/equivalence questions | predicates, domains, counterexamples, equivalence risks |
| `test-specification` | tests should express behavior, structural properties, or metamorphic relations | examples, properties, generators, counterexamples |
| `contract-property` | function/API behavior, caller/callee boundaries, valid inputs | preconditions, postconditions, invariants |
| `equation-invariant` | a compact formula, precedence rule, or conserved relationship is clearer than rows | formula, invariant, counterexample shape |
| `proof-invariant` | proof, loop correctness, or preservation across steps matters | loop invariant, proof obligation, termination condition |
| `data-relation` | data facts, queries, constraints, or representation replacement matter | relations, joins, violation queries, schema/model compatibility |
| `absence-default-semantics` | configurable, optional, nullable, defaulted, persisted, or externally supplied values may be missing | valid members, absence meanings, default owner, legacy shape, misplaced-default counterexample |
| `decision-space` | finite policy/case matrix, role/status/flag combinations | inputs, finite partitions, outputs, missing/conflicting cases |
| `domain-relation` | entities and relationships drive behavior | entities, relations, assumptions, properties |
| `transition-temporal` | state changes, async flows, retries, workers, lifecycle | states, actions, safety, liveness, stale events |
| `constraint-objective` | assignment, optimization, configuration, solver-like work | variables, constraints, objective, invalid representations |
| `logic-programming` | facts and rules should be queried directly or recursively | facts, rules, queries, possible worlds |
| `ai-delegation` | preparing a clear task for another agent or skill | facts, rules, forbidden cases, objective, verification |

## Problem Shape Router

Choose the first representation from the shape of uncertainty, not from tool
preference.

| Problem shape | Start with | Why |
| --- | --- | --- |
| A boolean name feels vague: valid, ready, allowed, safe, complete | `predicate-naming` | Forces the domain question behind the boolean to be explicit |
| The rule says all, any, none, at least one, exactly one, or at most one | `set-quantifier-model` | Separates the domain set from the required count |
| The rule is conditional: if, only if, unless, whenever | `implication-counterexample` | Turns a policy into the failure shape to exclude |
| A refactor, rewrite, schema change, or optimization must preserve meaning | `rewrite-equivalence-check` or `replacement-schema-model` | Separates logical equivalence from language/runtime semantics |
| A fact must remain true across calls, steps, data mutations, or loops | `equation-invariant`, `contract-model`, or `loop-invariant-proof` | Names the preserved guarantee before choosing a representation or change |
| Role/status/flag/action combinations are finite and reviewable | `decision-table` | Finds missing and conflicting cases |
| Facts and relationships drive correctness | `domain-model`, `relational-query`, or `data-constraint` | Makes possible instances and impossible fact combinations visible |
| Correctness depends on movement through time | `state-transition` or `temporal-model` | Distinguishes valid snapshots from valid behavior |
| The task is to find a satisfying value, allocation, plan, or counterexample | `constraint-objective`, `smt-counterexample`, or `logic-programming` | Models the conditions a solution must satisfy |
| The answer depends on stakeholder policy | `human-decision-surface` | Prevents the model from inventing product meaning |

## Modeling Tool Selection

Select tools after selecting lenses. A lens says what to look for; a tool says
how to represent the condition space. Use the full modeling range, not only
decision tables or solvers.

| Tool | Use when | Do not use when |
| --- | --- | --- |
| `predicate-naming` | important booleans hide product meaning | sequence, data relationships, or optimization are the main issue |
| `set-quantifier-model` | rules use all, any, none, at least one, exactly one | the domain cannot be stated |
| `implication-counterexample` | a rule is conditional: if P then Q | no useful `P && !Q` failure case exists |
| `rewrite-equivalence-check` | refactoring conditionals, predicates, sets, or quantifiers | language semantics, side effects, evaluation order, or runtime representation changes meaning |
| `example-test-spec` | concrete scenarios define required behavior | examples are arbitrary and miss the intended property |
| `structural-property-test` | behavior has a general property over many valid inputs | valid input generation or property definition is unclear |
| `metamorphic-relation` | exact output is hard to know but related runs should agree | no meaningful relation exists between transformed inputs |
| `contract-model` | the risk is at a function/API/component boundary | the main issue is stakeholder policy over many cases |
| `type-representation-model` | invalid states can be excluded or exposed by data shape | the language cannot express the semantic guarantee |
| `loop-invariant-proof` | correctness depends on every loop or proof step preserving a fact | tests provide enough evidence for the risk |
| `relational-query` | facts are best modeled as relations, joins, projections | behavior is mainly local branching |
| `data-constraint` | schema, uniqueness, existence, or update constraints matter | the rule is purely transient UI behavior |
| `replacement-schema-model` | changing schema/API/representation must preserve old meaning | no old abstract model must be recovered |
| `absence-default-model` | a value can be omitted, null, empty, defaulted, inherited, hydrated, or supplied by another boundary | the value is always required and has no legacy or external shape |
| `decision-table` | independent inputs can be partitioned into finite buckets and mapped to outputs/actions | inputs depend strongly on each other, side effects dominate, a loop/recursion is required, inputs are unbounded lists/complex types, or the table is too large |
| `equation-invariant` | a formula, precedence rule, or always-true relationship is clearer than enumerating rows | policy genuinely differs by many discrete buckets |
| `domain-model` | entities, relations, possible instances, and properties matter | the task is a local transform with no domain ambiguity |
| `state-transition` | a state can be valid but invalidly reached | current-state validity fully captures correctness |
| `temporal-model` | concurrency, retry, timeout, stale event, fairness, or liveness matters | finite deterministic examples cover the risk |
| `constraint-objective` | variables, hard constraints, and preferences must be separated | a bespoke algorithm is simple, fixed, and performance-critical |
| `smt-counterexample` | satisfaction, contract, arithmetic, string, bitvector, or data-structure edge cases need counterexample search | the model cannot be encoded accurately enough |
| `logic-programming` | facts, rules, recursive relations, or possible worlds are the program model | deterministic imperative control flow is simpler |
| `human-decision-surface` | reasonable stakeholders could choose different policies | the answer follows from existing rules or data |
| `ai-delegation-model` | another skill, tool, or agent needs a task contract | success criteria and verification cannot be stated |

For decision tables, check the four fit questions before selecting the tool:

```text
1. Is there a clear map between independent inputs and outputs?
2. Can the inputs be cleanly and concisely enumerated as finite partitions?
3. Is a table clearer than prose, an equation, an invariant, or a state model?
4. Will the table stay small enough to review?
```

If any answer is no, prefer another tool or split the model.

When presenting selected tools to the user, explain each tool in plain terms:

```text
Tool:
  What the tool means.
Why this tool:
  What shape of uncertainty or correctness risk it exposes.
Not this tool when:
  The boundary where another tool is more appropriate.
Output:
  What the tool should make visible: predicate, property, counterexample,
  table row, transition, query, constraint, objective, or human decision.
```

## Modeling Rules

- Normalize prose before solving. First identify domain facts, predicates,
  quantifiers, implications, counterexamples, finite decision spaces, temporal
  language, and open policy questions.
- Separate meaning from implementation. Predicate names should say what is true,
  not how it is computed.
- Separate predicate roles. A decision predicate can be true or false; an
  assumption or precondition defines when a property is meaningful; a property
  is a guarantee that must not be false in valid states.
- Separate assumptions from guarantees. Use assumptions for well-formedness,
  preconditions, and product decisions that must be true before a property means
  anything.
- Treat `P => Q` as a failure condition: `P && !Q`.
- For finite decisions, prefer explicit case coverage over prose, but only when
  inputs form reviewable finite partitions.
- Prefer an equation or invariant over a decision table when a compact
  relationship communicates the rule more clearly.
- For stateful behavior, distinguish current-state invariants from transition
  rules over old and new state.
- For optimization, distinguish constraints that must hold from objectives that
  choose among valid solutions.
- For optional, nullable, defaulted, persisted, configurable, or externally
  supplied values, model absence before design. State valid members; whether
  absent, `undefined`, `null`, empty, and false-like values differ; the default;
  the owner of that default; the legacy shape; and the counterexample that
  proves the default was enforced in the wrong layer.
- Preserve domain-specific unknowns as questions. Do not answer them by
  aesthetic preference or by over-formalizing.

## Guarantee Placement

For each property, choose the cheapest trustworthy layer that can carry the
guarantee:

- Use `type` when the language can exclude invalid states directly.
- Use `contract` when the rule is semantic and must guide callers/callees.
- Use `runtime-validation` when invalid external input must be rejected.
- Use `assertion` when an internal state must already be guaranteed and cheap to
  check.
- Use `unit-test` or `integration-test` when behavior has concrete examples.
- Use `property-test` when a domain generator can express the valid input set.
- Use `proof`, `model-check`, or `solver` only when exhaustive reasoning or
  counterexample search is worth the modeling cost.
- Use `human` when the rule is a product decision, not a derivable fact.
- Use an explicit default or normalization owner when missing or legacy data
  should be translated into a domain value before consumers rely on it.

If the chosen layer is not a test, still create a verification target explaining
what evidence will prove the guarantee.

## Common Failure Signals

- A natural-language `and/or` requirement has no explicit grouping.
- A rule uses "all", "any", "never", "always", "at least one", or "exactly one"
  without a domain.
- A quantifier can be read in more than one order, such as "some resource all
  users can access" versus "each user can access some resource."
- A predicate mixes decision, assumption, and property roles.
- A type accepts values outside the valid domain, but there is no validation or
  precondition.
- A fallback expression silently becomes the owner of product or domain default
  policy.
- A default value appears in multiple layers without one explicit owner.
- A decision table is complete internally but may not be correct product policy.
- A state enum exists, but allowed transitions are not represented.
- A representation change loses information needed to reconstruct the old model.
- An AI task prompt gives procedure but not facts, constraints, objective, or
  verification.

## Verification Target Derivation

Turn model elements into verification targets:

- `predicate`: unit test, property test, contract check, or proof obligation.
- `forbiddenCase`: negative test, runtime validation, type exclusion, or model
  check.
- `decisionSpace`: case matrix, table validation, branch coverage by meaning.
- `stateTransition`: transition tests, temporal model, stale event checks.
- `constraint`: assertion, database constraint, validation, solver check.
- `absenceDefault`: legacy/missing-value case, normalization contract, creation
  default, serialization round trip, and consumer fallback boundary.
- `objective`: ranking/optimization evidence and accepted tradeoff.
- `openQuestion`: human decision before any action that depends on it, or
  explicit acceptance of the uncertainty.

## Stop Checks

Before treating the model as usable, confirm:

- Each important boolean names a domain question, not an implementation trick.
- Each rule has a domain: the values, states, entities, or transitions it talks
  about.
- Quantifiers have a clear scope and order.
- Conditional rules have a counterexample shape.
- Decision predicates, assumptions, and properties are not collapsed into one
  vague predicate.
- The selected tool explains the uncertainty it exposes.
- Each guarantee has an owner and an evidence target.
- Human policy choices remain open questions instead of guessed rules.

## AI Delegation Boundary

When delegating to an AI helper, sub-agent, or specialized skill, do not provide
only a procedure. Provide:

- context: where the work lives;
- variables/concepts: relevant entities, states, and predicates;
- constraints: must-hold rules and forbidden cases;
- objective: what to optimize or preserve;
- verification: counterexamples, gates, and accepted evidence.

AI helpers are not solvers. Their output must still be checked against the model.
