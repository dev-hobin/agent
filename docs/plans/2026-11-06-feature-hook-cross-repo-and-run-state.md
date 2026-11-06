# 2026-11-06 hobin-feature: cross-repo records and run state

## What was observed

In a CRM session (Claude Code, hobin-feature 0.5.1) one session wrote two acceptance-scenario
records in two repositories and ran them for 20+ minutes each.

1. **A record outside the hook cwd was never gated.** The Backend record was written with
   `cd /…/boostree-crm && python3 … docs/acceptance-scenarios-snippet.json` (relative path).
   That repository is outside the session's working directory, so Claude Code reset the shell
   cwd and the hook received the Client project as `cwd`. `shellRecords` resolved the relative
   name against that cwd (no such file) and walked only that cwd. The session ledger held the
   Client record six times and the Backend record never: Stop never checked it.
2. **A long run looked like a missing run.** `scenarios.mjs run` wrote the record only after
   every scenario and the existing tests finished. During a 20-minute run every Stop reported
   the newly added scenario as `pending`, the same text as a run never started.
3. **An interrupted run kept old passes.** For the same reason a run killed midway left the
   previous run's `pass` results in place, so `check` could accept a record whose last run
   never finished after a code change.

## Decisions

| # | Options | Chosen | Why |
|---|---|---|---|
| 1 | parse `cd` / require absolute paths / look under the directories the command names | **directories the command names** | No shell interpretation (a token split, unquote, after `=`); covers `cd`, `pushd`, `git -C`, `--dir=`; still filtered by the PreToolUse stamp and the checked-out rule, so reads (F28) and other sessions' files stay out. Requiring absolute paths relies on the model. `/`, `$HOME` and system folders are never walked. |
| 2 | stop gating while a run is in progress / say so and keep gating | **mark results `running`, save after each, keep gating** | G6 still holds (a running record is not complete). The run first marks every result `running` and saves after each one, so an interrupted run leaves `running`, never earlier passes (fixes 3). A temp-dir marker `{pid, startedAt}` keyed by the record path lets Stop say "still running (pid, started); wait" or "interrupted; run it again". The block counter is unchanged, so a hung run cannot trap the session. |
| 3 | `run --only <ids>` | **not added** | A partial run cannot show that the other scenarios still pass after the code changed, which G5 ("the last run") requires. The record has no code fingerprint to tell a code change from a record-only change; adding one would make the check depend on every unrelated file. The 20-minute cost in the session came from adding a scenario after the code change, which needs a full run anyway. |

## Verification

- `tests/feature-stop-hook.test.mjs` F27 (cd out of the project, relative write → the
  session's; fails on the 0.5.1 hook, passes now), F28 (a record only read in a named
  directory → not the session's), F29 (live marker → "still running (pid …)", dead pid or no
  marker → "interrupted"), both hosts.
- `tests/scenarios-record.test.mjs`: a run killed with SIGKILL during the first check leaves
  every result `running`, `check` reports it, the marker names a dead process; a finished run
  saves every result and removes the marker.
- `pnpm check`: 186 tests pass, 0 fail (skills validator, Codex manifests, check:core, tests). The ledger record `docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json` (F1–F29, R1–R2) passes `scenarios.mjs run`.
- Not run: host evals (paid) and a live host session with the new hook.
