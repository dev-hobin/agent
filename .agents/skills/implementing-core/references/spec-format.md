# Core spec format

Read this before reading or creating `core/<id>/`. The spec is written for the user,
in Korean; implementations are written in English.

```text
core/<id>/
  SPEC.md                 frontmatter: id, plugin, skill, version
  knowledge/*.md          domain knowledge, copied verbatim into implementations
  scripts/*               host-neutral scripts, copied verbatim
  scenarios/<scenario>/   base/ (before), change.patch (optional), golden/ (a correct
                          result), scenario.yaml (request and deterministic checks)
```

`SPEC.md` sections:

| § | Content | Becomes |
| --- | --- | --- |
| 1 목적과 범위 | What, what not, the English description, short description, display name | Skill description and host listing metadata |
| 2 호출 | Explicit only or model-selectable; argument | Host invocation control and argument hint |
| 3 산출물 | Output format | Skill text; scenario checks rely on it |
| 4 보장 | Outcome guarantees with required/preferred | Per-host enforced/instructed/unsupported in HOST.md |
| 5 절차 | Gotchas and steps | Skill body (Gotchas first, then Procedure) |
| 6 권장 전략 | Optional strategies such as delegation | Host-native mechanism (Claude agents, Codex subagent instructions) |
| 7 지식 | Knowledge files and when each applies | Copied files plus a when-to-read list |
| 8 수용 시나리오 | Scenario table | One host eval case per scenario, same ID |

`scenario.yaml`:

```yaml
id: <scenario id, equal to the directory name>
tags: [regression]
base: base                 # directory with the state before the change
change: change.patch       # optional patch applied to base to produce the reviewed state
request: "<what the user asks>"
expect:                    # every check is deterministic
  - { id: <check>, file_exists: <path> }
  - { id: <check>, file_matches: { path, pattern, flags } }   # JavaScript regex
  - { id: <check>, file_lacks: { path, pattern, flags } }
  - { id: <check>, unchanged_except: [<paths the run may write>] }
  - { id: <check>, ran_command: "<regex over shell commands>" }  # needs the run trace
```

`golden/` holds files that, added to the presented workspace, pass every file-based
check; `pnpm check:core` proves that and proves the untouched workspace fails.
