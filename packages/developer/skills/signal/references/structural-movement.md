# Structural Movement

Use this reference when duplication, parallel branches, repeated tests, code
smells, or a model-code mismatch suggests movement but does not yet justify an
abstraction or implementation plan.

It extends `signal` at comparison and falsification: choose one pair, expose one
difference with one behavior-preserving observation move, then classify. It does
not promote the resulting candidate or continue a refactoring sequence.

## Central Question

What is actually moving in the evidence, and what smallest observation could
distinguish incidental similarity from a durable concept?

Structural movement is discovered from current behavior and pressure:

```text
correct-enough concrete behavior
-> an actual requested change or accepted model mismatch
-> a selected comparison and smallest meaningful difference
-> a behavior-preserving observation experiment
-> no-signal | horizontal | vertical | ambiguous
```

The final classification is this leaf's result. Performing the movement,
approving the candidate, choosing its timing, and designing a later object model
belong elsewhere.

## Establish Observable Pressure

Do not manufacture a future requirement. State the current request, invariant,
or mismatch and identify where the existing arrangement resists it. Code that
was appropriate for a previous requirement may become awkward only after new
evidence arrives.

A simple concrete implementation with temporary duplication can be a strong
baseline when it is understandable and protected by relevant examples. Before
simplifying parallel cases, ask whether the data definition and problem model are
stable enough that the repeated responsibilities are known; model discrepancy is
not abstraction evidence. Visible duplication without current pressure is not an
instruction to refactor. Return `no-signal` when the behavior is cheap to change
and no accepted claim is being inhibited.

## Select The Comparison

Choose two artifacts that are most alike by one meaningful basis:

- responsibility or user-visible result;
- domain vocabulary or data interpretation;
- state transition or failure mode;
- call shape, message sequence, or policy;
- test scenario, UI state, or model element.

Then name one smallest difference. Sameness locates a comparison; difference
carries the design information. Comparing every duplicate at once usually hides
which difference is incidental and which preserves product meaning.

## Form A Falsifying Small Move

Name the smallest behavior-preserving movement that would make the selected
difference easier to inspect. Typical candidates align one branch, expression,
parameter, message, local name, or test shape.

The move is an observation experiment, not a command. Record:

```text
Baseline behavior: the claim intended to stay true
Selected pair: the two comparable artifacts
Smallest difference: one concrete distinction
Proposed movement: one locally reversible alignment
Relevant check: evidence that could detect behavior drift
Revealing result: what would support or reject the suspected structure
```

If the relevant evidence is missing, return `needs-evidence`. Do not rewrite
tests merely so a proposed refactor can remain green. “Behavior-preserving” must
name the relevant semantics: reassociation, traversal order, effects, failure
versus divergence, or a new complexity class can make an apparently structural
alignment observable.

## Catalog Moves Are Experiments

Use familiar tidyings as candidate observation moves, not automatic cleanup:

- flatten a nested condition to a guard only when the condition governs all of
  the remaining body and return/failure behavior is equivalent;
- delete suspected dead code only after static and scoped runtime evidence;
  silence in telemetry is bounded negative evidence, not proof of absence;
- normalize one symmetry only when representational difference does not encode a
  product, ordering, or failure difference;
- introduce a wished interface over the old implementation as a reversible
  compatibility seam, not as proof of a durable public abstraction;
- change reading or cohesion order only while preserving declaration, data, and
  evaluation dependencies;
- introduce explaining names or explicit parameters only after the represented
  meaning and effect boundary are understood;
- chunk or extract when purpose and interaction are bounded, but inline toward
  one pile when fragmentation itself hides the process;
- preserve a nonredundant comment when code cannot carry the reason, external
  constraint, or known coupling honestly.

Each move must end in a locally explainable comparison. The catalog does not
supply the accepted pressure, verifier, or next destination.

## Horizontal Movement

Classify movement as horizontal when alignment stays at the current level:

- branches or expressions gain a consistent shape;
- names, parameters, or messages become comparable;
- no independent policy, invariant, or reason to change remains;
- the movement stays local and reversible.

A stable landing is useful evidence: the code is green, understandable, safe to
pause, and newly comparable. It is not permission to continue toward a
predetermined design. A structural template may expose more selectors or
recursive candidates than the completed purpose needs; an explicit purpose-based
omission is not missing movement. Re-select the closest pair from the new state.

## Vertical Movement

Classify a candidate as vertical only when a nameable unit survives horizontal
alignment, such as:

- a responsibility with its own reason to change;
- a policy with independent cases;
- an invariant-bearing representation boundary;
- a role that several implementations can honor;
- state or history with a clear owner;
- a conversion or type transition with a caller contract.

Return the concrete candidate, pressure, hidden detail, callers, invariant risk,
and missing evidence. `abstraction-review` decides whether the candidate is
stable. Similarity alone does not justify a helper, class, strategy, factory, or
public interface.

## Ambiguous Movement

Return `ambiguous` when the selected difference may be either incidental or
semantic and an accessible observation could change the answer. Name that
observation precisely: another caller, representative case, diff, runtime trace,
or accepted product rule.

Do not hide uncertainty by selecting a more polished design. A useful ambiguous
result makes the next evidence cheap to gather.

## Model-Code Mismatch

Structural pressure may also appear without textual duplication. Compare the
accepted model with the implementation for:

- forbidden cases that remain representable or reachable;
- missing or conflicting decision branches;
- transition rules that lose required history;
- callers that fail to establish callee preconditions;
- duplicated absence or default policy with no owner;
- stale, retried, reordered, or concurrent events with no rule;
- product and code vocabulary that name different concepts.

Use a behavior-preserving movement only to expose the mismatch. When satisfying
the model requires changed behavior, keep that behavior change explicit.

## Change-Relative Coupling And Cohesion

Do not report two elements as simply “coupled.” Name the accepted or historically
observed delta and direction:

```text
change delta:
source element and required change:
dependent element and why it must also change:
fanout or cascade:
evidence: contract, repeated accepted diff, compatibility rule, or trace
counterevidence: tooling, generated code, shared owner, or accidental batching
```

Files appearing together in commits are a clue, not proof: formatting, broad
pull requests, ownership, and generated output can create false co-change.
Conversely, runtime capacity or deployment assumptions can couple elements with
no source dependency.

Moving change-related elements adjacent is horizontal cohesion movement. It can
make a change set easier to see without eliminating the coupling. Report a
vertical candidate only when repeated deltas reveal a stable containing unit,
policy, or invariant owner. Do not infer cohesion from proximity alone or create
one giant container for every transitive relationship.

## Worked Observation

Baseline: tests protect verses 1, 2, and 0 in a simple formatter. A new accepted
requirement adds verse 3. The Shameless Green change copies the verse-2 branch
and changes two phrases. All tests are green.

```text
Pressure:
  verse 3 is now accepted and exposes another parallel branch
Selected pair:
  verse 2 and verse 3 branches, closest by output responsibility
Smallest difference:
  the quantity and one noun phrase
Observation move:
  align the two branches into the same expression shape without extracting a
  helper or changing output
Relevant check:
  exact output tests for verses 0 through 3
```

After alignment, suppose the only differences are `count` and a phrase selected
from `count`. That is still horizontal movement: the branches are more directly
comparable and the code is at a stable landing. Stop and re-observe.

If a policy survives—such as a `ContainerDescription` that owns singular/plural
wording and changes independently across several callers—report a vertical
candidate with its callers and hidden policy. Do not create the object here.

If verse 3 introduced a unique legal notice, the textual similarity was
incidental. Report `no-signal` or a narrower horizontal result rather than
forcing the notice into a generic formatter. An ambiguous result names the
missing evidence, such as whether a second UI surface shares the wording rule.
“Maybe we need a strategy” is not evidence.

## Reporting Shape

```text
Pressure: current requirement, invariant, or model mismatch
Baseline: current behavior and relevant evidence
Selected pair: artifacts and comparison basis
Smallest difference: one meaningful distinction
Observation move: smallest behavior-preserving experiment
Evidence: check and current gap
Classification: no-signal | horizontal | vertical | ambiguous
Candidate: only for vertical or ambiguous movement
Handoff: implementation, abstraction-review, schedule, naming-judgment, or none
```

## Failure Checks

The capability is being misused when:

- duplication is treated as sufficient pressure;
- a speculative future requirement selects the direction;
- no pair or single difference is named;
- the proposed experiment changes behavior;
- a destination such as polymorphism or a factory is chosen in advance;
- the leaf performs the edit instead of returning the observation;
- horizontal similarity is promoted directly into a vertical abstraction;
- line count or a static metric substitutes for change-cost evidence.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, version 2.2.2, 2024: Chapter 1, pp. 2-22; Chapter 2, pp. 23-50;
  Chapter 3, pp. 51-72; and Chapter 4, pp. 73-101, on Shameless Green,
  listening to change, points of attack, flocking, concentrating on difference,
  horizontal movement, and stable landings.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, official living build 9.2.0.3,
  released 2026-05-28 and audited 2026-05-28:
  Chapter 14
  and Chapter 15
  for comparing completed concrete designs and lifting corresponding roles;
  Chapter 19
  and Chapter 20
  for stabilizing a data model before simplification; and
  Intermezzo 5
  for duplicated-work and hidden-traversal cost signals.
- Kent Beck, *Tidy First?: A Personal Exercise in Empirical Software Design*,
  First Edition, Second Release, O'Reilly Media, 2025-12-12:
  Part I, Chapters 1-15, pp. 3-32, for small catalog-shaped observation moves;
  Part II, Chapters 16-18, pp. 35-46, for behavior/structure separation,
  chaining, and batch interactions; and Part III, Chapters 29-32, pp. 77-90,
  for change-relative coupling, fanout/cascades, and cohesion movement. Commit
  co-change, power-law cost, tool-constant fanout, and universal collocation are
  qualified rather than imported as laws.
