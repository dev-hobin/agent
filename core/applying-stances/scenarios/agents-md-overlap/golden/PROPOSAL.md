# Proposed change: working stances

Target: `AGENTS.md`. `CLAUDE.md` already imports it with `@AGENTS.md`, so Claude Code
and Codex both load it; `CLAUDE.md` needs no change.

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -4,3 +4,16 @@
 - Keep logic in `src/` pure; I/O lives in `src/io/`.
 - Before saying a task is done, run `npm test` and `npm run lint` and report
   the results. Do not claim completion from reading the code alone.
+
+<!-- hobin-stances:v1 -->
+## Working stances
+
+- Keep behavior changes and structural cleanup in separate steps; refactor only what blocks the current change.
+- Preserve data that is already stored; removing or rewriting it is the owner's decision.
+- Reject or surface missing, empty, and malformed input at a boundary; never treat it as a valid empty result.
+- When code, docs, and the user leave a decision open, take the conservative reversible option (preserve, deny, narrow) and record the decision, the reason, and how to revert it.
+- Ask before irreversible or outward-facing actions: deploys, pushes, shared-data changes, real messages or payments, credential use. Proceed with reversible work inside the agreed scope.
+- Work in the smallest slice that still reaches the user-visible outcome.
+- Treat duplication as a signal, not a mandate: extract an abstraction when an invariant or a third concrete case demands it.
+- When a rule here keeps being broken, turn it into a type, lint rule, or test and replace the line with a pointer to that check.
+<!-- /hobin-stances -->
```

Size after the change: `AGENTS.md` 1,360 bytes; with `CLAUDE.md` 1,429 bytes, far below
Codex's 32 KiB default limit.

Skipped as a duplicate: "Before saying a change is done, run the checks that cover the
changed code…" — `AGENTS.md` already requires `npm test` and `npm run lint` before a task
is called done.

Conflicts: none. The learning stance is not added: the project declares no learning goal.

Stances without an automatic check (candidates for enforcing conventions): every kept
stance. The project has `npm test` and `npm run lint` (`scripts/lint.mjs`, which only bans
`console.log` in `src/`), but no CI, pre-push hook, migration rule, boundary parser,
decision log, or host permission rule that checks any of them.

Approve this change? Nothing has been written to `AGENTS.md` yet; reply yes and I will
apply exactly this diff.
