# Language Semantics

Use this reference when ordinary data and functions have become notation that
needs its own grammar, validation, evaluation, result, and error semantics.

## Language Gate

A configuration, rule table, query, expression, or workflow is a language only
when it needs an owned account of:

```text
primitives
combination
abstraction or reusable names
accepted grammar and validation
evaluation in an environment
errors and unsupported programs
evolution and compatibility
```

Prefer typed data plus ordinary functions when they keep policy more visible.

## Representation, Parsing, And Meaning

```text
transport input
-> accepted grammar or sublanguage
-> constructed semantic representation
-> evaluator meaning
-> rendered or effectful result
```

Represent inspectable notation as semantic data rather than string positions.
Constructors may simplify only under explicit semantic laws. Parse success does
not establish evaluator meaning.

## Evaluator Contract

```text
evaluate : Program x Environment x ExecutionPolicy -> Evaluation
Evaluation = One(Result) | Search(Stream<Result>) | LanguageError
```

State scope, binding, order, demand, zero/one/many results, answer/proof identity,
duplicates, choice/fairness, branch failure, error, divergence, rollback, effects,
negation, cancellation, termination, and resource limits as applicable. A
mathematically equivalent rewrite may change any of these observers.

## Artifact

```text
Language gate and ordinary-data alternative:
Primitives, combinations, and abstractions:
Grammar and semantic representation:
Validation and invalid programs:
Evaluator/result/search contract:
Scope, order, demand, multiplicity, effects, failure, and termination:
Example program and unsupported case:
```

## Stop And Separation

Stop when a representative and invalid program have explainable syntax, meaning,
result shape, effects, and failure, and the ordinary-data alternative was
considered.

Use `runtime-and-compilation` only when lowering, calling convention, generated
code, roots, or optimization guards are independently consequential. Return to
`model/logic-query-semantics` when search meaning is not yet accepted.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 4.1,
  Section 4.2,
  Section 4.3,
  and Section 4.4
  for evaluator models, laziness, nondeterminism, and relational semantics.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, Chapters 11-12, pp. 139-168,
  calibrates solver/query language result multiplicity and search boundaries;
  recorded beta defects are excluded.
