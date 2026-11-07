# 2026-11-06 hobin-feature: a session registry the scripts must write (replaces the MCP record tools)

Status: approved direction (user, 2026-11-06/07). Supersedes the "record tools observed by hooks"
design in `2026-11-06-feature-hook-cross-repo-and-run-state.md` before 0.6.0 is released.

## Why the MCP design is replaced

Every host-specific addition in the MCP design came from one choice: registration went through a
model-called channel (plugin MCP tools) whose availability, permission and observability differ
per host and per evaluation tool.

| | Claude session | `claude plugin eval` | Codex session | Codex plugin-eval |
|---|---|---|---|---|
| Hooks (Stop, PostToolUse, UserPromptSubmit) | run | run; a Stop block is honored (trace of `results/2026-11-06T09-11-47-803Z`) | run only when trusted (`hooks/src/engine/discovery.rs:917-923`); re-trust after every plugin update (`plugin_trust.rs:40-43`) | not loaded: the plugin is listed `AVAILABLE`, never installed (`benchmark-workspace.js:81-111`; `core-plugins/src/loader.rs:855-960`) |
| Plugin MCP tools | prompt unless a PreToolUse hook allows | mocked unless `--mocks off`; need an operator grant (plugin-evals.md) | need annotations / `default_tools_approval_mode` | not loaded |
| Shell, edit tools, files | work | work (Bash/Write/Edit granted) | work | work |
| Session id in shell commands | `CLAUDE_CODE_SESSION_ID` = hook `session_id` (env-vars.md) | same | `CODEX_SESSION_ID` = hook `session_id` (`core/src/exec_env.rs` `inject_session_env`, `core/src/hook_runtime.rs:207`, rust-v0.166.0) | n/a |

## Why records are registered, not searched for

A hook that searches for records always has a blind spot: no host tells a hook where a shell
command wrote a file. Surveyed (sources in the research notes of this conversation, 2026-11-06):
tdd-guard, ralph-loop and hookify keep state at a fixed path in the session's directory and do not
handle other repositories; the official security-guidance plugin handles other repositories by
parsing Bash command text (the inference this plugin rejected); Claude `CwdChanged` misses
subshells, absolute paths and subagents (and has an open plugin bug, #105625), `FileChanged` watches
named files only; Codex has neither event and no way for a hook to give shell commands a variable.
So the scripts register records at the moment they create or run them, and fail when they cannot.

## Live checks behind this design (2026-11-07, this machine)

A probe plugin (hooks log their input and the environment; SessionStart creates the registry):
- Claude Code 2.1.316, `claude -p --plugin-dir`: SessionStart ran and created
  `<start dir>/.hobin-feature/sessions/<id>.json`; every Bash command, and a subagent's Bash command,
  saw `CLAUDE_CODE_SESSION_ID` equal to the hook `session_id`; after `cd sub` Bash stayed in `sub`
  and the hook `cwd` of later events (Stop included) was `sub`, so the hook must not locate the
  registry from its current `cwd`.
- Codex 0.166, `codex exec` in the dedicated home (`~/.cache/hobin-live-codex`), default model:
  SessionStart ran and created the registry; shell commands saw `CODEX_SESSION_ID` (and
  `CODEX_THREAD_ID`) equal to the hook `session_id`; each command started in the session directory
  again after an earlier `cd sub`; hook `cwd` stayed the session directory.

## Design

1. **The session registry.** On SessionStart the hook creates
   `<start dir>/.hobin-feature/sessions/<session_id>.jsonl` (and `<start dir>/.hobin-feature/.gitignore`
   containing `*`, so the work tree shows nothing). `<start dir>` is the SessionStart `cwd`; the hook
   remembers it in the plugin data dir for the session and uses that, not a later `cwd`. If
   SessionStart was missed (plugin enabled mid-session), UserPromptSubmit creates it the same way
   (Claude: `CLAUDE_PROJECT_DIR`; Codex: the event `cwd`).
2. **Scripts must register (fail closed).** `scenarios.mjs init | register | run | decline` take the
   agent session id from `CLAUDE_CODE_SESSION_ID` or `CODEX_SESSION_ID`, look for
   `.hobin-feature/sessions/<id>.jsonl` in their working directory and its parents, and append one
   line `{"file": "<absolute path>", "at": "…"}` (append-only; small appends are atomic). The
   registry code is the shared module `core/shared/scripts/session-registry.mjs`; it names no
   plugin-specific concept. All session variables present are tried (Codex started from a Claude
   Code shell inherits `CLAUDE_CODE_SESSION_ID`; found in the live Codex check).
   - Found: proceed. Records anywhere (another repository included) register by absolute path.
   - Session id present, registry not found or not writable: exit 2 without creating or running
     anything: "No hobin-feature registry for this agent session above <cwd>. Run scenarios.mjs from
     the directory the session started in and pass the record's absolute path. If the hobin-feature
     hooks are not active in this session (Codex: trust them in /hooks; evaluations that do not
     install the plugin), pass --no-gate: nothing will stop the session for this record."
   - No session id (a person at a terminal): proceed without registering.
   - `--no-gate`: proceed without registering, and print that no Stop gate covers the record.
   - `check` stays read-only and registers nothing.
   - Records carry no session ids; ownership lives only in the registry, so committed records stay
     free of session data.
   - `run` keeps removing the session id variables from the commands it runs, so scenario checks
     that call `scenarios.mjs` act as a person, not as the session.
3. **Edit tools register too.** A record file the session writes with Write/Edit/MultiEdit (Claude
   `tool_input.file_path`) or `apply_patch` (Codex patch grammar `*** Add|Update File:`,
   `*** Move to:`) is appended to the registry by the PostToolUse hook.
4. **Stop reads the registry.** It gates every record listed in the session's registry (missing files
   reported as such). No directory search at all.
5. **Obligation.** Unchanged signals (skill start). With an obligation and an empty registry, Stop
   blocks and names `node "<abs scripts>/scenarios.mjs" init <absolute path>`, `register <path>`,
   `decline <path> --reason "…"`, and says to run them from the session's start directory.
6. **Decline is a record.** `decline <path> --reason` writes a record with
   `"declined": {"reason", "at"}` and registers it; `check` passes it with a non-empty reason; it lifts
   only the "no record yet" obligation.
7. **Cleanup.** SessionEnd deletes the session's registry file and plugin-data state; Stop prunes
   registry files older than 7 days in the start directory.
8. **Run state** (`verification.run`) stays as is.

**Where the hook-side lifecycle lives (2026-11-07).** Steps 1, 3 and 7 (the start directory remembered
at SessionStart with the `CLAUDE_PROJECT_DIR` / event-cwd fallback, edit-tool paths on both hosts,
registry creation at SessionStart/UserPromptSubmit, SessionEnd removal, week-old pruning, and the
session state in the plugin data directory with the Stop block counter) are now `hookSession` in the
shared module `core/shared/scripts/session-registry.mjs`, the same code the result hooks use
(`2026-11-07-result-hooks-on-session-registry.md`). `scenarios-stop-hook.mjs` keeps only what is
hobin-feature's: what Stop gates (records via `scenarios.mjs` / `compile-control-model.mjs`), the
obligation (kept as one more state file), its messages and its three-block limit; `records.mjs` no
longer holds hook state.

## What remains host-specific, stated

- **Codex hooks run only after the user trusts them, and again after each update** (official
  plugins accept this: plugins with hooks are excluded from the public directory; replayio documents
  its hook as a "safety net"). With this design the gap is not silent: without hooks there is no
  registry, so the first `scenarios.mjs` call stops and says the hooks are not active.
- **Codex plugin-eval never installs the plugin.** It measures the skill only (the model meets the
  "hooks not active" message and uses `--no-gate`). The gate is verified by the shared real-install
  check `pnpm check:live -- claude|codex`.

## What this removes (in addition to the MCP removal already done)

The record `sessions` stamp, the directory search (`findSessionRecords` walking the cwd git root),
and with them the gitignored-record discovery and its cost.

## Verification plan

- Unit (`pnpm check`), both hosts' inputs: registry creation at SessionStart and at
  UserPromptSubmit when missing; start dir remembered across a changed hook `cwd`; scripts find the
  registry from a subdirectory, register an absolute path in another repository, refuse (exit 2,
  nothing written) when the registry is missing with a session id, proceed without one, `--no-gate`;
  append-only lines and duplicate paths; edit-tool and `apply_patch` registration (moves included);
  Stop gates only registry records (another session's registry never gates); obligation message;
  decline; SessionEnd cleanup and prune; `run` hides the session id from its checks.
- Mutation checks: Stop reading the current `cwd` instead of the remembered start dir fails the
  changed-cwd test; scripts that proceed without a registry fail the refusal test.
- `pnpm check:live -- claude|codex`: a session runs `scenarios.mjs init` (in another directory too,
  by absolute path) → Stop blocks; a complete record registered with `register` → Stop passes;
  `cd` elsewhere then `init` → refused with the message.
- Claude `claude plugin eval` (Bash/Write/Edit granted) 3×3; Codex plugin-eval 3×3 as skill-only.
