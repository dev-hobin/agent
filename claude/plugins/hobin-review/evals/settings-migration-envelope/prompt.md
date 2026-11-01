---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/review/scenarios/settings-migration-envelope/scenario.yaml
---

/hobin-review:reviewing-code The working tree is the changed version, and `CHANGE.diff` holds the full change against the base. Please review this change before I merge. Author's note: "Template schema v2: footers move to the workspace signature, stored templates are migrated, and the catalog parser now tolerates the empty-body response upstream sometimes sends. Tests are green." Write the review to `REVIEW.md` in the repository root in the review report format: each finding as `[P0|P1] <defect> — <file>:<line>` followed by `Scenario:` and `Evidence:` lines, or the single line `No findings`. Do not change any other file.
