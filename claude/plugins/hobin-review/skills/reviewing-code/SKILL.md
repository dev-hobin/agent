---
name: reviewing-code
description: "Reviews a code change, or a bounded existing scope, for correctness defects and reports only verified, high-confidence findings with concrete failure scenarios. Use only when explicitly asked to review a diff, branch, or pull request, or to diagnose a named module or feature slice. Not for style feedback, automatic repair, environment setup checks, or whole-repository rewrites."
argument-hint: "[what to review: a branch, diff, pull request, or named scope]"
disable-model-invocation: true
allowed-tools:
  - "Bash(${CLAUDE_SKILL_DIR}/scripts/collect-context.sh *)"
  - "Agent(hobin-review:contract-reviewer, hobin-review:async-flow-reviewer, hobin-review:structure-reviewer, hobin-review:data-loss-reviewer, hobin-review:evidence-reviewer)"
---

# Reviewing Code

Find the defects that would hurt users or data, prove each one, and say nothing else.
Do not change the reviewed code; write only the report.

Review target: $ARGUMENTS

## Gotchas

- Project instructions (`AGENTS.md`, `CLAUDE.md`, contributing guides) record team
  decisions that outrank every generic perspective here. A finding that contradicts a
  recorded decision is wrong.
- The tests the change added say nothing about the tests it may have broken. Run the
  existing suites around the changed code before calling the change safe.
- A change to one branch, field, or caller is often repeated in a sibling the diff does
  not touch.
- Reviewers drift into style and naming nits when nothing serious is found. "No
  findings" is a valid result.

## Procedure

1. **Pick the mode.** *Change review*: a diff, branch, or pull request. *Scope
   diagnosis*: a named module, directory, flow, or feature slice. If the target is
   unclear, review the current branch against its base.
2. **Collect context.** For change review run
   `${CLAUDE_SKILL_DIR}/scripts/collect-context.sh [base]` from the repository root; it
   prints the range, changed files, nearby tests, project instruction files, and the
   diff. If the request supplies a diff file, use it. For scope diagnosis, find the
   entry points, tests, and instruction files yourself. Read the instruction files.
3. **Select perspectives** that apply and say which you skipped and why:
   - **contract** (`hobin-review:contract-reviewer`): requirements, absence and default semantics, invariants, owner decisions, boundary parsing
   - **async-flow** (`hobin-review:async-flow-reviewer`): jobs, queues, callbacks, retries, acknowledgement, cancellation, stale state
   - **structure** (`hobin-review:structure-reviewer`): responsibility and boundaries, abstractions, variation mechanisms, names, refactors mixed with behavior
   - **data-loss** (`hobin-review:data-loss-reviewer`): transformations, migrations, normalization, serialization, scrubbing stored data
   - **evidence** (`hobin-review:evidence-reviewer`): whether tests and checks observe what the change claims
4. **Review per perspective.** Apply each selected perspective's "After building, find"
   questions; its knowledge is in `${CLAUDE_PLUGIN_ROOT}/knowledge/<perspective>.md`.
   For a change that is large or spans several perspectives, dispatch the reviewer
   agents of the selected perspectives with the Agent tool in a single message so they
   run in parallel, and give each the review target and the context from step 2.
5. **Verify every candidate** with a test, a command, or an exact trace through the
   code. Drop candidates you cannot turn into a concrete scenario of input or state
   leading to a wrong outcome. Merge duplicates.
6. **Rank.** P0: data loss, security exposure, or a crash on a main path. P1: wrong
   behavior on a realistic path. Report P2 and below only when asked.
7. **Report** in the file the request names, or in the reply. In scope diagnosis, end
   with a plan ordered now, next, later, and leave alone, each with the reason.

```text
[P0|P1] <one-line defect> — <file>:<line>
  Scenario: <input or state> → <wrong outcome>
  Evidence: <test, command output, or trace that shows it>
  Direction: <what a fix must preserve; not a full patch>

Checked without findings: <perspectives>
Not checked: <what the review could not observe>
```
