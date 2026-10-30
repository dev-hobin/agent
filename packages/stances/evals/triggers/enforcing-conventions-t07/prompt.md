---
tags: [trigger, enforcing-conventions]
runs: 3
max_turns: 3
timeout_seconds: 120
allowed_tools: [Skill]
---

Our convention is that API handlers never call the DB directly, only through repositories. It was broken three times this month. Enforce it.
