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
Canonical methods remain in `packages/*/skills/` and `skills/` without per-host
copies. Four standalone Skills remain outside the two plugin catalogs.

## Agent Plugins: applicable requirements and verification

The specification text, not the JSON Schema alone, is authoritative. We adopt a
**skills-only package profile**; neither package declares MCP servers or Agent
Plugins client extensions. There is no custom loader or mandatory runtime.

| Normative section / obligation | Authoring evidence | Boundary or review obligation |
| --- | --- | --- |
| §4.1, §5.1: root `plugin.json`, resolved package paths stay inside the plugin root | `check:standard:plugins`; negative manifest/Skill/resource symlink cases; actual extracted npm packs | These checks reject broken authored bundles; they are not a reimplementation of client failure handling |
| §5.2–5.5: canonical `$schema`, required fields, types, closed manifest and name constraints | Unmodified pinned upstream schema; positive and negative schema tests | Schema validation is intentionally strict for authors. The client's report-and-ignore exceptions are not implemented as a runtime here |
| §6–7.1: fixed `skills/`, immediate children only, Agent Skills validity | Layout checks, catalog counts, pinned skills-ref, relocated-bundle tests | Missing optional component directories are valid upstream; our two catalogs separately require 17 and 5 Skills |
| §7.2, §9: MCP configuration and subprocess behavior | Not applicable: our exported profile contains no `mcp.json` or MCP process | Adding an MCP component reopens adoption, schema and host verification; schema-only green checks are not evidence for it |
| §8: reverse-domain client extensions | No `extensions` field or standard client-extension directory is shipped by our portable profile | New Agent Plugins extension data/files must follow §8 and the owning client's contract; do not invent a namespace for a client |
| §10: schema version and plugin version distinction | Schema provenance and metadata-consistency tests | SemVer and SPDX are upstream recommendations, not new mandatory upstream syntax checks |
| §11: client conformance | Outside this repository's implementation scope | Installing our package does not certify a client or guarantee that every client supports it |

The original schema, its Apache-2.0 license, immutable source paths and SHA-256
pins live under `schemas/upstream/agent-plugins/1.0.0/`. The checker verifies local
bytes and performs no schema download. Upstream files must not be edited or
relicensed as our MIT work.

### Common identity and legacy compatibility

Each package's root `plugin.json` owns the portable identity. Our convention maps
`@hobin/<package>` to `hobin-<package>` and keeps its release metadata aligned
with npm. This mapping, disjoint names within our catalogs, identity-only
manifests and npm export rules are **repository conventions**, not upstream
requirements or a global registry.

Existing `.claude-plugin/plugin.json` and `package.json`'s `pi` fields are parallel
legacy host-format compatibility, not portable manifest overrides or claimed §8
client extensions. Existing Pi adapter components remain outside the v1
component types (§7); their discovery and behavior belong only to Pi. New
standard client extensions must use §8 rather than copying these legacy paths.
The portable core does not discover or execute them. Native compatibility checks
remain separate, and the same canonical Skill directories supply every route.

## Conditional adoption: no implementation without a matching feature

| Candidate and canonical source | Responsibility | Adoption trigger / current exclusion |
| --- | --- | --- |
| [MCP](https://modelcontextprotocol.io/specification/), current revision 2026-07-28 | External tool and context connections | When this repository actually provides an MCP integration; not a prerequisite for local Skills |
| [MCP Skills extension](https://skills.extensions.modelcontextprotocol.io/specification/stable/skills), `io.modelcontextprotocol/skills` | Remote Skill transport over MCP, preserving Agent Skills | When remote serving is required; ordinary resource reads do not imply Skill activation |
| [A2A](https://a2a-protocol.org/latest/) | Independent agent-service communication | When exposing such a service; not our internal subagent or file format |
| [Agent Client Protocol](https://agentclientprotocol.com/overview/introduction) | Editor-to-coding-agent communication | When implementing a client/agent boundary; not a package manifest |
| [Open Responses](https://www.openresponses.org/specification) / [OpenAPI](https://spec.openapis.org/oas/) | Cross-provider model API / HTTP API descriptions | When owning those API boundaries; not instruction-only distribution |
| [AG-UI](https://docs.ag-ui.com/introduction) | Agent backend to application UI | When providing that protocol boundary; not a reason to replace the optional Pi chooser |
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

## Repository conventions and host contracts

`references.json`, `judgment.json`, generated `Context Directions`, applicability,
completion statuses and minimal relevant reference reads remain **our own
contracts**. See [conditional references](skill-references.md). Core methods work
without host metadata injection. Reference files stay within their owning Skill;
this stricter authoring safeguard is distinct from plugin-root containment.

Host docs are compatibility evidence, not alternative normative package specs:

- [Claude plugin manifest](https://code.claude.com/docs/en/plugins-reference),
  [marketplace](https://code.claude.com/docs/en/plugins/marketplace-reference),
  [installation scopes](https://code.claude.com/docs/en/discover-plugins).
- [OpenAI plugin packaging and catalogs](https://developers.openai.com/plugins/build/plugins).
- [Pi package/Skill integration](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md).

The two root marketplace files are host-owned distribution metadata, not Agent
Plugins components. They point to the same package roots and are checked for
identity/source drift. Their different required fields do not justify copies of
methods. Global install scope, command syntax, cache behavior, permissions,
automatic context injection and hook APIs remain host-specific.

## Ownership and checks

| Location / command | Owner and supported claim |
| --- | --- |
| `packages/*/plugin.json` | Portable package identity; npm metadata is synchronized by repository checks |
| `packages/*/skills/`, `skills/` | Canonical Agent Skills and contained supporting files |
| `packages/*/.claude-plugin/plugin.json` | Legacy Claude identity compatibility, not a portable override |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Claude and Codex distribution catalogs |
| `packages/*/adapters/pi/` | Optional Pi-only components, not portable client extensions |
| `schemas/`, `packages/learning/schemas/` | Repository-owned authoring schemas, except the attributed `schemas/upstream/` subtree |
| `agents/` | Optional context fragments, not standardized subagent definitions |
| `AGENTS.md` | Repository maintenance instructions, not consumers' auto-installed global policy |
| `pnpm check:standard:skills` | Pinned upstream Skill frontmatter validation for all three catalogs |
| `pnpm check:standard:plugins` | Pinned manifest schema and applicable portable package/path checks |
| `pnpm check:standard` | Both standard-resource checks, without a host executable |
| `pnpm check:portable` | Standard checks plus repository policies, negative cases, actual npm packs and relocated resources |
| `pnpm check:pi` | Existing optional Pi integration/discovery behavior |
| `pnpm check:claude` | Optional native Claude metadata/catalog validation; no model call |
| `pnpm check:install -- <host>` | Opt-in isolated native installation/persistence checks against actual packed artifacts; see [installation](installation.md) |

Portable CI must work without Pi, Claude or Codex. Host compatibility results must
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
