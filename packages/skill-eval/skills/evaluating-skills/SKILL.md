---
name: evaluating-skills
description: "Builds evaluations for an Agent Skill in three layers: deterministic structure checks, a regression suite of pass/fail cases graded by code (trigger and outcome cases), and a separate benchmark that compares with-skill, without-skill, and a length-matched control. Use when creating or changing a skill, or deciding whether a skill earns its context cost. Not for testing application code or grading a single answer."
metadata:
  version: "0.3.0"
---

# Evaluating Skills

Keep three questions apart: is the Skill well-formed, does it still do what it did, and
is it worth its context cost. Each has its own test, and only the first two gate changes.

| Layer | Question | Graders | Gate |
| --- | --- | --- | --- |
| Structure | Is the Skill and its eval suite well-formed? | Validators and scripts; no model | Every change |
| Regression | Does the Skill still trigger and still produce the required artifacts? | Deterministic: regex, tool used, tool order, file exists, test exit code | Score at or above a fixed threshold |
| Benchmark | Is the Skill better than no Skill and than generic advice of the same length? | Same deterministic graders plus hidden tests; judge models only for short outputs, as a secondary signal | No gate; record and compare over time |

## Gotchas

- A model run is not repeatable, but a grader must be: the same output must always get
  the same verdict. A judge model reading a long answer is not repeatable; make the run
  write its result to a file in a fixed format and grade that file with regex or tests.
- Whether a Skill is chosen and what it adds are separate questions. Outcome cases name
  the Skill in the prompt; trigger cases use natural phrasing and only the Skill tool,
  so a run cannot explore an empty workspace and stop before deciding.
- With all tools available, a model often does the task itself instead of loading an
  explicit-use Skill. A near-zero difference with the Skill grader failing means the
  Skill never ran, not that it adds nothing.
- Small synthetic tasks hit a ceiling: strong models pass them with or without the
  Skill. Run the without-skill condition first and keep only tasks it fails.
- A hidden test can pin one implementation. Validate hidden checks against the untouched
  workspace (must fail), the reference, and a second, differently written solution.
- Trigger runs load the Skill on every query and add up quickly on large models.
  Estimate cost from a few runs before running a full matrix.

## Procedure

1. **Structure.** Run the host's validator (`claude plugin validate --strict`, or the
   Agent Skills reference validator) and add model-free tests for the eval suite itself:
   case fields, grader patterns compile, fixtures scaffold, hidden checks fail before and
   pass after the reference.
2. **Trigger cases.** Write 20 realistic queries, 10 that should trigger and 10 near
   misses that share vocabulary but need something else. Each becomes one case with only
   the Skill tool and one grader: Skill invoked (min 1) or not invoked (max 0).
3. **Outcome cases.** For 2–3 realistic tasks, make the run leave its result in files
   (`REVIEW.md`, a scenarios file, `TEST_OUTPUT.txt`) and grade them with deterministic
   graders: required findings present, known non-defects absent, required commands run,
   forbidden edits absent. Name the Skill in the prompt.
4. **Regression gate.** Run trigger and outcome cases with the Skill only, 3 runs, and
   fail below a fixed threshold. Cases that score 1.0 for a while are the regression
   suite; flaky cases go back to the benchmark until their graders are fixed.
5. **Benchmark.** Run the same cases with and without the Skill, plus hidden-test tasks
   in skill, none, and control conditions, on at least two models. Record pass rates,
   cost, and time per condition.
6. **Decide** from the benchmark, never from one run:

| Decision | When |
| --- | --- |
| keep | Beats both without-skill and control on deterministic graders in at least two models, at an acceptable cost increase |
| revise | Beats without-skill but not control, or the Skill grader shows it is not loaded |
| merge | Two Skills give indistinguishable results on shared tasks, or their trigger cases fire for each other's queries |
| retire | No gain over without-skill in any model |

## Scripts and host tools

- Claude Code: `claude plugin eval <plugin-root>` runs cases written as
  `evals/<case>/prompt.md` plus `graders/*.md`, with a no-plugin baseline arm, and exits 1
  below `--threshold`. See [references/formats.md](references/formats.md).
- Codex: `codex exec --json` writes a JSONL trace; apply the same deterministic checks
  to the trace and the workspace.
- `scripts/benchmark.mjs <plugin-root>` runs hidden-test tasks from
  `benchmarks/<task>/` in skill, none, and control conditions through `claude -p`, then
  grades only by check exit codes. It is a dry run unless given `--execute`.

## When to read more

- [references/formats.md](references/formats.md) — before writing cases, graders,
  trigger sources, or benchmark tasks.

## Sources

Anthropic, "Demystifying evals for AI agents" (deterministic graders first; regression
versus capability suites; pass@k and pass^k). Claude Code, "Test plugins with evals".
OpenAI, "Testing Agent Skills Systematically with Evals" (deterministic checks over the
JSONL trace before rubric grading). Agent Skills
[evaluating skills](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/evaluating-skills.mdx)
and [optimizing descriptions](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/optimizing-descriptions.mdx).
