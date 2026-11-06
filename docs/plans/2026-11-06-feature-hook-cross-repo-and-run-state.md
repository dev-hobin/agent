# 2026-11-06 hobin-feature: record tools observed by hooks, and run state

## What was observed (hobin-feature 0.5.1, one CRM session on Claude Code)

1. **A record outside the hook cwd was never gated.** The Backend record was written with
   `cd /…/boostree-crm && python3 … docs/acceptance-scenarios-snippet.json` (relative path).
   Claude Code reset the shell cwd to the project, so the hook got that cwd, resolved the relative
   name against it (no such file) and walked only that cwd. The ledger held the Client record six
   times and the Backend record never.
2. **A long run looked like a missing run, and an interrupted run kept old passes.** `run` wrote
   the record once at the end: a 20-minute run read `pending` on every Stop, and a run killed
   midway left the previous run's `pass` for `check` to accept.

## Approaches dropped, and why

| Revision | Registration came from | Dropped because |
|---|---|---|
| 1 | Shell text: directories a command named, walked for records | Measured walk cost (user review): 2.7 s on `/private/tmp/claude-501`; 4.6 s and 743 records that were not the session's on the macOS temp directory. A heuristic over shell text either misses (`python3 -c` writing a computed path) or over-claims (a named parent folder). The user rejected inference |
| 2 | The scripts appending to the hook's ledger, with the session id from `CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID` and the ledger in an `os.tmpdir()` both had to share | Depends on host details the plugin does not own: a sandbox that gives commands their own `TMPDIR`, a renamed variable or `env -i` silently stops registration; checks run by `run` had to strip the id. The user asked for the shared-TMPDIR assumption to be removed, not documented |
| 3 | Marker lines (`hobin-feature-record: <path>`) printed by the scripts, parsed from every tool's output | Still inference, over text: any output or file the session reads can carry a marker, re-printed check output had to be neutralized, background runs are invisible, and output truncation or a different response shape breaks it |

## Research (host sources, read for this design)

| Host fact | Source |
|---|---|
| Claude Code plugins can bundle a stdio MCP server (`.mcp.json` at the plugin root, `${CLAUDE_PLUGIN_ROOT}` expanded); its tools are named `mcp__plugin_<plugin>_<server>__<tool>` | code.claude.com/docs/en/plugins/components.md, mcp.md |
| PreToolUse / PostToolUse / PostToolUseFailure fire for MCP tools with structured `tool_input`; a matcher must name the full `mcp__plugin_<plugin>_<server>__` prefix, a bare server name never matches | code.claude.com/docs/en/hooks.md |
| Hooks get `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`, persistent across sessions and updates) | hooks.md, plugins reference |
| Stop input carries `background_tasks` | hooks.md |
| The transcript format is explicitly unstable: never parse it | sessions.md |
| MCP calls longer than 2 min move to the background (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`) | mcp.md |
| Codex 0.166 (`rust-v0.166.0`): `.codex-plugin/plugin.json` `mcpServers` (a `./` path or inline) or `<plugin_root>/.mcp.json`; the file may be `{"mcpServers": {...}}` or a bare map | `core-plugins/src/manifest.rs:48-74`, `core-plugins/src/loader.rs:76,1150-1163`, `codex-mcp/src/plugin_config.rs:44-71` |
| A relative `cwd` resolves against the plugin root; the legacy format does not expand `${PLUGIN_ROOT}` | `codex-mcp/src/plugin_config.rs:322-331` |
| Stdio MCP servers run outside the sandbox | `rmcp-client/src/stdio_server_launcher.rs:451-480` |
| PreToolUse and PostToolUse fire for MCP tools with `tool_name` `mcp__<server>__<tool>` (server name sanitized to `[A-Za-z0-9_]`, hash-suffixed only on a collision) and structured `tool_input` | `core/src/tools/handlers/mcp.rs:139-161,493-545,592-598`, `codex-mcp/src/tools.rs:113-150,228-234`, `codex-mcp/src/mcp/mod.rs:603-618` |
| The hook `session_id` is the root thread id; hooks get `PLUGIN_DATA` and `CLAUDE_PLUGIN_DATA` | `core/src/hook_runtime.rs:207`, `hooks/src/engine/discovery.rs:311-319` |
| Codex has a SessionEnd hook event | `hooks/src/events/session_end.rs` |
| Default MCP tool timeout 300 s in source, 60 s in the docs: set `tool_timeout_sec` / `startup_timeout_sec` explicitly | Codex config docs; source default |
| Approval: under `auto`, an MCP tool needs approval unless `readOnlyHint: true`, or `destructiveHint: false` and `openWorldHint: false`; with approval policy `never` and a restricted sandbox, a tool that needs approval is denied | `core/src/mcp_tool_call.rs:2545-2576,1655-1663` |

Re-read for this revision at the tag: `plugin_config.rs`, `manifest.rs`, `loader.rs`
(`.mcp.json` default, `mcpServers` path), `handlers/mcp.rs` (hook tool name and payloads),
`codex-mcp/src/tools.rs` and `mcp/mod.rs` (namespace sanitizing), and the `hooks/src/events`
listing; then `rmcp-client/src/stdio_server_launcher.rs:451-480` (the server is a plain
`Command` with the configured cwd and env, no sandbox wrapper), `core/src/hook_runtime.rs:207`
(`session_id` from the session), `hooks/src/engine/discovery.rs:311-319` (`PLUGIN_DATA`,
`CLAUDE_PLUGIN_DATA`), `core/src/mcp_tool_call.rs:1655-1663,2545-2576` (`never` denies a call that
needs approval; `requires_mcp_tool_approval` and the `auto|prompt|writes|approve` modes) and
`config/src/mcp_types.rs:27-35,289,443` (`AppToolApproval`, `default_tools_approval_mode`) with
`codex-mcp/src/server.rs:486-518` (per-server approval mode used for each call). The default tool timeout was not re-read; the config sets it.

Live on this machine (Claude Code 2.1.316, `claude -p --model haiku --plugin-dir
claude/plugins/hobin-feature`, the installed 0.5.1 plugin disabled, default permission mode):
the model loaded `…__check` through ToolSearch and called it with no permission denial
(`permission_denials: []`); a second run called `…__init`, said DONE, and the Stop hook sent it back
with "A record this session registered is not complete…" naming the new record. Live on Codex 0.166 (`codex exec --dangerously-bypass-hook-trust -c approval_policy=never`
in an isolated `CODEX_HOME` with a copy of the user's auth, removed afterwards; run at the user's
request): the model called `init` (status completed, so no approval was needed under `never`),
said DONE, and Stop sent it back three times (MAX_BLOCKS) for the new incomplete record. A
capture hook beside the real one recorded the PostToolUse input: `tool_name`
`mcp__hobin_feature__init` / `mcp__hobin_feature__decline`, `tool_input` the arguments as an
object, `tool_response` the MCP result object `{"content": [...], "isError": false}`. A refused
`init` (status failed) fired no PostToolUse at all. Codex clamps a SessionEnd hook timeout to 3 s;
the Codex hooks.json now says 3.

Checked on this machine: an isolated `codex plugin add` then `codex mcp list --json` lists
`hobin_feature` (stdio, `node ./scripts/records-mcp-server.mjs`, `cwd` the installed plugin root,
timeouts 20 s / 60 s); an isolated `claude plugin install` then `claude mcp list` reports
`plugin:hobin-feature:hobin_feature … ✔ Connected`.

## Design (0.6.0): record operations are plugin tools observed by hooks

**The tool/shell split.** Record operations (`init`, `register`, `check`, `decline`) are tools of
a stdio MCP server the plugin ships (`scripts/records-mcp-server.mjs`, the same file on both
hosts; the logic lives in core `scripts/record-tools.mjs`, shared with the CLI). Stdio MCP
servers run outside the host sandbox, so the server must never execute project commands: it
only reads and creates record files and keeps no session state. Running scenario checks and the
existing tests stays `scenarios.mjs run <record>` in the shell, under the host's sandbox and
approvals. Paths given to the tools are absolute (the server's working directory is the plugin
root on Codex, not the project).

| Concern | Source of truth |
|---|---|
| The session started the skill (obligation) | unchanged: Claude PostToolUse `Skill` with `tool_input.skill` matching `(^\|:)developing-features$`, UserPromptSubmit starting `/developing-features` or `/hobin-feature:developing-features`; Codex UserPromptSubmit containing `$developing-features`, a shell command containing this plugin's SKILL.md path |
| A record is the session's | a successful PostToolUse for `mcp__plugin_hobin-feature_hobin_feature__(init\|register\|check)` (Claude) or `mcp__hobin_feature__(init\|register\|check)` (Codex; hooks.json passes the host to the script), by `tool_input.path`, which must name an existing record file; a Codex result marked `isError` does not count (Claude sends failures to PostToolUseFailure, which this hook does not receive). Edit tools register their exact path. Nothing else: no shell text, output, environment, shared directory or tree |
| Release without a record | a successful `decline` call with a non-empty `tool_input.reason`; lifts only the "no record yet" obligation |
| Where state lives | the host's plugin data directory (`CLAUDE_PLUGIN_DATA`; Codex `PLUGIN_DATA` / `CLAUDE_PLUGIN_DATA`), `hobin-feature-sessions/<kind>-<session_id>`; `os.tmpdir()` only when neither is set. SessionEnd deletes the session's files; Stop and SessionEnd prune files older than 7 days |
| Run state | in the record: `verification.run = { startedAt, lastProgressAt }` while `run` works, results `running`, saved after each scenario and the existing tests, deleted when the run ends (also on a throw). `check` and Stop report "a scenarios.mjs run started at … (last progress …) has not finished; if it is still running wait for it, do not start another; if it stopped, run it again." No liveness claim. On Claude, Stop adds "background tasks are still running" when `background_tasks` is non-empty |
| Stop without a record | names this host's `init`, `register` and `decline` tools exactly, and says shell `scenarios.mjs` registers nothing |

**No permission prompt.** The record tools run on every feature session, so a prompt per call
is not acceptable.
- Claude Code: a PreToolUse hook matched to exactly
  `mcp__plugin_hobin-feature_hobin_feature__(init|register|check|decline)` returns
  `permissionDecision: "allow"`. The docs: allow "skips the permission prompt", and deny and ask
  rules still apply ("PreToolUse hook decisions don't bypass permission rules", permissions.md),
  so a user's deny rule still wins. Other ways were checked and rejected: a plugin `settings.json`
  cannot carry permissions ("Only two keys take effect from a plugin, `agent` and
  `subagentStatusLine`", plugins/components.md); SKILL.md `allowed-tools` grants only "during the
  turn that invokes the skill" and clears on the next message (skills.md); `readOnlyHint` changes
  only parallelism, not permission (mcp.md).
- Codex: `check` is `readOnlyHint: true` and the others `destructiveHint: false`,
  `openWorldHint: false`, which the default `auto` mode runs without asking; the plugin's server
  config also sets `default_tools_approval_mode: "approve"`, so a `never` policy does not deny them.
  The mode comes from the server's effective config (`codex-mcp/src/server.rs:486-518`,
  `binding.rs:343-346`), so a user's own `mcp_servers.hobin_feature` settings can still change it.

**Alternatives to MCP, considered.**
- Claude Skill tool with arguments: its input schema and any `args` are not documented, and it is
  listed "Permission required: Yes" (tools-reference.md). Codex has no skill tool at all (skills are
  read as files).
- Slash commands and LSP servers: user-typed or diagnostics-only; not model-callable operations.
- Edit tools only (Write/Edit, apply_patch): already structured and kept, but `register` of an
  existing record would need a pointless edit, `decline` a file in the work tree, and `init` the
  model retyping the template.
- Shell, its output, transcripts: inference (revisions 1–3), and transcripts are explicitly
  unstable (sessions.md).
So a plugin MCP server is the only mechanism both hosts offer for a model-called operation with
structured arguments that hooks observe. Its costs: one small node process per session, tools
deferred behind ToolSearch on Claude (the model loads them first; SKILL.md names them exactly),
and the 2-minute auto-background threshold (the tools return in milliseconds).

**Kept for people.** `scenarios.mjs init|check|decline` stay on the command line; they register
nothing, and the CLI `decline` says so.

## Not added: `run --only`

A partial run cannot show that the other scenarios still pass after a code change (G5, "the last
run"); the record has no code fingerprint to tell a code change from a record-only change.

## What host changes would break this

- The MCP tool naming (`mcp__plugin_<plugin>_<server>__<tool>`, `mcp__<server>__<tool>`), or
  PostToolUse no longer firing for MCP tools / no longer carrying `tool_input`. Then records stop
  registering and Stop asks for the tools (a visible block, not a silent pass). Edit-tool
  registration is unaffected.
- Codex dropping `mcpServers` / `.mcp.json` loading or plugin-root `cwd` resolution: the server
  does not start; same visible block.
- The plugin data variables disappearing: state falls back to the OS temp directory, which only
  the hook uses, so it still works within a session.
- The Skill tool's name or `tool_input.skill`, the UserPromptSubmit `prompt` field, the Codex
  `$skill` mention syntax, or the SKILL.md install path: the obligation does not start and only
  registered records are gated (as in 0.5.1).

## Verification

- `tests/feature-stop-hook.test.mjs` (both hosts). Record tool calls go through the real server
  over stdio, and the hook gets that host's PostToolUse input. The hook's TMPDIR changes on every
  call and no shell is involved in registration. F7 init registers a record outside the hook cwd;
  F8 refused calls (overwrite, bad name, relative path) register nothing; F9 register and check
  register only the named record, check reports problems as a successful call; F15 another
  host's tool name, a bare server name, other servers, unknown tools, missing or non-record paths
  and an `isError` result register nothing; F17 check registers a control record; F20 shell
  `scenarios.mjs` and the compiler register nothing, whatever they print; F22 a shell-only record
  after the skill starts → Stop names this host's tools; F23 decline (empty reason rejected), CLI
  decline records nothing; F24 decline does not exempt; F30 SessionEnd cleanup and 7-day prune in
  the plugin data directory; F31 server round trip (initialize, tools/list annotations, each tool,
  unknown tool and method); F18 wiring (Claude matcher with the full MCP prefix, Codex config as
  Codex resolves it, identical scripts, no session env, pid or marker left, no `child_process` in
  the record tools; the Codex server config sets `default_tools_approval_mode: "approve"`); F32
  Claude PreToolUse allows exactly the four record tools and nothing else, Codex prints nothing;
  F29 a run killed midway is reported (and background tasks on Claude); kept
  F1–F4, F6, F10–F14, F16, F19, F21, F25–F27.
- `tests/scenarios-record.test.mjs`: killed, finished, failing and throwing runs.
- Mutation checks on the Codex hook copy: ignoring `isError` fails F8/F15; skipping the
  SessionEnd clear or the Stop prune fails F30; matching any `mcp__…__<tool>` fails F15.
- `pnpm check`: 189 tests pass, 0 fail. `pnpm check:claude` passes (only the existing icon warnings);
  `pnpm check:install -- claude` and `-- codex` pass. The record
  `docs/plans/acceptance-scenarios-feature-stop-hook-ledger.json` passes `scenarios.mjs run`.
- Not run: paid host evals; a live model session calling the tools.
