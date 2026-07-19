---
name: abstraction-review
description: "Judge whether a concrete wished interface, helper, API, workflow rule, boundary, or structural candidate is stable enough to keep, revise, split, reject, or defer. Use when a concrete candidate and the pressure behind it can be inspected, including when its contract or evidence may be incomplete."
---

# Abstraction Review

Decide whether a concrete abstraction candidate is safe to rely on.

## Core Question

Is this candidate stable enough to keep, or should it be revised, split,
rejected, or deferred?

## Inputs

- Concrete candidate and the pressure it should remove
- Caller language, representative cases, and expected contract
- Hidden detail and failure mode
- Requirement, model, design, code, diff, or tests when available

## Output

Lead with the caller's concrete failure mode; keep review labels secondary.
Produce review timing, layer, contract, hidden detail, output artifact, stop
check, evidence and gaps, and one decision: `keep`, `revise-surface`,
`revise-model`, `split`, `reject`, or `defer`. When used inside a larger task,
return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: review decision and its concrete failure mode
Basis: candidate source, callers, cases, code, tests, and assumptions
Open questions: missing contract or evidence, or none
Artifacts: boundary, invariant, table, graph, trace, or repair rule
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when the candidate can satisfy this sentence or is rejected/deferred for
failing it:

```text
Given <input artifact>, derive <output artifact> by <rule>, then check
<observable stop>. If it fails, repair the named layer or contract.
```

Revisit when new callers, cases, implementation evidence, or failures change
the contract or stop check.

## Method

1. Identify the candidate, its source, and confidence.
2. State the pressure it is supposed to remove. Bias toward `reject` or `defer`
   when no pressure is visible.
3. Review pre-implementation intent or post-implementation evidence explicitly.
4. Choose the tested layer: Language, Unit, Law, Boundary, Engine, Time, or Run.
5. State the contract in caller language and the detail callers may ignore.
6. Name the reusable output artifact left by the review.
7. Define an observable stop check using cases, properties, tests, diffs,
   behavior, traces, or command output.
8. Decide without converting missing evidence into polished approval.

## Missing Evidence

Return `needs-evidence` when a caller, representative case, or stop check can
stabilize the judgment. Return `not-applicable` when there is no concrete
candidate yet. Return `blocked` when product meaning needed for the contract is
human-owned.

## Boundary

Do not discover structural movement, create the original design surface, decide
timing, implement the change, or perform final completion review.

## Reference Routing

- Read [the field card](references/field-card.md) for substantial or auditable
  reviews.
- Read [the recipe cards](references/recipe-cards.md) when the candidate needs a construction or
  repair rule.
- Read [the repair table](references/repair-table.md) when a stop check fails.
- Read [the worked examples](references/worked-examples.md) for concrete
  calibration.
