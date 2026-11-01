---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/applying-stances/scenarios/agents-md-overlap/scenario.yaml
---

/hobin-stances:applying-stances Apply the hobin engineering stances to this project's agent instructions. Write the proposal you would show me to `PROPOSAL.md` in the repository root, and do not change any other file.
