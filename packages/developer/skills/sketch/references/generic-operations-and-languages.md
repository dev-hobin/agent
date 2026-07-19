# Generic Operations And Languages

Use this reference when several representations must coexist additively, or
when ordinary data and functions are becoming a small language with its own
evaluation semantics.

## Two Axes Of Generic Operations

Write the matrix before choosing classes, visitors, multimethods, or a registry:

| Representation | `charge` | `refund` | `describe` |
| --- | --- | --- | --- |
| Card | method | method | method |
| Bank transfer | method | unsupported | method |
| Store credit | method | method | method |

There are two independent pressures:

- horizontal: higher-level operations should not know representation fields;
- vertical: adding a representation should not require editing every old
  representation package.

One possible data-directed surface is:

```text
register(kind, operation, method)
applyGeneric(operation, taggedValue, ...args)
```

Specify duplicate registration, missing method, load order, type transitions,
and error visibility. Then add a fake representation. Existing callers and old
representation modules should remain unchanged. If only two stable variants
exist, a local conditional may be cheaper and clearer.

## Coercion And Meaning Preservation

For mixed representations, draw paths:

```text
Integer -> Rational -> Decimal
Money(USD) -X-> Money(EUR) without an exchange-rate context
```

For each edge state preserved meaning and lost ability: precision, identity,
order, metadata, or capability. Choose direct operation, coercion, canonical
representation, or explicit rejection. A convenient path that silently loses
meaning is not genericity.

## Symbolic Data Boundary

When code inspects formulas, queries, or rules, represent notation as data:

```text
Expr = Number(value) | Variable(name) | Sum(left, right) | Product(left, right)
```

Algorithms use predicates/selectors/constructors or pattern matching on this
semantic definition, not string indexes. Constructors may own simplification:

```text
makeSum(0, x) -> x
makeSum(x, 0) -> x
makeSum(x, y) -> Sum(x, y)
```

That policy must be explicit because it changes the representation while
preserving intended expression meaning.

## When Data Becomes A Language

A rule table, query builder, workflow schema, or configuration is a language
only when it has:

```text
primitives: smallest valid expressions
combination: how expressions form larger expressions
abstraction: how recurring expressions receive reusable names
validation: well-formed versus invalid programs
evaluation: what an expression means in an environment
errors: parse, validation, runtime, and unsupported behavior
evolution: versioning, migrations, and compatibility
```

Worked policy DSL sketch:

```text
Policy = Allow(Role) | HasTag(Tag) | All(List<Policy>) | Any(List<Policy>)

evaluate(Allow("admin"), env) = env.user.role == "admin"
evaluate(All([]), env) = true
evaluate(All([p, ...rest]), env) = evaluate(p, env) && evaluate(All(rest), env)
```

Define invalid states, such as an unknown role or empty `Any`, rather than
letting a host-language exception become language semantics.

## Evaluator Boundary

Keep the evaluator contract distinct from syntax:

```text
evaluate : Program x Environment -> Result | LanguageError
```

State evaluation order, scope, effects, termination limits, and resource
budgets. A mathematically equivalent rewrite may not preserve host-language
short-circuiting, effects, or exceptions.

Do not build a DSL when ordinary typed data plus functions keep policy more
visible. The evaluator, migrations, debugging tools, and error messages are
product code, not free infrastructure.

## Artifact

```text
Variant-operation matrix:
Representation barrier:
Registration/dispatch and unsupported policy:
Conversion graph and preserved meaning:
Language primitives/combinations/abstractions:
Validation and evaluator contract:
Errors, effects, versioning, and limits:
Fake variant or example program check:
Simpler ordinary-data alternative:
```

## Source Trace

- *Structure and Interpretation of Computer Programs*, Second Edition,
  sections 2.4-2.5 and chapters 4-5: multiple representations, generic
  operations, data-directed programming, symbolic data, metalinguistic
  abstraction, evaluators, and explicit machines.
- Hillel Wayne, *Logic for Programmers*, version 0.14.0, May 4, 2026:
  model/runtime distinctions and ability-guarantee tradeoffs.
