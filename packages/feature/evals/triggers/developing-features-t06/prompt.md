---
tags: [trigger, developing-features]
runs: 3
max_turns: 3
timeout_seconds: 120
allowed_tools: [Skill]
---

Fix the bug where recurring events disappear after a timezone change. It's not obvious what the right behavior is for events created before the DST switch, so work out the cases first.
