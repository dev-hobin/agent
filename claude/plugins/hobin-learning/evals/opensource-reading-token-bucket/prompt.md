---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/opensource-reading/scenarios/token-bucket/scenario.yaml
---

/hobin-learning:opensource-reading I want to learn how this repository's `take()` keeps the promise its README makes. Trace it through the code and tests, and tell me what evidence would prove your reading wrong. Save the study to out/study.md.
