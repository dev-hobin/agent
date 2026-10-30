# Claude Code implementation recipe

Pinned to Claude Code 2.1.314 and its documentation as fetched 2026-10-30
([research](../../../../docs/research/2026-10-30-claude-code.md)). When Claude Code
changes, update this file first, then re-run the skill for every capability.

## Layout

```text
.claude-plugin/marketplace.json          repository root; source "./claude/plugins/<plugin>"
claude/
  IMPLEMENTS.json                        spec hash, copies, and eval paths per capability
  plugins/<plugin>/
    .claude-plugin/plugin.json           name, version, description, author, homepage, repository, license, keywords
    skills/<skill>/SKILL.md
    skills/<skill>/scripts/…             copies of core scripts
    knowledge/*.md                       copies of core knowledge
    agents/<role>.md                     only for a spec §6 strategy that delegates
    evals/<scenario>/                    one `claude plugin eval` case per spec §8 scenario
```

## Spec to Claude form

| Spec | Claude Code form |
| --- | --- |
| §1 description | `description` (third person, Use when, Not for); listing caps description at 1,536 characters |
| §2 explicit only | `disable-model-invocation: true` (the model cannot invoke it; description leaves context); the user runs `/<plugin>:<skill>` |
| §2 argument | `argument-hint`, and `$ARGUMENTS` in the body ("Review target: $ARGUMENTS") |
| §5 scripts | `${CLAUDE_SKILL_DIR}/scripts/<file>` in the body, pre-approved in `allowed-tools` as a YAML list item `Bash(${CLAUDE_SKILL_DIR}/scripts/<file> *)` |
| §6 delegation | One plugin agent per role in `agents/<id>-reviewer.md` with `name`, `description` ("…Dispatched by the <skill> skill; not for direct invocation."), `model: inherit`, `tools: Read, Grep, Glob, Bash` for read-only roles. The body is the role and the line "Before reviewing, read `${CLAUDE_PLUGIN_ROOT}/knowledge/<id>.md`." The skill dispatches them with the Agent tool in one message and pre-approves `Agent(<plugin>:<agent>, …)` in `allowed-tools`. A `disable-model-invocation` skill cannot be preloaded into agents, so agents read knowledge files instead |
| §7 knowledge | `knowledge/` at the plugin root, read through `${CLAUDE_PLUGIN_ROOT}` |
| §4 guarantees | Explicit invocation: enforced. Read-only agents: enforced by `tools`. Anything the skill text asks for: instructed |

Commands are merged into skills; do not add `commands/`. Avoid hooks unless the spec
needs one.

## Scenarios as `claude plugin eval` cases

```text
evals/<scenario>/
  prompt.md        frontmatter: tags [regression], max_turns: 60, timeout_seconds: 1200,
                   allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
                   body: "/<plugin>:<skill> " + presentation sentence + scenario request
  case.yaml        schema_version "1.1", name <scenario>, context.scaffold_script: scaffold.sh
  scaffold.sh      executable; copies base/, applies change.patch with git, writes CHANGE.diff,
                   removes .git (the macOS eval sandbox cannot run /usr/bin/git)
  base/, change.patch   copies of the scenario fixture
  graders/<check>.md    one per scenario check
```

Presentation sentence: "The working tree is the changed version, and `CHANGE.diff` holds
the full change against the base. "

| Scenario check | Grader |
| --- | --- |
| `file_exists: P` | `type: file_exists`, `path: "P"` |
| `file_matches: {path, pattern, flags}` | `type: regex`, `target: { source: file, path: P }`, `pattern`, `flags` |
| `file_lacks` | same as above plus `match: not_contains` |
| `unchanged_except: [P…]` | `<check>.md`: `type: tool_used`, `tool: Edit`, `min: 0`, `max: 0`, `arm: both`; and `<check>-write.md`: `type: tool_used`, `tool: Write`, `input_match` matching a `file_path` that does not end in an allowed path, `min: 0`, `max: 0`, `arm: both` |
| `ran_command: R` | `type: tool_used`, `tool: Bash`, `input_match: R` |
| `unchanged: [P…]` | `tool_used` on `Edit` and on `Write` with `input_match` on a `file_path` under P, `min: 0`, `max: 0`, `arm: both` (one grader each) |
| `command_passes` | Not supported: `claude plugin eval` has no custom-code graders and runs nothing after the run. Omit it and list it under "Not covered on Claude" in the case's `prompt.md` frontmatter `description` |

A scenario without `change` needs no patch step: the scaffold copies `base/` only.

### Triggers

For a capability with `triggers.yaml`, write one case per query under
`evals/triggers/<capability>-<query id>/` with `prompt.md` (frontmatter `tags: [trigger]`,
`runs: 3`, `max_turns: 3`, `allowed_tools: [Skill]`; body: the query) and one grader
`graders/trigger.md`: `type: tool_used`, `tool: Skill`, `input_match` for the skill name,
`min: 1` when it should trigger or `min: 0` and `max: 0` when not, `arm: both`. Run them with
`--tag trigger`. Explicit-only capabilities have no trigger file.

Only deterministic graders; never grade the path a strategy took.

## Verify

```sh
claude plugin validate claude/plugins/<plugin> --strict
claude plugin validate .claude-plugin/marketplace.json --strict
claude plugin eval claude/plugins/<plugin> --tag regression --ablation none --scaffold \
  --allow-tools Bash Write --model sonnet --runs 3 -j 3 --trust-plugin --no-publish
```
