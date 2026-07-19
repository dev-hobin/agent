# Verifier Selection And Pass-But-Wrong Risk

Use this reference when a completion claim depends on several kinds of evidence,
a passing check may not exercise the claim, or structural correctness matters in
addition to visible behavior.

## Contents

- Claim Before Check
- Evidence Map
- Verifier Ladder
- Execution Versus Relevance
- Pass-But-Wrong Search
- Test Design And Cost
- Structural Degradation
- Feedback Classification
- Residual Risk And Stop Checks
- Complete Evidence Example

## Claim Before Check

State the claim before selecting a verifier. "Tests pass" is an observation;
"the conversion rejects every impossible schedule variant" is a claim.

Split broad completion statements into independently checkable claims:

- product behavior;
- forbidden and boundary cases;
- type or API contract;
- transition and history behavior;
- compatibility with the requested source or version;
- representation or abstraction boundary;
- operational property such as performance, ordering, or idempotency.

If a claim cannot be stated, return to specification or modeling rather than
choosing a convenient command.

## Evidence Map

For each claim record:

```text
Claim: the narrow statement under review
Verifier: command, inspection, fixture, or human acceptance
Observation: what actually happened
Relevance: why the observation bears on the claim
Counterexample coverage: meaningful wrong shapes exercised or omitted
Residual: uncertainty that remains
```

Evidence may be direct, supporting, weak, contradicted, unavailable, or
human-owned. Do not merge unavailable evidence with passing evidence.

## Verifier Ladder

Prefer the cheapest verifier that can actually falsify the claim:

| Verifier | Best fit |
| --- | --- |
| static inspection or focused diff | locality, wiring, ownership, stale code, representation boundary |
| typecheck, lint, build, manifest check | syntax, imports, compile-time contracts, packaging |
| focused example test | one concrete behavior or regression |
| table or parameterized test | finite meaningful cases and boundaries |
| property or metamorphic check | many examples share a stable rule |
| integration or UI check | composition, rendering, persistence, external boundaries |
| state-transition or concurrency fixture | history, ordering, retry, stale events, idempotency |
| performance or resource measurement | runtime shape is part of the claim |
| model, solver, or exhaustive check | small critical rule space justifies exhaustive reasoning |
| human acceptance | the remaining question is policy, meaning, or visual judgment |

Use a stronger verifier when a weaker one can pass under a plausible wrong
implementation. Use a weaker verifier when it is the only practical evidence,
but narrow the claim and record the residual.

## Execution Versus Relevance

A verifier execution proves only that the verifier ran and produced an
observation. Check relevance separately:

- Did the fixture reach the changed branch?
- Did assertions inspect the product meaning or only absence of an exception?
- Did the build use the source and version requested by the user?
- Did a UI snapshot expose interaction and state changes or only initial pixels?
- Did a broad suite include the new boundary case?
- Did the manual inspection examine the actual generated artifact?

A green but irrelevant verifier creates a `verifier-gap`; it does not support
the broader claim.

## Pass-But-Wrong Search

For every consequential claim, imagine at least one implementation that passes
current checks while violating the intended meaning. Look for:

- missing branches whose fixtures never occur;
- fallback/default behavior that silently selects product policy;
- assertions that accept both the intended and an unintended value;
- mocks that bypass the real boundary;
- tests coupled to the implementation rather than the contract;
- source/version mismatch;
- current-state checks that miss invalid transitions;
- correct result with wrong ordering, mutation, sharing, or complexity;
- public API compatibility tested without real consumers.

When a plausible shape remains cheap to test, add the smallest distinguishing
fixture. Otherwise record it as residual risk instead of broadening the claim.

## Test Design And Cost

Tests are design evidence only when their boundary and maintenance cost remain
useful. Prefer tests that expose public responsibility and product meaning over
tests that echo private method structure.

Choose the unit by the claim:

- focused examples for stable responsibility and boundary cases;
- role or contract tests when several implementations must substitute;
- integration tests for collaborations, creation, persistence, and wiring;
- properties when many examples share a generatable rule;
- stateful fixtures when history, retry, order, or identity matters.

Do not require one test layer per class. Loose coupling may make a smaller unit
economical to test, while simple forwarding or framework glue may be better
covered by a larger behavior check. Fakes should remove irrelevant context while
preserving the collaborator role; mocks that restate call internals create an
echo chamber.

Delete or reorganize tests only when the remaining evidence still supports the
same claims. Redundancy is sometimes cheap insurance and sometimes obsolete
context that prevents a design from moving. State which claim each retained test
protects.

## Structural Degradation

Behavior may pass while the change weakens the code's ability to preserve the
same guarantee. Inspect for:

- duplicated invariant or absence/default policy;
- representation details leaking through a caller contract;
- generic abstraction without stable examples or a nameable purpose;
- hidden state, history, ordering, or ownership;
- vocabulary drifting away from the accepted model;
- a local fix that makes the next accepted requirement harder or unsafe;
- tests passing only because they mirror the new implementation.

Structural degradation is evidence for structural observation or abstraction
review. It does not automatically require refactoring now.

## Feedback Classification

Use a small, stable taxonomy:

- `pass`: the evidence supports the narrow claim;
- `implementation-fail`: relevant evidence contradicts the accepted claim;
- `model-or-spec-fail`: evidence shows the accepted meaning or case model is
  wrong or incomplete;
- `verifier-gap`: the check is missing or irrelevant to the claim;
- `blocked-environment`: the required source or environment was not exercised;
- `pass-but-wrong-risk`: current evidence passes while a plausible wrong shape
  remains;
- `structural-degradation`: behavior passes but structure weakens a relevant
  boundary or guarantee.

Classification describes the observation. The caller decides whether to
repair, remodel, add evidence, ask a human, accept residual risk, or continue.

## Residual Risk And Stop Checks

Verification is complete enough when:

- every stated claim is supported, narrowed, or explicitly unverified;
- each important forbidden or boundary case has evidence or a residual;
- actual source and version match the requested target;
- plausible pass-but-wrong shapes were attempted or recorded;
- structural claims have more than behavioral evidence when needed;
- human-owned acceptance is distinguished from mechanical checks;
- another verifier would cost more than the information it is expected to add.

Do not claim total correctness from a finite evidence set. State the strongest
claim justified now.

## Complete Evidence Example

```text
Claim: recurring schedules without an end date remain valid.
Verifier: focused table test with one-time, recurring-open, recurring-bounded,
and invalid-interval rows.
Observation: all rows produce the expected domain result.
Relevance: each semantic variant crosses the new conversion boundary.
Pass-but-wrong search: a mapper could still ignore timezone normalization.
Residual: timezone behavior remains unverified and is not included in the
supported claim.
```

Now attempt a wrong implementation that always emits `recurring-open` whenever
`endDate` is absent. It passes the open-recurring row but also misclassifies a
one-time schedule whose UI omitted an optional display field. Add a one-time row
with the same absence shape but a different recurrence discriminator. This
fixture fails the plausible wrong rule while remaining at the public conversion
boundary.

Map the broader completion claim:

| Claim | Verifier | What it can still miss |
| --- | --- | --- |
| semantic variants convert correctly | focused table test | persisted legacy shapes not in the table |
| public type accepts intended callers | typecheck plus real caller build | runtime external input |
| legacy saved schedules remain readable | migration fixture through persistence adapter | unknown production corruption |
| UI shows the converted meaning | interaction test or manual run | timezone/environment variance |
| package contains the changed source | packed-tarball inspection and fresh install | registry propagation delay |

If only the first row is executed, report only the first claim. The correct
result is a narrower supported statement, not an unqualified “done.”

## Source Trace

- Hillel Wayne, *Logic for Programmers*, version 0.14.0, May 4, 2026:
  strong and weak tests, partial specifications, structural properties,
  property-based testing, contracts, and proof limitations.
- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, version 2.2.2, 2024: chapters 2 and 9 on cost-effective tests,
  avoiding implementation echo, choosing units, unit versus integration tests,
  context independence, fakes, role verification, and obsolete-test removal.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs, Second Edition*, MIT Press, 2018:
  representative examples and tests as successive constraints in a design
  recipe.
