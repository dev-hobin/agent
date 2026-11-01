---
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
plugins: ["../..", "verify"]
env:
  EVAL_SCENARIO: core/enforcing-conventions/scenarios/money-to-cents/scenario.yaml
---

/hobin-stances:enforcing-conventions The money rule in CONVENTIONS.md keeps getting broken and reviewers catch it by hand. Enforce it so it can't regress. Wire whatever check you add into `npm run check` in package.json, and fix the code that currently violates it.
