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

## Second attempt, replaced: session id in the environment plus a shared temp directory

PR #8's second revision had the record scripts append to the hook's ledger themselves: the
session id came from the command environment (`CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`) and
the ledger lived in `os.tmpdir()`, which the hook and the command had to share. Both were
assumptions about the host, not contracts of this plugin: a sandbox that gives commands their own
`TMPDIR`, a host that stops exporting the variable or names it differently, or a command run
under `env -i` would silently stop registration. Checks run by `run` also had to strip the id so
that fixtures did not register. The user asked for the shared-TMPDIR assumption to be removed,
not documented.

## Design (0.6.0): the record tools print, the hook reads tool output

| Concern | Source of truth |
|---|---|
| The session started the skill (obligation) | Claude: PostToolUse `Skill` with `tool_input.skill` matching `(^\|:)developing-features$`; UserPromptSubmit `prompt` starting `/developing-features` or `/hobin-feature:developing-features`. Codex: UserPromptSubmit `prompt` containing `$developing-features`; a shell command whose text contains this plugin's `skills/developing-features/SKILL.md` path |
| A record is the session's | `scenarios.mjs init\|run\|check <record>` and `compile-control-model.mjs --baseline\|--changes\|--gate <record>` print `hobin-feature-record: <absolute path>` on stdout, one line per record. On PostToolUse and PostToolUseFailure of every tool the hook walks every string in `tool_response` (and a failure's `error`), shape-agnostically, including strings that are themselves JSON, and matches lines anchored at line start. A path counts when it is absolute, exists and has a record file name. Edit tools still register their exact `file_path` / apply_patch path |
| Which session | the hook input's `session_id`; the ledger is the hook's own file in the hook process's temp directory. The scripts know nothing about sessions |
| Release without a record | `scenarios.mjs decline --reason "<why>"` prints `hobin-feature-decline: <reason>` (non-empty, one line). It lifts only the "no record yet" obligation; records already registered must still pass (conservative). Stop prints the reason so the report can state it |
| Run state | in the record: `verification.run = { startedAt, lastProgressAt }` while `run` works, results `running`, saved after each scenario and after the existing tests; deleted when the run ends, also on a throw. `check` and Stop treat a present `verification.run` as incomplete: "a scenarios.mjs run started at … (last progress …) has not finished; if it is still running wait for it, do not start another; if it stopped, run it again." No liveness claim: only the record is known |

Why output rather than shared state: the tool's output is the one thing every host already hands
the hook for the same call, in the same session, without either side assuming an environment
variable or a common directory. The scripts stay session-agnostic, and running them outside any
host has no side effect.

What stays out:
- A walk without a record path prints no marker: it may find other sessions' records.
- `run` re-prints a failing check's output with its marker lines prefixed `(from a check) `, so a
  check that creates fixture records never registers them; a passing check's output is not
  printed at all.
- A marker in a file the session reads (Read tool, `cat`) registers that record. This is
  deliberate fail-safe: the worst case is an extra record the session must make pass, never a
  record silently left ungated.

### Limitation: background runs

A command started in the background returns before it prints, so its output never reaches the
hook. The recovery is deterministic: the Stop message for "skill started, no record registered"
says to run `scenarios.mjs init <path>` for a new record or `scenarios.mjs check <path>` in the
foreground for an existing one (or `decline --reason`), and SKILL.md step 1 says the same.

## Not added: `run --only`

A partial run cannot show that the other scenarios still pass after a code change (G5, "the last
run"); the record has no code fingerprint to tell a code change from a record-only change.

## What host changes would break this

- The hook input stops carrying tool output (`tool_response`, or `error` on Claude's
  PostToolUseFailure), or the output is truncated before the marker line. Then registration from
  the record tools stops and Stop asks for a record (a visible block with the recovery command,
  not a silent pass). Edit-tool registration is unaffected.
- The Skill tool's name or `tool_input.skill`, the UserPromptSubmit `prompt` field, the Codex
  `$skill` mention syntax, or the SKILL.md install path. Then the obligation does not start and
  only registered records are gated (as in 0.5.1).

No environment variable and no directory shared between the hook and the command is assumed.

## Verification

- `tests/feature-stop-hook.test.mjs` (both hosts; every script runs with its own `TMPDIR`, the
  hook with another, and the script's real stdout is fed as `tool_response` in the host's shape:
  Claude Bash `{stdout, stderr}` or PostToolUseFailure `error`, Codex a JSON string): F7 `init`
  after a cd out of the hook cwd is registered from its printed line and gated; F9 run/check
  print and register only the named record, a walk prints nothing; F15 a relative, missing or
  non-record path, or a marker not at line start, is ignored; F30 a marker in a read file
  registers (fail-safe); F31 markers register from string, object, JSON-string, nested and
  failure shapes; F5 another session's output does not register here; F17 the compiler prints
  and registers; F20 checks run by `run` never register (passing output not shown, failing output
  neutralized); F22 a record written only by a shell program after the skill starts → Stop asks
  for init, a foreground check or a decline; F23 a printed decline releases and reports, an empty
  reason is rejected; F24 decline does not exempt a registered record; F25 no start and no record
  → allow; F26/F27 obligation sources; F18 hook wiring (every tool, no session env or pid left);
  F29 a run killed midway leaves `verification.run` and Stop/check report it, a finished run
  clears it; kept F1–F4, F6, F10–F14, F16, F19, F21.
- `tests/scenarios-record.test.mjs`: R1 a killed run leaves `verification.run` and `running`, the
  wording carries its times and no liveness claim; R2 a finished run removes it; R3 a failing or
  throwing run removes it.
- Mutation checks: an identity `neutralizeMarkers` fails F20; dropping `error` from the walked
  strings fails F31 on Claude; dropping the JSON-string walk fails F7 on Codex.
- `pnpm check`: 187 tests pass, 0 fail. The record `docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json` passes `scenarios.mjs run`.
