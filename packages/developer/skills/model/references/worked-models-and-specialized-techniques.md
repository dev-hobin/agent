# Worked Models And Specialized Techniques

Use this reference to calibrate the artifacts in
[Problem Modeling](problem-modeling.md). Each technique starts from a different
uncertainty. Select the smallest model that can expose the consequential mistake.

## Boolean Policy: Access Rule

Prose: “Editors can publish their own drafts, and admins can publish anything,
unless the document is archived.”

```text
domain: user in Users, document in Documents
facts:
  role(user) in {viewer, editor, admin}
  owner(document) in Users
  status(document) in {draft, published, archived}

canPublish(user, document) =
  status(document) != archived
  && (role(user) == admin
      || (role(user) == editor && owner(document) == user))

forbidden counterexample:
  canPublish(user, document) && status(document) == archived
```

| archived | admin | editor owns | result |
| --- | --- | --- | --- |
| yes | any | any | false |
| no | yes | any | true |
| no | no | yes | true |
| no | no | no | false |

Unknown: whether an editor may republish a published document. Keep it human-
owned because the prose names drafts only. Verify the four partitions and one
real authorization integration; do not leave the guarantee in a UI guard alone.

## Relational Data And Constraints

Requirement: each department has at most one active manager at a time, and every
manager row refers to existing entities.

```text
Employee(id)
Department(id)
Management(employeeId, departmentId, start, end?)

all m in Management:
  some e in Employee: e.id == m.employeeId
  some d in Department: d.id == m.departmentId
  m.end is absent || m.start < m.end

all a, b in Management where a != b
  && a.departmentId == b.departmentId:
    intervalsDoNotOverlap(a, b)
```

The last property may require an exclusion constraint, serialized transaction,
or application check plus locking depending on the database. A nullable `end`
needs an explicit open-interval meaning. Exercise historical, current, future,
overlapping-boundary, and missing-foreign-key instances.

## Replacement Contract

Old API accepts any non-empty timezone string and returns a schedule or a domain
error. New API accepts only a timezone enum and throws on failure.

```text
old.Pre: nonEmpty(timezone)
new.Pre: timezone in KnownTimezone

old.Pre => new.Pre       // false for a legacy but non-empty timezone
new.Post => old.Post     // false if exceptions are not old domain errors
```

The replacement is unsafe for old callers even if current tests use only known
zones. Repair by adapting legacy strings, broadening the new precondition, or
making the break explicit.

## Temporal Model: Retried Payment

Snapshots do not distinguish a fresh approval from a duplicated response.

```text
states: Created | Authorizing(attempt, requestId) | Authorized(paymentId)
        | Failed(reason)
initial: Created

Authorize(id): Created -> Authorizing(1, id)
Retry(id2): Authorizing(n, _) -> Authorizing(n + 1, id2)
Approved(id, payment):
  Authorizing(_, id) -> Authorized(payment)
Approved(staleId, _):
  Authorizing(_, currentId) -> unchanged when staleId != currentId

safety: authorization is recorded at most once
progress assumption: a live provider eventually responds and retries are finite
```

Verification needs stale, duplicated, reordered, and retry traces, not one test
per enum value.

## Proof Boundary: Quotient And Remainder

```text
qr(x, y) -> (q, r)
requires: x >= 0 && y > 0
ensures: q * y + r == x; 0 <= r < y; q >= 0

q = 0
r = x
while r >= y:
  r = r - y
  q = q + 1
```

Invariant: `q * y + r == x`.

- initialization: `0 * y + x == x`;
- preservation: `(q + 1) * y + (r - y) == q * y + r`;
- exit: the guard and invariant imply the required remainder relation;
- termination: non-negative integer `r` decreases by positive `y`.

The proof still assumes mathematical integer semantics and complete
postconditions. Overflow or a missing performance requirement can invalidate the
product claim without invalidating this proof.

## Constraint Propagation

Before a solver, a relation may itself be the design. Temperature conversion is
not inherently one-way:

```text
9 * celsius == 5 * (fahrenheit - 32)
```

A propagation network can accept either value, derive the other, forget a
retracted value, and reject inconsistent facts. Its model must identify
connectors, relations, who asserted each value, and conflict behavior. This is
useful when information may arrive from several directions; an ordinary
`toFahrenheit(celsius)` function is clearer when direction is fixed.

The core insight is that a relation states what values must agree, while a
procedure also chooses direction and evaluation. Do not import propagation
machinery merely to make a one-way calculation appear declarative.

## Constraint Solver: Shift Assignment

```text
variables: assigned(task) in Workers
hard constraints:
  every task has exactly one worker
  worker skill covers task requirement
  overlapping tasks use different workers
objective: minimize total preference penalty
equivalence: assignments with equal penalty are acceptable
```

Test a known satisfiable fixture, a known impossible fixture, and two equal
optima. `unknown` or timeout is neither a solution nor proof of impossibility. A
bad weight can yield a mathematically optimal but operationally absurd plan.

## Logic Programming: Dependency Query

```text
depends(api, domain)
depends(ui, api)

reachable(a, b) if depends(a, b)
reachable(a, c) if depends(a, b) and reachable(b, c)
```

Query `reachable(ui, X)` should yield `api` and `domain`. State whether different
paths yield duplicate answers and how cycles terminate. If every product query
must terminate, a restricted deductive language may be better than a general
backtracking language.

## Planning: Rolling Server Upgrade

```text
state: set of Server(name, online, version)
initial: all online at version 1
goal: all online at version 3
invariant: at least one server is online
actions:
  takeOffline(server) when another server remains online
  upgrade(server) when server is offline
  bringOnline(server)
cost: one per action, plus optional online-version-skew penalty
```

Show every intermediate state so the invariant can be checked. A shortest plan
under action count may not minimize risk; changing the cost model can legitimately
change the preferred plan. Valid and preferred plans are different claims.

## Selection And Stop

| Uncertainty | Artifact | Stop |
| --- | --- | --- |
| ambiguous rule | predicate + counterexample + cases | every partition has one result or visible policy gap |
| data integrity | relations + quantified constraints | known valid and invalid instances differ |
| compatibility | old/new pre/post implications | callers are covered or breaking scope is explicit |
| history/order | transition model + safety/progress | stale, retry, duplicate, reorder are defined |
| exhaustive implementation claim | contract + invariant/proof obligations | assumptions and remaining obligations are explicit |
| allocation/search | variables, constraints, objective | satisfiable, impossible, alternate-optimum fixtures behave as modeled |
| inference | facts, rules, query semantics | expected and cyclic cases are explained |
| action sequence | state, action, invariant, goal, cost | each intermediate state is valid |

## Source Trace

- Hillel Wayne, *Logic for Programmers*, version 0.14.0, May 4, 2026:
  predicates, contracts and replacement, formal proof boundaries, relational
  data and constraints, temporal models, solvers, logic programming, planning,
  and answer-set reasoning. Examples are adapted for product modeling.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  state, constraints, and explicit evaluation models.
