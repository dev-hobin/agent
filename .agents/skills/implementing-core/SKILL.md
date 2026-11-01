---
name: implementing-core
description: "Implements a host-neutral capability spec from core/<id>/SPEC.md as native Claude Code and Codex plugins, each following its host's recommended patterns, then verifies them with each host's own validators and eval tools. Use when a core spec was added or changed, when `pnpm check:core` reports a stale implementation, or when a host's recommended patterns changed. Not for editing the spec itself or for plugins that have no core spec."
---

# Implementing Core

Turn `core/<id>/` (the interface) into `claude/` and `codex/` plugins (the
implementations). The user maintains only core; you keep the implementations in step.

## Gotchas

- Never edit `core/` to make an implementation easier. If the spec cannot be met on a
  host, implement what the host allows and record the gap in that host's `HOST.md`.
- Guarantees are outcomes. Do not turn a strategy (spec §6) into a requirement, and do
  not grade the path a run took when the spec promises a result.
- Each host has its own idioms; do not copy one host's form to the other. Claude reads
  `disable-model-invocation`, plugin `agents/`, and `.claude-plugin/plugin.json`; Codex
  ignores all three and uses `agents/openai.yaml`, subagent instructions, and a root
  `plugin.json`.
- Marketplace installs copy only the plugin directory. Anything a plugin needs from core
  (knowledge, scripts, scenario fixtures) must be copied into it; never reference `../`.
- Knowledge and scripts must stay byte-identical to core. Copy them with
  `scripts/check.mjs --sync`; do not paraphrase them.
- When a scenario's `request` or checks change, update every eval case built from it:
  each case carries the request word for word (`check.mjs` fails otherwise), and Claude
  graders repeat each check's pattern exactly.

## Procedure

1. **Read the spec** `core/<id>/SPEC.md` and, if it changed, `git diff` it since the
   commit recorded for this capability in `claude/IMPLEMENTS.json` and
   `codex/IMPLEMENTS.json`. The input format is in
   [references/spec-format.md](references/spec-format.md).
2. **Implement for Claude Code** following [references/claude.md](references/claude.md):
   plugin files, skill, agents for the §6 strategy, evals per §8 scenario. Write the
   skill text in English from the spec's content.
3. **Implement for Codex** following [references/codex.md](references/codex.md).
4. **Copy core resources and record the implementation.** Update this capability's entry
   in each `IMPLEMENTS.json` — `plugin`, `copies`, `evals`, `triggers` (a path pattern
   with `{trigger}`, or `"unsupported: reason"`), and `guarantees` (each §4 ID as
   `"enforced: …"`, `"instructed: …"`, or `"unsupported: …"`) — then run
   `node .agents/skills/implementing-core/scripts/check.mjs --sync`. It copies the
   resources and records the current spec hash.
5. **Verify without models.** Activate the repository's Python environment first
   (`. .venv/bin/activate`; the Agent Skills validator needs it), then run `pnpm check`
   and `claude plugin validate claude/plugins/<plugin> --strict`. Fix every failure.
6. **Verify with each host's eval tool** for the scenarios the change affects (all of
   them for a new capability), using the commands in each host reference. These calls
   cost money; run each scenario once first and three times before reporting a pass rate.
7. **Report**: what changed per host, each guarantee's level per host (enforced,
   instructed, unsupported), validator and eval results with cost, and any spec item a
   host cannot meet.

## When to read more

- [references/spec-format.md](references/spec-format.md) — before reading or creating a spec.
- [references/claude.md](references/claude.md) — before changing anything under `claude/`.
- [references/codex.md](references/codex.md) — before changing anything under `codex/`.
