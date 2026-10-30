# Claude Code host contract for a review plugin (primary sources)

Fetched 2026-10-30 (~08:20 UTC) as raw Markdown from code.claude.com/docs/en/*.md, platform.claude.com and anthropic.com. The official repo was read via the GitHub API (`main`, last pushed 2026-10-30T07:32Z). Local CLI: `claude --version` = **2.1.314**. Note: the plugin docs moved under `/docs/en/plugins/…`. `plugins-reference` now serves the same content as `plugins/manifest-reference`, and `slash-commands` serves the same content as `skills`.

## 1. Plugin layout, plugin.json, validate

- The manifest is optional. Only `name` is required. "Save the manifest at `.claude-plugin/plugin.json` … Put every other plugin file at the plugin root, not inside `.claude-plugin/`." (plugins/manifest-reference)
- Fields:
  - Metadata: `$schema, name, displayName, version, description, author, homepage, repository, license, keywords, metadata`.
  - Directory listing only: `icon`, `*Url`.
  - Behaviour: `defaultEnabled, dependencies, settings, userConfig, types, channels`.
  - Components: `skills, commands, agents, hooks, mcpServers, lspServers, outputStyles, workflows, experimental{themes,monitors,evals}`.
- Default paths: `skills/<name>/SKILL.md`, `commands/` ("Prefer `skills/` for new plugins"), `agents/` (subfolders become part of the name), `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `output-styles/`, `workflows/`, `themes/`, `monitors/monitors.json`, `bin/` (on the Bash tool's PATH, after the user's own PATH), `settings.json` (only `agent` and `subagentStatusLine` take effect).
- How manifest keys combine with defaults: "**Replaces the default**: `commands`, `agents`, `outputStyles`, `workflows`…; **Adds to the default**: `skills`; **Merges**: `hooks`, `mcpServers`, `lspServers`". Paths must start with `./`, must exist, and must stay inside the plugin root (`..` is an error).
- Variables: `${CLAUDE_PLUGIN_ROOT}` (the installed version's directory, which changes on update, so don't write state there), `${CLAUDE_PLUGIN_DATA}` (persists across updates), `${CLAUDE_PROJECT_DIR}`. Critical: "The variables aren't present in the environment of commands Claude runs through the Bash tool… In skill, command, and agent content, write the `${...}` reference in the Markdown body instead, and Claude Code substitutes the path inline."
- Namespacing: "an agent `reviewer` in plugin `deploy-tools` appears as `deploy-tools:reviewer`".
- Reserved plugin names: the name is an error if it starts with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`. Using `claude` or `anthropic` as a whole word elsewhere is a warning.
- Versioning: `version` is "not checked against semver. Setting it pins the plugin to that version until you change it". If `version` is unset, a git source falls back to the commit SHA. `claude plugin tag` creates a `{name}--v{version}` tag (`claude plugin --help`).
- `validate`: "Validation passed with warnings … such as an unknown top-level field…, a `name` that isn't kebab-case, or a missing `version`, `description`, or `author`. Pass `--strict` to turn warnings into failures in CI." Failures include type mismatches, missing or escaping paths, and unknown keys in strict objects. It also validates the frontmatter of skills, agents and commands. It does not follow symlinks: "A linked entry inside a `skills`, `agents`, or `commands` directory: Claude Code skips it and warns". `--profile directory` additionally applies the directory's submission checks, such as requiring a README. Exit codes: 0 = pass, 1 = fail, 2 = validator error. Sources: plugins/manifest-reference, plugins/cli-reference#plugin-validate, local `--help`.
- Plugin-root `CLAUDE.md` is not loaded ("`CLAUDE.md at the plugin root is not loaded as project context`"). "To include instructions in a plugin, write them as a skill." (plugins/components)

## 2. Skills

The frontmatter fields, all optional, are listed at https://code.claude.com/docs/en/skills#frontmatter-reference:
- `name`: the command name. It defaults to the directory name.
- `description`: recommended. "the combined `description` and `when_to_use` text is truncated at 1,536 characters in the skill listing".
- `when_to_use`: appended to the description in the listing.
- `argument-hint`.
- `arguments`: named positional arguments, used as `$name`.
- `disable-model-invocation`: "prevent Claude from automatically loading this skill… Also prevents the skill from being preloaded into subagents".
- `user-invocable: false`: hides the skill from `/`, so only Claude can invoke it.
- `allowed-tools`: "Tools Claude can use without asking permission during the turn that invokes this skill… does not restrict which tools are available".
- `disallowed-tools`.
- `model` and `effort`: apply for the rest of the turn, or to the forked subagent when `context: fork` is set.
- `context: fork` with `agent` (default `general-purpose`): runs the skill in a forked subagent.
- `background`: fork only, default `true`.
- `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`.
- Unknown fields are silently ignored.

Invocation table:

| Frontmatter | You invoke | Claude invokes | Description in context |
|---|---|---|---|
| default | yes | yes | always |
| `disable-model-invocation: true` | yes | not on its own | not in context |
| `user-invocable: false` | no | yes | always |

- If Claude tries to invoke a `disable-model-invocation` skill, "Claude Code blocks the call and instructs it not to reproduce the deploy steps another way."
- Substitutions: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, and in plugin skills only `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`. These are also substituted inside `allowed-tools` Bash rules: "Using the same variable in both places lets a skill run a bundled script without a permission prompt" (example: `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`).
- Dynamic context: `` !`cmd` `` runs before Claude sees the skill. "A failed command aborts the entire skill invocation." Constraints:
  - Any non-zero exit fails, except exit 1 from search and compare commands.
  - Commands time out after 2 minutes and run in the session's working directory, with stderr merged into the output.
  - Outside auto mode, a command that is not explicitly allowed aborts the invocation, so "pre-approve it with `allowed-tools`".
- `context: fork` "doesn't run in a fork of the current conversation". The subagent "doesn't see your conversation history". A forked skill runs in the background by default, with the narrower background tool set. "`context: fork` only makes sense for skills with explicit instructions."
- Lifecycle: the rendered skill "stays in context across turns". After compaction it is re-attached with the first 5,000 tokens kept, so "put the most important instructions near the top".
- Listing budget: "scales at 1% of the model's context window". When over budget, descriptions are dropped least-used first. The per-entry cap of 1,536 characters is configurable via `skillListingMaxDescChars`.
- Plugin invocation: "`/<plugin>:<directory>`… If you set `name` in the frontmatter, it replaces the last segment and the plugin prefix stays." The bare `/fancy` also works when no other command uses that name.
- Supporting files: "Reference supporting files from `SKILL.md` so Claude knows what each file contains and when to load it". "Keep `SKILL.md` under 500 lines."
- Commands vs skills: "**Custom commands have been merged into skills.**" (skills page). For plugins: "Commands are the older format, and skills supersede them for new work… Command files take the same frontmatter as skills." (plugins/components)

## 3. Subagents

- Plugin agent fields: "**Supported fields**: `name`, `description`, `model`, `effort`, `maxTurns`, `autoCompactWindow`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation`, `color`, and the `cacheTtl` key of `experimental`… **Ignored fields**: `permissionMode`, `hooks`, `mcpServers`, and `initialPrompt`." (plugins/components#frontmatter-fields-in-plugin-agents) Frontmatter that does not parse still loads the agent, with every field ignored.
- Names: `<plugin>:<name>`, or `<plugin>:<subdir>:<name>` for agents in subfolders. Users mention one with `@agent-my-plugin:code-reviewer`. "Names can't contain `:`". Plugin agents have the lowest priority (5), so a project or user agent with the same name wins.
- Dispatch is through the **Agent** tool: "In version 2.1.63, the Task tool was renamed to Agent. Existing `Task(...)` references… still work as aliases." The eval docs give the parameter form: dispatch "by its namespaced name, such as `my-plugin:code-reviewer`". A skill can pre-approve dispatch, as first-party `claude-security` does with `allowed-tools: Agent(claude-security:scan-researcher, …)`.
- Parallel dispatch: "For independent investigations, spawn multiple subagents to work simultaneously… This works best when the research paths don't depend on each other." Results return to the main context: "Running many subagents that each return detailed results can consume significant context".
  - Concurrency is capped at 20 running subagents.
  - Nesting depth defaults to 3 layers.
  - Subagents spawned from the main conversation start in the background by default.
  - A background subagent keeps a reduced built-in tool set (Read, Grep, Glob, Bash, Edit, Write, Skill and some others). No subagent ever gets `AskUserQuestion`.
- Startup context: "fresh, isolated context window… doesn't see your conversation history, the skills you've already invoked, or the files Claude has already read". A subagent receives CLAUDE.md and AGENTS.md (unless `omitClaudeMd: true`) and a git status snapshot.
- Giving a subagent knowledge:
  - `skills:` preloads full skill content: "The full content of each listed skill is injected… You can't preload skills that set `disable-model-invocation: true`".
  - Otherwise, name the file in the delegation prompt and let the agent `Read` it. `${CLAUDE_PLUGIN_ROOT}` is substituted in the agent body.
- When to use which (sub-agents#choose-between-subagents-and-main-conversation): use subagents when "The task produces verbose output… You want to enforce specific tool restrictions… The work is self-contained and can return a summary." features-overview adds: "Skills are reusable content you can load into any context; Subagents are isolated workers… Best for… parallel work, specialized workers."
- Workflows are an alternative for fan-out. Plugin `workflows/*.js` files are namespaced `/plugin:name` and orchestrate agents from a script (`agentType:"claude-security:scan-verifier"` in first-party code). They are not universally available: "available on all paid plans… On Pro, turn them on", and can be turned off with `disableWorkflows` (workflows.md).

## 4. Hooks (collision notes only)

- `hooks/hooks.json` has a top-level `"hooks"` wrapper and an optional `description`. "When a plugin is enabled, its hooks merge with your user and project hooks." "When an event fires, its matching hooks run in parallel."
- There are 33 events. Those a review plugin could collide on are SessionStart, UserPromptSubmit/Expansion, Pre/PostToolUse, SubagentStart/Stop and Stop.
- Two enabled plugins with the same manifest name: only one registers its hooks ("`Its hooks.json hooks do not run`"). (hooks.md, plugins/loading#name-conflicts)

## 5. Marketplace

- File location: `<root>/.claude-plugin/marketplace.json`. Required keys: `name`, `owner{name}`, `plugins[]`. Optional keys: `description`, `version`, `metadata.pluginRoot`, `forceRemoveDeletedPlugins`, `allowCrossMarketplaceDependenciesOn`, `renames`.
- Entry fields: `name` and `source` are required. Optional: `description, version, category, tags, strict, relevance, dependencies, defaultEnabled, displayName, metadata, headers, headersHelper`, plus any plugin.json field. "When `plugin.json` also sets `version`, `plugin.json` takes precedence and `claude plugin validate` warns." Unknown keys are ignored, and validate reports them as warnings.
- Plugin sources: relative path, `github`, `url`, `git-subdir`, `npm`, `archive`, `command`.
- Install ID: `plugin@marketplace`.
- Reserved marketplace names include the official ones (such as `claude-plugins-official`), `inline`, `skills-dir`, `builtin`, `npm`, `github`, `claudeai-*`, and other spellings of these.
- Local paths, quoted: "**Relative-path plugins in a marketplace you added from a local path**: the plugin loads in place… edits… take effect at the next session start or `/reload-plugins`, and you don't need to increase the version."
- Other marketplace plugins are copied: "Claude Code copies the plugin into `cache/<marketplace>/<plugin>/<version>/`… Files outside the plugin directory aren't copied, so when a script… reads a path above the plugin root, such as `../shared`, it doesn't find them."
- Updates: auto-update is on by default only for Anthropic's official marketplaces and off for others. It runs after a random delay of up to 10 minutes, and changes apply on `/reload-plugins` or the next launch. "a manifest that pins `"version": "1.0.0"` keeps every user on the cached copy until its author changes the string". (plugins/marketplace-reference, plugins/loading)
- UNVERIFIED: when in-place loading of local-path marketplaces replaced copying. No dated changelog entry was found.

## 6. Evals

- Layout: `evals/<case>/prompt.md` and/or `case.yaml` (`schema_version: "1.1"`), plus `graders/*.md`.
  - Key fields: `runs` (default 3), `max_turns` (default 10), `timeout_seconds` (default 300), `allowed_tools` (read-only unless granted), `env` (`EVAL_*` only), `disallowed_tools`.
  - Case-level context: `context.scaffold_script` (runs only with `--scaffold`), `history_file`, `add_dirs`.
- Grader types: `regex` (targets `last_message`, `trace`, `files`, `{source: file, path}`, `mock_calls`), `tool_used` (`input_match`, `min`, `max`), `tool_order`, `file_exists`, `llm` (passes on 2 of 3 haiku votes), `baseline`. Every grader also takes `weight` and `arm`.
- Baseline: by default each case also runs with no plugin loaded, and the report shows the score difference Δ. `tool_used: Skill` graders are excluded from the score in both arms. Expected noise: "`Agent type '<plugin>:<agent-name>' not found`" in the baseline arm. Use `--ablation none` to skip the baseline arm.
- Isolation: each run is a `claude -p` child with a temporary HOME, working directory and config. "Nothing personal or project-level loads"; the eval directory is hidden from the agent. Granting Bash puts every command under the OS sandbox ("Writes are confined to the run's workspace, your home directory… unreadable"). On a machine with no sandbox backend, runs are refused.
- macOS `/usr/bin/git` xcrun shim failing inside the sandbox: **UNVERIFIED / undocumented**. No docs or changelog mention it. The closest entry is 2.1.293, "Fixed `claude plugin eval` refusing every Bash-granting run on Macs with Docker Desktop". Requirements: git ≥ 2.31 if git is installed, and Claude Code ≥ 2.1.269.
- CI: `claude plugin eval . --trust-plugin --json results.json --threshold 0.8 --model … --judge-model … --no-publish --max-cost-usd 20`. Exit codes: 0 = pass, 1 = below threshold or error, 2 = partial run. "The with-minus-without delta is reported but never changes the exit code." (plugin-evals)
- Headless: "User-invoked skills and custom commands work. Include `/skill-name` in the prompt string" (headless.md). An eval prompt can therefore be `/<plugin>:review …`. That a `disable-model-invocation` skill can be started this way inside eval runs is my inference; it was not tested here.

## 7. Authoring best practices

- Descriptions: "**Always write in third person**"; "Include both what the Skill does and specific triggers/contexts"; maximum 1,024 characters in the Agent Skills spec; Claude Code lists up to 1,536 characters for description plus `when_to_use`. `name` is at most 64 characters, lowercase letters, numbers and hyphens only, with no `anthropic`/`claude`. (platform.claude.com/…/agent-skills/best-practices)
- Size and structure: "Keep the `SKILL.md` body under 500 lines"; "Keep references one level deep from `SKILL.md`"; a table of contents for reference files over 100 lines; forward slashes only; consistent terminology; "At least three evaluations created".
- Scripts: "Make clear in your instructions whether Claude should" execute or read a script. "Scripts solve problems rather than defer to Claude." Use "verifiable intermediate outputs" (plan → validate → execute). The engineering blog says: "many applications require the deterministic reliability that only code can provide"; "It should be clear whether Claude should run scripts directly or read them into context as reference." (anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills, published 2025-10-16, updated 2025-12-18 to note that Agent Skills is now an open standard)
- Portability: outside Claude Code, only `name, description, license, compatibility, metadata, allowed-tools` are allowed (skills#using-skill-frontmatter-outside-claude-code).
- "If a rule must hold every time… add it… as a hook rather than a skill."
- Subagent descriptions get a startup warning when the combined total exceeds 15k tokens; keep them short.

## 8. First-party multi-perspective review (claude-plugins-official @ main)

```
plugins/pr-review-toolkit/                 plugins/code-review/
  .claude-plugin/plugin.json (v1.0.1)        .claude-plugin/plugin.json (v1.0.1)
  agents/code-reviewer.md                    commands/code-review.md
  agents/code-simplifier.md                  README.md LICENSE
  agents/comment-analyzer.md
  agents/pr-test-analyzer.md               plugins/feature-dev/
  agents/silent-failure-hunter.md            agents/{code-architect,code-explorer,code-reviewer}.md
  agents/type-design-analyzer.md             commands/feature-dev.md
  commands/review-pr.md
plugins/claude-security/  (newest pattern)
  skills/claude-security/{SKILL.md,role.md,jobs/*.md,specs/{report-spec,patch-spec}.md}
  agents/{scan-researcher,scan-verifier,scan-inventory,…}.md   scripts/*.py   workflows/scan.js   hooks/
```

- How they dispatch reviewers:
  - `review-pr.md` has `allowed-tools: ["Bash","Glob","Grep","Read","Task"]` and `argument-hint: "[review-aspects]"`, and maps each aspect to one agent, with sequential or parallel modes.
  - `code-review.md` says "Launch 4 agents in parallel to independently review the changes", followed by a validation pass.
  - `feature-dev` says "Launch 3 code-reviewer agents in parallel with different focuses".
- Agent frontmatter excerpts:
  - `pr-review-toolkit/agents/code-reviewer.md`: `name: code-reviewer` / `description: Use this agent when you need to review code…` / `model: opus` / `color: green`.
  - `claude-security/agents/scan-researcher.md`: `description: Restricted read-only vulnerability researcher dispatched by the Claude Security scan workflow; not for direct invocation…` / `model: inherit` / `effort: xhigh` / `tools: Read, Glob, Grep, Bash, Agent(claude-security:explore)`.
- Observation: older first-party plugins still use `commands/` and `Task`. The newest one, claude-security, uses a skill plus agents plus `${CLAUDE_PLUGIN_ROOT}` scripts pre-approved in `allowed-tools`.

## 9. Recent and deprecated changes (changelog.md)

- 2.1.3 (2026-01-09): "Merged slash commands and skills".
- 2.1.63: Task tool renamed to Agent. Date not captured; `Task(...)` still works as an alias.
- 2.1.198 (2026-07-01): "Removed the `/agents` wizard".
- 2.1.212 (2026-07-17): the Task tool's `mode` parameter is deprecated. Subagents now inherit the parent's permission mode.
- 2.1.218 (2026-07-22): "skills with `context: fork` … run in the background by default".
- 2.1.222 (2026-08-04): a refused model invocation of a `disable-model-invocation` skill now tells Claude to ask the user to run it.
- 2.1.269 (2026-09-11): `claude plugin eval` added.
- 2.1.283 (2026-09-25): plugin eval requires git ≥ 2.31.
- 2.1.299 (2026-10-14): `--disallow-tools` and `disallowed_tools` added to eval. Skill or command names containing `<`, `>` or hidden characters are refused.
- 2.1.302 (2026-10-16): fork subagents are on by default in `-p`, the SDK, desktop and VS Code.
- Manifest: on CLIs older than 2.1.281, directory-listing fields produce warnings, so `--strict` fails there.

## Implications for the review slice (my inference, not documented guidance)

1. **Entry point.** Use one skill, `skills/review/SKILL.md`, with `disable-model-invocation: true` so it runs only when the user invokes it explicitly as `/<plugin>:review [args]`. Do not use `commands/`. The side effect is that its description is not in context and it cannot be preloaded into subagents. That fits "explicit only".
2. **Perspectives.** Keep the 5 perspective files as plain Markdown references, not skills. Either:
   - use one generic `agents/reviewer.md` (`tools: Read, Grep, Glob`, no `Agent`, `Bash` only if needed) and have the skill tell it to `Read ${CLAUDE_PLUGIN_ROOT}/…/perspectives/<p>.md`; or
   - use 5 thin agents, each naming its file.

   Preloading through `skills:` would force them to be model-invocable skills that pollute the listing.
3. **Parallel dispatch.** The skill should instruct Claude to issue all 5 `Agent` calls in one message with `subagent_type: <plugin>:reviewer`, and pre-approve with `allowed-tools: Agent(<plugin>:reviewer) …`. Parallelism is model-directed, not guaranteed. Workflows (`workflows/review.js`) would make the fan-out deterministic but are plan-gated and can be disabled, so treat them as an optional later variant.
4. **Context script.** Run the POSIX script through `` !`sh "${CLAUDE_SKILL_DIR}/scripts/collect-context.sh" $ARGUMENTS` `` or through an `allowed-tools: Bash(sh ${CLAUDE_PLUGIN_ROOT}/… *)` rule. With the injection form, any non-zero exit aborts the invocation, so add `|| true` or design exit codes for it. The 2-minute timeout also applies. Do not rely on `CLAUDE_PLUGIN_ROOT` being set inside Bash; it is substituted only in the Markdown.
5. **Host-neutral core packaging.** A build step must copy the core's scripts and knowledge into the plugin directory. Marketplace installs copy only the plugin directory (`../core` is not found), and validate and loading skip symlinked entries.
6. **Findings format.** Put the fixed findings schema in a skill-local `references/findings-format.md`, one level deep, and restate the essentials in each reviewer's delegation prompt, because subagents don't see the conversation. Keep the reviewer agent read-only and have the main skill write the output file.
7. **Contract tests.** Run `claude plugin validate --strict` (plus `--json`) in CI. Shell-test the script directly, outside Claude. Use `claude plugin eval` with:
   - `--ablation none`, or `arm: with-only` on agent-dispatch graders;
   - `tool_used` on `Agent` with `input_match: "<plugin>:reviewer"`, `min: 5`;
   - a `regex` or `file` grader on the fixed format.

   For Bash on macOS, expect the undocumented xcrun or sandbox problem. Generate fixtures with `scaffold_script` (it runs outside the sandbox) or run evals on Linux CI.
8. **Naming and versioning.** Avoid `claude-` prefixes in plugin and skill names. Set `version` and bump it per release; leave it unset only for development via a local-path marketplace, which loads in place.
9. **Codex parity.** Keep frontmatter that is part of the host-neutral contract to the Agent Skills six fields (`name, description, license, compatibility, metadata, allowed-tools`). Keep Claude-only fields (`disable-model-invocation`, `argument-hint`, `context`) in the Claude adapter layer.
