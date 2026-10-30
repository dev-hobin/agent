---
name: developing-features
description: "Develops a feature or behavior change through checkpoints: write acceptance scenarios and owner decisions, model combining conditions, design the surface, implement in small verified slices, and verify every scenario with an independent reviewer. Use only when explicitly asked to build a non-trivial feature or fix where scope, conditions, or design are unsettled. Not for one-line fixes, pure refactors, reviewing someone else's change, or writing a ticket or acceptance criteria without implementing."
metadata:
  short-description: "Build a feature through verified acceptance scenarios"
---

# Developing Features

Turn a request into executable acceptance scenarios first, then build until each one
passes and an independent reviewer agrees.

## Gotchas

- A request about new behavior usually leaves open what happens to data already stored
  under the old behavior. Keep, migrate, or delete is an owner decision. If the existing
  parser already drops fields, filling in the TODO still loses stored data silently.
- Missing, empty, and malformed inputs from an external system are different states.
  Accepting them as an empty valid result is a defect, not a simplification.
- State read before a slow or external step can be stale by the time an irreversible
  step runs. Revalidate right before the irreversible step; a version check after it
  is not a check.
- New tests passing is not completion. Existing tests around the changed code must
  still pass, and every scenario must have been run, not just written.
- The independent verification in step 6 is the step most often skipped, usually with
  "my tests pass" as the reason. Your own tests share your blind spots.
- Project instructions (`AGENTS.md`, contribution notes) record the team's decisions and
  outrank the defaults below.

## Procedure

1. **Scenarios.** Copy `assets/acceptance-scenarios.json` into the working tree as
   `acceptance-scenarios*.json` (next to the feature or in the project's planning folder)
   and fill it: one scenario per observable behavior, including absent, empty, invalid,
   duplicate, and concurrent cases where they apply. Every scenario names the command
   that checks it.
2. **Owner decisions.** List every decision the request, code, and documents do not
   settle. If the user is available, ask the smallest question. If not, take the
   conservative reversible default (preserve stored data, reject ambiguous or malformed
   input, narrow the change) and record decision, reason, and how to revert in the
   scenario file.
3. **Model conditions** when several conditions combine or order matters: read
   [condition-modeling.md](references/knowledge/condition-modeling.md) and derive extra
   scenarios from the table rows.
4. **Design** when ownership, boundaries, data shape, or variation is unsettled: read
   [design-surface.md](references/knowledge/design-surface.md) and write the surface
   before coding. For the risky parts, read the lenses under "When to read more" that
   apply and decide them up front.
5. **Implement in slices.** Each slice makes one or a few scenarios pass end to end. Run
   that slice's scenario commands and the existing tests around the change before the
   next slice. Keep behavior changes and structural cleanup in separate slices.
6. **Verify independently.** Spawn a fresh subagent and give it the instructions in
   [references/verifier.md](references/verifier.md), the scenario file path, the diff,
   and the project instructions, and nothing else from this conversation. Subagents share
   your sandbox, so tell it not to edit files. It runs every scenario command and the
   existing tests and returns only must-fix items. Fix them and repeat, at most 3 rounds;
   report what is still open. If subagents are unavailable, do a fresh pass that rereads
   only those same inputs and say so in the report.
7. **Report** in this form, and set each scenario's `status` and `verification.rounds` in
   the scenario file to the last result. Write it to the file the request names,
   otherwise in the answer:

```text
Scenarios:        <id> <then summary> — <check command> — pass | fail | not run
Owner decisions:  <id> <question> → <decision>. Reason: <reason>. Revert: <how to revert>
Checks run:       <command> — <result>
Not verified:     <what could not be observed>
```

   Report completion only when every scenario command and the existing tests around the
   change pass in their last run.

## When to read more

- `assets/acceptance-scenarios.json` — the scenario and decision record to copy and fill.
- [condition-modeling.md](references/knowledge/condition-modeling.md) — several
  conditions combine, absence or defaults matter, or order and time matter.
- [design-surface.md](references/knowledge/design-surface.md) — the data shape,
  ownership, interfaces, or variation mechanism are not settled yet.
- Lenses, only those that apply: [contract](references/lenses/contract.md)
  (requirements, absence semantics, invariants), [async-flow](references/lenses/async-flow.md)
  (jobs, queues, retries, external calls), [structure](references/lenses/structure.md)
  (boundaries and abstractions), [data-loss](references/lenses/data-loss.md)
  (transformations and stored data), [evidence](references/lenses/evidence.md) (what the
  checks really prove).
