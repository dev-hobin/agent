---
name: commit-message
description: >-
  Writes a Conventional Commits message for the currently staged changes. Use
  when the user asks for a commit message for what is staged. Not for
  changelogs, pull request descriptions, or rewriting existing history.
---

# Commit message

## Procedure

1. Read `git diff --staged`. Never describe unstaged or untracked changes.
2. Pick the type: `feat`, `fix`, `refactor`, `docs`, `test`, or `chore`.
   Use `fix` only when the previous behavior was wrong.
3. Scope: the directory directly under `src/` that holds most changed lines.
   Omit the scope when the change spans more than two such directories.
4. Subject: imperative mood, lowercase, no trailing period, at most 50
   characters including type and scope.
5. Body: wrap at 72 characters and explain why the change was made, not what
   the diff already shows.
6. If a public export was removed or renamed, add a `BREAKING CHANGE:` footer
   that names it.
7. Output only the message, inside one fenced code block.
