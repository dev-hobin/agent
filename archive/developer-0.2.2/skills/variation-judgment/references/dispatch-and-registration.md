# Dispatch And Registration

Use this reference when a mechanism claims additive extension through registered
variants or operations. It supplies the two-axis matrix, complete registration
flow, policy audit, fake-extension check, and stop without requiring another
reference.

## Accepted Judgment Context

Supply accepted representations and operations, current support combinations,
observed growth, representation barrier, registration authority, dispatch keys,
and known duplicate, overlap, precedence, load-order, visibility, and unsupported
constraints.

## Two Axes Before Mechanism

Build the matrix before selecting dispatch:

| Representation | `prepare` | `execute` | `describe` |
| --- | --- | --- | --- |
| Local | supported | supported | supported |
| Remote | supported | supported | supported |
| Deferred | supported | unsupported | supported |

Rows and columns impose different change costs. An object-owned operation favors
adding rows; a centralized operation favors adding columns; a two-dimensional
dispatch system can open both but adds registration and conflict semantics.
“Extensible” is incomplete until the claimed axis is named.

## Registration Contract

State all of the following:

```text
variant key and operation key
who may register
when registration closes or remains open
duplicate and overlap behavior
precedence and load-order behavior
visibility and inspection
missing and unsupported result
failure timing
unregistration or replacement, if allowed
deployment and compatibility boundary
```

Qualified keys prevent accidental identity collisions only when the authority
that creates and compares them is also controlled. Unique keys do not define
precedence or supported operations.

## Worked Case: Encoding Registry

Accepted pressure: separately deployed modules may add encoders under stable,
explicit keys. Callers select one key and need deterministic startup failure.

```text
registry.register(jsonKey, encodeJson)
registry.register(textKey, encodeText)

output = registry.encode(jsonKey, value)
```

Complete flow:

```text
creation:
  one registry instance owns entries
registration:
  duplicate key -> fail startup with "encoder already registered"
selection:
  caller supplies a stable key
execution:
  registry resolves key and invokes encoder
unsupported:
  unknown key -> explicit "unknown encoder" result before external effect
visibility:
  operators can inspect registered keys after startup
load order:
  no precedence; duplicates are errors
replacement:
  disallowed after startup
```

Fake row:

```text
add xmlKey in a new module
old callers and old encoder modules remain unchanged
```

Fake column:

```text
add estimateSize operation
all encoder modules must change or report unsupported
```

The registry opens representation growth, not operation growth. That bounded
claim survives the test.

## Counterexample: Closed Three-Case Policy

When one module owns three stable cases, all ship together, and adding a case
requires policy review anyway, registration adds startup order, naming, and
missing-key failure without independent extension. A local exhaustive
conditional is the smaller truthful owner.

## Artifact

```text
Variant-operation matrix:
Observed growth axis:
Representation barrier:
Registration and dispatch authority:
Key identity:
Duplicate / overlap / precedence / load order:
Visibility and failure timing:
Unsupported result:
Fake row:
Fake column:
Simpler alternative:
Decision:
```

## Stop And Separation

Stop when both extension axes are tested, every registration policy has one
owner, and the selected mechanism is no more powerful than observed pressure
requires. A successful lookup alone is not sufficient evidence.

This document does not invent domain roles, operation meaning, construction
workflow, or a whole API.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Sections 2.4-2.5, for data-directed generic operations, multiple
  representations, and variant/operation extension axes.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 64-69, for ordered conditionals, table
  conflicts, and qualified openness cost. Dispatch performance and unordered
  openness are not imported as universal runtime laws.
