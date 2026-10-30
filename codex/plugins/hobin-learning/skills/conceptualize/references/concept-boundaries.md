# Concept Boundary And Transfer

Use this reference when a candidate may contain several concepts, a connector
relation, or an operational pattern, or when its generality is uncertain.

## Role Classification

```text
Concept
  One reusable operation, relation, distinction, or judgment that answers one
  practical question.

Connector relation
  A named relation such as enables, constrains, refines, selects, tests, or
  composes. Keep it as a relation unless it has its own reusable mechanics.

Operational pattern
  A recurring coordination of several concepts or judgments into moves and
  checks. Hand it to patternize.

Source-local detail
  Vocabulary, example material, order, or implementation detail needed for
  provenance but not for the transferable definition.
```

## Semantic Atomicity Test

Split when:

- the candidate contains independent verbs or judgments;
- subsections have different “when to use” conditions;
- mechanisms can fail independently;
- one part transfers while another does not;
- the name is a topic umbrella rather than an operation;
- a portable model requires unrelated axes.

Do not split merely because several examples or technical anchors are needed to
explain one mechanism.

## Transfer Test

For each candidate, provide:

1. a source case;
2. a source-external case with changed surface details;
3. a near miss sharing vocabulary but not mechanism;
4. a counterexample or assumption violation;
5. the first observation that would falsify the claimed generality.

Transfer requires mapping deep structure, not copying terminology.

## Combination Check

When split concepts still participate in a larger move, keep them separate and
state the connector relation. Route to `patternize` only if a recurring context,
forces, moves, and checks can be supplied.

## Stop

Stop when each concept answers one question, every connector is explicit, and
the generality claim matches the transfer evidence. If the candidate fails,
return a split, a relation, a pattern handoff, or an evidence gap instead of a
polished concept.
