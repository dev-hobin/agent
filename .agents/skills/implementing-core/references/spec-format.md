# Core spec format

Read this before reading or creating `core/<id>/`. The spec is written for the user,
in Korean; implementations are written in English.

```text
core/<id>/
  SPEC.md                 frontmatter: id, plugin, skill, version
  knowledge/*.md          domain knowledge, copied verbatim into implementations
  scripts/*               host-neutral scripts, copied verbatim
  assets/*                files the skill installs or fills in (templates, blocks), copied verbatim
  scenarios/<scenario>/   base/ (before), change.patch (optional), golden/ (a correct
                          result), hidden/ (optional, added only after the run),
                          scenario.yaml (request and deterministic checks)
  triggers.yaml           only for capabilities the model may select on its own (§2):
                          queries: [{ id, query, should_trigger }]
```

Knowledge used by several capabilities lives once in `core/shared/<topic>/`; a spec
refers to it as `../shared/<topic>/…`, and a change there makes every implementation stale.

One plugin can hold several capabilities: each `core/<id>/` is one skill, and capabilities
with the same `plugin` share one plugin per host.

`SPEC.md` sections:

| § | Content | Becomes |
| --- | --- | --- |
| 1 목적과 범위 | What, what not, the English description, short description, display name | Skill description and host listing metadata |
| 2 호출 | Explicit only or model-selectable; argument | Host invocation control and argument hint |
| 3 산출물 | Output format | Skill text; scenario checks rely on it |
| 4 보장 | Outcome guarantees with required/preferred | Per-host enforced/instructed/unsupported in HOST.md |
| 5 절차 | Gotchas and steps | Skill body (Gotchas first, then Procedure) |
| 6 권장 전략 | Optional strategies such as delegation | Host-native mechanism (Claude agents, Codex subagent instructions) |
| 7 지식 | Knowledge files and when each applies; assets and scripts | Copied files plus a when-to-read list |
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
  - { id: <check>, file_exists: "<glob>" }                     # `**/` and `*` allowed
  - { id: <check>, unchanged_except: [<paths the run may write>] }
  - { id: <check>, unchanged: [<paths or directories that must not change>] }
  - { id: <check>, command_passes: { command, files: hidden } } # hidden files added after the run
  - { id: <check>, ran_command: "<regex over shell commands>" }  # needs the run trace
  - { id: <check>, script_passes: { script: scripts/<file>.mjs, args: [...] } }  # capability script, cwd = workspace
```

**Output contracts.** When a capability writes a Markdown result, its required parts live
as data in `assets/output-contract.json` (`id`, `skeleton`, `required` parts with label,
aliases and hint, optional `mentions`, `table`, `orderedList`). The shared
`core/shared/scripts/output-contract.mjs` creates the skeleton (`new`) and checks a result
(`check`, exit code plus fix-it messages). Scenarios use the same checker:

```yaml
  - { id: meets-output-contract, output_contract: { contract: assets/output-contract.json, file: out/x.md } }
```

Prefer a script over an instruction for anything that must always hold: generate it, or
check it with a script that says how to fix it. Leave only judgment to instructions.

Make the run leave everything that is judged in files (for example `REPORT.md`): not
every host's eval tool can read the final reply.

`golden/` holds files that, added to the presented workspace, pass every file-based
check (for code tasks, a reference solution plus the report); `pnpm check:core` proves that and proves the untouched workspace fails.
