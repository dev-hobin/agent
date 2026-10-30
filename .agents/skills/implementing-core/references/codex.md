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
    plugin.json                            Agent Plugins manifest (canonical in Codex docs)
    skills/<skill>/SKILL.md
    skills/<skill>/agents/openai.yaml
    skills/<skill>/references/…            role text and copies of core knowledge
    skills/<skill>/scripts/…               copies of core scripts
  evals/<plugin>/<scenario>/               plugin-eval benchmark per spec §8 scenario
```

## Spec to Codex form

| Spec | Codex form |
| --- | --- |
| identity | Root `plugin.json` with `$schema: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, `name`, `version`, `description`, `author`, `license`, `homepage`, `repository`, `keywords`, and `extensions.com.openai.interface` (`displayName`, `shortDescription`, `developerName`, `defaultPrompt` ≤ 3 × 128 chars). Codex reads only these root fields |
| §1 description | `SKILL.md` frontmatter `name`, `description`, `metadata.short-description`; Codex reads nothing else |
| §1 display | `agents/openai.yaml` `interface.display_name`, `short_description`, `default_prompt` |
| §2 explicit only | `agents/openai.yaml` `policy.allow_implicit_invocation: false`; the user runs `$<plugin>:<skill>` |
| §5 scripts | `scripts/` in the skill directory, called as `sh <this skill's directory>/scripts/<file>` |
| §6 delegation | Plugins cannot ship agents and Codex ignores plugin-root `agents/`. Write it as instructions: spawn one subagent per role and wait for all; give each the role text in `references/reviewer.md`, its knowledge file path, the target, and the context. Subagents inherit the sandbox, so tell them not to edit |
| §7 knowledge | `references/perspectives/<id>.md` inside the skill |
| §4 guarantees | Explicit invocation: enforced. Read-only reviewers: instructed only (no per-agent sandbox). Anything the skill asks for: instructed |

The bundled Codex skill `review-agent` exists; keep skill names distinct from it.

## Scenarios as plugin-eval benchmarks

```text
codex/evals/<plugin>/<scenario>/
  benchmark.json    kind "plugin-eval-benchmark", targetKind "plugin", targetName <plugin>,
                    runner { type "codex-cli", model, sandbox "workspace-write", approvalPolicy "never" },
                    workspace { sourcePath "codex/evals/<plugin>/<scenario>/workspace", setupMode "copy" },
                    targetProvisioning { mode "workspace-plugin-marketplace" },
                    verifiers { commands: [ scenario check command ] },
                    scenarios [ { id, title, purpose, userInput "$<plugin>:<skill> " + presentation + request } ]
  base/, change.patch   copies of the scenario fixture
```

`codex/evals/prepare.sh <plugin> <scenario>` builds `workspace/` (changed tree plus
CHANGE.diff, gitignored) before a run. The verifier command is
`node "$HOBIN_AGENT_ROOT/.agents/skills/implementing-core/scripts/scenario-check.mjs" "$HOBIN_AGENT_ROOT/core/<id>/scenarios/<scenario>/scenario.yaml" "$HOBIN_AGENT_ROOT/codex/evals/<plugin>/<scenario>/workspace" .`
— exit 0 when every file-based check passes. `command_passes` runs there too (the
checker copies the scenario's hidden files in first). `ran_command` checks need the trace
and are listed in the benchmark `notes` instead. A scenario without `change` is prepared by
copying `base/` only.

Triggers: plugin-eval has no skill-selection verifier. List `triggers.yaml` as not covered
on Codex in `IMPLEMENTS.json` (`"triggers": "unsupported: …"`) rather than inventing one.

## Verify

```sh
pnpm check:standard                      # Agent Plugins schema and Agent Skills fields
pnpm check:install -- codex              # model-free native install and skill listing
HOBIN_AGENT_ROOT="$PWD" sh codex/evals/prepare.sh <plugin> <scenario> && \
  HOBIN_AGENT_ROOT="$PWD" plugin-eval benchmark codex/plugins/<plugin> \
  --config codex/evals/<plugin>/<scenario>/benchmark.json -m <model>
```

`plugin-eval` comes from `openai/plugins` (plugins/plugin-eval); running it executes that
downloaded code and calls models, so it needs the user's approval.
