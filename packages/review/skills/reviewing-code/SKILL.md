---
name: reviewing-code
description: "Reviews a code change, or a bounded existing scope, for correctness defects by running one focused pass per applicable perspective (contract, async flow, structure, data loss, evidence) and reporting only verified, high-confidence findings with concrete failure scenarios. Use only when explicitly asked to review a diff, branch, or pull request, or to diagnose a named module or feature slice. Not for style feedback, automatic repair, environment setup checks, or whole-repository rewrites."
metadata:
  version: "0.3.0"
---

# Reviewing Code

Find the defects that would hurt users or data, prove each one, and say nothing else.

## Gotchas

- Project instructions (`AGENTS.md`, `CLAUDE.md`, contributing guides) record team
  decisions that outrank every generic perspective here. A finding that contradicts a
  recorded decision is wrong.
- The tests the change added say nothing about the tests it may have broken. Run the
  existing suites around the changed code before calling the change safe.
- A change to one branch, field, or caller is often repeated in a sibling the diff does
  not touch. Check siblings before reporting the change as complete or the bug as fixed.
- Reviewers drift into style and naming nits when nothing serious is found. "No
  findings" is a valid result.

## Procedure

1. **Pick the mode.** *Change review*: a diff, branch, or pull request. *Scope
   diagnosis*: a named module, directory, flow, or feature slice. If the target is
   unclear, review the current branch against its base.
2. **Collect context.** Run `scripts/collect-context.sh [base]` from the repository root
   for change review; it prints the commit range, changed files, the diff, nearby test
   files, and the project instruction files. For scope diagnosis, list the scope's
   entry points, tests, and instruction files yourself. Read the instruction files.
3. **Select perspectives.** Read the first lines (`Catches`, `Applies when`,
   `Skip when`) of each file in `references/perspectives/` and keep those that apply.
   Say which ones you skipped and why.
4. **Review per perspective.** If you can start subagents, start one per selected
   perspective in parallel. Give each the full path of its perspective file, the
   context from step 2, and the instruction to return candidate findings only. If you
   cannot, review the perspectives one after another, rereading only that perspective
   file each time.
5. **Verify every candidate.** Reproduce it with a test, a command, or an exact trace
   through the code. Drop candidates you cannot turn into a concrete scenario of input
   or state leading to a wrong outcome. Merge duplicates found by several perspectives.
6. **Rank.** P0: data loss, security exposure, or a crash on a main path. P1: wrong
   behavior on a realistic path. Report P2 and below only when asked.
7. **Report** in the format below. In scope diagnosis, add an ordered plan: now, next,
   later, and leave alone, each with the reason.

```text
[P0|P1] <one-line defect> — <file>:<line>
  Scenario: <input or state> → <wrong outcome>
  Evidence: <test, command output, or trace that shows it>
  Direction: <what a fix must preserve; not a full patch>

Checked without findings: <perspectives>
Not checked: <what the review could not observe, such as runtime config or production data>
```

## Scripts

- `scripts/collect-context.sh [base]` — read-only; uses `git` only. The base defaults
  to the upstream branch or `main`.

## When to read more

Each perspective file in `references/perspectives/` is read by the reviewer for that
perspective (step 4), not all at once:

- [contract.md](references/perspectives/contract.md) — requirements, absence and
  default semantics, invariants, owner decisions, boundary parsing.
- [async-flow.md](references/perspectives/async-flow.md) — jobs, queues, callbacks,
  retries, acknowledgement, cancellation, stale state.
- [structure.md](references/perspectives/structure.md) — responsibility and boundary
  placement, abstractions, variation mechanisms, names, refactors mixed with behavior.
- [data-loss.md](references/perspectives/data-loss.md) — transformations, migrations,
  normalization, serialization, scrubbing of stored data.
- [evidence.md](references/perspectives/evidence.md) — whether tests and checks
  actually observe the claims the change makes.
