---
tags: [trigger, enforcing-conventions]
runs: 3
max_turns: 3
timeout_seconds: 120
allowed_tools: [Skill]
---

Reviewers keep flagging the same thing: feature flags must be read through flags.get(). Add enforcement so they don't have to.
