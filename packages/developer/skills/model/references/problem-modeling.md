# Problem Modeling Reference

Use this reference when a requirement, bug, refactor, API change, or AI task
contains enough conditional complexity that prose and isolated examples no longer
show the full acceptable solution space.

## Central Idea

Model only the condition space under judgment:

```text
domain and facts
-> predicates and rules
-> assumptions and forbidden cases
-> transitions or objectives when relevant
-> guarantee owners
-> counterexamples and verification targets
```

The model is a deliberately simplified view of the world. Its value is not
formality by itself; it is the ability to expose ambiguity, missing cases,
composition failures, and unsafe replacements before code hides them.

## Lower Prose Into Logic

Translate requirement language before choosing a representation:

1. Nouns identify domains and facts: users, documents, orders, states, events.
2. Judgments become predicates: `canEdit`, `isValidTransition`, `isReady`.
3. Quantity words become scoped quantifiers: all, some, none, exactly one.
4. Conditional words become implications: if, only if, unless, whenever.
5. `P => Q` becomes the counterexample to exclude: `P && !Q`.
6. Finite combinations become decision spaces.
7. Time words become actions, transitions, safety, or progress questions.
8. Preferences become objectives only after hard constraints are separated.
9. Reasonable stakeholder choices remain open policy questions.

Words such as *valid*, *ready*, *allowed*, *all*, *any*, *never*, *always*,
*after*, *retry*, and *timeout* are often where the real requirement lives.

## Logic Is Not Runtime Semantics

A logically valid rewrite may be an invalid program rewrite. Before carrying an
equivalence into code, check:

- truthiness and coercion rules;
- short-circuiting and evaluation order;
- exceptions, side effects, mutation, and non-termination;
- equality, identity, and collection semantics;
- floating-point, overflow, null, and missing-value behavior;
- whether a set-like mathematical model is actually represented by an ordered or
  duplicate-preserving collection.

Use the logical form to state the intended relationship, then separately prove
that the implementation language preserves it.

## The Ability-Guarantee Tradeoff

Every representation or tool gains guarantees by excluding abilities. A set
excludes duplicates and order; a read-only capability excludes writes; a narrow
type excludes values; a decidable model excludes expressions its checker cannot
handle.

For every proposed modeling or implementation constraint, state both:

```text
Guarantee gained: what becomes impossible or checkable
Ability lost: what valid expression, input, behavior, or implementation is excluded
```

Do not call a narrower representation better until the lost ability is known not
to be a product requirement.

## Choose The Model From The Uncertainty

| Problem shape | Start with | What it exposes |
| --- | --- | --- |
| vague boolean or conditional rule | predicates, quantified sets, implication counterexamples | exact domain, scope, and failure shape |
| function or API composition | contracts | caller obligations and callee guarantees |
| refactor, upgrade, schema, or API replacement | replacement model | which old guarantees and accepted inputs must survive |
| finite role/status/flag combinations | decision table | missing, overlapping, or contradictory cases |
| entities and relationships | domain/relational model | possible instances, impossible combinations, and assumptions |
| state, retry, concurrency, lifecycle | transition/temporal model | valid histories, safety, progress, stale events |
| allocation, planning, configuration | constraints plus objective | valid solutions versus preferred solutions |
| hard satisfaction or counterexample search | solver encoding | satisfiability, counterexamples, or optimal solutions |
| stakeholder-dependent behavior | human decision surface | choices the model must not invent |

Use multiple views when the task genuinely mixes shapes. Do not model the whole
product merely because one rule is complicated.

For complete, runnable-shaped examples of boolean policy, relational data,
temporal behavior, proof boundaries, solvers, logic programming, and planning,
read [Worked Models And Specialized Techniques](worked-models-and-specialized-techniques.md).
The examples are selected by uncertainty; they are not a mandatory progression.

## Statements, Specifications, And Tests

A stronger statement implies more statements and excludes more implementations.
A total specification describes all required behavior; most practical tests check
partial specifications because complete behavior is too complex or because a
smaller property localizes failures better.

Combine evidence deliberately:

- examples make product cases concrete;
- domain properties express rules specific to the product;
- structural properties express reusable shapes such as valid output, idempotence,
  monotonicity, membership, or preservation;
- metamorphic relations compare several executions when the exact output is hard
  to know;
- generators define the valid input domain for property tests;
- counterexample shrinking turns a broad failure into a diagnostic case.

A strong passing property gives breadth of confidence. A weak failing property
may provide better localization. Prefer several meaningful partial specifications
over one opaque assertion that cannot explain what failed.

## Contracts And Composition

Model a callable as:

```text
requires: facts callers must establish
ensures: facts correct execution guarantees
invariant: facts preserved through relevant internal steps
```

Contracts propagate through call graphs. If `A` calls `B`, A's established facts
must imply B's preconditions, and B's postconditions must be sufficient for A's
remaining work. This finds bugs where every individual function is locally
correct but their composition is not.

Choose a checking mechanism separately. Types are contracts over representable
values and are usually cheaper to check but less expressive. Runtime assertions,
validation, tests, properties, and proofs cover different parts of a semantic
contract. An unchecked contract can still aid reasoning, but it is not evidence.

## Safe Replacement

To replace `old` with `new` for existing callers, require:

```text
old.Pre  => new.Pre
new.Post => old.Post
```

The replacement must accept at least what old accepted and guarantee at least
what old guaranteed. Apply this to functions, types, APIs, libraries, schemas,
and system specifications.

Observable behavior outside the declared contract may still be depended on in
real systems. Inspect actual callers, persisted data, tests, telemetry, and known
bugs before claiming compatibility. Logical replaceability is necessary evidence,
not a complete social or operational guarantee.

For representation changes, define an abstraction or refinement mapping from the
new representation back to the old model. A change is safe only if relevant new
states or behaviors map to valid old ones.

## Proof And Formal Verification Boundary

A proof establishes that an implementation conforms to a stated specification
under stated assumptions. It does not establish that the specification captures
everything the product needs or that environmental assumptions hold.

For proof-shaped work, write:

```text
preconditions
postconditions
facts known after each step
loop/recursion invariant when control repeats
termination argument when total correctness matters
assumptions outside the model
```

Check initialization, preservation, and conclusion. Use proof or formal tooling
only when exhaustive confidence justifies the modeling and maintenance cost.
Tests, runtime validation, model checking, theorem proving, and static types make
different guarantees; do not label one as another.

## Decision Tables

Use a decision table only when:

1. independent inputs map clearly to outputs;
2. each input can be partitioned into a small finite set;
3. a table is clearer than an equation, invariant, or transition model;
4. the expanded table remains reviewable.

A table is complete when no input combination is missing and sound when the same
input does not map to conflicting outputs. Those properties make the table valid,
not necessarily correct. A valid table can still encode misunderstood product
policy; return ambiguous rows to a human owner.

Avoid tables for strongly dependent inputs, unbounded collections, recursion,
long-running side effects, or rules better expressed by precedence such as
`flags > user settings > defaults`.

## Absence And Defaults

For optional, nullable, configurable, inherited, persisted, or externally supplied
values, model absence before design:

- valid members;
- whether missing, `undefined`, `null`, empty, and false-like values differ;
- the domain default and the one boundary that owns it;
- legacy and serialized shapes;
- whether normalization preserves source distinctions needed later;
- a counterexample showing the default applied in the wrong layer.

A fallback expression is not harmless when it silently becomes product policy.

## Domains, Assumptions, And Time

A domain model defines possible instances, not the entire real world. Separate
three predicate roles:

- **decision**: may be true or false across valid instances;
- **property**: must hold or the model/design is wrong;
- **assumption**: defines the well-behaved instances for which the property is
  meaningful.

Explore unusual valid instances even after properties pass. A checker verifies
consequences of the model; it cannot tell whether omitted real-world facts should
have been modeled.

Use a temporal model when correct snapshots are insufficient. State:

- initial states;
- actions and allowed next states;
- unchanged state for each action;
- safety properties that must always hold;
- progress/fairness properties that must eventually hold;
- stale, duplicated, reordered, retried, or concurrent events.

A concrete implementation refines an abstract system only when each observable
implementation behavior is allowed by the abstract specification, possibly after
an explicit refinement mapping. This catches gaps such as intermediate states
that users can observe even though an abstract operation looked atomic.

## Constraints, Objectives, And Solvers

For solver-shaped work, separate:

- variables and domains;
- hard constraints;
- an optional objective or ranking;
- acceptable equivalence among solutions;
- model assumptions and encoding limits.

Use the least specialized tool that is still economical to model, then specialize
when runtime or scale requires it. General solvers make new constraints easy but
can be much slower than bespoke algorithms. A solver result of `unknown` is not
proof of satisfaction or impossibility. Solver output is evidence only to the
extent that the encoding matches the product problem.

## Logic Programming And Planning

Logic programming is useful when facts, relations, and inference rules are more
natural than a fixed control flow. State facts, derived rules, query variables,
negation meaning, duplicate behavior, search order, and termination. A more
expressive query language may lose termination guarantees; a restricted system
may be the better product boundary.

For planning, model initial state, goal predicate, legal actions, transition
result, state invariant, and optional action cost. A generated plan is valid only
if every intermediate state satisfies the invariant. An optimal plan is optimal
only for the encoded cost function.

## Place Guarantees Deliberately

Choose the cheapest trustworthy owner:

- `type` for representable-state restrictions;
- `contract` for caller/callee semantics;
- `runtime validation` for hostile or external inputs;
- `database constraint` for persisted relational facts;
- `assertion` for internal facts already expected to hold;
- `example/integration test` for concrete behavior;
- `property test` for a generatable valid domain;
- `model check/solver/proof` for exhaustive or high-risk relationships;
- `human decision` for policy rather than derivable fact.

Every important model element needs an owner and an evidence target, even when
the owner is not a test.

## AI Delegation Boundary

When the model feeds another skill, tool, or agent, provide:

```text
Context: where the work lives and what evidence is authoritative
Facts: entities, states, predicates, and existing behavior
Rules: assumptions, must-hold constraints, and forbidden cases
Objective: what to change, optimize, or preserve
Unknowns: product decisions that remain human-owned
Verification: counterexamples, gates, and accepted evidence
```

An AI helper is not a solver or proof. Check its output against the model and the
runtime semantics.

## Stop Checks

The model is usable when:

- every important predicate names a domain question;
- quantifiers have explicit domains and unambiguous nesting;
- implications have counterexample shapes;
- assumptions, decisions, and properties are distinct;
- the representation's lost abilities are acceptable;
- stateful rules cover transitions, not only enums;
- replacements state old/new contract relationships;
- every guarantee has an owner and evidence target;
- unresolved policy remains visible rather than being guessed.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, version 0.14.0, May 4, 2026:
  predicates, sets, quantifiers, logical refactoring and runtime caveats, partial
  specifications, contracts and replacement, data constraints, decision tables,
  domains, time, system models, solvers, and logic programming.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs, Second Edition*, MIT Press, 2018:
  information interpretation, data definitions, representative cases, and
  iterative refinement.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  abstraction mappings, state/history, constraint propagation, and the semantic
  cost of assignment and concurrency.
- Zachary Tellman, *Elements of Clojure*, 2019: narrow access, absence semantics,
  module models, and assumptions that constrain a useful interface.
