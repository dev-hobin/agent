# Flocking And Structural Movement

Use this reference when duplication, parallel branches, similar tests, repeated
UI states, conditionals, or a recent refactor create pressure for structural
movement and the safest next move is not obvious.

## Contents

- Change Pressure
- The Flocking Cycle
- Evidence That Keeps The Move Green
- Horizontal And Vertical Movement
- Model-Code Mismatch
- Small-Step Discipline
- Failure Checks
- Reporting Shape
- Conceptual Lineage

## Change Pressure

Start with the current requirement or invariant. Ask whether the existing code
is already open to the change. If it is, similarity alone does not justify a
refactor. If it is not, locate the smallest part of the code whose present shape
blocks or obscures the change.

Structural movement should answer an observed pressure:

- two paths express the same responsibility differently;
- a stable domain difference is hidden in incidental branching;
- a default or absence policy is duplicated;
- a modeled transition is represented as an unrelated current-state check;
- callers repeat knowledge that should belong behind a boundary;
- names describe mechanics while the model describes meaning.

## The Flocking Cycle

Work with one selected pair at a time:

1. Select the two things most alike.
2. State why they are alike: responsibility, vocabulary, transition, failure
   mode, model element, or user-visible outcome.
3. Find the smallest meaningful difference between only those two things.
4. Choose the simplest behavior-preserving move that removes or exposes that
   difference.
5. Run the smallest relevant check.
6. Observe the new shape before choosing another pair.
7. Delete newly unused code only after the replacement is exercised.

Possible small moves include matching an expression or name, aligning a branch,
introducing a temporary parameter or adapter, moving one responsibility, or
calling the new shape before deleting the old one.

If the proposed move changes behavior, touches many unrelated sites, or creates
a public concept, it is no longer a routine flocking step. Split it or return a
vertical/ambiguous candidate for review.

## Evidence That Keeps The Move Green

"Behavior preserving" is a claim, not a visual impression. Name the evidence:

- focused tests for the affected responsibility;
- a characterization test for legacy behavior;
- typecheck, build, or contract evidence for an interface movement;
- a representative UI or integration check;
- a diff inspection showing only structural change;
- an explicit residual when no cheap verifier exists.

Lower confidence when evidence cannot distinguish the original and moved
behavior. Do not use a broad green suite as proof when it never exercises the
selected difference.

## Horizontal And Vertical Movement

Keep movement horizontal when it aligns already-related code inside the current
abstraction level and leaves no stable new concept behind.

Treat movement as vertical only when, after the difference is understood, a
nameable concept remains:

- a policy with its own cases;
- an invariant-bearing boundary;
- a responsibility with distinct reasons to change;
- a conversion or representation barrier;
- state/history ownership;
- a caller contract shared across uses.

Similarity is not enough. Two pieces may look alike while changing for
different reasons. Conversely, a vertical concept may first appear as a stable
difference rather than as duplicated text.

For a vertical or ambiguous candidate, state its pressure, contract-shaped
meaning, hidden detail, invariant risk, concrete evidence, and evidence still
needed. Do not promote or schedule it here.

## Model-Code Mismatch

When a problem model exists, check whether code and model disagree:

- a forbidden case remains representable or reachable;
- a decision space has a missing or conflicting branch;
- a transition rule sees only the current state and loses history;
- a caller does not establish a callee precondition;
- a type admits invalid states without a boundary check;
- progress or retry behavior is absent from a temporal requirement;
- a ranking or objective is hidden in incidental ordering;
- product vocabulary and code vocabulary point to different concepts.

A mismatch may justify structural review even without textual duplication.

## Small-Step Discipline

Keep each move reversible and locally explainable. After every green move,
reselect the comparison instead of executing a predetermined refactoring plan.
The newly aligned code may reveal that the next difference is meaningful and
should remain.

When a move fails its check, revert or repair that move before continuing. Do
not stack more structural guesses on top of ambiguous evidence.

## Failure Checks

The observation is not ready when:

- no selected pair is named;
- "duplicate" is the only similarity basis;
- the smallest difference is actually several differences;
- the move has no behavior-preserving evidence;
- a helper is proposed before its stable concept can be stated;
- line count or static complexity is treated as the only improvement measure;
- product scope is expanded during structural observation;
- timing is decided before a concrete candidate exists.

## Reporting Shape

Keep the result auditable:

```text
Pressure: the requirement, invariant, or mismatch driving observation
Selected pair: the two most alike artifacts and why
Smallest difference: one concrete distinction
Smallest move: one behavior-preserving experiment
Evidence: the check that keeps the move green
Classification: no-signal | horizontal | vertical | ambiguous
Candidate: only for vertical or ambiguous movement
Missing evidence: what could change the classification
```

## Conceptual Lineage

This reference adapts the flocking rules and small, behavior-preserving
refactoring discipline presented by Sandi Metz, Katrina Owen, and TJ Stankus in
*99 Bottles of OOP*. It extends the comparison with model-code mismatch and
explicit evidence because the skill must judge real product changes, not only
remove duplication.

- 99 Bottles of OOP: https://sandimetz.com/99bottles
- JavaScript sample: https://sandimetz.com/99bottles-sample-js
