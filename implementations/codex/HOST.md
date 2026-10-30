# Codex implementation contract

Pinned: codex-cli 0.165.0, `openai/codex` @ f752c97f, `openai/plugins` @ 0722921d,
documentation fetched 2026-10-30 ([sources and quotes](research/2026-10-30.md)).
Re-check these rules when Codex changes; update `build.mjs`, never `core/`.

| Core intent | Codex form used by `build.mjs` | Source |
| --- | --- | --- |
| Plugin identity | Root `plugin.json` with the Agent Plugins `$schema` (canonical); presentation in `extensions.com.openai.interface` | Build plugins |
| Skill metadata | `SKILL.md` with only the fields Codex reads: `name`, `description`, `metadata.short-description` | `codex-rs/skills/src/parser.rs` |
| `invocation: explicit` | `agents/openai.yaml` `policy.allow_implicit_invocation: false`; started as `$<plugin>:<skill>` | Skills docs, `metadata.rs` |
| Interface | `agents/openai.yaml` `interface.display_name`, `short_description`, `default_prompt` | Skills docs |
| Delegation per perspective | Skill instructions to spawn one subagent per perspective and wait for all (plugins cannot ship agents); role and perspective files under `references/` | Subagents docs, `agent-roles/src/loader.rs` |
| `read_only` reviewers | Instruction only: subagents inherit the parent sandbox and cannot be narrowed | Subagents docs |
| Bundled script | `scripts/` in the skill directory, called by skill-relative path | Skills docs |
| Contract tests | `plugin-eval` benchmark configs in `dist/codex/evals/<plugin>/<case>/benchmark.json`; verifiers run `scripts/contract-check.mjs` (exit code). Trace-only expectations are listed in the config notes | `openai/plugins` plugin-eval `src/core/benchmark.js` |

Not used: plugin-root `agents/` (never loaded), `commands/` (converted on install),
hooks (desktop-only and excluded from the public directory). The bundled `review-agent`
skill exists, so the skill keeps the name `reviewing-code`.
