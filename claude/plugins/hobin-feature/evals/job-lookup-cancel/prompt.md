---
tags: [regression]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write, Edit]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/developing-features/scenarios/job-lookup-cancel/scenario.yaml
---

/hobin-feature:developing-features Build the cancel feature described in REQUIREMENTS.md. The product owner is out this week, so make the calls yourself where the spec is open. Run without asking me questions. Record the panel's request lifecycle after the change as a control decision record (`control-decisions.json`). Write `REPORT.md` in the repository root listing each decision you made, with its reason and how to revert it.
