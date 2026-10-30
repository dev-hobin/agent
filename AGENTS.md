# Repository instructions

## Source of truth

- **Core spec and host implementations.** `core/<id>/SPEC.md` (with `knowledge/`,
  `scripts/`, `scenarios/`) is the interface the user maintains. `claude/plugins/` and
  `codex/plugins/` are maintained implementations in each host's recommended form, with
  their own eval suites. When a spec changes, run the `implementing-core` skill
  (`.agents/skills/implementing-core`, also linked under `.claude/skills`); its host
  recipes live in its `references/`. `pnpm check:core` fails when an implementation is
  stale, a copied resource differs from core, a scenario has no eval case, or a
  scenario's golden result does not prove its checks. Never name a host in `core/`.
  Capabilities not yet migrated still live in `packages/*`.

- Read `docs/standards.md` before changing resource formats, package boundaries,
  discovery, distribution, or portability checks. Before inventing a format,
  inspect the relevant official project indexes, normative references and
  related specifications—not just a host's docs. Record authority, status,
  revision/license, adopted/excluded scope and a verifier in the adoption register.
  Pin upstream revisions; do not equate a foundation listing, example or SDK
  version with an adopted normative contract.
- Keep canonical Agent Skills in `packages/*/skills/`; do not make per-service
  copies of their methods. Shared lens text lives once in `sources/lenses/` and is
  copied into each Skill that ships it by `pnpm sync:sources`; never edit the copies.
  `archive/` holds retired resources and is never packaged or linked.
- Author Skills to `docs/plans/2026-10-30-restructure.md` §3: third-person
  description with `Use when` and `Not for`, Gotchas only from observed failures,
  procedures over principles, and reference files named with their read condition.
  Entry-point Skills are explicit-use: say so in the description and set
  `policy.allow_implicit_invocation: false` in `agents/openai.yaml`.
- Distinguish upstream requirements, upstream recommendations, our own reference
  convention, and host constraints. See `docs/skill-references.md`.
- Root `packages/*/plugin.json` owns the portable Agent Plugins identity; use
  the existing `skills/` catalogs. Keep it aligned with npm release metadata.
  `.claude-plugin/plugin.json` is Claude Code's host manifest, kept identity-only and
  synchronized with the portable manifest, not an alternative source of portable
  semantics.
- Keep existing optional Pi components (Learning's `adapters/pi/`) and preserve
  their behavior. They are legacy host components, not claimed Agent
  Plugins client extensions. New standard client extensions must follow the
  upstream reverse-domain namespace rules. None may be required for a core method.
- Host marketplace files are distribution compatibility, not universal standards.
  Point them at the canonical package roots and check metadata drift. Keep adapter
  tests, native-install probes and live-evaluation drivers explicitly host-scoped.
- Skill-local `agents/openai.yaml` is Codex metadata, not a subagent format. Stances
  meant for users' instructions ship as an asset of `applying-stances` and are
  written only with the user's approval.
- Evaluations have three layers (see the `evaluating-skills` Skill). Regression and
  trigger cases live in `packages/*/evals/` in the `claude plugin eval` format and use
  deterministic graders only; trigger cases are generated from
  `evals/triggers/<skill>.json` by `pnpm build:triggers`. Hidden-test benchmark tasks
  live in `packages/*/benchmarks/` and run through `evaluating-skills/scripts/benchmark.mjs`.
  npm packs exclude both. Any run that calls a model is a paid live-model evaluation.

## Authoring and checks

- Node.js 22.19+ and pnpm 10.33.4 are development tools, not Skill runtime
  prerequisites. Reference validation also needs Python 3.11+; see README.md.
- Run `pnpm check:portable` for portable resource changes and `pnpm check:pi` for
  Pi compatibility changes. `check:standard` covers both Agent Skills and Agent
  Plugins. Retain exact upstream schema/license bytes and provenance under
  `schemas/upstream/`; these are not our MIT-licensed schemas.
- For Claude metadata/catalog changes, also run `pnpm check:claude` when available.
  For installation changes, run the opt-in `pnpm check:install -- <host>` with
  temporary HOME/config directories. Never reuse real credentials/settings or
  call a model in this probe. Run `pnpm check` before reporting completion.
- After editing a Learning `judgment.json`, run
  `node packages/learning/scripts/write-context-directions.mjs` and check for
  generated-text drift.
- Keep reference paths relative to and contained within the owning Skill.
- Report structural checks separately from live-model behavior; a passing
  validator is not evidence of correct Skill or reference selection.
- Do not publish packages, change users' global agent configuration, or run paid
  live-model evaluations unless the user requests it.
