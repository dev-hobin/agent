# Design Recipe And Abstraction Barriers

Use this reference when a sketch must do more than name files or helpers: the
data shape, ownership, traversal, representation boundary, or wished interfaces
must carry part of the design judgment.

## Contents

- Design Pressure
- Data Definitions And Templates
- Wishful Top-Level Design
- Wished Interfaces As Barriers
- Representative Cases And Checks
- Deferred Abstractions
- Failure Checks
- Compact Example
- Conceptual Lineage

## Design Pressure

A useful sketch preserves a chain of reasoning:

```text
accepted intent
-> purpose
-> data or state definitions
-> representative cases
-> data-shaped template
-> wishful top level
-> wished interfaces and checks
-> smallest implementation item
```

Do not start with a file list. A file list records placement after the design is
known; it does not explain why the design has that shape.

## Data Definitions And Templates

A data definition does more than repeat a type name. State:

- what domain information the data represents;
- which values are valid members;
- which values are excluded or impossible;
- which variants, lifecycle states, or ownership boundaries matter;
- which fields are available at each branch or traversal point.

Derive the template from that definition. The template should expose the
structural inventory an implementation must handle:

- one branch for each meaningfully different variant;
- selectors or fields available in each branch;
- recursive or collection traversal positions;
- state transitions and the old/new values they require;
- ownership handoffs and conversion boundaries.

Merging two branches is allowed only when the accepted intent treats them the
same. Omitting a branch requires an explicit reason, such as an upstream
guarantee that makes the state unreachable.

The template is not final code. It is the smallest skeleton that makes missing
cases, hidden state, and accidental representation choices visible.

## Wishful Top-Level Design

Write the top-level operation as if the right lower-level operations already
existed. Use the vocabulary of the product contract and problem model rather
than storage, framework, DOM, transport, or mutation mechanics.

Wishful top-level design should reveal:

- the order of domain operations;
- which decisions belong at the top level;
- which details callers should not need to know;
- which missing concepts need names and contracts;
- where evidence can check the result.

Do not invent a helper only to shorten code. A wished operation earns a name
when its purpose and caller-facing assumption can be stated without describing
its body.

## Wished Interfaces As Barriers

Treat each wished interface as a proposed abstraction barrier. Record:

- purpose: what callers obtain or may assume;
- input and output shape;
- contract: preconditions, postconditions, and meaningful failure;
- owner: the component or layer responsible for the guarantee;
- hidden detail: representation or mechanism callers must not depend on;
- stop check: the smallest evidence that would falsify the contract.

An interface is too weak when callers still inspect the hidden representation.
It is too broad when unrelated policy or lifecycle decisions are bundled behind
one name. It is speculative when no representative case needs the boundary.

## Representative Cases And Checks

Choose cases before implementation shape hardens. Include only cases that
distinguish meaningful behavior:

- a normal case;
- each relevant data variant;
- a boundary or absence/default case;
- a forbidden or impossible case;
- a product-meaning case that a mechanically plausible implementation could
  get wrong.

Map cases to evidence. Unit examples are not always enough: a type, contract,
property check, runtime validation, state-transition check, UI inspection, or
human acceptance may carry the guarantee more directly.

## Deferred Abstractions

Separate three things:

1. design artifacts needed to understand the current change;
2. implementation items needed to make the accepted behavior real;
3. abstraction candidates that the sketch noticed but current evidence has not
   earned.

For each deferred candidate, state the pressure that would reopen it. Do not
promote it merely because the wished top level uses a convenient name.

## Failure Checks

A sketch is too shallow when:

- it can be reduced to "edit these files" without losing information;
- the data definition is a type name with no valid/excluded members;
- the template does not mirror the important variants or traversal shape;
- wished helpers expose no caller contract or hidden detail;
- the top level speaks in framework or storage vocabulary;
- examples all follow the happy path;
- checks prove execution but not the accepted meaning;
- deferred ideas silently enter the implementation queue.

Return to product clarification or modeling when the purpose, valid members, or
case outcomes cannot be stated without guessing.

## Compact Example

For a form-to-domain conversion, do not begin with `add mapper.ts`.

```text
Purpose: convert editable form state into valid schedule content.
Data variants: one-time | recurring; optional end date; local date/time input.
Cases: one-time, recurring without end, recurring with end, invalid interval.
Template: branch by schedule kind, normalize shared time fields, validate the
variant, construct domain content.
Wishful top level: validate(form) -> normalize(form) -> makeScheduleContent(...)
Barrier: makeScheduleContent hides the domain representation and rejects
impossible combinations.
Checks: one table row per meaningful variant and forbidden combination.
```

The concrete functions may change after repository inspection. The design
pressure should remain stable.

## Conceptual Lineage

This reference adapts procedural abstraction, data abstraction, wishful
thinking, and abstraction barriers from Abelson and Sussman's *Structure and
Interpretation of Computer Programs*, together with the data-directed design
recipe from Felleisen, Findler, Flatt, and Krishnamurthi's *How to Design
Programs*. It uses those ideas as design judgment, not as a mandatory phase
sequence.

- SICP: https://mitpress.mit.edu/sites/default/files/sicp/full-text/book/book.html
- HtDP: https://htdp.org/2026-5-28/Book/index.html
