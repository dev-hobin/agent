---
tags: [regression, review]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, Bash, Write]
---

Use the reviewing-code skill for this.

Please review this change before I merge. Author's note: "Template schema v2: footers move to the workspace signature, stored templates are migrated, and the catalog parser now tolerates the empty-body response upstream sometimes sends. Tests are green."

This working tree is the `feature` branch; `CHANGE.diff` is its full diff against `main` (git is not available here). Write the findings to `REVIEW.md` in the repository root, one per line as `[P0] <defect> — <file>:<line>` or `[P1] <defect> — <file>:<line>`, or the single line `No findings`. Do not change any other file.
