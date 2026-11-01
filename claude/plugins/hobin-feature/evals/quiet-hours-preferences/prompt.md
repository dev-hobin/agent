---
tags: [regression]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write, Edit]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/developing-features/scenarios/quiet-hours-preferences/scenario.yaml
---

/hobin-feature:developing-features Build the quiet hours feature described in REQUIREMENTS.md. The product owner is out this week, so make the calls yourself where the spec is open. Run without asking me questions. Write `REPORT.md` in the repository root listing each decision you made, with its reason and how to revert it.
