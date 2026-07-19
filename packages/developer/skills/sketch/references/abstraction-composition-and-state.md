# Abstraction, Composition, And State

Use this reference when a sketch must choose a level of language, hide a
representation, compose reusable units, expose the process a procedure creates,
or place history. The core insight is not “add an abstraction.” It is:

> Let each level speak only through the vocabulary immediately below it, so a
> representation, process, or state choice can change without forcing every
> caller to change.

An abstraction is real only when it hides a consequential choice and leaves a
smaller, truthful contract.

## Complete Example: A Representation Barrier

Requirement: calculate and display the duration of a schedule while accepting
several storage formats.

### Wishful use

```text
label(schedule) = formatDuration(duration(schedule))
```

The top level speaks about schedules and durations, not tuples, JSON keys, or
date-library objects.

### Public vocabulary and law

```text
makeSchedule(start, end, timezone) -> Schedule
startOf(schedule)                  -> Instant
endOf(schedule)                    -> Instant
timezoneOf(schedule)               -> Timezone

law: endOf(makeSchedule(s, e, z)) == e
law: startOf(makeSchedule(s, e, z)) == s
invariant: e is not earlier than s
```

### Two representations

```text
Representation A: { start, end, timezone }
Representation B: [timezone, epochStart, epochEnd]
```

`duration` is written only with `startOf` and `endOf`. Switching A to B should
change constructors/selectors and boundary adapters, not `duration` or `label`.
That replacement test is what makes the barrier concrete. A `Schedule` type
whose callers still read `.epochEnd` is only a new name for a leaked
representation.

### Where policy lives

Validation and normalization belong to the constructor or an explicit external
adapter. The selectors do not invent fallback timezones. If callers need raw
source distinctions, the barrier must preserve them or expose a separate source
view; normalization is a loss of ability as well as a gain in guarantees.

## Three-Level Sketch

For consequential designs, write the levels explicitly:

```text
product level:
  label, reschedule, overlaps

domain representation level:
  makeSchedule, startOf, endOf, timezoneOf

mechanism level:
  JSON fields, database columns, date-library values
```

Check every dependency arrow. Product operations may use the domain vocabulary;
only the representation owner may use mechanism details. Add another level only
when it introduces meaningful primitives, combinations, or reusable names.

## Select The Specific Reference

| Unresolved question | Read | Required output |
| --- | --- | --- |
| wished top level, representation barrier, higher-order unit, closure, or conventional interface | [Abstraction Barriers And Closure](abstraction-barriers-and-closure.md) | level map, public operations/laws, hidden representation, replacement and closure checks |
| process shape, cost, state/history, identity, concurrency, streams, or event order | [Processes, State, And Time](processes-state-and-time.md) | process trace/cost or explicit history owner and ordering law |
| multiple representations, generic operations, registration, symbolic data, DSL, evaluator, or runtime boundary | [Generic Operations And Languages](generic-operations-and-languages.md) | variant-operation matrix or language vocabulary plus evaluator contract |

Read [Responsibility And Variation](responsibility-and-variation.md) instead when
the main question is who should own knowledge, collaboration, creation, or a
changing role.

## Modules As Models

A module is a useful model of an environment, not merely a folder. Fill:

```text
environment: real context and change pressure
model: represented facets and deliberately ignored facts
interface: sense exposed to users
assumptions: environmental facts required for the model to remain useful
```

Example:

```text
module: ExchangeRateQuote
environment: provider responses, currencies, timestamps, outages
model: base, quote, rate, observedAt
ignored: provider request IDs and transport headers
interface: convert(amount), age(now)
assumptions: rate is positive; observedAt uses a comparable clock
```

If a caller needs provider headers to decide freshness, either freshness is
owned by the wrong layer or the model omitted a required fact.

A coherent **principled component** may share assumptions internally and use
weak indirection. An **adaptable system** needs stronger interfaces between
components with different assumptions or replacement pressure. Do not impose
plugin-style indirection inside every cohesive unit, and do not expose internals
between independently evolving units.

## Pull, Transform, Push

Many processes can be sketched as:

```text
pull: acquire and validate external information
transform: compute a context-light domain result
push: interpret effects or update the environment
```

Example:

```text
pullOrders() -> Orders
planNotifications(Orders) -> List<Notification>
sendNotifications(List<Notification>) -> DeliveryReport
```

This split is useful when failures, retries, and tests differ by phase. Reject it
when one atomic transaction or shared-state invariant is the actual product
boundary.

## Sketch Output

```text
Top level: product operations written wishfully
Levels: vocabulary and allowed dependency direction
Barrier: public operations/laws, hidden choice, invariant owner
Replacement: alternative implementation that should leave callers unchanged
Composition: primitives, combinators, closure boundary, finalizers
Process: generated work, cost, time, failure, and ordering
Module: environment, model, interface, assumptions
State: history owner or explicit stream/log
Checks: leak, replacement, closure, trace, and order evidence
```

## Failure Diagnosis

| Symptom | Return to |
| --- | --- |
| wished function merely renames a mechanism | product vocabulary and hidden choice |
| callers assemble or inspect raw representation | barrier operations and leak check |
| composed result cannot be combined again | closure boundary and finalizer split |
| short code creates unexplained stack/buffer/order cost | process trace |
| module boundary follows directories only | environment/model/interface/assumptions |
| same call changes after prior interactions | history placement |
| new variant edits every old package | generic operation axes |
| configuration syntax has no evaluator/error semantics | ordinary data/functions or language contract |

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  black-box abstraction, data-abstraction barriers, closure, conventional
  interfaces, procedure/process distinction, generic operations, state,
  streams, and metalinguistic abstraction.
- Zachary Tellman, *Elements of Clojure*, 2019: modules as models,
  environment/model/interface/assumptions, principled versus adaptable systems,
  units of computation, and process construction.
- Hillel Wayne, *Logic for Programmers*, version 0.14.0, May 4, 2026:
  ability-guarantee tradeoffs and the separation of mathematical models from
  runtime semantics.
