# Behavior-Preserving Structural Change

Use this protocol only after a `direct` route has justified one concrete structural
movement and its stable landing. It governs that single green-to-green mutation;
it does not discover the move, approve an abstraction, decide its timing, or carry
a multi-step implementation queue across landings.

## Entry Contract

Before editing, state:

```text
Behavior to preserve: the narrow observable claim
Structural move: one concrete rearrangement
Pressure: why the accepted task needs or benefits from it now
Baseline evidence: the cheapest relevant check that is currently green
Affected surface: files, callers, persisted forms, or public boundaries
Stop: the next stable, pausable state
```

If the behavior claim, timing, or candidate is still under judgment, close or
pause the direct route and route that question to the appropriate leaf.

## Smallest Green Transformation

Keep behavior and structure distinct in reasoning even if they eventually share
a commit. Prefer the smallest movement whose failure can be localized.

For replacement-shaped refactors, use this progression:

```text
new shape parses
-> new shape executes
-> callers use its result
-> replaced code becomes unreachable
-> replaced code is deleted
-> relevant evidence is green
```

For movement across a boundary, update one sender or caller at a time when the
old and new forms can safely coexist. Confirm that each intermediate state is
valid. Do not rely on a final large diff to explain which step changed behavior.

## Evidence Rhythm

Within the routed movement:

1. run the narrowest check that can catch the likely break;
2. inspect the diff for mixed behavior and structural changes;
3. reduce the step when the failure cannot be explained locally;
4. return to the declared green, deployable stable landing;
5. close the direct route there and let Developer re-observe and route the next
   question instead of following a predetermined final design.

A passing test is useful only when it exercises the preserved behavior. When no
cheap verifier exists, keep the movement smaller and record the residual risk.

## Stable Landing

A stable landing is not merely a green command. It is a state where:

- the preserved behavior has relevant evidence;
- names and intermediate compatibility shapes are honest enough to pause;
- no dead replacement path or half-moved caller remains accidentally active;
- the diff has one explainable structural purpose;
- the next decision can be made from the new evidence.

Stop and close the direct route there even when the wider accepted task still has
work remaining. Developer must select the next movement or focused judgment from
the new evidence. Further caller movement, cleanup, polymorphism, factory design,
or public abstraction requires another route and its own current pressure.

## Reroute Conditions

Close direct execution at the latest stable landing and open a focused judgment
when the movement reveals:

- an unexpected product behavior or policy choice: `specify`;
- missing cases, transition rules, or replacement obligations: `model`;
- unresolved ownership, collaboration, or data flow: `sketch`;
- a new comparison or uncertain structural direction: `signal`;
- a responsibility, role, boundary, or abstraction candidate: `abstraction-review`;
- a disputed name or vocabulary boundary: `naming-judgment`;
- a question of now, after, or never: `schedule`;
- weak or irrelevant evidence: `verify`.

This is adaptive rerouting, not a required sequence.

## Worked Mutation Trace

Accepted move: replace duplicated schedule conversion in two callers with the
already-reviewed pure `toScheduleContent` function.

```text
Behavior to preserve:
  both callers produce the same ScheduleContent or domain error for the
  characterized table of variants
Structural move:
  introduce the function, move one caller, then the second, then delete the
  duplicate expressions
Baseline evidence:
  focused table test plus both caller integration tests are green
Affected surface:
  converter module, two callers, no persistence format
Stop:
  both callers use the converter; old expressions are unreachable and removed
```

Mutation sequence:

```text
1. add the pure function with one characterized caller's exact behavior
2. run the conversion table
3. switch caller A; run its integration and inspect the diff
4. switch caller B; run its integration and inspect the diff
5. search for the replaced expression and remove dead code
6. run the focused table, integrations, typecheck, and packed-source check
```

If caller B reveals that `null` and missing have different product meanings, do
not broaden the helper until everything passes. Return that policy to `model`;
caller A remains at a stable landing. If both callers move cleanly, stop.
Creating a converter class or registry is a new judgment, not “finishing” this
refactor.

## Failure Checks

The protocol is being misused when:

- tests are changed merely to preserve green output after behavior drift;
- several differences are removed before the first can be inspected;
- a class, strategy, polymorphic hierarchy, or factory was chosen in advance;
- behavior work is hidden inside a structural label;
- the route continues after a new human-owned policy question appears;
- an intermediate state cannot safely run or be reviewed;
- cleanup continues past the accepted pressure because the code could be nicer.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, version 2.2.2, 2024: chapters 3-5 on methodical transformations,
  flocking, gradual refactoring, stable landings, and sender-by-sender movement.
- Kent Beck, *Tidy First?: A Personal Exercise in Empirical Software Design*,
  O'Reilly Media, 2023: separating behavior and structure, keeping tidyings
  small, and managing structural change as optionality.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs, Second Edition*, MIT Press, 2018:
  iterative refinement and propagating a changed data design through dependent
  artifacts.
