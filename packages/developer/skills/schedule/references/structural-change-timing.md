# Structural Change Timing

Use this reference when a concrete refactor or abstraction candidate competes
with a behavior change, and timing depends on reversibility, optionality,
invariant pressure, or the cost of delay.

## Contents

- Behavior And Structure
- Timing Vocabulary
- Decision Procedure
- Guarantee And Ability Tradeoff
- Reversibility And Cost Of Delay
- Nested Work Pressure
- Reopen Conditions
- Failure Checks
- Conceptual Lineage

## Behavior And Structure

Separate two kinds of change before deciding timing:

- behavior change alters what the system does for a user, caller, or policy;
- structural change alters how the code is arranged while intending to preserve
  behavior.

The same diff may contain both. Split them conceptually even when they are
committed together. A structural candidate belongs now only when its timing can
be justified by the current behavior or invariant—not merely by aesthetic
preference.

## Timing Vocabulary

This skill uses three outcomes:

- `now`: perform the structural move before or as part of accepted work because
  it protects the invariant, exposes a needed verification point, or unblocks a
  safe implementation;
- `after`: preserve the option but let accepted behavior proceed first;
- `never`: reject the candidate for the current scope because it is speculative,
  harmful, or has no evidence-backed pressure.

Kent Beck's broader vocabulary sometimes separates `later` from `after`. Here,
`after` covers both immediate follow-up and evidence-triggered deferral. The
reopen condition makes the distinction explicit.

## Decision Procedure

Ask in order:

1. What is the smallest concrete structural candidate?
2. Which current claim, invariant, caller, or implementation step depends on it?
3. What evidence shows the candidate is stable enough to act on?
4. What guarantee does doing it now provide?
5. What implementation freedom or alternate representation would it remove?
6. Can a smaller type, contract, test, validation, adapter, or local movement
   provide the same guarantee?
7. How reversible is the move if the model changes?
8. What cost grows if the move is delayed?
9. What nested work does doing it now create?

Choose `now` when the accepted work is otherwise blocked, unsafe, or difficult
to verify for a concrete reason. Choose `after` when the move is plausible and
reversible but not required. Choose `never` when the pressure is cosmetic,
unrelated, low-confidence, or contradicted by current evidence.

## Guarantee And Ability Tradeoff

Every structure buys a guarantee by removing some ability. Examples:

- a narrower type prevents invalid states but rejects flexible inputs;
- a shared policy centralizes decisions but removes caller variation;
- an abstraction barrier protects representation but restricts direct access;
- normalization simplifies consumers but may erase source distinctions;
- persistent history enables temporal guarantees but adds storage and ordering
  obligations.

State both sides. A claimed guarantee is not enough when the lost ability is a
real product requirement. A claimed flexibility is not enough when it permits a
modeled forbidden case.

## Reversibility And Cost Of Delay

Prefer earlier structural work when delaying it creates irreversible or rapidly
growing cost:

- data is persisted in a representation that will be expensive to migrate;
- public callers begin depending on an accidental contract;
- several implementations will duplicate the same invariant-bearing policy;
- tests are impossible to write at the current boundary;
- the next accepted step compounds hidden state or ownership.

Prefer deferral when the move is cheap to add later, current examples are too
few, the domain vocabulary is unstable, or the candidate would close several
valid implementation paths.

Do not confuse large effort with irreversibility. A large but isolated movement
may remain reversible; a one-line public contract can be difficult to undo.

## Nested Work Pressure

Structural work often discovers more structural work. Count that pressure:

- new public concepts;
- migrations or compatibility layers;
- cross-package coordination;
- new lifecycle or state ownership;
- additional verification infrastructure;
- unrelated cleanup required only to make the candidate look complete.

Bias toward `after` when the candidate opens a chain of nested work without
protecting the current invariant. If a small prerequisite is genuinely needed,
schedule that prerequisite rather than the full idealized architecture.

## Reopen Conditions

An `after` decision must state observable evidence that reopens it, such as:

- a second caller needs the same contract;
- another branch repeats the same stable policy;
- a new requirement reaches the blocked extension point;
- a performance or migration threshold is crossed;
- an accepted verifier cannot observe the claim through the current boundary.

Do not use calendar time alone unless timing itself changes the risk. A reopen
condition should be detectable from code, requirements, evidence, or product
priority.

## Failure Checks

The timing judgment is weak when:

- the candidate is still only a smell or vague aspiration;
- `now` means only "the code is messy";
- `after` has no reopen condition;
- `never` silently means "not in this task";
- behavior and structure have not been separated;
- the guarantee gained is named but the ability lost is ignored;
- large nested work is hidden inside a small-sounding abstraction;
- timing substitutes for product prioritization that only a human can decide.

## Conceptual Lineage

This reference adapts Kent Beck's distinction between behavior and structure,
and his timing vocabulary of first, after, later, and never. The package reduces
the vocabulary to `now`, `after`, and `never` while preserving reversibility,
optionality, and cost-of-delay reasoning.

- Structure and behavior: https://newsletter.kentbeck.com/p/structure-and-behavior
- First, after, later, never: https://newsletter.kentbeck.com/p/first-after-later-never
