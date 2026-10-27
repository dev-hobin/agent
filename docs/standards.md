# Standards and adoption boundaries

This repository is the source of truth for reusable agent instructions, not a
configuration repository for one agent service. A host consumes the same Skill
bundle; host integrations must not become prerequisites for its method.

## Source register

Sources were reviewed on **2026-10-27 (UTC)**. An unversioned documentation URL
is not a frozen contract. Review upstream changes before changing these baselines.

| Source | Adopted baseline | Role |
| --- | --- | --- |
| [Agent Skills specification](https://agentskills.io/specification) | [Specification at `69ef37e9424c0a7ea9dd2293b559e43ec8176379`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/specification.mdx) | Primary Skill format contract |
| [Agent Skills integration guide](https://agentskills.io/integrate-skills) | Documentation reviewed on the date above | Implementation guidance, not an additional Skill format |
| [skills-ref](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref) | Same upstream commit; pinned in `requirements-skills.txt` | Development-time reference validator |
| [AGENTS.md](https://agents.md/) | Open-format guidance reviewed on the date above | Repository working instructions, separate from Agent Skills |
| [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) | Draft 2020-12; [metaschema](https://json-schema.org/draft/2020-12/schema) | Structure of our own reference-policy schemas |

The `skills-ref` README explicitly describes the library as demonstration code,
not a production runtime. We use it only for authoring checks. Its successful
frontmatter validation does not prove all specification requirements, reference
selection quality, or compatibility with every host.

## Agent Skills: adopted requirements

The upstream specification owns the format, including:

- a Skill directory containing `SKILL.md` with YAML frontmatter and Markdown;
- required `name` and `description`, their constraints, and name-directory match;
- the standard optional `license`, `compatibility`, `metadata`, and experimental
  `allowed-tools` fields;
- relative file references resolved from the Skill directory;
- progressively disclosed metadata, instructions, and supporting resources.

Supporting files may use additional names and formats. A custom JSON file is
allowed supporting data; that does not make its meaning part of Agent Skills.
There is no required Markdown body template.

Recommendations such as keeping `SKILL.md` under 500 lines, short reference
chains, and the suggested token budgets are authoring guidance, not additional
schema fields or unconditional validation failures. Tool allowlisting is
experimental and may differ between hosts.

## Repository conventions: additional, not upstream requirements

The repository separately owns these portability expectations:

- Keep one canonical copy of each Skill and its supporting files. Do not maintain
  Claude-, Codex-, and Pi-specific copies of the method.
- Keep each bundle self-contained, including physically contained reference
  targets. Our path containment checks are repository safeguards.
- Keep the core method complete without prepared reference bodies or a host hook.
- Keep host command syntax and APIs out of portable method instructions.
- Preserve optional, materially relevant reference selection, with exclusions
  taking precedence. See [our reference contract](skill-references.md).
- Treat generated directions as generated output and check them against their
  authoring source.

`references.json`, `judgment.json`, `Context Directions`, applicability rules,
completion statuses, and the preference for minimal reference reads are our own
contracts. JSON Schema validates data structure; it cannot decide whether a
natural-language condition applies to a user's request.

## Resource ownership

| Canonical location | Contract and owner |
| --- | --- |
| `packages/developer/skills/` | Developer methods, Agent Skills bundles |
| `packages/learning/skills/` | Learning methods, Agent Skills bundles; embedded directions are generated locally |
| `skills/` | Independent Agent Skills bundles, outside the npm package catalogs |
| `schemas/` and `packages/learning/schemas/` | Versioned repository-owned authoring formats |
| `packages/*/adapters/pi/` | Optional Pi lifecycle and UI integration |
| Package `test/` / `tests/` and Learning `scripts/eval-*.mjs` | Development checks; Pi live-evaluation drivers and adapter tests are host-specific, not portable method dependencies |
| `agents/` | Reviewable context fragments, not a standardized subagent definition format |
| `AGENTS.md` | Instructions for maintaining this repository, not a global policy automatically installed for consumers |

Package names group distributable resources. They do not define a portable agent
runtime, mandatory pipeline, or cross-Skill state machine.

## Host documentation: compatibility evidence only

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code project instructions](https://code.claude.com/docs/en/memory)
- [Codex Skills](https://developers.openai.com/codex/skills/)
- [Codex project instructions](https://developers.openai.com/codex/guides/agents-md/)
- [Pi Skills](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md)

These describe discovery paths, invocation, permissions, and host extensions.
They do not redefine the canonical method. Discovery locations, command syntax,
AGENTS.md precedence, automatic context injection, and hook APIs are not
universal Agent Skills guarantees.

MCP is not required for this migration. If external tools are added later, their
protocol should be documented separately rather than used as a Skill loader.

## Verification and updating the baseline

- `pnpm check:standard`: reference validation of all three Skill catalogs, with
  no agent runtime. The installed validator's Git provenance must match the
  commit in `requirements-skills.txt`; a same-version tool from another source
  is not accepted.
- `pnpm check:portable`: standard checks plus repository conventions, authoring
  consistency, relocated bundles, and packed artifacts.
- `pnpm check:pi`: Pi adapter, discovery, and runtime integration checks.
- Live-model tests are separate evidence for model behavior, not implied by any
  of the structural checks above.

To update the Agent Skills baseline, review the specification and validator diff,
update this register and `requirements-skills.txt` together, reinstall the
reference tool with `python -m pip install --force-reinstall -r requirements-skills.txt`,
and rerun the checks. Classify every added rule as an upstream
requirement, upstream recommendation, repository convention, or host constraint.
Do not silently promote a host feature or our own convention into a standard.
