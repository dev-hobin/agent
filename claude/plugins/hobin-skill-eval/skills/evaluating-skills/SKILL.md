---
name: evaluating-skills
description: "Builds evaluations for an Agent Skill in three layers: deterministic structure checks, a regression suite of pass/fail cases graded by code (trigger and outcome cases), and a separate benchmark that compares with-skill, without-skill, and a length-matched control. Use when creating or changing a skill, or deciding whether a skill earns its context cost. Not for testing application code or grading a single answer."
argument-hint: "[path or name of the skill to evaluate]"
---

# Evaluating Skills

Keep three questions apart: is the Skill well-formed, does it still do what it did, and
is it worth its context cost. Only the first two gate changes.

Skill to evaluate: $ARGUMENTS (if empty, find it in the request)

| Layer | Question | Graders | Gate |
| --- | --- | --- | --- |
| Structure | Is the Skill and its eval suite well-formed? | Validators and scripts; no model | Every change |
| Regression | Does the Skill still trigger and still produce the required artifacts? | Deterministic: regex, tool used, file exists, test exit code | Fixed pass rate |
| Benchmark | Is the Skill better than no Skill and than generic advice of the same length? | Same deterministic graders plus hidden tests; a judge model only for short outputs, as a secondary signal | No gate; record and compare over time |

## Gotchas

- A model run is not repeatable, but a grader must be: the same output must always get
  the same verdict. A judge model reading a long answer is not. Make the run write its
  result to a file in a fixed format and grade that file with a regex or tests; graders
  that read only the final reply are not available in every eval tool.
- Whether a Skill is chosen and what it adds are separate questions. Outcome cases name
  the Skill in the prompt; trigger cases use natural phrasing and allow only the Skill
  tool, so a run cannot explore an empty workspace and stop before deciding.
- With all tools open, a model often does the task itself instead of loading an
  explicit-use Skill. A near-zero difference while the Skill grader fails means the Skill
  never ran, not that it adds nothing.
- Small synthetic tasks hit a ceiling: strong models pass with or without the Skill.
  Run the without-skill condition first and keep only tasks it fails.
- A hidden test can pin one implementation. Check it against the untouched workspace
  (must fail), the reference, and a second, differently written solution.
- Grading the path (which tool, which subagent, which step order) fails runs that reach
  the same result another way. Grade the result the Skill promises, and a path only when
  the Skill promises that action itself, such as running the tests.
- Trigger runs load the Skill on every query and cost adds up quickly on large models.
  Estimate cost from a few runs before running the full matrix.
- Never edit the Skill under evaluation; write only the eval set and the report.

## Procedure

1. **Structure.** Run `claude plugin validate <plugin-root> --strict` and add model-free
   checks for the eval suite itself: case fields, grader patterns compile, workspaces
   scaffold, every check fails on the untouched workspace and passes on the reference.
2. **Trigger cases**, only when the model may select the Skill: 20 realistic queries, 10
   that should trigger and 10 near misses that share vocabulary but need something else.
   One case per query, one grader: Skill invoked (min 1) or not (max 0).
3. **Outcome cases.** 2–3 realistic tasks. The run leaves its result in files with a
   fixed format (`REVIEW.md`, a scenario file, `TEST_OUTPUT.txt`), graded by required
   findings present, known non-defects absent, required commands run, forbidden edits
   absent. Name the Skill in the request.
4. **Regression gate.** Run trigger and outcome cases with the Skill only, 3 runs, and
   fail below a fixed pass rate. Cases at 1.0 for a while are the regression suite; flaky
   cases go back to the benchmark until their graders are fixed.
5. **Benchmark.** The same cases and hidden-test tasks with the Skill, without it, and with
   a length-matched control, on at least two models. Record pass rate, cost, and time per
   condition.
6. **Decide** from the benchmark record, never from one run:

| Decision | When |
| --- | --- |
| keep | Beats both without-skill and control on deterministic checks in at least two models, at an acceptable cost increase |
| revise | Beats without-skill but not control, or the record shows the Skill was not loaded |
| merge | Two Skills give indistinguishable results on shared tasks, or their trigger cases fire for each other's queries |
| retire | No gain over without-skill in any model |

7. **Report** in this form, to the file the request names, otherwise in the answer. If the
   request says not to run models, build the eval set and structure checks only and write
   `not run` for results:

```text
Eval set:       <path>
Structure:      <checks> — <result | not run>
Regression:     <case id>: <check summary>. Gate: <condition, runs, pass rate>
Triggers:       <should n> / <near miss n> (only for a model-selectable Skill)
Benchmark:      with skill / without skill (baseline) / length-matched control; <models>; <runs>
Decision rule:  the keep / revise / merge / retire conditions
Results:        <per condition and model | not run>
Not checked:    <what has no deterministic check>
```

## Host tools

- `claude plugin eval <plugin-root>` runs `evals/<case>/prompt.md` with `graders/*.md`,
  has a no-plugin baseline arm, and exits 1 below `--threshold`. The exact layout and
  commands: [references/claude-eval-format.md](references/claude-eval-format.md).
- `${CLAUDE_SKILL_DIR}/scripts/benchmark.mjs <plugin-root>` runs hidden-test tasks from
  `benchmarks/<task>/` with the Skill, without it, and with a length-matched control
  through `claude -p`, and grades only by check exit codes. It is a dry run unless given
  `--execute`, which calls models and costs money; get the user's approval first.

## When to read more

- `${CLAUDE_PLUGIN_ROOT}/knowledge/formats.md` — before writing structure checks,
  regression cases, trigger sets, or benchmark tasks: what each must contain.
- [references/claude-eval-format.md](references/claude-eval-format.md) — before writing
  those as `claude plugin eval` cases or running them.
