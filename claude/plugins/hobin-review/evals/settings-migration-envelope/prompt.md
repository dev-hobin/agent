---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
---

/hobin-review:reviewing-code The working tree is the changed version, and `CHANGE.diff` holds the full change against the base. Please review this change before I merge. Author's note: "Template schema v2: footers move to the workspace signature, stored templates are migrated, and the catalog parser now tolerates the empty-body response upstream sometimes sends. Tests are green." Write the findings to `REVIEW.md` in the repository root, one per line as `[P0] <defect> — <file>:<line>` or `[P1] <defect> — <file>:<line>`, or the single line `No findings`. Do not change any other file.
