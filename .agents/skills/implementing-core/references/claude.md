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
    hooks/hooks.json                     plugin hooks for must-hold results
    scripts/<name>-hook.mjs              hook scripts, byte-identical to the Codex plugin's
    evals/<scenario>/                    one `claude plugin eval` case per spec §8 scenario
claude/eval-support/verify/              eval-only plugin copied into every case as verify/
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

Commands are merged into skills; do not add `commands/`.

### Must-hold results: plugin hooks

Claude Code's answer to "a rule that must hold every time" is a hook. Register it in the
plugin's `hooks/hooks.json`, not in the skill's `hooks` frontmatter. A frontmatter hook is
registered only once the skill is invoked, so a result written without invoking it goes
unchecked; a plugin hook runs in every session, however the skill started (2026-11-02,
when the entry skills became model-selectable). The scripts therefore check only results
written in the session (changed since the session transcript was created) and leave other
sessions alone, as the Codex plugin hooks always have. Every guarantee the spec backs with a
script (an output contract or a `script_passes` check) gets one, and the guarantee is
**enforced**:

- For a result file Claude writes, register the same script on `PostToolUse` (matcher
  `Write|Edit`, quick feedback) and on `Stop` (the gate: files written by a shell command
  never reach an edit-tool hook). The script calls `runHook` from the shared
  `scripts/hook-input.mjs` with a `check(file, text)` that recognizes the skill's results by
  content (an output-contract marker, a report whose first line is `[P0]`/`[P1]` or
  `No findings`, a block marker). On Stop it checks every Markdown file under the project
  changed since the session transcript was created. Problems go back with exit 2.
  The hook scripts are byte-identical to the Codex plugin's.
- `Stop` for "finish only when the check passes": exit 2 while the check fails sends Claude
  back to work. Let Claude stop after three blocks in a row (count per `session_id` in the
  temp directory) so a check that cannot pass never traps the session.
- Use `${CLAUDE_PLUGIN_ROOT}` in hook commands; `${CLAUDE_SKILL_DIR}` is not set for hooks.
- Keep the events and timeouts the same as the Codex plugin's `hooks/hooks.json`; only the
  plugin-root variable and the edit-tool matcher (`Write|Edit`) differ.
- `tests/hooks.test.mjs` proves each hook with a passing and a failing result, and fails if a
  skill registers a hook in its frontmatter.

The skill still runs the check itself at the step the spec names, so the model learns the
result before the hook has to send it back.

### Output contracts

For a capability with `assets/output-contract.json`:

- Copy `core/shared/scripts/output-contract.mjs` to `scripts/output-contract.mjs` at the
  plugin root, and the contract into the skill's `assets/`.
- The skill tells Claude to start the result with
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs new ${CLAUDE_SKILL_DIR}/assets/output-contract.json <file>`
  and to finish only when `… check …` passes; pre-approve that script in `allowed-tools`.
- Register `scripts/output-contract-hook.mjs` as the skill's `PostToolUse` hook. It acts on
  files that start with `<!-- output-contract: <id> -->`, finds the contract with that `id`
  among `skills/*/assets/output-contract.json`, and runs `checkText` from
  `./output-contract.mjs`.

### Capability check scripts (`script_passes`)

When the spec ships a check script in `scripts/` (a `script_passes` scenario check):

- Copy it into the skill's `scripts/` with any assets it reads, and pre-approve
  `Bash(node ${CLAUDE_SKILL_DIR}/scripts/<script> *)` in `allowed-tools`.
- The skill runs it at the step the spec names and finishes only when it exits 0.
- Register a skill hook for it as described above.

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
  verify/               copy of claude/eval-support/verify (an eval-only plugin)
  graders/<check>.md    one per scenario check
```

Every case also loads the verify plugin and names its scenario in the `prompt.md`
frontmatter:

```yaml
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/<id>/scenarios/<scenario>/scenario.yaml
```

The verify plugin's `Stop` hook runs the scenario's code-based checks (`command_passes`,
`script_passes`, `output_contract`) on a copy of the finished workspace with
`scenario-check.mjs --kinds …` and writes `pass <id>` / `FAIL <id>` lines to
`SCENARIO_CHECK.txt`. Hidden test files stay in the copy, out of the model's sight.
`claude plugin eval` has no custom-code graders, so this is how those checks become
ordinary regex graders. A case's helper plugin must sit in a subdirectory of the case
(`claude plugin eval` loads nothing outside the plugin under test), which is why each
case carries its own copy; `tests/evals.test.mjs` keeps the copies identical.

Presentation sentence: "The working tree is the changed version, and `CHANGE.diff` holds
the full change against the base. "

| Scenario check | Grader |
| --- | --- |
| `file_exists: P` | `type: file_exists`, `path: "P"` |
| `file_matches: {path, pattern, flags}` | `type: regex`, `target: { source: file, path: P }`, `pattern`, `flags` |
| `file_lacks` | same as above plus `match: not_contains` |
| `unchanged_except: [P…]` | `<check>.md`: `type: tool_used`, `tool: Edit`, `min: 0`, `max: 0`, `arm: both`; and `<check>-write.md`: `type: tool_used`, `tool: Write`, `input_match` matching a `file_path` that does not end in an allowed path, `min: 0`, `max: 0`, `arm: both` |
| `unchanged: [P…]` | `tool_used` on `Edit` and on `Write` with `input_match` on a `file_path` under P, `min: 0`, `max: 0`, `arm: both` (one grader each) |
| `command_passes`, `script_passes`, `output_contract` | `type: regex`, `target: { source: file, path: SCENARIO_CHECK.txt }`, `pattern: "^pass <check>$"`, `flags: m` (written by the verify plugin) |

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
