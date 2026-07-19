# Structural Movement

Use this reference when duplication, parallel branches, repeated tests, code
smells, or a model-code mismatch suggests movement but does not yet justify an
abstraction or implementation plan.

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
baseline when it is understandable and protected by relevant examples. Visible
duplication without current pressure is not an instruction to refactor. Return
`no-signal` when the behavior is cheap to change and no accepted claim is being
inhibited.

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
tests merely so a proposed refactor can remain green.

## Horizontal Movement

Classify movement as horizontal when alignment stays at the current level:

- branches or expressions gain a consistent shape;
- names, parameters, or messages become comparable;
- no independent policy, invariant, or reason to change remains;
- the movement stays local and reversible.

A stable landing is useful evidence: the code is green, understandable, safe to
pause, and newly comparable. It is not permission to continue toward a
predetermined design. Re-select the closest pair from the new state.

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
  Edition, version 2.2.2, 2024: chapters 1-4 on Shameless Green, listening to
  change, points of attack, flocking, concentrating on difference, horizontal
  movement, and stable landings.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs, Second Edition*, MIT Press, 2018:
  deriving abstractions by comparing completed concrete designs and lifting
  corresponding differences.
- Kent Beck, *Tidy First?: A Personal Exercise in Empirical Software Design*,
  O'Reilly Media, 2023: small behavior-preserving structural moves and the need
  to keep them separate from behavior changes.
