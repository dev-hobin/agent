# Data-Driven Design

Use this reference when product information should determine the program shape.
The central insight is concrete: **a data definition is a construction rule for
valid values, and that same rule determines the first honest function
template**. Code shape should not be guessed from framework files or a favorite
pattern when the cases are already present in the data.

## The Six-Artifact Recipe

Produce these artifacts in order. Each one catches a different error.

```text
1. data definition + interpretation
2. representative data examples
3. signature + purpose + executable stub
4. behavior examples
5. template derived only from the data definition
6. completed function + checks
```

The order is diagnostic, not ceremonial. If the template has no branch for a
required case, repair the data definition. If the template exposes all required
ingredients but the result is wrong, repair the completed body. If no template
ingredient can express the purpose, design an auxiliary with its own recipe.

In an existing repository, recover the same artifacts from schemas, types,
fixtures, callers, UI states, persistence, and tests. Do not copy pedagogical
comments into production merely to imitate the recipe.

## Complete Example: Let The Variants Write The Skeleton

Requirement: show the customer-facing instruction for a fulfillment method.

### 1. Define and interpret the data

```text
Fulfillment =
  Pickup(storeId)       // collect from this store
  | Delivery(address)   // send to this address
  | Locker(lockerId)    // collect from this locker

Excluded: a fulfillment value with none or several of these variants.
```

This is not merely a union type. Its interpretation says the three variants are
different product meanings, so silently merging branches would lose policy.

### 2. Construct one value from every clause

```text
Pickup("gangnam")
Delivery("12 Teheran-ro")
Locker("L-17")
```

If a valid example cannot be constructed, the definition is unusable. Add
boundary examples when fields have their own restrictions.

### 3. State what the function computes

```text
instruction : Fulfillment -> Text
purpose: produce the instruction a customer should follow
stub: instruction(method) = ""
```

The purpose says *what*, not “inspect the tag and branch.”

### 4. Work behavior examples before implementation

```text
instruction(Pickup("gangnam"))
  == "Pick up at gangnam"
instruction(Delivery("12 Teheran-ro"))
  == "Deliver to 12 Teheran-ro"
instruction(Locker("L-17"))
  == "Collect from locker L-17"
```

### 5. Derive, do not invent, the template

One data clause becomes one branch. Fields in that clause become available
ingredients.

```text
instruction(method):
  match method:
    Pickup(storeId)     -> ... storeId ...
    Delivery(address)   -> ... address ...
    Locker(lockerId)    -> ... lockerId ...
```

The strings and formatting policy do not come from the data shape; the purpose
and examples supply them. The branch structure and accessible fields do.

### 6. Complete and check

```text
instruction(method):
  match method:
    Pickup(storeId)     -> "Pick up at " + storeId
    Delivery(address)   -> "Deliver to " + address
    Locker(lockerId)    -> "Collect from locker " + lockerId
```

Run all three examples. Then try a fake fourth variant. A compiler failure or
explicit missing branch reveals the exact extension point; a catch-all returning
an empty string would hide it.

## Select The Specific Recipe

Read only the detail that matches the unresolved design question:

| Evidence | Read | Expected artifact |
| --- | --- | --- |
| atomic values, intervals, itemizations, records, recursive or mutually recursive data, multiple complex inputs, complex outputs, or event loops | [Data-Shape Template Catalog](data-shape-template-catalog.md) | a template whose branches, selectors, recursive positions, and delegations correspond to the data definition |
| wished helpers, several completed concrete functions, generated subproblems, termination uncertainty, repeated work, or lost traversal knowledge | [Composition, Generative Recursion, And Accumulators](composition-generative-recursion-and-accumulators.md) | separately designed auxiliaries, a justified abstraction, a generation template plus termination argument, or an accumulator invariant |

These documents extend this recipe; they do not replace the six artifacts.

## Existing-Code Recovery

Use this recovery table rather than assuming the declared type is complete.

| Artifact | Repository evidence | Typical contradiction |
| --- | --- | --- |
| data definition | schema, type, constructors, persisted samples | runtime contains a legacy or impossible-looking shape |
| interpretation | product copy, callers, docs, analytics meaning | two same-shaped values mean different things |
| data examples | fixtures, factories, production samples | only the happy variant has an example |
| behavior examples | tests, screenshots, API examples | expected output encodes an undocumented default |
| template | branches, selectors, traversal, delegation | catch-all hides a meaningful clause |
| completed body | implementation | code needs information absent from the data model |

When evidence conflicts, keep the contradiction visible. `model` owns disputed
validity or policy; this reference shapes the implementable surface once the
meaning is accepted.

## Sketch Output

```text
Purpose: result in product language
Data: valid clauses, interpretation, excluded values
Data examples: at least one per clause and meaningful boundary
Behavior examples: input -> expected result with rationale
Template: branches, selectors, recursive calls, and delegations derived from data
Wish list: separately designed subproblems
Checks: examples, properties, boundaries, and compatibility evidence
First item: smallest executable step implied by the template
Deferred: abstractions or policies not yet earned
```

## Failure Diagnosis

| Symptom | Return to |
| --- | --- |
| valid product case has no representation | data definition and interpretation |
| data clause has no example | data examples |
| tests describe traversal rather than result | purpose and behavior examples |
| branch has no corresponding data clause | template derivation |
| recursive call is on an arbitrary “smaller” value | structural versus generative recursion recipe |
| helper has a body but no independent purpose | wish-list design |
| abstraction precedes comparable completed designs | abstraction-from-examples recipe |
| changed type ignores stored/public older forms | existing-code recovery and compatibility model |

## Source Trace

- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs, Second Edition*, MIT Press, 2018,
  and the [official living edition](https://htdp.org/2026-5-28/Book/index.html):
  information analysis, data definitions and interpretations, examples,
  signatures and purpose statements, templates, implementations, tests, and
  iterative refinement.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  wishful decomposition and the distinction between procedure text and the
  process it generates.
