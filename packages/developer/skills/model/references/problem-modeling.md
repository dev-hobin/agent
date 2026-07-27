# Problem Modeling

Use this reference when prose and isolated examples no longer expose the whole
condition space under judgment. It extends `model` at the point where dimensions,
rules, and forbidden cases must become explicit. It does not select an API,
implementation, verifier, or specialized formal tool.

## Judgment Spine

```text
uncertainty
-> admitted domain and distinctions
-> predicates, rules, and forbidden combinations
-> assumptions and policy gaps
-> guarantee owners and counterexample targets
```

The model is complete enough when every consequential distinction changes a rule,
forbidden case, owner, or check. Extra detail that changes none of those is not a
better model.

## Lower Prose Into Decisions

Translate requirement language before choosing notation:

1. nouns identify domains and facts;
2. judgments become predicates such as `canEdit` or `isReady`;
3. quantity words become scoped quantifiers;
4. conditional words become implications;
5. `P => Q` exposes the forbidden counterexample `P && !Q`;
6. finite combinations become partitions or decision tables;
7. time words identify a possible temporal handoff;
8. preferences remain separate from hard constraints;
9. stakeholder choices remain visible rather than being guessed.

A predicate states a relationship, not how to compute it. Mark abstract terms and
state the domain and nesting order of every quantifier. If `all qualifying items`
must not pass on an empty set, add the required existence condition explicitly.

## Keep Logic And Runtime Distinct

A truth-preserving rewrite is not automatically a behavior-preserving program
rewrite. Record the observers that can distinguish it:

- coercion, equality, identity, and collection multiplicity;
- short-circuit demand and evaluation order;
- effects, exceptions, mutation, and non-termination;
- null, missing, false-like, and legacy values;
- numeric range, exactness, rounding, overflow, and underflow;
- time, storage, and resource behavior when they are part of the claim.

Use logic to state intended relations. A later sketch or verification must still
show that the implementation model preserves them.

## Choose The Smallest Sufficient Model

| Uncertainty | Model view | Handoff when it becomes consequential |
| --- | --- | --- |
| finite roles, flags, statuses, or defaults | predicates and a partition table | remain here while the complete finite surface is visible |
| caller/callee obligations or compatibility | contract and replacement relation | [Contract And Replacement Models](contract-and-replacement-models.md) |
| entities, intervals, and cross-record facts | relational constraints | [Relational Constraint Models](relational-constraint-models.md) |
| retry, lifecycle, concurrency, or allowed histories | transition and temporal behavior | [Temporal Behavior Models](temporal-behavior-models.md) |
| deductive implementation-conformance claim | proof obligations | [Proof Obligations](proof-obligations.md) |
| bounded counterexample, satisfiability, feasibility, or optimization status | solver-result boundary | [Solver Result Boundaries](solver-result-boundaries.md) |
| inference, answer multiplicity, negation, or query search | logic-query semantics | [Logic Query Semantics](logic-query-semantics.md) |
| legal action sequence toward a goal | planning model | [Planning Models](planning-models.md) |
| product-owned choice | human decision surface | return an explicit open question |

Use more than one view only when each answers a different unresolved question.
Do not model the whole product because one rule is difficult.

## Ability And Guarantee

Every restriction removes an ability while gaining a guarantee:

```text
restriction:
guarantee gained:
ability lost:
product evidence that the loss is acceptable:
```

A set removes order and duplicates. A narrow type removes representable values. A
read-only capability removes writes. A decidable language removes expressions.
Do not call a narrower model better until the excluded ability is known not to be
required.

## Finite Partitions And Defaults

A decision table is justified only when every dimension has a finite, pairwise
disjoint, exhaustive partition. Row count is evidence only after those conditions
hold. A structurally valid table can still encode the wrong policy, so ambiguous
rows remain human-owned.

For absence-sensitive values, distinguish at least:

```text
missing | undefined | null | empty | false-like | defaulted | legacy | invalid
```

State which distinctions survive normalization, the single owner of the default,
and a counterexample where applying the default in another layer changes meaning.
A fallback expression is product policy when callers can observe it.

## Prediction, Observation, And Refinement

Use the simplest representation that preserves the facts required for the current
prediction:

```text
model + assumptions
-> predicted case or transition
-> observation
-> discrepancy
-> one explicit model refinement
```

A discrepancy may locate an implementation defect, an omitted fact, an external
drift, or a mistaken purpose. Keep these explanations separate.

Distinguish enforceable internal consistency from environmental observation:

```text
internal invariant: transition the modeled owner can enforce
external relation: correspondence observed at a time
drift signal: evidence the correspondence may no longer hold
mitigation: revalidate, narrow use, revise the model, or accept bounded failure
```

A health check or compatibility probe cannot permanently force the environment
to remain aligned.

## Place Guarantees Deliberately

For every important rule, name the cheapest trustworthy owner and evidence target:

- type or abstract representation for representable-state restrictions, but only
  when every construction path establishes the restriction;
- parser or smart constructor for hostile or broader input, returning the
  invariant-carrying value or explicit failure rather than discarding the check;
- contract for caller/callee meaning;
- database constraint for persisted relational facts;
- state transition owner for history-sensitive rules;
- example or integration check for concrete behavior;
- property check for a declared generatable domain;
- model, solver, or proof for bounded exhaustive relationships;
- human decision for policy.

An unchecked statement may guide design, but it is not evidence. Validation that
returns only success, `Unit`, or `Bool` cannot by itself place a guarantee at a
stronger type, and an assertion, cast, non-null claim, ignored conversion result,
or typed deserialization target does not repair that gap. Record the required
raw-to-refined transition and hand its concrete caller surface to `sketch`.

## Model Artifact

```text
Question under judgment:
Domain and admitted values:
Dimensions and distinctions:
Predicates and rules:
Forbidden cases or transitions:
Decisions / properties / assumptions:
Ability gained and lost:
Guarantee owner and evidence target:
Counterexamples:
Human-owned unknowns:
Specialized handoff, if any:
```

## Stop And Separation

Stop when the admitted space, rules, forbidden cases, assumptions, owners, and
counterexamples are explicit enough to constrain a later design.

Separate rather than expanding this reference when:

- a public operation, ownership map, or caller shape must be invented (`sketch`);
- an existing structural candidate must be approved (`abstraction-review`);
- an implementation claim needs evidence (`verify`);
- a specialized contract, temporal, relational, proof, solver, logic, or planning
  obligation has its own artifact and stop check (use the routed reference above).

## Source Trace

- Alexis King, “Parse, don’t validate,” published November 5, 2019, for the
  distinction between checks that discard learned information and fallible
  transitions that return a refined representation. Concrete parser and
  smart-constructor surfaces remain owned by `sketch`.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04:
  Chapters 2-4, pp. 5-46, for predicates, quantifiers, ability/guarantee,
  specifications, and logic/runtime boundaries. Recorded beta defects are
  excluded.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, living build 9.2.0.3:
  Preface,
  Chapter 19,
  Chapter 20,
  and Intermezzo 4
  for interpretation, simplest sufficient representations, prediction,
  discrepancy, refinement, and numeric assumptions.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 2.1
  and Section 3.1
  for abstraction mappings, state, identity, and history-sensitive meaning.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 70-89, for model/environment distinctions,
  assumptions, observation, drift, and environment-relative usefulness. Broad
  proof rhetoric and language-specific idioms are not imported as general laws.
