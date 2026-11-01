---
name: developing-features
description: "Develops a feature or behavior change through checkpoints: write acceptance scenarios and owner decisions, model combining conditions, design the surface, implement in small verified slices, and verify every scenario with an independent reviewer. Use only when explicitly asked to build a non-trivial feature or fix where scope, conditions, or design are unsettled. Not for one-line fixes, pure refactors, reviewing someone else's change, or writing a ticket or acceptance criteria without implementing."
argument-hint: "[the feature or behavior change to build, or the path of its requirements]"
disable-model-invocation: true
allowed-tools:
  - "Agent(hobin-feature:independent-verifier)"
  - "Bash(node ${CLAUDE_SKILL_DIR}/scripts/scenarios.mjs *)"
  - "Bash(node ${CLAUDE_SKILL_DIR}/scripts/compile-control-model.mjs *)"
  - "Bash(node ${CLAUDE_SKILL_DIR}/scripts/check-control-model.mjs *)"
hooks:
  Stop:
    - hooks:
        - type: command
          command: "node \"${CLAUDE_PLUGIN_ROOT}/scripts/scenarios-stop-hook.mjs\""
---

# Developing Features

Turn a request into executable acceptance scenarios first, then build until each one
passes and an independent reviewer agrees.

Request: $ARGUMENTS (if empty, take it from the conversation)

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
- Project instructions (`AGENTS.md`, `CLAUDE.md`, contribution notes) record the team's
  decisions and outrank the defaults below.

## Procedure

1. **Scenarios.** Copy `${CLAUDE_SKILL_DIR}/assets/acceptance-scenarios.json` into the
   working tree as `acceptance-scenarios*.json` (next to the feature or in the project's
   planning folder) and fill it: one scenario per observable behavior, including absent,
   empty, invalid, duplicate, and concurrent cases where they apply. Every scenario names
   the command that checks it.
2. **Owner decisions.** List every decision the request, code, and documents do not
   settle. If the user is available, ask the smallest question. If not, take the
   conservative reversible default (preserve stored data, reject ambiguous or malformed
   input, narrow the change) and record decision, reason, and how to revert in the
   scenario file.
3. **Model conditions** when several conditions combine or order matters: read
   `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/condition-modeling.md` and derive
   extra scenarios from the table rows. When what the user or system may do depends on a
   mode (an external job and polling, retries, rechecks or cancels, late results, flags that
   together block an action), read
   `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/control-model.md`, copy
   `${CLAUDE_SKILL_DIR}/assets/control-decisions.json` into the working tree as
   `control-decisions*.json`, fill it from the current code, fix it until
   `node ${CLAUDE_SKILL_DIR}/scripts/compile-control-model.mjs --gate` passes, and take a
   baseline with `… --baseline` before changing the code. Then update the record with the
   code: every cell that changed since the baseline needs an acceptance scenario that lists
   it in `covers` and passes (`… --changes` prints them). The gate's
   findings are facts about the code: acknowledge each one, and raise the ones an owner
   must decide as decisions in step 2. The Stop hook runs the gate, so do not add it as an
   acceptance scenario; scenario commands must not name paths outside the project.
4. **Design** when ownership, boundaries, data shape, or variation is unsettled: read
   `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/design-surface.md` and write the
   surface before coding. For the risky parts, read the lenses under "When to read more"
   that apply and decide them up front.
5. **Implement in slices.** Each slice makes one or a few scenarios pass end to end. Run
   that slice's scenario commands and the existing tests around the change before the
   next slice. Keep behavior changes and structural cleanup in separate slices.
6. **Verify independently.** Dispatch the `hobin-feature:independent-verifier` agent with
   only the scenario file path, the diff, the project instructions, and, with a control
   model, the output of `node ${CLAUDE_SKILL_DIR}/scripts/compile-control-model.mjs --changes`. It runs every
   scenario command and the existing tests and returns only must-fix items. Fix them and
   repeat, at most 3 rounds; report what is still open. If the agent cannot be used,
   do a fresh pass that rereads only those same inputs and say so in the report.
7. **Report** in this form. Scenario results come only from `node ${CLAUDE_SKILL_DIR}/scripts/scenarios.mjs run`,
   which runs every scenario check and the existing tests and writes the results into the
   record; never edit `status` by hand. Finish only when `node ${CLAUDE_SKILL_DIR}/scripts/scenarios.mjs check`
   passes, and `node ${CLAUDE_SKILL_DIR}/scripts/compile-control-model.mjs --gate` too when a
   control decision record exists; both print what is incomplete. Write it to the file
   the request names, otherwise in the answer:

```text
Scenarios:        <id> <then summary> — <check command> — pass | fail | not run
Owner decisions:  <id> <question> → <decision>. Reason: <reason>. Revert: <how to revert>
Checks run:       <command> — <result>
Not verified:     <what could not be observed>
```

   Report completion only when every scenario command and the existing tests around the
   change pass in their last run.

## When to read more

- `${CLAUDE_SKILL_DIR}/assets/acceptance-scenarios.json` — the scenario and decision
  record to copy and fill.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/condition-modeling.md` — several
  conditions combine, absence or defaults matter, or order and time matter.
- `${CLAUDE_SKILL_DIR}/assets/control-decisions.json` — the control decision record to copy
  and fill when the allowed actions depend on a mode.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/control-model.md` — what the user or
  system may do depends on a mode, an external job, or a late result.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/control-model-format.md` — filling the
  decision record or reading what the scripts print.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/developing-features/design-surface.md` — the data
  shape, ownership, interfaces, or variation mechanism are not settled yet.
- Lenses in `${CLAUDE_PLUGIN_ROOT}/knowledge/lenses/`, only those that apply:
  `contract.md` (requirements, absence semantics, invariants), `async-flow.md` (jobs,
  queues, retries, external calls), `structure.md` (boundaries and abstractions),
  `data-loss.md` (transformations and stored data), `evidence.md` (what the checks
  really prove).
