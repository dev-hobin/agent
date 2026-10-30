---
tags: [regression]
description: "Not covered on Claude: hidden-tests, visible-tests (command_passes; claude plugin eval runs nothing after the run). The same case is proven on Codex and by the core scenario check."
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write, Edit]
---

/hobin-feature:developing-features Implement refund approval per REQUIREMENTS.md in src/approve.js. The owner can't be reached, so decide the open questions conservatively. Don't stop to ask. Write `REPORT.md` in the repository root listing each decision you made, with its reason and how to revert it. When you are done, run `npm test` and save its full output to `TEST_OUTPUT.txt`.
