# Logic Query Semantics

Use this reference when facts and relations can yield zero, one, or many answers
and search behavior affects the meaning of an observed result.

## Query Contract

State:

```text
facts and derived rules
query variables
answer identity
derivation or proof identity
duplicate and aggregation policy
negation meaning
binding requirements
search order, fairness, and cycle policy
termination and resource bound
outcome vocabulary
```

Different proofs may produce one domain answer. Decide whether aggregation uses a
set, bag, or proof count.

## Negation And Failure

Negation-as-failure means the current knowledge base and search cannot derive the
goal. It is not classical falsehood about the world. Require variables used by
negation or host predicates to be bound when runtime meaning depends on binding
order.

Keep distinct:

```text
answer
exhausted complete search
bounded unknown
timeout
language/runtime error
divergence before a later branch
```

Failure to observe an answer proves absence only after a complete search
terminates conclusively.

## Worked Shape

```text
depends(api, domain)
depends(ui, api)
reachable(a, b) if depends(a, b)
reachable(a, c) if depends(a, b) and reachable(b, c)
```

Query `reachable(ui, X)` must explain duplicate paths, cycles, answer identity,
and completion.

## Artifact

```text
Facts, rules, and query:
Answer versus proof identity:
Duplicate and aggregation policy:
Negation and binding semantics:
Search order, fairness, cycles, and termination:
Outcome states:
Known answer, duplicate, cycle, divergence, and no-answer cases:
```

## Stop And Separation

Stop when every observed empty/non-empty result has one defined interpretation
relative to search completion, duplicates, negation, and termination.

Use `planning-models` for legal action sequences toward a goal,
`solver-result-boundaries` for conclusive bounded status, and the `sketch`
language-semantics route when the query runtime must be designed.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapter 12, pp. 156-168, for zero/one/many answers, duplicates, negation,
  search, and answer sets. Recorded Prolog and exercise defects are excluded.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 4.4
  for proof multiplicity, search order, closed-world negation, fairness, and
  termination.
