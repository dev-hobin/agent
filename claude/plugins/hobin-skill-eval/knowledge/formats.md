# Evaluation Contents

Read this before writing structure checks, regression cases, trigger sets, or benchmark
tasks. It says what each piece must contain, not how a particular eval tool spells it:
write the contents in the project's existing eval format, or in plain files that a host
eval tool can be pointed at later.

## Layout

One eval set per skill, kept apart from the skill so the skill under test never changes:

```text
evals/<skill>/
  structure check     model-free checks of the skill and of this eval set
  cases/<case>/       regression cases: workspace, request, checks, reference result
  triggers            trigger set, only when the model may select the skill itself
  benchmark/          benchmark tasks, the control text, and recorded results
```

## Structure checks

Model-free, run on every change, and gating:

- The skill is well-formed: required metadata present, description states what it does,
  when to use it, and what it is not for; every file the skill links to exists.
- The eval set is well-formed: every case has the fields below, every pattern compiles,
  every workspace can be set up from its files alone.
- Every hidden or file check fails on the untouched workspace and passes on the reference
  result. For hidden tests, also pass a second, differently written correct solution, so
  the test does not pin one implementation.

## Regression case

| Field | Content |
| --- | --- |
| id | Stable name; the same id is used in every host's eval tool |
| workspace | The files the run starts from, or a setup script that builds them (for example a git repository with staged changes) |
| request | What a user would ask, in natural words, plus where to leave the result and in what fixed format (for example "write the message to `COMMIT_MSG.txt`", "save `npm test` output to `TEST_OUTPUT.txt`") |
| checks | Deterministic checks over the files the run leaves (kinds below) |
| hidden | Optional tests added only after the run, never visible to it |
| reference | A correct result that passes every check; proves the checks are satisfiable |

Check kinds, all deterministic:

| Kind | Use it for |
| --- | --- |
| file exists (path or glob) | An artifact the run must create |
| file matches a regex | A required finding, section, or format in a file the run wrote |
| file lacks a regex | A known non-defect or forbidden content that must not appear |
| unchanged paths | Files the run must not touch (for example the skill under test, existing tests) |
| unchanged except | The run may write only the named files |
| command passes | Hidden or existing tests; judged by exit code only |
| ran a command | A command the skill promises to run (for example the test suite), matched against the run's command trace |

A check is kept only if the same output always gets the same verdict. A model reading a
long answer and scoring it is not such a check; make the run write a file in a fixed
format and match the file. Grade the outcome the skill promises, not the path a run took:
which tools, subagents, or step order it used is not a check unless the skill promises
that action itself (running the tests is a promise; delegating to a subagent is a
strategy).

## Trigger set

Only for skills the model may select on its own.

- 20 realistic queries: 10 that should select the skill and 10 near misses that share its
  vocabulary but need something else (testing application code, grading one answer, a
  concept question, a word that only looks related).
- Each query: `id`, `query`, `should_trigger` (true or false), and a short note on why.
- Mix phrasing: terse and long, casual and formal, every language the users write in.
- Each query is one case whose run can only select or not select a skill, so it cannot
  explore an empty workspace and stop before deciding. The one check: selected at least
  once (should trigger) or never (should not).

## Benchmark task

Not gating; recorded and compared over time.

| Field | Content |
| --- | --- |
| id, prompt | The same request a regression case would use |
| workspace, hidden, reference | As in a regression case; hidden tests are the main checks |
| conditions | with skill; without skill; control: generic advice of about the same length as the skill, so a gain is not just more context |
| models | At least two |
| runs | At least three per condition and model |
| record | Pass rate per check, cost, and time per condition and model |

Run the without-skill condition first and keep only tasks it fails; strong models pass
small synthetic tasks either way, and a ceiling task cannot show a difference. A
near-zero difference while the with-skill run never loaded the skill means the skill did
not run, not that it adds nothing.

## Decision rule

Decide from the benchmark, never from one run.

| Decision | When |
| --- | --- |
| keep | Beats both without-skill and control on deterministic checks in at least two models, at an acceptable cost increase |
| revise | Beats without-skill but not control, or the record shows the skill was not loaded |
| merge | Two skills give indistinguishable results on shared tasks, or their trigger sets fire for each other's queries |
| retire | No gain over without-skill in any model |
