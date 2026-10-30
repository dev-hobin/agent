# Claude Code implementation contract

Pinned: Claude Code 2.1.314, documentation fetched 2026-10-30
([sources and quotes](research/2026-10-30.md)). Re-check these rules when Claude Code
changes; update `build.mjs`, never `core/`.

| Core intent | Claude Code form used by `build.mjs` | Source |
| --- | --- | --- |
| Plugin identity | `.claude-plugin/plugin.json` with `version`, `description`, `author` (strict validation requires them) | plugins reference |
| `invocation: explicit` | `disable-model-invocation: true`; started as `/<plugin>:<skill>`; description stays out of context | skills, frontmatter reference |
| Argument | `argument-hint` and `$ARGUMENTS` in the skill body | skills |
| Bundled script | `${CLAUDE_SKILL_DIR}/scripts/...`, pre-approved in `allowed-tools` with the same variable | skills, pre-approve tools |
| Delegation per perspective | One plugin subagent per perspective in `agents/<id>-reviewer.md` (`name`, `description`, `model: inherit`, `tools`); dispatched in parallel with the Agent tool as `<plugin>:<agent>`, pre-approved with `Agent(...)` in `allowed-tools`. Knowledge is the agent's own body because a `disable-model-invocation` skill cannot be preloaded into subagents | sub-agents, plugin agent fields, first-party `claude-security` |
| `read_only` reviewers | Agent `tools` without `Edit`/`Write` | sub-agents |
| Commands | Not used: commands are merged into skills for new work | plugins components |
| Contract tests | `evals/<case>/` for `claude plugin eval` with deterministic graders; the case prompt starts with the user invocation | Test plugins with evals |
| Distribution | Plugin directory is self-contained (marketplace installs copy only the plugin directory, so core files are copied in by the build) | plugin marketplaces |

Known host behaviour: on macOS the eval sandbox cannot run `/usr/bin/git` (an `xcrun`
shim), so contract workspaces ship `CHANGE.diff`.
