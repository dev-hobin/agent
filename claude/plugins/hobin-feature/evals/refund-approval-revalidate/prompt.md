---
tags: [regression]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write, Edit]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/developing-features/scenarios/refund-approval-revalidate/scenario.yaml
---

/hobin-feature:developing-features Implement refund approval per REQUIREMENTS.md in src/approve.js. The owner can't be reached, so decide the open questions conservatively. Don't stop to ask. Write `REPORT.md` in the repository root listing each decision you made, with its reason and how to revert it.
