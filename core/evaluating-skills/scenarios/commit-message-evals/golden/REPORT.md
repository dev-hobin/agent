# commit-message evals

The eval set is in `evals/commit-message/`. No model has been run yet; `skills/` is unchanged.

## What was built

| Layer | Files | Gates changes? |
| --- | --- | --- |
| Structure | `check-structure.mjs`: skill metadata; every case builds its workspace, fails untouched, and passes its reference; 10 + 10 trigger queries; control length within 20% of the skill | Yes, every change |
| Regression | `cases/staged-only`, `cases/breaking-rename`, `cases/wide-scope`: each writes `COMMIT_MSG.txt`, graded only by file and regex checks (type, scope, 50-character subject, no trailing period, `BREAKING CHANGE:` footer naming the removed export, unstaged changes not described); `triggers.json`: 10 queries that should select the skill and 10 near misses (PR descriptions, changelogs, rewriting history, reviewing the staged diff) | Yes: with the skill only, 3 runs, fail below a pass rate of 1.0 |
| Benchmark | `benchmark/plan.json`, `benchmark/control.md` | No; recorded and compared over time |

Every check gives the same verdict for the same `COMMIT_MSG.txt`. Whether the body explains
why the change was made has no deterministic check, so it is not graded rather than graded
by a model.

## Comparison

The benchmark runs the three cases in three conditions, on at least two models, 3 runs each:

- **with skill**: the skill is available and named in the request;
- **without skill** (the baseline): the same request, no skill;
- **length-matched control**: `benchmark/control.md`, generic commit-message advice of about
  the skill's length, so a gain is not explained by extra context alone.

The without-skill condition runs first; a case it already passes every time is dropped,
because it cannot show a difference. Each run records pass rate per check, cost, and time.

## Decision rule

Decide from the benchmark record, never from one run:

| Decision | When |
| --- | --- |
| keep | Beats both without-skill and the control in at least two models, at an acceptable cost increase |
| revise | Beats without-skill but not the control, or the record shows the skill was not loaded |
| merge | Another skill gives indistinguishable results on these cases, or the trigger sets fire for each other's queries |
| retire | No gain over without-skill in any model |
