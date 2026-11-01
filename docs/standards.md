# Standards adoption register

This repository owns reusable agent resources, not a configuration for one agent
service. The contract is **Agent Skills for methods, Agent Plugins for packages,
and optional host compatibility at the edges**. A host integration must not be
required to understand a method or select its supporting references.

Reviewed **2026-10-27 UTC**. An unversioned URL is not a frozen contract. This is
a scope-bound adoption record, not a claim to have surveyed every AI standard.

## Admission and change procedure

Before adding or changing an instruction format, package boundary, discovery
mechanism, or distribution route:

1. Identify the responsibility being changed. Look for existing specifications
   at that layer, starting with official project indexes, normative references,
   and the specification's related projects—not just one host's documentation.
2. Verify the canonical domain/repository, governance, license, document status,
   and version policy. Search summaries, SDK versions, examples, and foundation
   membership do not substitute for a normative contract.
3. Record `adopted`, `conditional`, `observe`, `host contract`, or `repository
   convention`; state the included and excluded behavior and the evidence gap.
4. Pin the adopted revision or commit and retain upstream attribution. Map each
   applicable requirement to a check or an explicit human review obligation.
5. Separate requirements, recommendations, our stricter authoring safeguards,
   and host constraints. Do not silently strengthen a recommendation into an
   upstream requirement or advertise an untested client guarantee.
6. Reopen this decision when upstream changes affect an exported boundary, a
   target client changes its behavior, or a previously excluded feature is
   proposed. Review the upstream diff before updating a pin.

A community specification, a foundation-hosted project, a formal standards-body
publication, and a vendor product contract are different authority claims. None
alone proves applicability, interoperability, safety, or model adherence.

## Adopted sources

| Source and authority | Baseline and license | Adopted responsibility | Excluded responsibility |
| --- | --- | --- | --- |
| [Agent Skills](https://agentskills.io/specification), public format; [AAIF project listing](https://aaif.io/projects/skills) | [Specification and skills-ref at `69ef37e9424c0a7ea9dd2293b559e43ec8176379`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379); specification CC-BY-4.0, validator Apache-2.0 | `SKILL.md`, supporting files, Skill-relative references, progressive disclosure | Installation directories, invocation syntax, automatic selection and enforcement |
| [Agent Plugins](https://agent-plugins.org/specification), independently governed multi-vendor TSC | Published 1.0.0, tag `v1.0.0`, commit [`bd383552095128f6effe895b9257cfd580a6d179`](https://github.com/agentplugins/agent-plugins-spec/tree/bd383552095128f6effe895b9257cfd580a6d179); specification CC-BY-4.0, schemas Apache-2.0 | Root `plugin.json`, fixed `skills/` discovery and package containment for our skills-only bundles | Marketplaces, installation, permissions, publisher identity, global name reservation, model behavior |
| [AGENTS.md](https://agents.md/), open Markdown format stewarded by AAIF | Unversioned guidance reviewed on the date above; [source README at `557da8b39c6f5b4dee2239df09a6ab97a82ff4df`](https://github.com/agentsmd/agents.md/blob/557da8b39c6f5b4dee2239df09a6ab97a82ff4df/README.md), MIT | Instructions for maintaining this repository | Required body schema, standardized subagent definitions, universally identical automatic loading or precedence |
| [JSON Schema](https://json-schema.org/specification), public schema specification | [Draft 2020-12](https://json-schema.org/draft/2020-12/schema); [upstream licensing](https://github.com/json-schema-org/json-schema-spec/blob/main/LICENSE) | Structure of repository-owned JSON authoring formats and the upstream plugin schema dialect | Meaning of natural-language applicability conditions |
| [Semantic Versioning](https://semver.org/spec/v2.0.0.html) | 2.0.0; CC-BY-3.0 | Release/version policy; describe compatibility of exported resource names, metadata and integration interfaces | A universal guarantee that a model will behave identically; a mandatory Agent Plugins version-string grammar |
| [SPDX License List](https://spdx.org/licenses/) | Reviewed list 3.29.0; [source and licensing information](https://github.com/spdx/license-list-data#licensing-information) | License identifiers such as `MIT`; retain actual license texts separately | Mandatory SPDX validity for every otherwise type-correct upstream manifest |

Agent Plugins is **not an AAIF project**. The [AAIF-hosted community guest
post](https://aaif.io/blog/from-skills-and-tools-to-portable-agent-plugins)
explicitly says it is independently governed. Its [technical charter](https://github.com/agentplugins/agent-plugins-spec/blob/bd383552095128f6effe895b9257cfd580a6d179/GOVERNANCE.md)
is the governance source. Foundation-hosted articles must not be relabeled as
foundation ownership or formal standards-body approval.

The `skills-ref` README describes demonstration code, not a production runtime.
Its frontmatter checker is an authoring dependency, pinned in
`requirements-skills.txt`. It does not prove all prose obligations or behavior.

## Agent Skills: requirements versus guidance

The upstream specification owns the required `SKILL.md` frontmatter, naming and
name-directory match, standard optional fields, relative references, and the
supporting-resource format. Additional JSON files are permitted supporting data;
that permission does not standardize their meaning. There is no mandatory body
template. `allowed-tools` remains experimental and host-dependent.

Recommendations about 500 lines, token budgets and short reference chains are
authoring guidance, not additional schema fields or unconditional failures.
Capability content is authored once in `core/`; each host implementation carries a
byte-identical copy of the resources it needs, because a plugin must stay
self-contained; `check:core` fails on drift.

### Skill authoring guidance (reviewed 2026-10-30)

Sources: Agent Skills [best practices](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/best-practices.mdx)
and [optimizing descriptions](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/optimizing-descriptions.mdx)
at the pinned commit (upstream recommendations), and Claude's
[Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
(host recommendation, unversioned). None of these is a schema requirement.

| Decision | Classification and basis | Verifier |
| --- | --- | --- |
| A description states what the Skill does in the third person, then `Use when …`, then `Not for …` near misses | The third person follows the Claude guidance ("Always write in third person"). The imperative `Use when` follows the Agent Skills guidance. Upstream recommends near-miss *test queries*; writing them into the description is our **repository convention** | Human review now; trigger evals with near-miss queries (planned) |
| A `## Gotchas` section, placed directly after the introduction, holds only failures that were observed or corrected | Upstream recommendation ("Gotchas sections"); the evidence-only rule is our **repository convention**. Provenance is recorded in the change's plan, not in the Skill | Human review; each entry cites an observation in `docs/plans/` |
| A `## When to read more` section lists each reference file with its read condition | **Repository convention**, following the upstream advice to spend context only on what the agent lacks | Review; `claude plugin validate` and skills-ref for links and fields |

Where the Claude and Agent Skills guidance differ, the rule above records which part
each one governs. Neither is relabeled as an upstream requirement.

Evaluation follows Anthropic's "Demystifying evals for AI agents" (deterministic graders
where possible; regression suites near 100% kept apart from capability benchmarks) and
uses Claude Code's `claude plugin eval` case format as a **host contract**, reviewed
2026-10-30 on Claude Code 2.1.314. Cases sit inside each plugin because the command reads
`<plugin>/evals/`, so they sit inside each Claude plugin and marketplace installs copy them. Gating
cases use only `regex`, `tool_used`, `tool_order`, and `file_exists` graders, checked by
`tests/evals.test.mjs`. Hidden-test outcomes need a command after the run, which the host
does not offer (it has no custom-code graders), so they run in the repository's
benchmark script.

## Agent Plugins: applicable requirements and verification

The specification text, not the JSON Schema alone, is authoritative. We adopt a
**skills-only package profile**; neither package declares MCP servers or Agent
Plugins client extensions. There is no custom loader or mandatory runtime.

| Normative section / obligation | Authoring evidence | Boundary or review obligation |
| --- | --- | --- |
| §4.1, §5.1: root `plugin.json`, resolved package paths stay inside the plugin root | `check:standard:plugins`; negative manifest/Skill/resource symlink cases | These checks reject broken authored bundles; they are not a reimplementation of client failure handling |
| §5.2–5.5: canonical `$schema`, required fields, types, closed manifest and name constraints | Unmodified pinned upstream schema; positive and negative schema tests | Schema validation is intentionally strict for authors. The client's report-and-ignore exceptions are not implemented as a runtime here |
| §6–7.1: fixed `skills/`, immediate children only, Agent Skills validity | Layout checks, catalog counts, pinned skills-ref, relocated-bundle tests | Missing optional component directories are valid upstream; our five catalogs require 1, 1, 2, 1 and 5 Skills |
| §7.2, §9: MCP configuration and subprocess behavior | Not applicable: our exported profile contains no `mcp.json` or MCP process | Adding an MCP component reopens adoption, schema and host verification; schema-only green checks are not evidence for it |
| §8: reverse-domain client extensions | No `extensions` field or standard client-extension directory is shipped by our portable profile | New Agent Plugins extension data/files must follow §8 and the owning client's contract; do not invent a namespace for a client |
| §10: schema version and plugin version distinction | Schema provenance and metadata-consistency tests | SemVer and SPDX are upstream recommendations, not new mandatory upstream syntax checks |
| §11: client conformance | Outside this repository's implementation scope | Installing our package does not certify a client or guarantee that every client supports it |

The original schema, its Apache-2.0 license, immutable source paths and SHA-256
pins live under `schemas/upstream/agent-plugins/1.0.0/`. The checker verifies local
bytes and performs no schema download. Upstream files must not be edited or
relicensed as our MIT work.

### Host manifests

Codex implementations use `.codex-plugin/plugin.json`, which OpenAI documents as the
compatibility manifest that may declare `hooks`. The packaging guide names the root Agent
Plugins `plugin.json` as canonical, but Codex 0.166 does not load a plugin's hooks when a root
manifest exists (verified 2026-11-01 with the app-server's `plugin/read` and `hooks/list`), and
the implementations rely on hooks for results that must always hold. The Agent Plugins
validator and pinned schema stay for the return to the root manifest once Codex reads hooks
from it. Claude Code implementations use
`.claude-plugin/plugin.json`, Claude Code's manifest location, checked with
`claude plugin validate --strict`. Neither is an override of the other: each is that
host's implementation of the same core spec.

## Conditional adoption: no implementation without a matching feature

| Candidate and canonical source | Responsibility | Adoption trigger / current exclusion |
| --- | --- | --- |
| [MCP](https://modelcontextprotocol.io/specification/), current revision 2026-07-28 | External tool and context connections | When this repository actually provides an MCP integration; not a prerequisite for local Skills |
| [MCP Skills extension](https://skills.extensions.modelcontextprotocol.io/specification/stable/skills), `io.modelcontextprotocol/skills` | Remote Skill transport over MCP, preserving Agent Skills | When remote serving is required; ordinary resource reads do not imply Skill activation |
| [A2A](https://a2a-protocol.org/latest/) | Independent agent-service communication | When exposing such a service; not our internal subagent or file format |
| [Agent Client Protocol](https://agentclientprotocol.com/overview/introduction) | Editor-to-coding-agent communication | When implementing a client/agent boundary; not a package manifest |
| [Open Responses](https://www.openresponses.org/specification) / [OpenAPI](https://spec.openapis.org/oas/) | Cross-provider model API / HTTP API descriptions | When owning those API boundaries; not instruction-only distribution |
| [AG-UI](https://docs.ag-ui.com/introduction) | Agent backend to application UI | When providing that protocol boundary |
| [PURL / ECMA-427](https://ecma-international.org/publications-and-standards/standards/ecma-427/) | Ecosystem-independent software-package identification | When inventory/provenance needs it; not a Skill invocation namespace or publisher verification |
| [SLSA](https://slsa.dev/spec/), reviewed 1.2 | Supply-chain provenance and security guarantees | When adding a concrete provenance/verifier boundary; no SLSA level is currently claimed |

These entries record discovery and responsibility, not a completed compliance or
client-support assessment. Detailed version/license/compatibility review must
precede their activation. Do not build a runtime just to adopt a protocol.

## Observe or leave outside the current resource model

- [AI Catalog](https://ai-catalog.io/spec/) addresses artifact discovery. Its
  normative document says it is a draft that may change at any time. Observe;
  do not claim it is an adopted universal marketplace/installer standard.
- [OASF](https://github.com/agntcy/oasf) describes agent discovery/capability
  metadata. It does not replace our Skill methods or conditional references.
- [Open Agent Specification](https://github.com/oracle/agent-spec) describes
  runnable agents/flows. Our independent methods are not executable agent-loop
  definitions, so this is outside the present model.

- [Agent Plugins 1.1.0](https://agent-plugins.org/specification) is a Working
  Draft (reviewed 2026-10-30). Observe; 1.0.0 stays the adopted baseline until a
  published release is reviewed through the procedure above.

## Interface and host implementations

Claude Code and Codex evolve independently, and no vendor-neutral standard covers
invocation policy, subagent definitions, or evaluation formats
([research, 2026-10-30](research/2026-10-30-neutral-standards.md)). The repository
therefore keeps a host-neutral interface in `core/` (written in Korean for its
maintainer) and maintains one implementation per host in `claude/` and `codex/`, each in
that host's recommended form and free to use everything the host offers. The
`implementing-core` skill applies spec changes to both, following host recipes that pin
the host version and documentation reviewed. Agent Skills and Agent Plugins are used where
the host adopts them (Codex manifests and skill fields), not as a limit on what an
implementation may use.

## Repository conventions and host contracts

The core spec format, scenario checks, `IMPLEMENTS.json`, and the guarantee levels
(enforced, instructed, unsupported) are **our own conventions**, described in
`.agents/skills/implementing-core/references/`. Host documentation is the contract for
each implementation; the recipes there pin the version and date reviewed:

- [Claude plugin manifest](https://code.claude.com/docs/en/plugins-reference),
  [marketplace](https://code.claude.com/docs/en/plugins/marketplace-reference),
  [plugin evals](https://code.claude.com/docs/en/plugin-evals).
- [OpenAI plugin packaging and catalogs](https://developers.openai.com/plugins/build/plugins),
  [Codex skills](https://developers.openai.com/codex/skills).

The two root marketplace files are host-owned distribution metadata. They list the same
plugins and point each at its host's implementation. Install scope, command syntax,
cache behavior, permissions, and hook APIs remain host-specific.

## Ownership and checks

| Location / command | Owner and supported claim |
| --- | --- |
| `core/<id>/`, `core/shared/` | Capability specs (the interface), maintained by the user |
| `claude/plugins/`, `codex/plugins/`, `codex/evals/` | Host implementations and their eval suites |
| `claude/IMPLEMENTS.json`, `codex/IMPLEMENTS.json` | Implemented spec hash, copied resources, eval paths, guarantee levels |
| `.agents/skills/implementing-core/` | Spec format, host recipes, and `check.mjs` |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Claude Code and Codex catalogs |
| `schemas/upstream/` | Attributed upstream Agent Plugins schema and license |
| `archive/` | Retired resources kept for provenance; not packaged, discovered or checked |
| `AGENTS.md` | Repository maintenance instructions |
| `pnpm check:standard:skills` | Pinned upstream Skill frontmatter validation for Codex skills and repository tools |
| `pnpm check:standard:plugins` | Pinned manifest schema and path checks for Codex implementations, catalog consistency |
| `pnpm check:core` | Implementations in step with core, copies identical, every scenario and trigger has an eval case, every guarantee declared, every scenario proven by its golden result |
| `pnpm check` | All of the above plus tests, without a host executable |
| `pnpm check:claude` | `claude plugin validate --strict` on every Claude plugin and the catalog; no model call |
| `pnpm check:install -- <host>` | Opt-in isolated native installation of every plugin; see [installation](installation.md) |

CI must work without Claude or Codex. Host compatibility results must
name the actual executable version and exercised source. Structural checks and
model-free installs do not establish model selection, reference-reading quality,
permission enforcement, or live invocation behavior. Paid behavioral evaluation,
real user configuration changes and publishing remain separately authorized.

For an Agent Skills update, review its specification/validator diff, update this
register and `requirements-skills.txt` together, reinstall the pinned validator,
and rerun the checks. For Agent Plugins, review the normative/schema/license
diffs, vendor exact upstream bytes, update `source.json` and this register, and
rerun the standard, packed-artifact and relevant host checks. Preserve the
classification of every added rule throughout the update.
