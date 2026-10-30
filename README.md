# Hobin agent resources

English | [한국어](./README.ko.md)

Agent Skills for code review, feature development, engineering stances, skill
evaluation, and learning, maintained by dev-hobin. Skills follow
[Agent Skills](https://agentskills.io/specification); packages follow
[Agent Plugins](https://agent-plugins.org/specification). Host-specific files are
optional and point at the same originals.

## Design

- **Few entry points, explicit use.** Each package exposes one job. Review and
  feature development are invoked by name, so they never compete for automatic
  selection with each other or with your other Skills.
- **Perspectives are references, not Skills.** A review runs one focused pass per
  perspective (contract, async flow, structure, data loss, evidence), in parallel
  subagents where the host supports them. The same lens files guide design in
  feature development. They are written once in `sources/lenses/`.
- **Gotchas first, only from observed failures.** Skills lead with the mistakes a
  strong model actually made, then give a procedure.
- **Deterministic parts are scripts and assets**: review context collection, the
  acceptance-scenario file, the evaluation runner.
- **Stances belong in your instructions.** Default behaviors such as "preserve
  stored data" go into `AGENTS.md` or `CLAUDE.md` with your approval, and are
  promoted into checks when they keep being broken.
- **Kept only if measured.** `evals/` holds trigger and outcome evaluations that
  compare each Skill with no Skill and a length-matched control.

See the [standards register](./docs/standards.md) and the
[restructure plan](./docs/plans/2026-10-30-restructure.md).

## Packages

| Plugin | Skills | Use |
| --- | --- | --- |
| `hobin-review` | `reviewing-code` | Review a diff, branch, or pull request, or diagnose a named scope; reports verified P0/P1 defects only |
| `hobin-feature` | `developing-features` | Build a non-trivial feature through acceptance scenarios, owner decisions, design, slices, and independent verification |
| `hobin-stances` | `applying-stances`, `enforcing-conventions` | Install short stances into agent instructions; turn repeatedly broken rules into checks |
| `hobin-skill-eval` | `evaluating-skills` | Trigger and outcome evaluations for any Agent Skill |
| `hobin-learning` | `technical-reading`, `opensource-reading`, `conceptualize`, `patternize`, `exercise` | Source-grounded study and practice |

Each package is an independent npm package (`@hobin/<name>`) and plugin. Install
only what you use.

## Install

Register the **resource checkout** once, then install plugins. The marketplace is
named `hobin`.

### Claude Code

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-review@hobin --scope user
claude plugin install hobin-feature@hobin --scope user
```

### Codex

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-review@hobin
codex plugin add hobin-feature@hobin
```

Start a new session after installing.

| Host | Invocation |
| --- | --- |
| Claude Code | `/hobin-review:reviewing-code`, `/hobin-feature:developing-features` |
| Codex | `$hobin-review:reviewing-code`, `$hobin-feature:developing-features` |
| Pi | `/skill:reviewing-code` |

To add the stances to a project, run `/hobin-stances:applying-stances` (Claude
Code) or `$hobin-stances:applying-stances` (Codex). It shows the exact change
to `AGENTS.md` or `CLAUDE.md` and writes only after you approve.

Upgrading from 0.2.x? See the [0.3.0 release notes](./docs/releases/0.3.0.md) for
the old-to-new mapping. More detail: [installation](./docs/installation.md),
[Claude plugin boundaries](./docs/claude-plugins.md).

## Portable use

Instruction-only Skills need neither Node.js nor a specific host. Copy or expose
each **whole Skill directory**, including `references/`, `scripts/`, and `assets/`,
through any compatible host. `agents/openai.yaml` is Codex metadata and other hosts
ignore it. Scripts need a POSIX shell (`collect-context.sh`) or Node.js 22
(`run-evals.mjs`).

## Repository layout

| Location | Purpose |
| --- | --- |
| `packages/*/` | Plugins: `plugin.json`, `.claude-plugin/plugin.json`, `skills/` |
| `sources/lenses/` | Single source for lens files copied into Skills (`pnpm sync:sources`) |
| `evals/<skill>/` | Trigger sets, outcome tasks, fixtures; never packaged |
| `archive/` | Retired 0.2.2 resources kept for provenance |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Claude Code and Codex catalogs |

## Development and checks

Authoring requires Node.js 22.19+, pnpm 10.33.4, and Python 3.11+ for the pinned
Skill validator.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check            # standards, shared-source drift, policies, packed artifacts, Pi
pnpm check:claude     # optional, model-free
pnpm check:install -- claude   # optional, isolated native install probe
pnpm check:install -- codex
```

Evaluations call models and cost money, so the runner is a dry run unless given
`--execute`:

```sh
node packages/skill-eval/skills/evaluating-skills/scripts/run-evals.mjs \
  outcomes --evals evals/reviewing-code --plugin-dir packages/review
```

Structural checks do not prove model behavior; only evaluations do.

## License

Repository-owned resources: [MIT](./LICENSE). The unmodified Agent Plugins schema
under [`schemas/upstream/`](./schemas/upstream/agent-plugins/1.0.0) keeps its
upstream Apache-2.0 license and attribution.
