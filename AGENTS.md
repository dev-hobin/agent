# Repository instructions

## Structure

- `core/<id>/` is the interface: `SPEC.md` (Korean, maintained by the user),
  `knowledge/`, `scripts/`, `assets/`, `scenarios/<scenario>/`, and `triggers.yaml` for
  skills the model may select. Knowledge several capabilities share lives once in
  `core/shared/`. Never name a host in `core/`.
- `claude/plugins/<plugin>/` and `codex/plugins/<plugin>/` are the implementations,
  maintained in each host's recommended form and free to use everything that host offers,
  including its own eval tools (`claude/plugins/*/evals/`, `codex/evals/`).
  `claude/IMPLEMENTS.json` and `codex/IMPLEMENTS.json` record, per capability, the spec
  hash implemented, the core resources copied in, the eval paths, and how each §4
  guarantee is met (enforced, instructed, or unsupported).
- `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` list the same
  plugins, each pointing at its host's implementation.
- `archive/` holds retired resources for provenance; it is never packaged or linked.

## Changing things

- To change what a capability does, edit `core/<id>/`, then run the `implementing-core`
  skill (`.agents/skills/implementing-core`, linked from `.claude/skills`). It applies the
  change to both implementations following its host recipes in `references/`.
- To follow a host change, update that host's recipe in
  `.agents/skills/implementing-core/references/` from the host's current documentation
  (record the version and date), then re-run the skill for every capability.
- Do not edit copies of core resources inside implementations; edit core and run
  `pnpm sync:core`.
- Before adopting or changing a resource format, read `docs/standards.md`: check the
  relevant official specifications, pin the revision, and record what is adopted.

## Checks

- Activate the Python environment first (`. .venv/bin/activate`); see README.md.
- `pnpm check` runs the pinned Agent Skills validator, the Agent Plugins schema check on
  Codex manifests, `check:core` (no implementation stale, copies identical to core, an
  eval case for every scenario and trigger, every guarantee declared, every scenario's
  golden result proving its checks), and the tests. Run it before reporting completion.
- `pnpm check:claude` validates every Claude plugin and the catalog with
  `claude plugin validate --strict`. `pnpm check:install -- <host>` installs every
  plugin in an isolated HOME without credentials or model calls.
- Host eval runs call models and cost money; run them only when the user asks. Report
  structural checks separately from model behavior.
- Do not publish, push, change users' global agent configuration, or run paid evals
  unless the user requests it.
