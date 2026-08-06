# Contract And Replacement Models

Use this reference when the unresolved question is what callers may require,
what implementations must guarantee, or whether a new implementation can
replace an old one for a declared observer. It is self-contained and does not
require another modeling reference.

## Accepted Modeling Context

Supply the bounded question, admitted caller and implementation domains, known
preconditions and outcomes, relevant failures and observers, environmental
assumptions, and at least one replacement counterexample. Unknown product policy
remains explicit rather than being invented here.

This member contributes the contract implications, refinement mapping, excluded
abilities, compatibility decision, and verification targets. Its stop and
handoffs below own any context still missing.

## Contract Relation

Model a callable or boundary as:

```text
requires: facts the caller establishes
ensures: facts successful execution guarantees
invariant: facts preserved through relevant internal steps
failure: admitted error outcomes and when they become observable
observers: value, effects, order, errors, resource behavior, persisted/public form
```

Composition is an implication check. If `A` calls `B`, facts established by `A`
must imply `B.requires`, and `B.ensures` must establish what the rest of `A`
needs. Locally correct contracts can still fail at their seam.

## Replacement Relation

For existing callers, require at least:

```text
old.requires => new.requires
new.ensures  => old.ensures
```

The new implementation must not demand more from old callers or promise less.
Apply the same relation to error behavior and every declared observer. Passing
old examples is sufficient only when those examples completely express the
chosen contract, which is uncommon.

For representation changes, write an abstraction or refinement mapping:

```text
new representation/state/behavior
-> old abstract meaning observed by callers
```

Every relevant new behavior must map to an admitted old behavior. Intermediate
states matter when callers can observe them.

## Ability And Guarantee Check

A narrower enum, schema, or result type may strengthen guarantees while rejecting
previously valid input. Record:

```text
old admitted ability:
new restriction:
guarantee gained:
old caller or stored value excluded:
explicit migration or breaking scope:
```

Do not hide a breaking change behind the word `validation`.

## Compatibility Beyond The Logical Contract

Actual systems may depend on behavior never written into the contract. Inspect:

- real callers and built consumers;
- persisted and serialized legacy forms;
- failure types and timing;
- ordering, effects, and resource observers;
- telemetry only as bounded evidence, never proof of absence;
- public documentation and known bugs that became de facto behavior.

Migration, rollout, coexistence, telemetry, and rollback protocols are Developer
adaptations. This model names their obligations but does not claim a source book
supplies a production procedure.

## Artifact

```text
Old requires / ensures / failures:
New requires / ensures / failures:
Declared observers:
Precondition implication:
Postcondition implication:
Refinement mapping:
Excluded old inputs or behaviors:
Actual caller and persistence evidence:
Compatibility decision or open policy:
Verification targets:
```

## Stop And Separation

Stop when every implication is supported, contradicted, or left as an explicit
compatibility question, and the observer set is named.

Hand off to `sketch` when adapters or a new boundary must be designed, to
`schedule` when migration timing is the question, and to `verify` when the model
exists but evidence for compatibility is missing.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapter 5, pp. 47-60, for contracts, composition, replacement, and accidental
  observable behavior.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 2.1
  for abstraction mappings, representation laws, and observer-relative data
  meaning.
- The explicit production compatibility inventory is a Developer adaptation of
  those semantic obligations.
