---
tags: [regression]
description: "Not covered on Claude: catches-new-violation (command_passes with hidden files; claude plugin eval runs nothing after the run). The same case is proven on Codex and by the core scenario check."
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Agent, Bash, Write]
---

/hobin-stances:enforcing-conventions The money rule in CONVENTIONS.md keeps getting broken and reviewers catch it by hand. Enforce it so it can't regress. Wire whatever check you add into `npm run check` in package.json, and fix the code that currently violates it.
