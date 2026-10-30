---
tags: [regression, stances]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, Bash, Write, Edit]
---

Use the enforcing-conventions skill for this.

The money rule in CONVENTIONS.md keeps getting broken and reviewers catch it by hand. Enforce it so it can't regress. Wire whatever check you add into `npm run check` in package.json, and fix the code that currently violates it.
