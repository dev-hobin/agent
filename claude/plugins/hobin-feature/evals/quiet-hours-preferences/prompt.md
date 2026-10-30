---
tags: [regression]
description: "Not covered on Claude: hidden-tests, visible-tests (command_passes; claude plugin eval runs nothing after the run). The same case is proven on Codex and by the core scenario check."
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write, Edit]
---

/hobin-feature:developing-features Build the quiet hours feature described in REQUIREMENTS.md. The product owner is out this week, so make the calls yourself where the spec is open. Run without asking me questions. Write `REPORT.md` in the repository root listing each decision you made, with its reason and how to revert it. When you are done, run `npm test` and save its full output to `TEST_OUTPUT.txt`.
