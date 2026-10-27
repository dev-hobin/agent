# Install the native plugins

Agent Skills defines the methods; Agent Plugins defines the portable packages.
Installation, catalogs, enablement and invocation remain host-specific. Use the
existing native managers below, not a custom installer or a chosen work project.

## Source and release status

This checkout prepares **0.2.2**, not yet published. It contains two independent
plugin roots, `packages/developer/` and `packages/learning/`. The private workspace
root is a marketplace source, not a third plugin containing all 26 Skills.

Published npm 0.2.1 has Claude compatibility metadata but not the new portable
root manifests or repository catalogs. Do not assume a published package already
contains the prepared changes. For the verified route, use an absolute path to a
checkout **containing this revision**; retain that source directory for local
marketplace updates. Native managers handle their own install/cache locations.

## Claude Code: once for your user, across projects

Run from any directory; the path identifies the resource source, not a work
project to install into:

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-developer@hobin-agent --scope user
claude plugin install hobin-learning@hobin-agent --scope user
claude plugin list --json
```

`user` is Claude's default install scope and applies to your projects on this
machine. `project` writes shared repository settings; `local` applies only to you
in that repository. The portable format does not prescribe these scopes. A
repository or managed setting can override enablement.

Start a new Claude session, or use `/reload-plugins` in an existing one. Invoke:

```text
/hobin-developer:sketch Shape an implementable design for this change.
/hobin-developer:model Model the unresolved cases behind this bug.
/hobin-learning:technical-reading Read this specification faithfully.
```

Claude reads `.claude-plugin/marketplace.json` and the packages' identity-only
`.claude-plugin/plugin.json` compatibility descriptors. They remain synchronized
with portable `plugin.json`; no Skills are renamed or copied per host.

## Codex: native user installation

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-developer@hobin-agent
codex plugin add hobin-learning@hobin-agent
codex plugin list --json
```

These commands register and enable the plugins in user configuration. On the
tested Codex version they remain enabled across work directories and expose
user-scoped, qualified Skill names. No `--scope user` flag is needed or assumed
for this CLI. Project/managed enablement is still a Codex concern.

Start a new session and select the qualified Skill, for example:

```text
$hobin-developer:sketch Shape an implementable design for this change.
$hobin-developer:model Model the unresolved cases behind this bug.
$hobin-learning:technical-reading Read this specification faithfully.
```

The observed catalog names are `hobin-developer:sketch`,
`hobin-developer:model`, and `hobin-learning:technical-reading`; `$` is Codex's
Skill-mention syntax, not part of Agent Skills or Agent Plugins.

Codex reads `.agents/plugins/marketplace.json` with explicit host install/auth
policies. The portable package needs no `.codex-plugin/plugin.json` or OpenAI
extension object for these instruction-only Skills. The catalog's `ON_INSTALL`
policy does not add an authentication requirement to our Skills; they bundle no
MCP connection or credential flow.

## Remote source after publication

After a Git revision containing these catalogs has been published, each native
manager also supports registering the GitHub source `dev-hobin/agent` in place of
the absolute local path. Review/pin the source using the host's supported Git
source syntax before installing. The subsequent plugin IDs remain
`hobin-developer@hobin-agent` and `hobin-learning@hobin-agent`.

The local packed-artifact probe below does **not** test GitHub cloning, remote
updates, marketplace publication, npm registry installation, or credentials.
Do not present those routes as exercised merely because local installation passes.

## Development-only loading and individual Skills

Claude's `--plugin-dir` loads a plugin for **one session**, without persistent
installation. It is useful for editing, not the normal global-install guide:

```sh
claude --plugin-dir /absolute/path/to/agent/packages/developer \
       --plugin-dir /absolute/path/to/agent/packages/learning
```

You can still install complete individual Skill directories with any compatible
host/installer. Vercel Labs' `skills` CLI is an optional flat-Skill route, not a
native plugin manager. It does not apply the package namespace and can overwrite
same-named entries. Keep supporting files with `SKILL.md` and review overwrite
warnings. This alternative does not require adopting a new loader or runtime.

Existing flat installations are **not** automatically removed. Inspect and
remove/disable only copies you own; do not blindly delete shared
`~/.agents/skills/` resources another client uses. The repository and its checks
never migrate a real user's configuration automatically.

## Reproduce the model-free compatibility check

From the authoring checkout, with Node/pnpm, `npm`, `tar`, and the relevant native
CLI available:

```sh
pnpm check:claude
pnpm check:install -- claude
pnpm check:install -- codex
```

`check:install` is an opt-in **test harness**, not a consumer installer. It:

1. Creates temporary HOME, host config, cache, npm/git config and work directories;
   environment allowlisting avoids inheriting API credentials and config overrides.
2. Builds real npm packs with lifecycle scripts disabled and installs their
   extracted contents through the selected native marketplace manager.
3. Installs another harmless plugin with the same `model` Skill name.
4. Starts fresh CLI processes from two unrelated work directories and checks
   enablement, versions and native component inventories.
5. Checks all installed Skill/supporting-file bytes against the canonical source.
   Codex metadata requests additionally assert qualified names and `pluginId`.
6. Removes temporary files and stops its Codex metadata process. It sends no model
   prompt or evaluation request and never uses the user's real host settings.

### Evidence recorded on 2026-10-27

| Consumer | Exercised source / observer | Scope of evidence |
| --- | --- | --- |
| Claude Code 2.1.311 | Actual 0.2.2 packs; native marketplace/install/list/details | User scope persists across two cwd values; 17 + 5 Skills and a peer `model` have separate plugin inventories/caches |
| Codex CLI 0.164.0 | Same packs; native install/list plus `initialize` and `skills/list` metadata calls | Both cwd values expose user-scoped qualified names; `hobin-developer:model` and `hobin-probe-peer:model` coexist with different plugin IDs; a root-manifest-only peer works |

These are installation, discovery and artifact-preservation observations—not
live Skill invocation, model adherence, minimal-reference selection, security
certification, or a promise that future client versions behave identically.
Missing/broken native executables fail an explicitly requested probe; portable
CI does not depend on either executable.

References: [Agent Plugins scope](https://agent-plugins.org/specification),
[Claude install scopes](https://code.claude.com/docs/en/discover-plugins),
[Claude marketplace format](https://code.claude.com/docs/en/plugins/marketplace-reference),
[OpenAI packaging and catalogs](https://developers.openai.com/plugins/build/plugins).
