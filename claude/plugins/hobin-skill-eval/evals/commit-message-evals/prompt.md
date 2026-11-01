---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/evaluating-skills/scenarios/commit-message-evals/scenario.yaml
---

/hobin-skill-eval:evaluating-skills Build evals for the skill in skills/commit-message so I can tell whether it's worth keeping. Put them under evals/commit-message/. Don't run any models yet, just build the eval set. Then write `REPORT.md` in the repository root saying what the results will be compared against and how they decide what happens to the skill.
