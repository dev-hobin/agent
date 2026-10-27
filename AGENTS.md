# Repository instructions

## Source of truth

- Read `docs/standards.md` before changing resource formats, package boundaries,
  discovery, distribution, or portability checks. Before inventing a format,
  inspect the relevant official project indexes, normative references and
  related specifications—not just a host's docs. Record authority, status,
  revision/license, adopted/excluded scope and a verifier in the adoption register.
  Pin upstream revisions; do not equate a foundation listing, example or SDK
  version with an adopted normative contract.
- Keep canonical Agent Skills in `packages/*/skills/` and `skills/`; do not make
  per-service copies of their methods.
- Distinguish upstream requirements, upstream recommendations, our own reference
  convention, and host constraints. See `docs/skill-references.md`.
- Root `packages/*/plugin.json` owns the portable Agent Plugins identity; use
  the existing `skills/` catalogs. Keep it aligned with npm release metadata.
  `.claude-plugin/plugin.json` is identity-only legacy compatibility, synchronized
  with the portable manifest, not an alternative source of portable semantics.
- Keep existing optional Pi components in package-local `adapters/pi/` and
  preserve their behavior. They are legacy host components, not claimed Agent
  Plugins client extensions. New standard client extensions must follow the
  upstream reverse-domain namespace rules. None may be required for a core method.
- Host marketplace files are distribution compatibility, not universal standards.
  Point them at the canonical package roots and check metadata drift. Keep adapter
  tests, native-install probes and live-evaluation drivers explicitly host-scoped.
- `agents/` contains optional context fragments, not auto-installed policy or a
  standardized subagent format.

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
