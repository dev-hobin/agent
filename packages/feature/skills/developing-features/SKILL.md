---
name: developing-features
description: "Develops a feature or behavior change through checkpoints: write acceptance scenarios and owner decisions, model combining conditions, design the surface, implement in small verified slices, and verify every scenario with an independent reviewer. Use only when explicitly asked to build a non-trivial feature or fix where scope, conditions, or design are unsettled. Not for one-line fixes, pure refactors, or reviewing someone else's change."
metadata:
  version: "0.3.0"
---

# Developing Features

Turn a request into executable acceptance scenarios first, then build until each one
passes and an independent reviewer agrees.

## Gotchas

- A request about new behavior usually leaves open what happens to data already stored
  under the old behavior. Treat keep, migrate, or scrub as an owner decision.
- Missing, empty, and malformed inputs from an external system are different states.
  Accepting them as an empty valid result is a defect, not a simplification.
- State read before a slow or external step can be stale by the time an irreversible
  step runs. Revalidate right before the irreversible step.
- New tests passing is not completion. Existing tests around the changed code must
  still pass, and every scenario must have been run, not just written.
- Project instructions (`AGENTS.md`, `CLAUDE.md`) record decisions that outrank the
  defaults below.

## Procedure

1. **Scenarios.** Copy `assets/acceptance-scenarios.json` into the working tree (next to
   the feature or in the project's planning folder) and fill it: one scenario per
   observable behavior, including absent, empty, invalid, duplicate, and concurrent
   cases where they apply. Each scenario names the command that checks it.
2. **Owner decisions.** List every decision the request, code, and documents do not
   settle. If the user is available, ask the smallest question. If not, take the
   conservative reversible default (preserve data, reject ambiguous input, narrow the
   change) and record decision, reason, and how to revert in the scenario file.
3. **Model conditions** when several conditions combine or order matters: read
   `references/condition-modeling.md` and derive extra scenarios from the table rows.
4. **Design** when ownership, boundaries, data shape, or variation is unsettled: read
   `references/design-surface.md` and write the surface before coding. Read the lenses
   under "When to read more" that apply, to decide the risky parts up front.
5. **Implement in slices.** Each slice makes one or a few scenarios pass end to end. Run
   that slice's scenario commands and the existing tests around the change before the
   next slice. Keep behavior changes and structural cleanup in separate slices.
6. **Verify independently.** Start a fresh subagent (or, without subagents, a fresh
   pass that rereads only these inputs) with the scenario file, the diff, and the
   project instructions. Ask it to run every scenario command and report only
   must-fix items: a failing scenario, a broken existing test, a missing scenario for a
   stated requirement, or a non-conservative owner decision. Fix and repeat, at most 3
   rounds; report anything still open.
7. **Report**: scenarios with their last result, owner decisions with reason and how to
   revert, checks run, and what was not verified.

## Assets

- `assets/acceptance-scenarios.json` — the scenario and decision record to copy and fill.

## When to read more

- [condition-modeling.md](references/condition-modeling.md) — several conditions
  combine, absence or defaults matter, or order and time matter.
- [design-surface.md](references/design-surface.md) — the data shape, ownership,
  interfaces, or variation mechanism are not settled yet.
- Lenses, read only those that apply to the change:
  [contract](references/lenses/contract.md) (requirements, absence semantics,
  invariants), [async-flow](references/lenses/async-flow.md) (jobs, queues, retries,
  external calls), [structure](references/lenses/structure.md) (boundaries and
  abstractions), [data-loss](references/lenses/data-loss.md) (transformations and
  stored data), [evidence](references/lenses/evidence.md) (what the checks really prove).
