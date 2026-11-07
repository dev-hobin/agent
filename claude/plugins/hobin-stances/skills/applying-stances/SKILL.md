---
name: applying-stances
description: "Installs a short set of engineering stances into a project's or user's agent instructions (CLAUDE.md or AGENTS.md) after showing the exact diff and getting approval, and links each stance to an existing check where one exists. Use when asked to set up, add, or update these stances, or default working stances, in agent instructions. Not for writing general project documentation, editing other parts of agent instructions, or enforcing a convention in code."
allowed-tools:
  - "Bash(node ${CLAUDE_SKILL_DIR}/scripts/stances.mjs *)"
---

# Applying Stances

Put a few default behaviors where every session reads them, without duplicating or
contradicting what the project already says. Write nothing until the user approves the
exact diff.

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
   `${CLAUDE_SKILL_DIR}/assets/stances.md`: drop it if the project already says the same thing, drop it
   and report the conflict if the project says otherwise, keep it otherwise. Add
   `${CLAUDE_SKILL_DIR}/assets/learning-stance.md` only if the project declares a learning goal.
3. **Link checks.** For each kept stance, look in `${CLAUDE_SKILL_DIR}/assets/enforcement-map.md` for where
   it can be checked, and append `(checked by <path or command>)` only when that check
   really exists in the project. List stances without a check as candidates for enforcing
   conventions.
4. **Write the proposal.** Generate the exact diff with
   `node ${CLAUDE_SKILL_DIR}/scripts/stances.mjs block <target> [--skip <numbers of dropped stances>] [--learning]`
   (numbers as listed in `assets/stances.md`); it replaces an existing block in place or
   appends one. Do not write the block text by hand. Write the proposal to the file the
   request names, or in the reply if it names none, in this form; for a proposal file, run
   `node ${CLAUDE_SKILL_DIR}/scripts/stances.mjs check <proposal file>` and fix what it reports.
   Then ask for approval. In a non-interactive run, stop here.

   ```text
   Target: <file to write> and why that file (does the host read it, is an import needed)
   <the exact diff>
   Size after the change: <size of the target and the files read with it>
   Skipped as duplicates: <stances the project already says>
   Conflicts: <project rules that say something different>
   Without a check: <stances with no check to link (enforcing-conventions candidates)>
   <approval request>
   ```
5. **Write and report** only after approval, then run `node ${CLAUDE_SKILL_DIR}/scripts/stances.mjs check <target>`: the files changed, stances skipped as
   duplicates or conflicts, and stances without a check. Until then change no file other
   than the proposal file the request names.

Run `stances.mjs check` from the directory this session started in or below it: it registers
the checked file for this session, and a plugin hook checks it again when the session stops.
If it stops with "No hobin-stances registry for this agent session", `cd` back there and run
it again, and follow the message if it says more.

## Assets

- `${CLAUDE_SKILL_DIR}/assets/stances.md` — the block to install (at most 15 lines); read in steps 2 and 4.
- `${CLAUDE_SKILL_DIR}/assets/learning-stance.md` — one optional line; read only when the project declares a learning goal.
- `${CLAUDE_SKILL_DIR}/assets/enforcement-map.md` — where each stance can be checked; read in step 3.
