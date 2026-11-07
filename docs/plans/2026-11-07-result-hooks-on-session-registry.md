# 2026-11-07 Result hooks (review, stances, learning) on the shared session registry

Status: approved (user, 2026-11-07), option (a). Follows the hobin-feature registry design
(`2026-11-06-feature-records-carry-their-session.md`) after that ships.

## Problem

`hook-input.mjs` (shared by the review, stances and learning result hooks, both hosts) decides
"this session's results" with the mechanisms hobin-feature dropped:
- shell command text: `.md` names pulled out by regex (`NAMED`), files found by name under the cwd;
- times: a PreToolUse stamp per call, file mtimes, the transcript file's birth time (both hosts call
  the transcript format unstable), `git log` dates to tell a checkout from a write;
- a ledger and stamps in `os.tmpdir()`.
Each is inference with known misses or false claims, and the ledger depends on the hook's TMPDIR.

## Design (same structure as hobin-feature, no new mechanism)

The skills already have scripts that make or check a result:

| Plugin | Starts a result | Checks a result |
|---|---|---|
| learning | `output-contract.mjs new <contract> <file>` | `output-contract.mjs check <contract> <file>` |
| stances | `stances.mjs block <target>` (SKILL: "Do not write the block text by hand") | `stances.mjs check <file>` |
| review | — | `check-report.mjs <file>` |

1. Each plugin creates its session registry at SessionStart (UserPromptSubmit if missed) with
   `core/shared/scripts/session-registry.mjs`, folder `.hobin-<plugin>` in the start directory.
2. Those scripts register the file they make or check (fail closed as in hobin-feature: with a
   session id and no registry they stop and say why; `--no-gate` proceeds unregistered; no session
   id, a person, proceeds).
3. Edit tools register result files (Claude Write/Edit/MultiEdit `file_path`; Codex `apply_patch`
   paths), as now; the `check(file, text)` content test decides whether a file is a result.
4. Stop checks exactly the registry's files with the plugin's `check`. SessionEnd removes the
   registry; Stop prunes week-old ones.
5. Removed from `hook-input.mjs`: shell-text parsing, the PreToolUse stamp, mtimes, the transcript
   time, `git log` dating, the `os.tmpdir()` ledger. PreToolUse and PostToolUseFailure hooks go.

## Decision: shell-only results

A result the model writes only through shell redirection, without the skill's script and without
an edit tool, is not registered. Today's hooks try to catch it by parsing the command (inference).
Options:
- (a) Close it in the procedure: review gets a starter (`check-report.mjs new <file>`), so every
  result starts from a script or an edit tool, like learning and stances already do. A shell-only
  result then means the procedure was skipped twice. No hook inference.
- (b) An obligation as in hobin-feature (the skill started → a result or a decline is required).
  Not fitting: these skills write a file only when the user asks for one.
Chosen: (a) (user, 2026-11-07).

## Verification plan

Unit tests per plugin on both hosts' inputs (registry creation, scripts register/refuse,
`--no-gate`, edit-tool registration, Stop checks only registry files, another session never gates,
cleanup); mutation checks (Stop ignoring the registry; scripts proceeding without one); a short
`check:live` per host for one result plugin; the plugins' existing evals.
