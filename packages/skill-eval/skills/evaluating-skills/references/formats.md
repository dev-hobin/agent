# Evaluation file formats

Read this before writing evaluation data for `scripts/run-evals.mjs`. Keep one directory
per Skill, outside the shipped package (for example `evals/<skill>/`).

## `triggers.json`

```json
{ "skill": "reviewing-code", "plugin": "hobin-review", "queries": [
  { "id": "t01", "query": "review the changes on this branch before I merge", "should_trigger": true, "note": "explicit review request" },
  { "id": "t11", "query": "fix the lint errors in src/api", "should_trigger": false, "note": "near miss: code quality, not a review" }
] }
```

- `plugin` must equal the `name` in the plugin root's `plugin.json`.
- 20 queries, about half negatives. Negatives are near misses, not unrelated topics.
- A Skill counts as triggered when the run calls the Skill tool with it or reads its
  `SKILL.md`.

## `evals.json`

```json
{ "skill": "reviewing-code", "plugin": "hobin-review", "tasks": [ {
  "id": "queue-ack-before-process",
  "prompt": "Review the changes on branch feature against main.",
  "fixture": "fixtures/queue-ack-before-process",
  "assertions": [ { "id": "finds-early-ack", "text": "The review reports that the job is acknowledged before processing finishes, so a crash loses it." } ],
  "checks": [ { "id": "hidden-tests", "command": "node --test 'hidden/**/*.test.mjs'" } ],
  "notes": "What this task discriminates."
} ] }
```

Fixture layout under the task's `fixture` directory:

| Path | Use |
| --- | --- |
| `workspace/` | Copied into a fresh temp directory and committed on branch `main` |
| `change.patch` | Optional. Applied and committed on branch `feature` (review tasks) |
| `hidden/` | Optional. Copied into the workspace after the agent finishes; `checks[].command` runs there and passes on exit 0 |
| `reference/` | Optional. A correct solution used only to validate hidden checks; never shown to the agent |

Validate every fixture before running models: hidden checks fail on the untouched
workspace, pass on `reference/`, and pass on a second, differently written correct
solution; every `change.patch` applies cleanly with `git apply --check`.

## Conditions

| Condition | What the run gets |
| --- | --- |
| `skill` | The plugin, invoked as `/<plugin>:<skill> <prompt>` |
| `none` | No plugin; the plain prompt |
| `control` | A copy of the plugin whose Skill bodies are replaced by generic advice of the same length, invoked like `skill` |
