---
name: abstraction-review
description: "Judge whether an already-shaped wished interface, helper, API, workflow rule, boundary, or structural candidate is stable enough to keep, revise, split, reject, or defer. Use when concrete caller-facing shape and pressure can be inspected, even if evidence is incomplete. A desired representation or requested property list without an interface shape belongs to sketch, not abstraction review."
---

# Abstraction Review

Decide whether a concrete abstraction candidate is safe to rely on.

## Core Question

Is this candidate stable enough to keep, or should it be revised, split,
rejected, or deferred?

## Judgment Spine

```text
existing candidate + current pressure
-> caller-visible promise and hidden detail
-> smallest plausible counterexample
-> observable stop and evidence
-> keep | revise-surface | revise-model | split | reject | defer
```

Review only promises the candidate already makes. When operations, ownership, or
rules still need to be invented, hand off instead of constructing them here.

## Inputs

- Concrete candidate and the pressure it should remove
- Caller language, representative cases, and expected contract
- Hidden detail and failure mode
- Requirement, model, design, code, diff, or tests when available

## Output

Lead with the caller's concrete failure mode; keep review labels secondary. Use
a review card or table with `Candidate`, `Pressure`, `Caller contract`, `Hidden
detail`, `Failure`, `Stop check`, and `Evidence gap`. Add a boundary diagram or
before/after interface snippet when the candidate changes layers or callers.
End with one prominent decision: `keep`, `revise-surface`, `revise-model`,
`split`, `reject`, or `defer`. When used inside a larger task, return:

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

Finish when each declared candidate promise is supported, contradicted, or left
as an explicit gap, and one observable stop can fail the candidate. A failed stop
produces a decision and owning-skill handoff, not an in-leaf redesign.

Revisit when new callers, cases, implementation evidence, or failures change
the contract or stop check.

## Method

1. Identify the candidate, its source, and confidence.
2. State the pressure it is supposed to remove. Bias toward `reject` or `defer`
   when no pressure is visible.
3. State the contract in caller language, its relevant observers, and the detail
   callers may ignore.
4. Name only the promises the candidate makes: representation, responsibility,
   substitution, closure, extension, process, state, or stable sense.
5. Construct the smallest plausible counterexample to one promise.
6. Define an observable stop using cases, properties, tests, diffs, traces, cost,
   or command output.
7. Decide and name the owning handoff for any missing model, design, timing,
   naming, or verification artifact.
8. Do not convert missing evidence into polished approval or a shadow design.

## Missing Evidence

Return `needs-evidence` when a caller, representative case, or stop check can
stabilize the judgment. Return `not-applicable` when there is no concrete
candidate yet. Return `blocked` when product meaning needed for the contract is
human-owned.

## Boundary

Do not discover structural movement, create the original design surface, decide
timing, implement the change, or perform final completion review. A desire such
as “replace this array with an object” is pressure, not yet a reviewable
abstraction, when public operations, caller shape, ownership, and hidden detail
still have to be invented; route that work to `sketch`.
