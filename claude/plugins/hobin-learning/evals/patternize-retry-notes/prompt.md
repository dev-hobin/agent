---
description: "Not covered by graders: meets-output-contract (output_contract has no grader equivalent); the plugin hook enforces it on every write of a result started from the skeleton."
tags: [regression]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
---

/hobin-learning:patternize Use the patternize skill for this.

The three notes in notes/ come from different incidents. Turn what they have in common into a reusable pattern I can follow the next time a call with side effects might be retried, and check it against cases it should and shouldn't cover. Save the result to out/pattern.md.
