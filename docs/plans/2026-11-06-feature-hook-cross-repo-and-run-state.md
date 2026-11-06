# 2026-11-06 hobin-feature: structural record registration and run state

## What was observed (hobin-feature 0.5.1, one CRM session on Claude Code)

1. **A record outside the hook cwd was never gated.** The Backend record was written with
   `cd /…/boostree-crm && python3 … docs/acceptance-scenarios-snippet.json` (relative path).
   Claude Code reset the shell cwd to the project, so the hook got that cwd, resolved the relative
   name against it (no such file) and walked only that cwd. The ledger held the Client record six
   times and the Backend record never.
2. **A long run looked like a missing run, and an interrupted run kept old passes.** `run` wrote
   the record once at the end: a 20-minute run read `pending` on every Stop, and a run killed
   midway left the previous run's `pass` for `check` to accept.

## First attempt, rejected: inferring directories from shell text

PR #8's first revision also walked every existing directory a command named. Measured walk cost
(reported by the user's review): 2.7 s on `/private/tmp/claude-501`; 4.6 s and 743 records that
were not the session's on the macOS temp directory. Any heuristic over shell text either misses
(`python3 -c` writing a computed path) or over-claims (a named parent folder). The user rejected
inference: what counts must come from fixed identifiers and from the record tools themselves.

## Design (0.6.0)

| Concern | Source of truth |
|---|---|
| The session started the skill (obligation) | Claude: PostToolUse `Skill` with `tool_input.skill` matching `(^\|:)developing-features$`; UserPromptSubmit `prompt` starting `/developing-features` or `/hobin-feature:developing-features`. Codex: UserPromptSubmit `prompt` containing `$developing-features`; a shell command whose text contains this plugin's `skills/developing-features/SKILL.md` path |
| A record is the session's | the record tools: `scenarios.mjs init|run|check <record>`, `compile-control-model.mjs --baseline|--changes|--gate <record>` append it to the ledger; edit tools register their exact `file_path` / apply_patch path |
| Which session | the host's session id in the command environment, read at call time: `CLAUDE_CODE_SESSION_ID` ("For Bash, PowerShell, and hooks this matches the session_id field in the hook JSON input and is updated on /clear", code.claude.com/docs/en/env-vars.md); `CODEX_THREAD_ID` (codex-rs/core/src/exec_env.rs injects it; the hook's `session_id` is the same ThreadId, codex-rs/hooks/src/events/stop.rs). No id → no registration |
| Release without a record | `scenarios.mjs decline --reason "<why>"` (non-empty reason, needs a session id). It lifts only the "no record yet" obligation; records already registered must still pass (conservative). Stop prints the reason so the report can state it |
| Run state | `run` marks every result `running`, saves after each, keeps `{pid, startedAt}` in the temp directory; Stop says still running or interrupted and keeps blocking (G6) |

Shared helpers live in core `records.mjs` (ledger/obligation/decline naming in the temp
directory, same naming the 0.5.1 hook used). Checks that `run` executes get no session id, so a
check that runs these scripts on fixtures never registers them (F20).

## Not added: `run --only`

A partial run cannot show that the other scenarios still pass after a code change (G5, "the last
run"); the record has no code fingerprint to tell a code change from a record-only change.

## What host changes would break this

- The session id variable names or their equality with the hook's `session_id`
  (`CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`). Then the scripts stop registering and Stop asks
  for a record although one exists (a visible block, not a silent pass).
- The hook and the command running with different temp directories (for example a sandbox that
  sets its own `TMPDIR` for commands). Same effect. On the checked machine both use the same
  `os.tmpdir()`.
- The Skill tool's name or `tool_input.skill`, the UserPromptSubmit `prompt` field, the Codex
  `$skill` mention syntax, or the SKILL.md install path. Then the obligation does not start and
  only registered records are gated (as in 0.5.1).

## Verification

- `tests/feature-stop-hook.test.mjs` (both hosts): F7 `init` after a cd out of the hook cwd is
  registered and gated; F9 run/check register only the named record; F15 no session id registers
  nothing; F5 another session's id does not register here; F17 the compiler registers; F20 checks
  run by `run` do not register (fails without the env strip); F22 a record written only by a
  shell program after the skill starts → Stop asks for one; F23 decline releases and reports, an
  empty reason is rejected; F24 decline does not exempt a registered record; F25 no start and no
  record → allow; F26 Claude Skill/slash starts, others do not; F27 Codex mention/SKILL.md read
  starts, others do not; F18 hook wiring and no inference left; F29 run state; kept F1–F4, F6,
  F10–F14, F16, F19, F21.
- `tests/scenarios-record.test.mjs`: interrupted run leaves `running`; a finished run saves all
  and removes the marker.
- `pnpm check`: 182 tests pass, 0 fail. The record `docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json` (30 scenarios and `pnpm check`) passes `scenarios.mjs run`.
