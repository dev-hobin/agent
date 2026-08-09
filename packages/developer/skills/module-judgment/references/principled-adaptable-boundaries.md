# Principled And Adaptable Boundaries

Use this reference when concrete responsibilities may belong in one cohesive
component or behind a longer-lived interface. It judges shared assumptions,
purpose, independent participants, replacement pressure, interface collapse,
and calcification without assuming that either cohesion or adaptability always
wins.

## Accepted Judgment Context

Supply responsibilities, purpose, assumptions, failure modes, callers and
participants, deployment and replacement cycles, current interface, credible
future pressure, and one change expected to stay local.

## Two Boundary Pressures

```text
principled component:
  responsibilities share purpose, assumptions, failure modes, and change owner
  local comprehension may justify weaker indirection

adaptable boundary:
  participants, purposes, deployments, or replacement cycles change independently
  a stronger interface lets each side vary without shared implementation knowledge
```

The practical system often needs both:

```text
short-lived cohesive components
separated where independent pressure justifies longer-lived interfaces
```

An interface used only by one fixed purpose may collapse into an
implementation-shaped mirror. A public interface exposed too early may calcify
before its sense and observers are stable.

## Pressure Map

| Responsibility | Purpose | Assumptions | Failure mode | Change owner | Deployment/replacement cycle |
| --- | --- | --- | --- | --- | --- |

Group rows that share the consequential columns. Consider separation only where
the columns diverge enough that co-change creates repeated coordination or where
one side must be replaceable under a smaller contract.

## Worked Case: Import And Pricing

A product import flow performs:

1. acquire supplier rows;
2. decode and validate product facts;
3. calculate market-specific prices;
4. persist admitted products.

Pressure map:

```text
acquire/decode:
  assumptions: supplier schema, encoding, availability
  failure: unavailable or malformed input
  change owner: integration team

price calculation:
  assumptions: market rules, currency, promotions
  failure: invalid business price
  change owner: commerce policy

persist:
  assumptions: storage transaction and identity
  failure: partial or conflicting write
  change owner: data platform
```

Judgment:

- acquire and decode share supplier assumptions and may form one principled edge;
- pricing has a different purpose and change owner and deserves a smaller admitted
  product interface;
- persistence owns transaction behavior and should not leak storage fields into
  pricing;
- separate interfaces are justified by independent assumptions, not by a desire
  for more layers.

Fake change:

```text
supplier changes file encoding -> pricing remains unchanged
pricing adds a promotion rule -> acquisition remains unchanged
```

If both fail, the claimed boundaries are not yet adaptable.

## Counterexample: One-Team One-Purpose Wrapper

One cohesive module and one caller deploy together. A wrapper repeats every
method and data field without hiding policy, representation, failure, or
replacement choice. The interface adds navigation and compatibility obligation
without independent pressure. Collapse or keep it local until a stable contract
is observable.

## Calcification Check

Before exposing a boundary beyond local control, state:

```text
independent participants:
stable caller purpose:
admitted observers:
compatibility duration:
replacement pressure:
local maturation evidence:
cost if the current mistake becomes permanent:
```

External exposure is a timing cost, not proof of abstraction quality.

## Artifact

```text
Responsibilities and pressure map:
Shared assumptions and failure modes:
Independent participants and cycles:
Current interface and hidden choice:
Expected-local fake changes:
Collapse risk:
Calcification risk:
Keep together / separate / mature locally decision:
```

## Stop And Separation

Stop when each boundary follows a concrete divergence or shared pressure, fake
changes stay local where promised, and external exposure has a stable enough
sense to justify calcification. Do not add a boundary whose only evidence is a
pattern name.

This reference does not invent original operations, decide implementation order,
or prescribe which external capability owns unresolved design or timing work.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 89-95, for principled components, adaptable
  systems, shared assumptions, independent participant pressure, interface
  collapse, local maturation, and public-interface calcification.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Sections 1.1-1.3 and 2.1, for levels of language, procedural and data
  abstraction, and hidden implementation choice.
