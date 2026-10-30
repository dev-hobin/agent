---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
---

/hobin-review:reviewing-code Can you review this change before I merge? Author says: "Refactored amount formatting into a shared helper and added thousands separators. The new grouping tests pass." This working tree is the `feature` branch; `CHANGE.diff` is its full diff against `main`. Write the findings to `REVIEW.md` in the repository root, one per line as `[P0] <defect> — <file>:<line>` or `[P1] <defect> — <file>:<line>`, or the single line `No findings`. Do not change any other file.
