---
name: applying-stances
description: "Installs a short set of engineering stances into a project's or user's agent instructions (CLAUDE.md or AGENTS.md) after showing the exact diff and getting approval, and links each stance to an existing check where one exists. Use only when explicitly asked to set up or update these stances. Not for writing general project documentation or enforcing a convention in code."
metadata:
  version: "0.3.0"
---

# Applying Stances

Put a few default behaviors where every session reads them, without duplicating or
contradicting what the project already says.

## Gotchas

- Claude Code reads `AGENTS.md` only when no `CLAUDE.md` or `CLAUDE.local.md` exists in
  the working directory or above it, unless `CLAUDE.md` imports it with `@AGENTS.md`.
  Writing to a file the host does not load changes nothing.
- Codex stops reading project instructions after 32 KiB by default
  (`project_doc_max_bytes`). Check the combined size before adding lines.
- The same rule worded twice, or a stance that contradicts a project rule, makes
  behavior less predictable, not more. The project's own rule always wins.
- Never write instructions without approval: they change every later session.

## Procedure

1. **Choose the target.** Project scope by default; user scope (`~/.claude/CLAUDE.md`,
   `~/.codex/AGENTS.md`) only when the user asks. In a project:
   - `AGENTS.md` exists and Claude would load it (no `CLAUDE.md`, or `CLAUDE.md` imports
     it) → write to `AGENTS.md`.
   - `AGENTS.md` exists but `CLAUDE.md` does not import it → write to `AGENTS.md` and
     propose adding `@AGENTS.md` to `CLAUDE.md`.
   - Only `CLAUDE.md` exists → write to `CLAUDE.md`.
   - Neither exists → create `AGENTS.md`.
2. **Compare.** Read the target and every file it imports. For each line of
   `assets/stances.md`: drop it if the project already says the same thing, drop it and
   report the conflict if the project says otherwise, keep it otherwise. Add
   `assets/learning-stance.md` only if the project declares a learning goal.
3. **Link checks.** For each kept stance, look for an existing check from
   `assets/enforcement-map.md` and append `(checked by <path or command>)` when one
   exists. List stances without a check as candidates for enforcing conventions.
4. **Show the diff.** If the marker block `<!-- hobin-stances:v1 -->` exists, replace it
   in place; otherwise append the block. Show the exact diff and the size after the
   change, then wait for approval. In a non-interactive run, stop here.
5. **Write and report** the file changed, stances skipped as duplicates or conflicts,
   and stances without a check.

## Assets

- `assets/stances.md` — the block to install (at most 15 lines).
- `assets/learning-stance.md` — one optional line for learning-oriented projects.
- `assets/enforcement-map.md` — where each stance can be checked.
