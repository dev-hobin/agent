---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/conceptualize/scenarios/retry-notes/scenario.yaml
---

/hobin-learning:conceptualize Use the conceptualize skill for this.

The three notes in notes/ come from different incidents. Form one concept that holds across all of them, something I can reuse outside these systems, and test whether it really transfers. Save the result to out/concept.md.
