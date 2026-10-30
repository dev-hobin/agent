# Claude Code eval format

How the contents in `knowledge/formats.md` are spelled for `claude plugin eval`. Paths are
relative to the plugin root; Claude Code reads `evals/` by default.

```text
evals/
├── <case>/
│   ├── prompt.md          # frontmatter: tags, runs, max_turns, timeout_seconds, allowed_tools; body: the prompt
│   ├── case.yaml          # schema_version "1.1", name, context.scaffold_script
│   ├── scaffold.sh        # seeds the workspace from base/ (runs only with --scaffold)
│   ├── base/              # files the scaffold copies; never visible to the run otherwise
│   └── graders/<name>.md  # one grader per file
└── triggers/
    └── <skill>-<query id>/  # one case per trigger query: prompt.md, case.yaml, graders/trigger.md
```

A grader is a Markdown file with frontmatter only:

```markdown
---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "\\[P[01]\\][^\\n]*\\b(ack|acknowledg)"
flags: i
---
```

| Check | Grader |
| --- | --- |
| file exists | `type: file_exists`, `path` (globs allowed) |
| file matches / lacks a regex | `type: regex`, `target: { source: file, path }`; add `match: not_contains` for lacks |
| a command ran | `type: tool_used`, `tool: Bash`, `input_match: "npm test"` |
| a tool must not run, or a path must stay unchanged | `type: tool_used`, `tool: Edit` (and one for `Write`), `input_match` on the `file_path`, `min: 0`, `max: 0`, `arm: both` |
| the Skill was selected | `type: tool_used`, `tool: Skill`, `input_match: "\"skill\"\\s*:\\s*\"(?:[\\w-]+:)?<skill>\""`, `min: 1`; for a near miss `min: 0`, `max: 0`; `arm: both` |
| one step before another | `type: tool_order` |
| hidden or existing tests pass | Not available: `claude plugin eval` runs nothing after the run. Use the hidden-test benchmark below, and list the check as not covered in the case |

Trigger cases use frontmatter `tags: [trigger]`, `runs: 3`, `max_turns: 3`,
`allowed_tools: [Skill]` and the query as the body. A scenario without a change patch
needs only `cp -R "$here/base/." .` in `scaffold.sh`.

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

These calls cost money; estimate from one run before running three.

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
