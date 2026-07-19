# Abstraction Review Worked Examples

Use these examples to calibrate the review output. Keep user-facing answers
shorter unless the user asks for the full card.

Examples are abbreviated to show the main decision move. For a serious review,
also include the field-card sections for source and confidence, contract, hidden
detail, evidence and gaps, and open consequences.

## Contents

- Example Selector
- Skill Update Self-Review
- Provider Integration
- Retry Helper From Repeated Movement
- Optional Default Semantics
- Symbolic Expression Rewrite
- Stateful Account
- Chainable Builder

## Example Selector

Use the smallest example that matches the candidate shape. Do not read the full
file unless calibration is still unclear.

| Candidate shape | Example to read |
| --- | --- |
| skill, workflow, recipe, or instruction update | Skill Update Self-Review |
| generic operation, plugin/provider, type/case expansion | Provider Integration |
| repeated helper movement with stable roles | Retry Helper From Repeated Movement |
| optional, nullable, defaulted, or legacy value meaning | Optional Default Semantics |
| expression, formula, DSL, parser, or rewrite rule | Symbolic Expression Rewrite |
| local state, hidden history, audit, replay, or concurrency | Stateful Account |
| fluent API, builder, pipeline, or chainable surface | Chainable Builder |

## Skill Update Self-Review

```text
Candidate:
  abstraction-review skill update with field-card, recipe-cards, repair-table,
  and worked examples

Pressure:
  The first version only classified candidates by layer. It could still collapse
  into polished advice without a concrete artifact or stop check.

Wish:
  A future agent can review an abstraction by producing a contract, hidden
  detail, output artifact, observable stop check, and unresolved consequences.

Layer:
  Boundary + Engine + Run

Recipe:
  Data Abstraction Boundary for owned responsibility
  Dispatch Registration for reference routing
  Procedure -> Process Reality Check for whether agents will actually use it

Input artifact:
  SKILL.md procedure, reference list, and current reference files

Derivation:
  core question -> public contract
  references -> conditional reference choices
  realistic invocation -> run evidence

Output artifact:
  skill boundary:
    owns abstraction promotion judgment
    does not create the design surface, choose timing, implement, or perform
    final completion review
  reference selector:
    field-card for substantial review
    recipe-cards for construction rules
    repair-table for failed stop checks
    worked-examples for calibration

Stop:
  Given a proposed API, workflow, or skill update, the agent produces a review
  card with output artifact and stop check instead of only saying "looks good."

Decision:
  keep with calibration gap if no realistic invocation has been run yet
  revise-surface if the skill cannot say when to read each reference
  revise-model if the review invariant or condition space is unclear
```

## Provider Integration

```text
Candidate:
  charge(provider, amount) as a generic operation

Pressure:
  Each new provider edits old switch statements and leaks provider fields.

Layer:
  Engine + Boundary

Recipe:
  Dispatch Registration, then Data Abstraction Boundary

Input artifact:
  providers x operations table

Derivation:
  each current branch -> one (provider, operation) method cell

Output artifact:
  registerProvider(provider, { charge, refund })
  charge(provider, amount)
  unsupported refund policy

Stop:
  add fake provider without changing caller code

Decision:
  keep if unsupported cases are explicit; otherwise revise-surface
```

## Retry Helper From Repeated Movement

```text
Candidate:
  withRetry(operation, shouldRetry, delayStrategy, maxAttempts)

Pressure:
  Several request functions repeat the same movement: run operation, inspect
  failure, wait, retry, eventually fail.

Layer:
  Language + Unit

Recipe:
  Movement Pattern Extraction, then Procedure -> Process Reality Check

Input artifact:
  cases:
    fetchProfile, submitPayment, syncInventory
  common movement:
    attempt -> classify failure -> delay -> retry or give up
  variation roles:
    operation, shouldRetry, delayStrategy, maxAttempts

Derivation:
  common movement becomes the helper body
  variation roles become parameters or strategy callbacks

Output artifact:
  withRetry signature
  role table for existing cases
  process note for total attempts and delay behavior

Stop:
  old cases are simple calls and a new retrying operation needs no new branch in
  withRetry

Decision:
  keep if variation roles are stable; reject if each case has different
  responsibility or product semantics
```

## Optional Default Semantics

```text
Candidate:
  readConfig("timeout") returns configured timeout or fallback

Pressure:
  Missing values are handled differently by producers and consumers.

Layer:
  Law + Boundary

Recipe:
  Data Abstraction Boundary, then Meaning-Preserving Path

Input artifact:
  states: missing / null / empty / configured / legacy
  owner: producer / constructor / consumer fallback

Derivation:
  decide which states preserve the same meaning and which are unsupported

Output artifact:
  absence/default policy:
    missing means <x>
    null means <y>
    fallback owner is <layer>
    consumer fallback is defensive unless explicitly owned

Stop:
  each state has one meaning, one enforcement layer, and one test target

Decision:
  revise-model if missing/null/legacy meanings are not decided yet
```

## Symbolic Expression Rewrite

```text
Candidate:
  simplify(expression)

Pressure:
  Rewrite rules are tied to list indexes or string positions.

Layer:
  Language + Boundary

Recipe:
  Notation As Data, then Data Abstraction Boundary

Input artifact:
  expression cases: number, variable, sum, product

Derivation:
  cases -> predicates; parts -> selectors; new expressions -> constructors

Output artifact:
  isSum, addend, augend, makeSum
  isProduct, multiplier, multiplicand, makeProduct

Stop:
  rewrite rules use selectors/constructors, not raw layout

Decision:
  keep after constructors own simplification policy; otherwise split policy
```

## Stateful Account

```text
Candidate:
  makeAccount(initialBalance).withdraw(amount)

Pressure:
  Same method call can produce different results after previous calls.

Layer:
  Time

Recipe:
  History Placement

Input artifact:
  required history: transaction sequence
  sufficient summary: current balance
  interaction model: single actor or concurrent actors

Derivation:
  decide whether balance can be hidden local state or must be explicit stream/log

Output artifact:
  balance is hidden summary of accepted transactions
  transaction log is required if audit/replay/collaboration matters

Stop:
  caller contract states whether history is hidden or explicit

Decision:
  keep for single-actor local state; revise-model if concurrency/audit matters
```

If concurrent withdrawals appear, run Event Order Protection:

```text
order law:
  read balance, decide sufficient funds, write new balance is one protected unit

stop:
  forbidden interleaving cannot violate balance invariant
```

## Chainable Builder

```text
Candidate:
  query.where(...).orderBy(...).limit(...).execute()

Pressure:
  Most operations compose, but execute leaves the query world.

Layer:
  Unit + Boundary

Recipe:
  Closure Composition Unit

Input artifact:
  query unit, closed operations, finalizers

Derivation:
  mark where/orderBy/limit as Query -> Query
  mark execute as Query -> Result

Output artifact:
  closed query builder vocabulary
  explicit finalizer boundary

Stop:
  all builder operations return Query; execute is intentionally outside

Decision:
  keep if finalizer is not hidden as another closed operation
```
