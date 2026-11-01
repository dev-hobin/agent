---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/exercise/scenarios/fencing-note/scenario.yaml
---

/hobin-learning:exercise I wrote up notes/fencing-tokens.md after reading about leases. Make me a short practice workbook so I can show I can actually use the idea, not just repeat the words. Save it to out/exercise.md.
