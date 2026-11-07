---
name: developing-features
description: "Develops a feature or behavior change through checkpoints: write acceptance scenarios and owner decisions, model combining conditions, design the surface, implement in small verified slices, and verify every scenario with an independent reviewer. Use when asked to build or change a feature, or fix a behavior, where scope, conditions, or design are not settled yet (combining conditions, stored data, external jobs, retries, cancellation, late results). Start it before exploring the code, even if the request never mentions scenarios. Not for one-line fixes, pure refactors, reviewing someone else's change, explaining code, or writing a ticket or acceptance criteria without implementing."
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
- Tests and scenario checks belong to the project. Importing or running the skill's own
  scripts or the installed plugin's files from them breaks for anyone without the skill;
  the gate's `covers` already ties the control model to the code.
- Project instructions (`AGENTS.md`, contribution notes) record the team's decisions and
  outrank the defaults below.

## Procedure

1. **Scenarios.** Create the record with
   `node <this skill's directory>/scripts/scenarios.mjs init <absolute path>/acceptance-scenarios<name>.json` (next to the feature or in the
   project's planning folder; it copies the template and never overwrites) and fill it: one
   scenario per observable behavior, including absent, empty, invalid, duplicate, and
   concurrent cases where they apply. Every scenario names the command that checks it.
   Run `scenarios.mjs` from the directory this session started in and always pass absolute
   record paths: `init`, `register`, `run` and `decline` register the record in this
   session's registry (`.hobin-feature/sessions/` there), and the Stop hook checks every
   record listed in it, wherever the record lives. A record written with the edit tools is
   registered too. For a record that already exists, run
   `node <this skill's directory>/scripts/scenarios.mjs register <record>`. If this work truly needs no record, run
   `node <this skill's directory>/scripts/scenarios.mjs decline <absolute path>/acceptance-scenarios<name>.json --reason "<why>"`
   and give the reason in the report; other records of this session must still pass.
   If `scenarios.mjs` stops with "No hobin-feature registry for this agent session", first
   `cd` back to the start directory; if the plugin's hooks are not active (trust them in /hooks; an evaluation that does not install the plugin), add
   `--no-gate`, check the record yourself with `scenarios.mjs check <record>`, and say in the
   report that no Stop gate covered it.
2. **Owner decisions.** List every decision the request, code, and documents do not
   settle. If the user is available, ask the smallest question. If not, take the
   conservative reversible default (preserve stored data, reject ambiguous or malformed
   input, narrow the change) and record decision, reason, and how to revert in the
   scenario file.
3. **Model conditions** when several conditions combine or order matters: read
   [condition-modeling.md](references/knowledge/condition-modeling.md) and derive extra
   scenarios from the table rows. When what the user or system may do depends on a mode
   (an external job and polling, retries, rechecks or cancels, late results, flags that
   together block an action), read [control-model.md](references/knowledge/control-model.md),
   copy `assets/control-decisions.json` into the working tree as `control-decisions*.json`,
   fill it from the current code, fix it until
   `node <this skill's directory>/scripts/compile-control-model.mjs --gate <record>` passes, and take a
   baseline with `… --baseline` before changing the code, and register the decision record with
   `node <this skill's directory>/scripts/scenarios.mjs register <record>` so the Stop hook gates it. Then update the record with the
   code: every cell that changed since the baseline needs an acceptance scenario that lists
   it in `covers` and passes (`… --changes` prints them). The gate's
   findings are facts about the code: acknowledge each one, and raise the ones an owner must
   decide as decisions in step 2. The Stop hook runs the gate, so do not add it as an
   acceptance scenario; scenario commands must not name paths outside the project.
4. **Design** when ownership, boundaries, data shape, or variation is unsettled: read
   [design-surface.md](references/knowledge/design-surface.md) and write the surface
   before coding. For the risky parts, read the lenses under "When to read more" that
   apply and decide them up front.
5. **Implement in slices.** Each slice makes one or a few scenarios pass end to end. Run
   that slice's scenario commands and the existing tests around the change before the
   next slice. Keep behavior changes and structural cleanup in separate slices.
6. **Verify independently.** Spawn a fresh subagent and give it the instructions in
   [references/verifier.md](references/verifier.md), the scenario file path, the diff,
   the project instructions, and, with a control model, the output of
   `node <this skill's directory>/scripts/compile-control-model.mjs --changes`, and nothing
   else from this conversation. Subagents share
   your sandbox, so tell it not to edit files. It runs every scenario command and the
   existing tests and returns only must-fix items. Fix them and repeat, at most 3 rounds;
   report what is still open. If subagents are unavailable, do a fresh pass that rereads
   only those same inputs and say so in the report.
7. **Report** in this form. Scenario results come only from
   `node <this skill's directory>/scripts/scenarios.mjs run <record>`, which runs every scenario check
   and the existing tests and writes the results into the record; never edit `status` by
   hand. Finish only when `node <this skill's directory>/scripts/scenarios.mjs check <record>` passes,
   and `node <this skill's directory>/scripts/compile-control-model.mjs --gate <record>` too when a
   control decision record exists. `<record>` is the path of the record you wrote (the
   acceptance record for `scenarios.mjs`, the control decision record for `--gate`); without
   it they take every record under the current directory, other features' and other
   sessions' included. Write it to the file the request names, otherwise in the answer:

```text
Scenarios:        <id> <then summary> — <check command> — pass | fail | not run
Owner decisions:  <id> <question> → <decision>. Reason: <reason>. Revert: <how to revert>
Checks run:       <command> — <result>
Not verified:     <what could not be observed>
```

   Report completion only when every scenario command and the existing tests around the
   change pass in their last run.

## When to read more

- `assets/acceptance-scenarios.json` — the scenario and decision record template `scenarios.mjs init` copies.
- [condition-modeling.md](references/knowledge/condition-modeling.md) — several
  conditions combine, absence or defaults matter, or order and time matter.
- `assets/control-decisions.json` — the control decision record to copy and fill when the
  allowed actions depend on a mode.
- [control-model.md](references/knowledge/control-model.md) — what the user or system may
  do depends on a mode, an external job, or a late result.
- [control-model-format.md](references/knowledge/control-model-format.md) — filling the
  decision record or reading what the scripts print.
- [design-surface.md](references/knowledge/design-surface.md) — the data shape,
  ownership, interfaces, or variation mechanism are not settled yet.
- Lenses, only those that apply: [contract](references/lenses/contract.md)
  (requirements, absence semantics, invariants), [async-flow](references/lenses/async-flow.md)
  (jobs, queues, retries, external calls), [structure](references/lenses/structure.md)
  (boundaries and abstractions), [data-loss](references/lenses/data-loss.md)
  (transformations and stored data), [evidence](references/lenses/evidence.md) (what the
  checks really prove).
