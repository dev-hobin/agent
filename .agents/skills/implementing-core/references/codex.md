# Codex implementation recipe

Pinned to codex-cli 0.165.0, `openai/codex` @ f752c97f, `openai/plugins` @ 0722921d, and
documentation fetched 2026-10-30 ([research](../../../../docs/research/2026-10-30-codex.md)).
When Codex changes, update this file first, then re-run the skill for every capability.

## Layout

```text
.agents/plugins/marketplace.json          repository root; source "./codex/plugins/<plugin>"
codex/
  IMPLEMENTS.json                          spec hash, copies, and eval paths per capability
  plugins/<plugin>/
    .codex-plugin/plugin.json              Codex manifest (no root plugin.json; see below)
    hooks/hooks.json, scripts/<name>-hook.mjs   hooks for results that must always hold
    skills/<skill>/SKILL.md
    skills/<skill>/agents/openai.yaml
    skills/<skill>/references/…            role text and copies of core knowledge
    skills/<skill>/scripts/…               copies of core scripts
  evals/<plugin>/<scenario>/               plugin-eval benchmark per spec §8 scenario
```

## Spec to Codex form

| Spec | Codex form |
| --- | --- |
| identity | `.codex-plugin/plugin.json` with `name`, `version`, `description`, `author`, `license`, `homepage`, `repository`, `keywords`, `skills: "./skills/"`, `hooks: "./hooks/hooks.json"` when the plugin has hooks, and `interface` (`displayName`, `shortDescription`, `developerName`, `defaultPrompt` ≤ 3 × 128 chars). No root `plugin.json`: Codex 0.166 hides a plugin's hooks when a root Agent Plugins manifest exists, whatever its `extensions.com.openai.hooks` says (checked with the app-server's `plugin/read` and `hooks/list`). When Codex reads hooks from the root manifest, return to the root Agent Plugins `plugin.json`; `checkPortablePlugin` and the pinned schema are kept for that |
| §1 description | `SKILL.md` frontmatter `name`, `description`, `metadata.short-description`; Codex reads nothing else |
| §1 display | `agents/openai.yaml` `interface.display_name`, `short_description`, `default_prompt` |
| §2 explicit only | `agents/openai.yaml` `policy.allow_implicit_invocation: false`; the user runs `$<plugin>:<skill>` |
| §5 scripts | `scripts/` in the skill directory, called as `sh <this skill's directory>/scripts/<file>` |
| §6 delegation | Plugins cannot ship agents and Codex ignores plugin-root `agents/`. Write it as instructions: spawn one subagent per role and wait for all; give each the role text in `references/reviewer.md`, its knowledge file path, the target, and the context. Subagents inherit the sandbox, so tell them not to edit |
| §7 knowledge | `references/perspectives/<id>.md` inside the skill |
| §4 guarantees | Explicit invocation: enforced. Read-only reviewers: instructed only (no per-agent sandbox). Anything the skill asks for: instructed |

### Output contracts

For a capability with `assets/output-contract.json`, copy
`core/shared/scripts/output-contract.mjs` and `core/shared/scripts/session-registry.mjs` (which
it imports) into each such skill's `scripts/` and the contract into its `assets/`. The skill procedure starts the result with
`node <this skill's directory>/scripts/output-contract.mjs new <this skill's directory>/assets/output-contract.json <file>`
and ends only when `… check …` passes. The plugin's `scripts/output-contract-hook.mjs`
enforces it as described below. The `output_contract` scenario check runs in the
plugin-eval verifier.

The bundled Codex skill `review-agent` exists; keep skill names distinct from it.

### Must-hold results: plugin hooks

Codex loads lifecycle hooks bundled with an enabled plugin (on by default; the user trusts
them once with `/hooks`, and Codex records trust against the hook's hash). Declare them as
`hooks` in `.codex-plugin/plugin.json`. To see what Codex discovered without a model call, ask
`codex app-server` for `plugin/read` (the plugin's `hooks`) and `hooks/list` (trust status). Codex has no skill-scoped hooks, so plugin hooks apply to every session
and must act only on the skill's own results. Every guarantee the spec backs with a script
(an output contract or a `script_passes` check) gets one, and the guarantee is
**enforced once the user trusts the plugin hooks**:

- For a result file, register `node "$PLUGIN_ROOT/scripts/<name>-hook.mjs" codex` on
  `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop` and `SessionEnd`, without a
  matcher: file edits arrive as `apply_patch`, and a missing matcher keeps the hooks working if
  a tool is renamed; the script decides by the input's shape. The shared
  `scripts/hook-input.mjs` keeps the session registry
  (`core/shared/scripts/session-registry.mjs`, copied next to the skill's scripts):
  SessionStart creates `<start dir>/.hobin-<name>/sessions/<session_id>.jsonl` (UserPromptSubmit
  in the event `cwd` if missed); the skill's scripts register what they make or check with
  `CODEX_SESSION_ID`, stop with exit 2 without a registry (so untrusted hooks are never silent),
  and refuse `--no-gate` with one; PostToolUse checks and registers the results an apply_patch
  wrote (Add File, Update File, Move to). Nothing is inferred from shell text, command output,
  file times or transcripts. The scripts are the Claude plugin's, unchanged.
- `Stop` for "finish only when the check passes": check exactly the registry's files, exit 2
  while one fails or is missing, and let Codex stop after three blocks in a row. hobin-feature's
  record gate uses the same registry with its own hook. A checker that throws exits 1, never 2.
  SessionEnd deletes the registry and state; Stop prunes week-old ones.
- Hook input, observed in Codex 0.166 (2026-11-05): the model runs shell commands through
  the code-mode `exec` tool (`tools.exec_command({cmd})`), but hooks receive them as
  `tool_name: "Bash"` with `tool_input.command`. `apply_patch` arrives as `apply_patch` with
  the patch text in `tool_input.command`. Every tool call has a `tool_use_id`, and
  `session_id` is the thread id. `codex exec` runs plugin hooks only with
  `--dangerously-bypass-hook-trust`; trust stored through `/hooks` (and shown as `trusted` by
  the app-server's `hooks/list`) did not make it run them.
- `tests/hooks.test.mjs` proves each hook with an apply_patch input;
  `tests/result-hooks-registry.test.mjs` and `tests/feature-stop-hook.test.mjs` prove the
  registry hooks scenario by scenario on both hosts' inputs.

The skill still runs the check itself at the step the spec names. Copy each spec script
into the skill's `scripts/` with any assets it reads.

## Scenarios as plugin-eval benchmarks

```text
codex/evals/<plugin>/<scenario>/
  benchmark.json    kind "plugin-eval-benchmark", schemaVersion 2, version 2,
                    targetKind "plugin", targetName <plugin>,
                    runner { type "codex-cli", model, sandbox "workspace-write", approvalPolicy "never" },
                    workspace { sourcePath "codex/evals/<plugin>/<scenario>/workspace", setupMode "copy" },
                    targetProvisioning { mode "workspace-plugin-marketplace" },
                    verifiers { commands: [ scenario check command ] },
                    scenarios [ { id, title, purpose, userInput "$<plugin>:<skill> " + presentation + request } ]
  base/, change.patch   copies of the scenario fixture
```

`codex/evals/prepare.sh <plugin> <scenario>` builds `workspace/` (changed tree plus
CHANGE.diff, gitignored) before a run. The verifier command is
`node "$HOBIN_AGENT_ROOT/.agents/skills/implementing-core/scripts/scenario-check.mjs" "$HOBIN_AGENT_ROOT/core/<id>/scenarios/<scenario>/scenario.yaml" "$HOBIN_AGENT_ROOT/codex/evals/<plugin>/<scenario>/workspace" . --ignore plugins/ --ignore .agents/plugins/`
— exit 0 when every file-based check passes. plugin-eval copies the plugin into the run's
workspace (`plugins/<plugin>/`, `.agents/plugins/marketplace.json`); `--ignore` keeps those
out of every check. It lists the plugin as available but never installs it, so the plugin's
hooks never run there: a run measures the skill only. Hook-enforced guarantees are checked by
`pnpm check:live -- codex` instead. `tests/evals.test.mjs` pins these fields. `command_passes` runs there
too (the checker copies the scenario's hidden files in first). A scenario without `change`
is prepared by copying `base/` only.

Triggers: plugin-eval has no skill-selection verifier. List `triggers.yaml` as not covered
on Codex in `IMPLEMENTS.json` (`"triggers": "unsupported: …"`) rather than inventing one.

## Verify

```sh
pnpm check:standard                      # Agent Plugins schema and Agent Skills fields
pnpm check:install -- codex              # model-free native install and skill listing
HOBIN_AGENT_ROOT="$PWD" sh codex/evals/prepare.sh <plugin> <scenario> && \
  HOBIN_AGENT_ROOT="$PWD" plugin-eval benchmark codex/plugins/<plugin> \
  --config codex/evals/<plugin>/<scenario>/benchmark.json --model <model>
```

`plugin-eval` comes from `openai/plugins` (plugins/plugin-eval); running it executes that
downloaded code and calls models, so it needs the user's approval.
