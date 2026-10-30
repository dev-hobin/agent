# Vendor-neutral specs for packaging agent skills/plugins (checked 2026-10-30)

Sources are primary unless marked. Git sources were cloned and read locally. Web docs were fetched on 2026-10-30; quotes taken through a summarizing fetcher are marked "(fetched)" and may be lightly paraphrased.

## 0. Pin currency

- **Agent Skills, still current.** `agentskills/agentskills` `main` HEAD = `69ef37e9424c0a7ea9dd2293b559e43ec8176379` (2026-08-09, "docs: add OpenClaw to client showcase (#492)"). The repo has no tags. The diff since the pin is empty.
  - Open PRs relevant to us (not merged):
    - #546 reserves the `io.modelcontextprotocol/` metadata prefix (head `1ae3320f`).
    - #527 adds client guidance on nested/namespaced layouts (head `390d7aac`).
    - #254 and #380 are the `.well-known` URI drafts.
    - #506 renames eval `assertions` to `expectations`.
- **Agent Plugins, the 1.0.0 pin is still the latest published release, but `main` has moved on.**
  - Pin `bd383552…` = tag `v1.0.0`.
  - `main` HEAD = `ff8ab5e392cc87bd88d87c060815a87490e51003` (2026-08-19, PR #65 "Start the 1.1.0 working draft").
  - Diff since the pin (2 commits): adds `spec/1.1.0.md`, `schemas/1.1.0/*`, and README status lines. **1.1.0 is currently a mechanical copy of 1.0.0.** The only changes are the version strings, `$schema` URIs, "Status: Working Draft", and the wording "Agent Plugins v1" → "This specification". It has no substantive normative change yet.
  - Proposed 1.1 changes are in open PRs:
    - #89 portable lifecycle hooks (`hooks.json`; SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop; head `a6a93f8b`)
    - #67 namespaced skill discovery under `skills/<ns>/<skill>/`
    - #82 makes a malformed `extensions` value fatal
    - #85 per-server MCP extension data
    - #66 display names/icons
    - #79/#80 regex-portable validation
    - Issue #6 proposes a normative `{plugin-name}:{component-name}` invocation format (open).

## 1. Agent Skills specification

Sources: `docs/specification.mdx` @ `69ef37e` (= https://agentskills.io/specification) and `docs/client-implementation/adding-skills-support.mdx` @ `69ef37e`.

- **Required fields.**
  - `name`: "Max 64 characters. Lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen." Also: "Must not contain consecutive hyphens" and "Must match the parent directory name".
  - `description`: "Max 1024 characters. Non-empty. Describes what the skill does and when to use it."
- **Optional fields.**
  - `license`
  - `compatibility`: "Max 500 characters. Indicates environment requirements (intended product, system packages, network access, etc.)". Also "Most skills do not need the `compatibility` field."
  - `metadata`
  - `allowed-tools`: "Space-separated string of pre-approved tools the skill may use. (Experimental)". Also "Support for this field may vary between agent implementations". Example: `Bash(git:*) Bash(jq:*) Read`.
- **Unknown fields: the spec text is silent, and the reference validator is strict.**
  - The spec lists the six fields and says nothing about other keys.
  - `skills-ref/src/skills_ref/validator.py` @ `69ef37e` has `ALLOWED_FIELDS = {name, description, license, allowed-tools, metadata, compatibility}`. It errors with "Unexpected fields in frontmatter: … Only [...] are allowed."
  - The skills-ref README says: "This library is intended for demonstration purposes only. It is not meant to be used in production."
  - So the prohibition comes from the validator (and from Anthropic's upload path, see §6), not from normative spec text.
- **What clients do with unknown or invalid fields.** The client guide has no explicit unknown-field rule. Its general posture is "Lenient validation": "Warn on issues but still load the skill when possible". It skips a skill only when the description is missing or the YAML is unparseable.
  - The guide itself cites a non-standard field as a host opt-out: "The skill has opted out of model-driven activation (e.g., via a `disable-model-invocation` flag)".
  - **Caveat (cross-spec):** Agent Plugins §7.1 says "If a discovered skill does not conform to the Agent Skills specification, the client MUST skip that skill". Whether an extra frontmatter key is "non-conformant" is therefore ambiguous. That is UNVERIFIED / not settled by either spec.
- **`metadata`.** "A map from string keys to string values". "Clients can use this to store additional properties not defined by the Agent Skills spec". "We recommend making your key names reasonably unique to avoid accidental conflicts."
  - No namespacing rule exists in the spec.
  - The MCP Skills extension (SEP-2640, Final) reserves `io.modelcontextprotocol/` within `metadata`. Open Agent Skills PR #546 would mirror that and recommend "a reverse-domain namespace you control, such as `com.example/my-key`". That PR is not merged.
- **Directories.** "A skill is a directory containing, at minimum, a `SKILL.md` file". `scripts/`, `references/` and `assets/` are "recommendations for organizing common types of content".
  - "Keep your main `SKILL.md` under 500 lines". The instructions budget is "< 5000 tokens recommended".
  - "use relative paths from the skill root". "Keep file references one level deep".
- **Explicit invocation (guidance only, no field).** "Users should also be able to activate skills directly … slash command or mention syntax (`/skill-name` or `$skill-name`) … The specific syntax is up to you". The client-side opt-out quoted above is an example, not a standardized field.
- **Delegation (guidance only).** "Subagent delegation (optional) … an advanced pattern only supported by some clients … the skill is run in a separate subagent session". No frontmatter field for it is defined.
- **Discovery paths (client guide, non-normative).** "the Agent Skills specification does not mandate where skill directories live". Clients should consider scanning `<project>/.agents/skills/` and `~/.agents/skills/`, a "widely-adopted convention for cross-client skill sharing". On name collisions: "apply a deterministic precedence rule".

## 2. Agent Plugins 1.0.0 (published) and 1.1.0 (working draft)

Sources: `spec/1.0.0.md` @ `bd38355` and `spec/1.1.0.md` @ `ff8ab5e`.

- **Components.** "Agent Plugins v1 defines exactly two component types: **skills** and **MCP servers**."
  - Fixed locations: `skills/` (immediate children with `SKILL.md`; "MUST NOT recursively search deeper") and root `mcp.json`.
  - Out of scope (Design Decisions): "commands, hooks, agents, rules, and LSP servers — remain too client-specific for a stable portable contract".
  - There is **no agents/subagents component**.
  - Skill format is delegated: "Agent Skills MUST conform to the Agent Skills specification".
- **Manifest.**
  - Root `plugin.json`, closed schema: "the only permitted top-level fields are `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, and `extensions`."
  - `$schema` is required and must equal `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
  - "Clients MUST NOT retrieve a schema while loading a plugin."
- **Unknown fields.** "Clients MUST report and ignore each unknown field and MUST continue loading … Clients MUST NOT assign semantics to unknown fields." Any other schema violation "is fatal".
- **Unknown components.** "Clients MUST ignore component types they do not support." Also: "lack of support for a component type, MCP transport, or client extension is not itself an error."
- **`extensions` (§8), exact rules.**
  - "Client-specific manifest data MUST be represented under a reverse-domain namespace in `extensions`. Client-specific files MUST be represented under a top-level directory named for that namespace."
  - "A client SHOULD base its namespace on a domain name it controls" (example: `com.example.client`).
  - "The optional `extensions` field … MUST be an object whose member names are client extension namespaces and whose member values are objects."
  - "A client MUST ignore manifest entries for namespaces it does not implement without validating the contents of their values."
  - "Agent Plugins assigns no portable discovery, validation, loading, or failure semantics to client extension data or files."
  - Non-object `extensions` → "report and ignore". PR #82 would make this fatal in 1.1.
- **Conformance (§11.1).** A conformant client must at minimum:
  - load from a directory
  - select a schema from `$schema`
  - ignore unimplemented extensions
  - discover from fixed locations
  - provide `PLUGIN_ROOT`/`PLUGIN_DATA` if it launches subprocesses
  - "Supports at least one component type".
  - Appendix A is a non-normative checklist.
  - There is no conformance test suite. FUTURE_CONSIDERATIONS lists "Conformance test suites", "A standard plugin linter", and "Permission declarations" as future items.
- **Governance.** `MAINTAINERS.md` @ `ff8ab5e` lists the TSC: "Clare Liguori (Amazon), Roshan Sadanani (Cursor), Harald Kirschner (Microsoft), Gav Verma (OpenAI), Jonathan Hefner (Vercel)". The Lead Core Maintainer is Jonathan Hefner. The charter says "No single vendor may control a majority of Core Maintainer seats." Anthropic is not on the TSC.
- **Host support.**
  - **Codex: confirmed** (https://developers.openai.com/plugins/build/plugins, fetched). "add `plugin.json` at the plugin root". "Existing `.codex-plugin/plugin.json` files remain supported as a compatibility fallback". OpenAI settings go "under `extensions.com.openai` in root `plugin.json`". Hooks and apps are OpenAI extensions.
  - **ChatGPT, Cursor, GitHub Copilot, Kiro, VS Code:** claimed only in Vercel's launch post (https://vercel.com/blog/introducing-agent-plugins, 2026-08-06): "At launch, Agent Plugins are supported across:" followed by that list. This is a TSC-member vendor post, not host docs, so host-doc confirmation is UNVERIFIED.
  - **Claude Code: not supported.** Its manifest is `.claude-plugin/plugin.json`: "Save the manifest at `.claude-plugin/plugin.json` under the plugin root" (https://code.claude.com/docs/en/plugins-reference). Its plugins docs have no reference to Agent Plugins.
- **1.1.0 so far.** No normative change versus 1.0.0 (see §0). The candidates are all open PRs: hooks (#89), namespaced skills (#67), strict `extensions` (#82), per-MCP-server extension data (#85), display name/icon (#66).

## 3. AGENTS.md

Source: `agentsmd/agents.md` @ `d001185d792eb6402a58e4cbef1c228b309ec25d` (= https://agents.md).

- **What it standardizes:** a file name and location convention only. "a simple, open format for guiding coding agents … a README for agents" (README).
- **No schema:** "No. AGENTS.md is just standard Markdown. Use any headings you like" (`components/FAQSection.tsx`).
- **Precedence:** "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything." Also: "Agents automatically read the nearest file in the directory tree, so the closest one takes precedence" (`HowToUseSection.tsx`).
- **Size:** the standard gives no guidance. Limits are host-specific. Example from Codex: "the limit defined by `project_doc_max_bytes` (32 KiB by default)". Codex concatenates root→cwd, and "Files closer to your current directory override earlier guidance" (https://learn.chatgpt.com/docs/agent-configuration/agents-md, fetched).
- **Not standardized:** skills, subagents, invocation, tools, permissions, and file imports.
- **Governance:** "stewarded by the Agentic AI Foundation under the Linux Foundation" (`AboutSection.tsx`). `Technical_Charter.pdf` was added at HEAD.
- **Claude Code** reads `AGENTS.md` only when there is no `CLAUDE.md` in the working directory or above it. With both present it reads "Your `CLAUDE.md` files only" (https://code.claude.com/docs/en/memory, v2.1.277+).

## 4. Is there a neutral standard for…

### (a) Subagent / agent definitions: no adopted coding-agent standard

- **Agent Plugins:** agents are explicitly out of scope (§2 above).
- **Each host has its own format:**
  - Claude Code: "Subagents are Markdown files with YAML frontmatter" in `.claude/agents/` (https://code.claude.com/docs/en/sub-agents).
  - Codex: "standalone TOML files under `~/.codex/agents/` … or `.codex/agents/`". Required fields are `name`, `description`, `developer_instructions`. No open standard is referenced (https://learn.chatgpt.com/docs/agent-configuration/subagents, fetched).
  - VS Code/Copilot: `.github/agents/*.agent.md` and `~/.copilot/agents`. It also reads ".md files in the Claude agent format" from `.claude/agents` (https://code.visualstudio.com/docs/copilot/customization/custom-agents, fetched).
  - So `agents/*.md` is a de-facto Claude-format convention partly read by Copilot. It is not a spec.
- **Open Agent Specification (Oracle, `oracle/agent-spec`, latest release `agent-spec-26.3.1`, 2026-09-11):** a framework-agnostic declarative YAML/JSON language for Agents and Flows (https://oracle.github.io/agent-spec/). It targets agent frameworks (WayFlow, adapters), not coding-agent hosts. Neither Claude Code nor Codex documents adoption.
- **A2A (`a2aproject/A2A` v1.0.1, 2026-05-28):** the AgentCard is "A JSON metadata document published by an A2A Server" (https://a2a-protocol.org/latest/specification/, fetched). It describes networked remote agents, not local subagent prompts. Not applicable.

### (b) Skill/plugin evaluation formats: guide-level only

- Agent Skills has a non-normative guide (`docs/skill-creation/evaluating-skills.mdx` @ `69ef37e`): "Store test cases in `evals/evals.json` inside your skill directory". It defines `{skill_name, evals:[{id, prompt, expected_output, files, assertions}]}`, with generated `grading.json`, `timing.json` and `benchmark.json`.
  - Trigger evals use `eval_queries.json` with `{query, should_trigger}` (`optimizing-descriptions.mdx`).
  - It is not part of the specification, and the open PR #506 would rename `assertions`.
- Agent Plugins: none ("No test harness or validation tool is specified", FUTURE_CONSIDERATIONS).
- Claude Code `claude plugin eval` uses its own `evals/<case>/` directories. Its docs say skill-creator's `evals/evals.json` exists and "neither tool reads the other's case files" (https://code.claude.com/docs/en/plugin-evals).
- Codex documents no eval format (UNVERIFIED; none found).

### (c) Invocation policy (explicit vs implicit): no standard field

- Agent Skills only says user-explicit activation should exist; the syntax "is up to you". Each host has its own control:
  - Claude Code: `disable-model-invocation: true` ("prevent Claude from automatically loading this skill").
  - Cursor: `disable-model-invocation` (fetched).
  - Pi: `disable-model-invocation: true` "available only through its explicit command" (`pi-mono` @ `4b535d57`, `packages/coding-agent/docs/skills.md`).
  - VS Code agents: `disable-model-invocation` / `user-invocable` (fetched).
  - Codex: `agents/openai.yaml` with `policy: allow_implicit_invocation: false` (https://learn.chatgpt.com/docs/build-skills, fetched).
- So `disable-model-invocation` is a cross-host de-facto key in SKILL.md frontmatter (Claude Code, Cursor, Pi, VS Code agents), but it is not in the spec. Codex uses a sidecar file instead.

## 5. MCP

- **The MCP Skills extension, SEP-2640 (Status: Final; extension id `io.modelcontextprotocol/skills`), is relevant** (https://modelcontextprotocol.io/seps/2640-skills-extension).
  - It serves skills as MCP resources (`skill://<path>/SKILL.md`) with `skills/list` and `skills/get`.
  - "The skill format itself … is delegated entirely to the Agent Skills specification; this SEP defines only the transport binding."
  - Frontmatter passes through "verbatim … not a curated subset".
  - It reserves `io.modelcontextprotocol/` keys in `metadata`: "Implementations SHOULD ignore keys under this prefix that they do not recognize."
  - It is a remote distribution channel for the same SKILL.md. It defines nothing about invocation or subagents.
- **MCP prompts and resources by themselves** are generic primitives. The SEP does not use prompts. Shipping skills as prompts would be our own convention, so prompts are not recommended for skills.

## 6. Hosts that natively read Agent Skills `SKILL.md`

| Host | Paths | Source |
|---|---|---|
| Claude Code | `~/.claude/skills/`, `.claude/skills/`, nested `<subdir>/.claude/skills/`, `--add-dir`, managed, plugin `<plugin>/skills/`. **Not `.agents/skills/`** (not listed). | https://code.claude.com/docs/en/skills ("Claude Code skills follow the Agent Skills open standard … extends the standard") |
| Codex | `.agents/skills` "in every directory from your current working directory up to the repository root", `$HOME/.agents/skills`, `/etc/codex/skills`, system | https://learn.chatgpt.com/docs/build-skills (fetched) |
| GitHub Copilot | project `.github/skills`, `.claude/skills`, `.agents/skills`; personal `~/.copilot/skills`, `~/.agents/skills`; "Supported locations depend on the surface" | https://docs.github.com/en/copilot/concepts/agents/about-agent-skills (fetched) |
| Cursor | `.agents/skills/`, `.cursor/skills/`, `~/.agents/skills/`, `~/.cursor/skills/`; compatibility: `.claude/skills/`, `.codex/skills/` (and `~` variants) | https://cursor.com/docs/context/skills (fetched) |
| Gemini CLI | `~/.gemini/skills/` or `~/.agents/skills/`; `.gemini/skills/` or `.agents/skills/`; `.agents` wins within a tier; workspace > user > extension > built-in | https://geminicli.com/docs/cli/skills/ (fetched) |
| Pi | user/project skills dirs (recursive), plus "`~/.agents/skills/` and `.agents/skills/`" (ancestors up to repo root) | `badlogic/pi-mono` @ `4b535d57`, `packages/coding-agent/docs/skills.md` |
| Others (showcase) | VS Code, Junie, OpenCode, OpenHands, Amp, Goose, Kiro, Factory, Roo Code, Letta, Mistral Vibe, Tabnine, … | `docs/snippets/clients.jsx` @ `69ef37e` (paths not verified) |

- **Anthropic upload paths are strict about unknown fields.** claude.ai uploads, the Skills API and `package_skill.py` accept only `name, description, license, compatibility, metadata, allowed-tools`. "If you include any field the spec doesn't allow, packaging or upload fails with a hard error" (https://code.claude.com/docs/en/skills).
- In Claude Code, `metadata` is "Free-form YAML map … Claude Code doesn't act on its contents".

## Implications for a neutral core (inference)

1. **Skill package: use the standard.** Express the review capability as an Agent Skills directory (`SKILL.md` with `name`/`description`, `references/*.md` knowledge, `scripts/*.sh`), keeping the six spec fields only. That passes skills-ref and the Anthropic upload paths, and it is safe under Agent Plugins §7.1.
2. **Explicit-only invocation has no standard.** Keep it out of the neutral SKILL.md and have each host adapter emit its own form: `disable-model-invocation: true` for Claude Code and `agents/openai.yaml` `policy.allow_implicit_invocation: false` for Codex. If you want the intent recorded neutrally, put it in a namespaced `metadata` key (e.g. `dev.hobin/invocation: explicit`), since `metadata` is string→string and clients must not act on it.
3. **Namespace our metadata keys reverse-domain style.** This follows Agent Plugins §8, the MCP prefix reservation, and PR #546. Expect no host to act on them; they are for our own adapters and tests.
4. **Reviewer-per-perspective delegation needs our own convention.** No portable agent-definition format exists. Define a neutral "perspective" record in our core (e.g. Markdown files under `references/perspectives/` plus a small schema) and generate `.claude/agents/*.md` and `.codex/agents/*.toml` per host. The standard only blesses "subagent delegation" as optional client behavior.
5. **Packaging: Agent Plugins 1.0.0 is the neutral wrapper for Codex/Cursor/Copilot, not Claude Code.** Claude Code still needs `.claude-plugin/plugin.json`. Target 1.0.0 (1.1.0 is a draft identical in substance) and put host specifics only under `extensions.<reverse-domain>` and namespace directories. Do not rely on 1.1 hooks or namespaced skills until merged and published.
6. **Discovery path: no single location covers all hosts.** `.agents/skills/` covers Codex, Copilot, Cursor, Gemini CLI and Pi, but not Claude Code (`.claude/skills/`). Plan a per-host install/symlink step.
7. **Contract tests are ours to define.** Agent Skills' `evals/evals.json` is a non-normative guide, and Claude Code's `claude plugin eval` format is incompatible with it. Keep deterministic contract tests (script I/O, frontmatter validation, generated-adapter golden files) in our own neutral format. Optionally also validate with skills-ref, noting it is a demo tool.
8. **Neutral scripts.** The spec only says scripts should be "self-contained or clearly document dependencies". Declare shell/tool needs in `compatibility` (≤500 chars). Treat `allowed-tools` as experimental and host-specific in syntax, so per-host adapters should own it.
9. **AGENTS.md is for repo-wide guidance only, not capability definition.** Claude Code skips it when CLAUDE.md exists, so don't put review-procedure semantics there.
10. **Watch for change:** Agent Plugins PRs #89, #67 and #82 and issue #6 (invocation naming), and Agent Skills PRs #546 and #506. Re-check the pins when 1.1.0 is published.
