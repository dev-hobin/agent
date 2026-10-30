---
name: evaluating-skills
description: "Builds and runs evaluations for an Agent Skill: trigger evals with should-trigger and near-miss queries, and outcome evals comparing with-skill, without-skill, and a length-matched control across models, then recommends keep, revise, merge, or retire. Use when creating or changing a skill, or deciding whether a skill earns its context cost. Not for testing application code or grading a single answer."
metadata:
  version: "0.3.0"
---

# Evaluating Skills

Decide with evidence whether a Skill changes outcomes enough to justify its context cost.

## Gotchas

- Small, well-specified synthetic tasks hit a ceiling: strong models pass them with or
  without the Skill, so the comparison shows nothing. Run the without-skill condition
  first and keep only tasks it actually fails.
- A hidden test can pin one implementation and fail a different correct fix. Validate
  hidden checks against an alternative correct solution, not only the reference.
- Globally installed plugins and user instructions leak into headless runs. Confirm the
  loaded plugin list for every run; numbers from a contaminated run are void.
- Headless runs rarely stop to ask. For tasks that hinge on an owner decision, assert
  that the answer names the decision and its default, not that it asked.
- A gain over no skill can come from extra prompt length alone. Compare against a
  length-matched control before crediting the Skill's content.
- Assertions that pass in every condition carry no information; remove or harden them.
- A runner that applies the conditions by default hides them from the eval files.
  Write the comparison (conditions, models, runs) and the decision rule into the eval
  directory before running, so readers and later runs know what "better" means.
- An LLM grader that sees only the final answer cannot judge process assertions
  ("ran the existing tests", "used an independent reviewer") and tends to fail
  negative ones ("did not flag X") for lack of evidence. Give it the commands and
  subagents the run used, and tell it how to treat negative assertions.

## Procedure

1. **State the claim.** Capability uplift ("does X better") or encoded preference
   ("follows our workflow"). Preference Skills are judged on adherence to the workflow,
   uplift Skills on task outcomes.
2. **Trigger set.** Write 20 realistic queries: 10 that should trigger and 10 near
   misses that share keywords but need something else. If you will tune the
   description, split them 60/40 into train and validation and look only at train
   failures while editing. Run each query 3 times; it passes when the trigger rate is
   on the right side of 0.5.
3. **Outcome tasks.** Write 2–3 realistic tasks with fixtures. Add assertions only after
   a first run shows what outputs look like; each assertion must be checkable from the
   answer or the workspace and must fail for a generic answer. Prefer code checks
   (hidden tests, file checks) wherever possible.
4. **Calibrate.** Run the without-skill condition once. Drop or harden tasks it already
   passes completely.
5. **Write the plan, then run the matrix.** In the eval directory's `README.md`, state
   the conditions (with-skill, without-skill, control), the models (at least two), the
   runs per cell (3), and the decision rule from step 7. Then run and record pass rates,
   cost, tokens, and time. Estimate cost from a few runs first: trigger runs load the
   Skill on every query and add up quickly on large models.
6. **Analyze per assertion.** Look for assertions that pass only with the Skill, that
   fail everywhere (broken assertion or task too hard), or that flip between runs
   (flaky task or vague instruction). Read a few transcripts for each pattern.
7. **Decide** using the table below and report the evidence behind it.

| Decision | When |
| --- | --- |
| keep | Beats both without-skill and control on discriminating assertions in at least two models, at an acceptable cost increase |
| revise | Beats without-skill but not control, or results flip between runs |
| merge | Two Skills produce indistinguishable results on shared tasks, or their trigger sets fire for each other's queries |
| retire | No gain over without-skill in any model |

## Scripts

`scripts/run-evals.mjs` runs both evaluation kinds through Claude Code (`claude -p`)
with Node 22 built-ins only. It is a dry run by default and calls models only with
`--execute`; `--max-budget-usd` caps each run.

```sh
node scripts/run-evals.mjs triggers --evals <evals/skill-dir> --plugin-dir <plugin-root>
node scripts/run-evals.mjs outcomes --evals <evals/skill-dir> --plugin-dir <plugin-root> \
  --models haiku,sonnet --runs 3 --execute
```

Results are written to `<evals/skill-dir>/results/<timestamp>/`: per run a transcript,
the final answer, the workspace diff, the commands it ran, and a graded record; plus
`summary.json`. On other hosts, follow the same procedure by hand
or adapt the runner's `claude()` and `usedSkill()` functions.

## When to read more

- [references/formats.md](references/formats.md) — read before writing
  `triggers.json`, `evals.json`, or fixtures, for the file formats the runner expects.

## Sources

Agent Skills [evaluating skills](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/evaluating-skills.mdx)
and [optimizing descriptions](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/optimizing-descriptions.mdx);
Anthropic skill-creator; the repository's `adversarial-eval` Skill (0.2.2).
