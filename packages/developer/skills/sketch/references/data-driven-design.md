# Data-Driven Design

Use this reference when product information should determine the program shape.
It extends `sketch` from accepted meaning through data, examples, template, and
first executable item. Specialized references refine one later step; they do not
replace this derivation.

The central insight is concrete: **a data definition states how valid values are
constructed and what they mean, and that construction rule determines the first
honest structural template**. The template inventories possible branches,
fields, recursions, and delegations. Purpose and examples decide which available
parts the completed function actually uses. Code shape should not be guessed
from framework files or a favorite pattern when the cases are already present
in the data.

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

In an existing repository, recover equivalent evidence from schemas, types,
fixtures, callers, UI states, persistence, and tests. This recovery is a
Developer adaptation for production repositories, not a claim that HtDP replaces
its pedagogical artifacts with those sources. Do not copy recipe comments into
production merely to imitate the teaching form.

## Function Recipe Versus Program Recipe

The six artifacts organize one function. Whole-program design has a different
collaboration:

```text
analyze the information and external interfaces
-> sketch a top-down wish list of needed functions
-> choose a coherent inspectable slice
-> design wished functions bottom-up with the small recipe
-> run or demonstrate the slice
-> refine the model and work list from observed discrepancies
```

Do not flatten top-down planning and bottom-up function construction into one
large template. Iterative refinement changes an intentionally simplified model
and propagates the change through data examples, behavior examples, templates,
implementations, tests, and compatibility surfaces. It is not arbitrary cleanup
of an unchanged problem.

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

## Select One Design Extension

Read only the extension that answers the unresolved question:

| Question after the base recipe | Read | Expected artifact |
| --- | --- | --- |
| Which branches, selectors, recursive positions, or delegations follow from this data shape? | [Data-Shape Template Catalog](data-shape-template-catalog.md) | a data-corresponding template |
| Which independently meaningful operations compose the result? | [Composition By Wished Operations](composition-by-wishes.md) | wished-operation contracts and one composable slice |
| Which stable roles appear across several completed designs? | [Earned Abstraction](earned-abstraction.md) | completed-design alignment, variation-role table, and candidate handoff |
| How are new problem instances generated, preserved, and proven to progress? | [Generative Recursion](generative-recursion.md) | generation, preservation, combination, and progress artifacts |
| What lost knowledge or repeated work should traversal carry? | [Accumulator Invariants](accumulator-invariants.md) | an original/current/accumulated invariant with ownership and semantic-delta checks |

Each extension refines a different design step. Select several only when their
questions are independently consequential; do not treat them as a progression or
one bundled recursion topic.

## Existing-Code Recovery (Developer Adaptation)

Use this recovery table rather than assuming the declared type is complete. The
evidence sources and compatibility obligations below adapt HtDP's artifacts to
an existing repository; they are package-owned operational guidance.

<!-- markdownlint-disable MD013 -->

| Artifact | Repository evidence | Typical contradiction |
| --- | --- | --- |
| data definition | schema, type, constructors, persisted samples | runtime contains a legacy or impossible-looking shape |
| interpretation | product copy, callers, docs, analytics meaning | two same-shaped values mean different things |
| data examples | fixtures, factories, production samples | only the happy variant has an example |
| behavior examples | tests, screenshots, API examples | expected output encodes an undocumented default |
| template | branches, selectors, traversal, delegation | catch-all hides a meaningful clause |
| completed body | implementation | code needs information absent from the data model |

<!-- markdownlint-enable MD013 -->

When evidence conflicts, keep the contradiction visible. `model` owns disputed
validity or policy; this reference shapes the implementable surface once the
meaning is accepted.

## Propagate Model Refinement

When a required case cannot be represented or a forbidden value remains easy to
construct, revise one accepted model fact and propagate it through:

```text
data definition and interpretation
-> data examples
-> behavior examples
-> template
-> implementation
-> checks
-> persisted and public compatibility surfaces
```

A type edit is not complete while older serialized values or callers still use
the prior model. Propagation is a consistency obligation, not permission for
unrelated cleanup.

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

<!-- markdownlint-disable MD013 -->

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

<!-- markdownlint-enable MD013 -->

## Source Trace

- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, official living build 9.2.0.3,
  released 2026-05-28 and audited 2026-05-28:
  Preface: Systematic Program Design
  for the ordered recipe and function/program distinction;
  Chapter 3: How to Design Programs
  for signatures, purpose, examples, templates, definitions, and tests;
  Chapter 6: Itemizations and Structures
  for mixed-data derivation; and
  Epilogue: Moving On
  for top-down work lists, bottom-up construction, feedback, and maintenance
  communication.
- The repository-recovery table, compatibility surfaces, and production artifact
  substitutions are Developer adaptations derived from the source method; they
  are not canonical HtDP artifacts.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  Section 2.1
  for wishful decomposition and
  Section 1.2
  for the distinction between procedure text and the process it generates. Data
  interpretation, templates, ordered recipe steps, repository recovery, and
  compatibility artifacts remain HtDP-derived or Developer adaptations as
  identified above.
