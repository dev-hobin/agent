---
tags: [trigger, enforcing-conventions]
runs: 3
max_turns: 3
timeout_seconds: 120
allowed_tools: [Skill]
---

People keep importing from '@/internal/*' outside the core package even though the README says not to. Can we make that fail automatically?
