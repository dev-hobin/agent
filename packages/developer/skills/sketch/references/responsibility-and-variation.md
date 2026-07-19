# Responsibility And Variation

Use this reference when a real change exposes misplaced knowledge, repeated
arguments, data clumps, conditional dispatch, type transitions, object creation,
or uncertainty about which collaboration should absorb variation.

## Begin With The Change

Do not design toward classes, polymorphism, or a factory in advance. State the
accepted change and show where the current code resists it. A smell identifies a
point of attack, not the final architecture.

Keep a simple concrete solution when it remains understandable and cheap to
change. A more elaborate design is justified by localized future change, not by
lower line count or the prestige of a pattern.

## Inventory Responsibilities

Describe what the current unit:

- knows;
- calculates or decides;
- coordinates;
- creates;
- sends to collaborators;
- changes for independent reasons.

Write wishful pseudocode in messages rather than field manipulation. A message
asks a receiver that owns relevant knowledge to do work. Repeatedly pulling data
out of one object so another can decide what it means is evidence of misplaced
responsibility.

## Smells As Design Evidence

Inspect smells on the accepted change path:

- a value repeatedly passed through methods that already belong to one concept;
- several fields or parameters that move as a data clump;
- conditionals that select behavior by a stable domain variant;
- methods that mostly inspect another unit's data;
- a coordinator that both chooses a variant and implements each variant;
- object construction mixed into domain collaboration;
- a chain of navigation that exposes collaborator structure.

The sketch should show how one concrete movement would make the change local.
Do not clean unrelated smells to make the design look complete.

## Extracting A Responsibility

A candidate unit is credible when data and behavior form a coherent concept with
its own reason to change. State:

```text
Responsibility: what the unit owns
Knowledge: data or history required to fulfill it
Messages: minimal caller-visible protocol
Hidden detail: mechanics callers stop knowing
Creation: who constructs or selects it
Representative change: change that becomes local
Rejected placement: why the old owner was wrong
```

Move callers gradually when old and new forms can coexist. The implementation
protocol owns those edits; this reference only shapes the target collaboration.

Immutability often makes an extracted value easier to share and reason about,
but it is not mandatory when identity or local history is the product model.

## Variation And Substitution

Use polymorphism only when variants share a real role and callers can send the
same message without knowing the concrete type. State the role contract and
unsupported cases.

A subtype or implementation must preserve caller expectations. A special case
that raises, changes return meaning, or requires stronger preconditions may not
belong under the common role. Model old and new contracts before claiming safe
substitution.

Conditionals are not categorically wrong. Keep them when the variation is local,
finite, readable, and unlikely to grow independently. Replace them when new
accepted variants repeatedly force old behavior owners to change.

## Type Transitions

When one domain value leads to another kind of value, model the transition as a
domain relation rather than scattered numeric or string manipulation. State:

- current type and next type;
- operation or event causing the transition;
- preserved meaning;
- boundary or terminal behavior;
- whether the target selects itself or a collaborator decides.

Transitions that violate a common role may require a narrower protocol or an
explicit result type instead of inheritance.

## Object Creation And Factories

Creation policy belongs at a boundary where variant information is available.
Keep domain collaborators dependent on the role they use, not on class-name or
registration mechanics.

Factory designs form a continuum: a concrete conditional, configurable mapping,
registration, self-registration, or automatic discovery each moves knowledge
and adds operational cost. Compare:

- who knows available variants;
- how a new variant is introduced;
- unsupported and duplicate registration behavior;
- load order, reflection, naming, and deployment assumptions;
- testability and failure visibility.

Choose the least powerful mechanism that satisfies real extension pressure.
Pushing construction to the edge often removes the need for an elaborate
factory inside the domain.

## Dependency Direction And Navigation

High-level product behavior should depend on stable roles rather than concrete
variant mechanics. Inject a dependency when it represents a caller-chosen
collaborator, not merely to make every object configurable.

Long navigation chains reveal structural knowledge. Prefer asking the first
meaningful collaborator for the domain result, but do not add forwarding methods
that only hide an unchanged data path. The receiving responsibility must become
more coherent.

## Tests As Role Evidence

Choose units to test by public responsibility and cost of failure, not by one
test file per class. Use integration evidence for collaborations and focused
unit evidence for stable role contracts or difficult cases.

Fakes are useful when they express the same role without importing irrelevant
context. Tests that echo implementation structure, duplicate the same behavior
at every layer, or preserve obsolete context inhibit redesign.

## Complete Example: Move Discount Knowledge

Accepted change: subscriptions now support a partner discount in addition to a
student discount. Current `Checkout` receives `student`, `partner`, `country`,
and `subtotal`, then selects and calculates every discount itself.

### Inventory the current owner

```text
Checkout knows:
  customer flags, discount precedence, formulas, country exclusions
Checkout decides:
  which discount applies
Checkout coordinates:
  pricing, payment, receipt
Checkout changes when:
  discount policy, payment flow, or receipt flow changes
```

The problem is not the conditional alone. Discount knowledge and behavior have
a different reason to change from checkout coordination.

### Write wished messages

```text
discount = discountPolicy.for(customer, country)
payable = discount.applyTo(subtotal)
checkout.charge(payable)
```

Candidate responsibility:

```text
Responsibility: choose and apply the accepted discount policy
Knowledge: eligibility, precedence, exclusions, calculation
Messages: for(customer, country); applyTo(money)
Hidden detail: flags and formula selection
Creation: composition root supplies current policy set
Representative change: add partner eligibility and formula locally
```

If student and partner discounts share `applyTo(Money) -> Money` with the same
preconditions and result meaning, they may honor one role. If partner discount
requires an asynchronous provider lookup, it cannot silently substitute for a
pure discount. The boundary may instead return an eligibility decision or move
the lookup to the pull phase.

A local finite rule table may remain clearer than a class per discount. Add a
factory or registry only if creation or extension pressure is real. Constructing
the policy set at the edge keeps `Checkout` independent without inventing
discovery.

Smallest implementation surface:

```text
1. characterize current student behavior with responsibility-level examples
2. introduce DiscountPolicy behind the existing result
3. move one policy calculation while keeping Checkout behavior green
4. add partner behavior through the same caller-visible contract
5. inspect whether the role remains coherent; stop at the stable landing
```

This reference shapes the collaboration. The direct execution protocol owns the
sender-by-sender mutation, and `abstraction-review` decides whether the candidate
is stable enough to keep.

## Sketch Output

```text
Change pressure: accepted change exposing the design issue
Current responsibility inventory: knows, decides, coordinates, creates
Point of attack: concrete smell on the change path
Wished messages: collaboration in domain language
Candidate ownership: data, behavior, hidden detail, reason to change
Variation model: role, variants, substitution and unsupported cases
Creation boundary: selection knowledge and factory tradeoff
Checks: behavior, role, integration, and pass-but-wrong cases
First item: smallest implementation step
Deferred: patterns or variants not yet supported by evidence
```

## Failure Checks

- a pattern or class hierarchy is selected before the change is stated;
- responsibility is inferred from duplicated syntax alone;
- an extracted object has no knowledge or reason to change of its own;
- polymorphism hides incompatible contracts;
- a factory solves hypothetical discovery or registration needs;
- dependency injection adds configuration without isolating real variation;
- navigation is hidden by forwarding methods without moving responsibility;
- tests freeze current internals rather than verify roles and behavior.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, version 2.2.2, 2024: chapters 3-9 on listening to change, smells and
  points of attack, responsibility extraction, argument removal, immutability,
  Liskov substitution, conditional-to-polymorphic movement, type transitions,
  factories, wishful pseudocode, dependency inversion, Law of Demeter, creation
  at the edge, and responsibility-focused testing.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  multiple representations, generic operations, data-directed programming, and
  additivity.
- Zachary Tellman, *Elements of Clojure*, 2019: indirection cost, module
  assumptions, and the distinction between cohesive components and adaptable
  interfaces.
