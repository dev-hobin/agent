# Verifier Selection And Pass-But-Wrong Risk

Use this reference when a completion claim needs more than one evidence kind, a
green check may be irrelevant, or visible behavior can pass while an important
observer or structural guarantee degrades.

## Judgment Spine

```text
claim
-> declared observer and boundary
-> cheapest check that could falsify it
-> actual execution and provenance
-> plausible wrong implementation
-> distinguishing evidence
-> strongest supported claim + residual
```

A command result is an observation. Verification decides what claim that
observation supports.

## Split The Claim

Separate independently falsifiable claims:

- user or caller behavior;
- forbidden and boundary cases;
- data multiplicity and preservation;
- type or API contract;
- state transition and history;
- representation or ownership boundary;
- source/version compatibility;
- operational properties such as order, effects, time, space, and idempotency.

If the intended claim cannot be stated, return to `specify` or `model`. Do not
choose a convenient command first.

## Evidence Map

```text
Claim:
Observer and admitted boundary:
Verifier:
Observation:
Why it is relevant:
Counterexample coverage:
Source/version exercised:
Residual:
```

Classify evidence as direct, supporting, weak, contradicted, unavailable, or
human-owned. Never merge unavailable evidence into a passing row.

## Choose By Falsification Power

| Claim shape | Cheapest relevant verifier | Typical gap |
| --- | --- | --- |
| wiring, ownership, stale code, representation leak | focused inspection or diff | runtime external behavior |
| syntax, imports, compile-time API, package shape | typecheck, lint, build, packed artifact | dynamic input and real consumer |
| one concrete behavior | focused example | unrepresented variants |
| finite partitions and boundaries | table/parameterized check | invalid partition or omitted domain |
| generatable stable rule | property/metamorphic check | generator excludes the wrong case |
| collaboration, persistence, UI, adapter | integration or interaction check | environment variance |
| retry, order, stale, concurrency | transition/trace fixture | production scheduling and scale |
| time, space, allocation, distribution | measurement with stated model | different size/case/cost model |
| bounded exhaustive relation | model/solver/proof evidence | assumptions, scope, encoding, toolchain |
| product or visual policy | human acceptance | mechanical correctness only |

Use a stronger verifier when a weaker one admits a plausible wrong shape. Use a
weaker verifier when it is the only economical evidence, but narrow the claim.

## Execution Is Not Relevance

Ask:

- Did the fixture reach the changed branch and meaningful case?
- Did assertions observe product meaning or only absence of an exception?
- Did the command use the requested source and version?
- Did a UI check exercise interaction and state change or only initial pixels?
- Did a migration check pass through the real persistence adapter?
- Did a structural claim receive structural evidence rather than only equal
  returned values?

A green irrelevant verifier is a `verifier-gap`.

## Counterexample Families

Use the claim's observer to select a wrong shape. The table integrates the source
calibrations by failure mechanism rather than by book.

| Claim | Green proxy that can mislead | Plausible wrong implementation | Distinguishing check |
| --- | --- | --- | --- |
| transformation preserves domain values | expected output looks ordered | output drops duplicates or invents members | membership, no-additions, and multiplicity properties |
| optional states preserve meaning | happy configured case passes | missing, null, empty, and default collapse | same absence shape with different discriminator/meaning |
| property holds generally | sampled generated cases pass | generator omits one fixed boundary | inspect generator domain and add the distinguishing example |
| implication/test is strong | assertion excludes every bad case | assertion also rejects every correct implementation or passes vacuously | witness a valid instance and one violating instance |
| proof/model result establishes behavior | tool reports success | specification, arithmetic, scope, or assumptions omit product meaning | audit obligations, bounds, satisfiable witness, and observers |
| relational/storage rule matches model | projected rows look right | endpoint, `NULL`, bag duplicates, or mutation path differs | runtime-specific endpoint/multiplicity/event checks |
| numeric result is accurate | value is near a known answer | residual, location, bracket, or downstream error is wrong | name tolerance meaning and test each claimed relation |
| arithmetic refactor preserves behavior | ordinary magnitudes pass | reassociation changes inexact result or effect order | adversarial magnitudes, reverse order, effects, and scale |
| benchmark supports growth claim | sampled run is faster | input distribution or constant dominates; adversarial shape loses | state size/case/cost model and test relevant range |
| database schema behavior is preserved | row content matches | labels or function-valued predicates changed | inspect schema and execute predicates/integrity checks |
| temporal implementation is correct | each enum state is reachable | stale or duplicate event commits twice | ordered trace with stale, retry, duplicate, and concurrency |
| abstraction is safe | public tests pass | callers still depend on fields, load order, or hidden default | leak search, fake variant, and real caller rewrite |
| package/source compatibility holds | workspace tests pass | packed artifact or installed version lacks changed files | inspect tarball/fresh install and bind provenance |

A verifier for one row does not support another. In particular, location,
residual, representation, and downstream tolerances are not interchangeable.

## Formal And Search Result Boundaries

Keep sampled property evidence distinct from total specification and proof. Keep
bounded model results relative to scope/configuration and require a satisfiable
witness. Preserve exposed statuses:

```text
satisfiable | unsatisfiable | unknown | timeout | error
unbounded | feasible | proven-optimal
```

For logic/search work, distinguish no answer after complete exhaustion from
bounded unknown, timeout, error, or divergence. A later answer may exist behind
an infinite earlier branch.

## Test Design As Structural Evidence

Choose test units by public responsibility and failure-localization value, not
one file per class. Focused role tests suit stable contracts; integration evidence
suits creation, collaboration, persistence, and wiring. A fake should preserve a
collaborator role while removing irrelevant context. A mock that repeats private
calls creates an echo chamber.

Redundancy can be independent domain evidence or obsolete context. Delete it only
when the remaining tests still support the same claim. Hard-to-write tests are a
structural signal, not automatic proof that production must be generalized.

## Feedback And Stop

Use:

- `pass`;
- `implementation-fail`;
- `model-or-spec-fail`;
- `verifier-gap`;
- `blocked-environment`;
- `pass-but-wrong-risk`;
- `structural-degradation`.

Verification is complete enough when every claim is supported, narrowed, or
explicitly unverified; important wrong shapes have evidence or residuals; source
and version match; and another check would cost more than its expected
information.

## Complete Artifact

```text
Claim/evidence matrix:
Requested-versus-exercised provenance:
Counterexample family and attempted wrong implementation:
Distinguishing checks and observations:
Structural degradation, if any:
Strongest supported claim:
Unverified claims and residual risk:
```

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapters 3-6 and 9-11, pp. 23-155, for logical/runtime preservation, partial
  specifications, generated properties, proof limits, bounded models, and solver
  result states. Recorded beta defects are excluded.
- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, Chapters 2 and 9, pp. 23-50 and 226-268, for cost-effective tests,
  public responsibility, integration versus unit evidence, fakes, role checks,
  and obsolete context.
- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3:
  Prologue,
  Chapter 18,
  Chapter 23,
  Chapter 25,
  Chapter 27,
  Chapter 28,
  Chapter 29,
  Intermezzo 4, and
  Intermezzo 5
  for progressive property strength, multiplicity, schema predicates, numeric
  tolerances, order-sensitive arithmetic, and bounded performance evidence.
