# Codex eval format

How the contents in `formats.md` are run on Codex.

- Regression and outcome cases: a `codex exec --json` run in a copy of the case workspace
  writes a JSONL trace. Apply the deterministic checks to the workspace (file exists,
  regex, unchanged paths, test exit codes) and to the trace (which commands ran). The run
  must leave its result in files with a fixed format.
- Benchmark conditions: run the same case with the skill installed, without it, and with a
  control skill whose body is generic advice of the same length and whose name and
  description are unchanged. Record pass rate, cost, and time per condition and model.
- Trigger sets: there is no skill-selection verifier in `plugin-eval`. Keep the trigger set
  as data (`id`, `query`, `should_trigger`) and check selection in the JSONL trace of a run
  that is allowed to choose a skill and nothing else.
- Hidden tests: copy the hidden files into the workspace after the run, then run the check
  command and use its exit code.
- `plugin-eval` (`openai/plugins`, `plugins/plugin-eval`) can run a benchmark from a
  `benchmark.json`; it executes downloaded code and calls models, so get the user's
  approval first.
