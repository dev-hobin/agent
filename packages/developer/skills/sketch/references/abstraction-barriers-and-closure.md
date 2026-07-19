# Abstraction Barriers And Closure

Use this reference to design a truthful level of language. A barrier separates
programs that *use* a concept from code that *represents* it. Closure determines
whether the concept's combination mechanism can build values at every useful
scale.

## Wishful Decomposition

Start with the result in domain vocabulary:

```text
checkout(cart, customer):
  priced = priceCart(cart, customer.pricingContext)
  payable = applyCredits(priced, customer.credits)
  return authorizePayment(payable.total, customer.paymentMethod)
```

For each wished operation state:

```text
caller-visible result
normal and failure examples
details the caller should stop knowing
owner of validation/invariant
smallest replacement or behavior check
```

Wishful code exposes possible units; it does not prove they deserve public
interfaces.

## Build A Data Barrier

Use this construction rule:

1. Name the domain value and interpretation.
2. List only supported constructors, selectors, predicates, and domain
   operations.
3. State laws callers may rely on.
4. Identify the one owner of validation, normalization, and simplification.
5. Write two materially different representations.
6. Rewrite one real caller using only the public vocabulary.
7. Search for remaining representation primitives outside the owner.

Worked rational-like value:

```text
Rate = conversion relationship between two quantities

makeRate(numerator, denominator)
numeratorOf(rate)
denominatorOf(rate)
multiplyRate(left, right)

law: denominatorOf(makeRate(n, d)) > 0
law: Rate(1, 2) and Rate(2, 4) have equal domain meaning
```

Representation A reduces at construction. Representation B stores raw terms and
reduces at selection. `multiplyRate` must not change between them. The barrier
preserves freedom to decide *when* normalization happens.

Reject the barrier when no choice is hidden, callers still require raw layout,
or the public operations are just field aliases with no stable laws.

## Procedures As Values

A higher-order boundary is justified when the varying role has a stable
contract.

```text
aggregate(items, base, project, combine)
```

Here `project` and `combine` are values the algorithm can receive without
knowing their bodies. Record their preconditions, effects, error behavior, and
cost assumptions. Passing a callback does not make hidden mutation or retries
irrelevant.

## Closure

Suppose a UI layout language has:

```text
Panel = Text(content) | Image(src) | Row(List<Panel>) | Column(List<Panel>)
```

`Row` and `Column` accept `Panel` values and produce `Panel`, so primitive and
compound panels combine uniformly:

```text
Column([
  Text("Order"),
  Row([Image("item.png"), Text("2 × mug")])
])
```

Closure check:

```text
unit predicate: what counts as Panel
closed constructors/combinators: Panel... -> Panel
observers/finalizers: Panel -> outside world
invalid nesting: combinations forbidden by product meaning or cost
```

Rendering is a finalizer `Panel -> Pixels`; pretending it is another `Panel`
would blur the boundary. Do not make every method chainable. Preserve closure
only for the central composition unit.

## Conventional Interfaces

A conventional interface lets independently designed stages exchange a shared
shape:

```text
enumerateOrders : Query -> Sequence<Order>
eligible        : Sequence<Order> -> Sequence<Order>
invoice         : Sequence<Order> -> Sequence<Invoice>
sum             : Sequence<Invoice> -> Money
```

The shared sequence contract enables composition, but record whether stages are
eager or lazy, ordered or unordered, finite or unbounded, single-use or
replayable. “Iterable” alone may hide operationally incompatible processes.

## Barrier Review Artifact

```text
Domain meaning:
Use-level operations:
Representation-level operations:
Concrete representations A and B:
Laws and invariant owner:
Real caller rewritten:
Leak search:
Closure unit and closed operations:
Observers/finalizers:
Operational assumptions:
Decision or unresolved evidence:
```

## Failure Diagnosis

- A new representation changes every caller: the barrier is too low or leaked.
- Public operations mention JSON keys, indexes, providers, or library types: the
  use level is contaminated by representation.
- A combinator result needs a second assembly API: closure is missing or the
  units are not genuinely uniform.
- A closed API includes I/O as if it returned the same value world: split the
  finalizer.
- A conventional interface hides eager materialization or ordering: add the
  operational contract or choose a different interface.

## Source Trace

- *Structure and Interpretation of Computer Programs*, Second Edition,
  sections 1.1-1.3 and 2.1-2.2: black-box procedures, wishful thinking,
  higher-order procedures, data abstraction, abstraction barriers, closure, and
  conventional interfaces.
