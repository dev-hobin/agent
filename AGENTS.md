# Repository instructions

## Source of truth

- Read `docs/standards.md` before changing Skill formats or portability checks.
- Keep canonical Agent Skills in `packages/*/skills/` and `skills/`; do not make
  per-service copies of their methods.
- Distinguish upstream requirements, upstream recommendations, our own reference
  convention, and host constraints. See `docs/skill-references.md`.
- Keep host-specific runtime integration in package-local `adapters/<host>/`.
  It must not be required to use a portable Skill bundle. Keep adapter tests and
  live-evaluation drivers explicitly host-scoped.
- `agents/` contains optional context fragments, not auto-installed policy or a
  standardized subagent format.

## Authoring and checks

- Node.js 22.19+ and pnpm 10.33.4 are development tools, not Skill runtime
  prerequisites. Reference validation also needs Python 3.11+; see README.md.
- Run `pnpm check:portable` for portable resource changes and `pnpm check:pi` for
  Pi adapter changes. Run `pnpm check` before reporting the migration complete.
- After editing a Learning `judgment.json`, run
  `node packages/learning/scripts/write-context-directions.mjs` and check for
  generated-text drift.
- Keep reference paths relative to and contained within the owning Skill.
- Report structural checks separately from live-model behavior; a passing
  validator is not evidence of correct Skill or reference selection.
- Do not publish packages, change users' global agent configuration, or run paid
  live-model evaluations unless the user requests it.
