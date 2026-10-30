# Evaluation file formats

Read this before writing cases, graders, trigger sources, or benchmark tasks. Paths are
relative to the plugin root. Claude Code reads `evals/` by default.

## Regression and trigger cases (`claude plugin eval`)

```text
evals/
├── <case>/
│   ├── prompt.md          # frontmatter: tags, runs, max_turns, timeout_seconds, allowed_tools; body: the prompt
│   ├── case.yaml          # schema_version "1.1", name, context.scaffold_script
│   ├── scaffold.sh        # seeds the workspace from fixture/ (runs only with --scaffold)
│   ├── fixture/           # files the scaffold copies; never visible to the run otherwise
│   └── graders/<name>.md  # one grader per file
└── triggers/
    ├── <skill>.json       # 20 queries: { "skill", "queries": [{ "id", "query", "should_trigger" }] }
    └── <skill>-<id>/      # generated cases; do not edit by hand
```

Deterministic graders only in these cases:

```markdown
---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "\\[P[01]\\][^\\n]*\\b(ack|acknowledg)"
flags: i
---
```

| Type | Use it for |
| --- | --- |
| `regex` with `target: { source: file, path }` | A required finding or section in a file the run wrote; `match: not_contains` for something that must not appear |
| `regex` with `target: files` | A path the run created |
| `tool_used` | A command that must run (`tool: Bash`, `input_match: "npm test"`), a tool that must not run (`min: 0`, `max: 0`, `arm: both`), the Skill being invoked |
| `tool_order` | One step before another |
| `file_exists` | An artifact the run created |

Make the run leave results in files with a fixed format, for example: "Write the findings
to `REVIEW.md`, one per line as `[P0] <defect> — <file>:<line>`". To check that tests
passed, ask the run to save `npm test` output to `TEST_OUTPUT.txt` and match `# fail 0`.

Run them:

```sh
# regression gate: Skill loaded only, fail below the threshold
claude plugin eval <plugin-root> --tag regression --ablation none --scaffold \
  --allow-tools Bash Write Edit --model sonnet --threshold 1.0 --trust-plugin --no-publish
# triggers: Skill tool only
claude plugin eval <plugin-root> --tag trigger --ablation none --model sonnet --no-publish
# benchmark: same cases with and without the plugin; read the difference, do not gate
claude plugin eval <plugin-root> --tag regression --scaffold --allow-tools Bash Write Edit --model opus
```

## Hidden-test benchmark tasks (`scripts/benchmark.mjs`)

```text
benchmarks/<task>/
├── task.json      # { "skill", "id", "prompt", "checks": [{ "id", "command" }], "notes" }
├── workspace/     # copied into a fresh directory for the run
├── hidden/        # copied in after the run; never visible to it
└── reference/     # a correct solution, used only to validate the hidden checks
```

Hidden checks must fail on the untouched workspace and pass on `reference/` and on a
second correct solution. Use `node --test 'hidden/**/*.test.mjs'`; a bare directory
argument is treated as a failure by Node 22 and 24.
