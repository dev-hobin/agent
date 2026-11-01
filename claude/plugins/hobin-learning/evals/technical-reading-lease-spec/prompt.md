---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/technical-reading/scenarios/lease-spec/scenario.yaml
---

/hobin-learning:technical-reading I just read docs/lease-spec.md for a design review next week. What should I actually carry forward from it, beyond a summary? Keep what the spec says separate from your interpretation. Save the result to out/insights.md.
