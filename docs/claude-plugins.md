# Claude compatibility and namespaces

For normal persistent installation, follow the
[native installation guide](installation.md). Claude supports user-wide plugins;
its default `user` scope is not tied to a chosen work repository.

## Common identity, host compatibility

Each package's root `plugin.json` declares its Agent Plugins identity.
`.claude-plugin/plugin.json` retains the matching name, version, description and
author solely for Claude's legacy discovery format. The same `skills/` directories
supply every host; there are no per-host Skill copies or reference loaders.

| npm package | Portable / Claude name | Claude invocation |
| --- | --- | --- |
| `@hobin/developer` | `hobin-developer` | `/hobin-developer:model` |
| `@hobin/learning` | `hobin-learning` | `/hobin-learning:technical-reading` |

The `@hobin/<package>` to `hobin-<package>` mapping is our convention, not a
portable name registry. The standard defines package structure, not a universal
command syntax. Native Codex also qualifies plugin Skills; see the separate
Codex commands and observed names in the installation guide.

## Persistent user installation

From any directory, register a checkout containing the current catalogs:

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-developer@hobin-agent --scope user
claude plugin install hobin-learning@hobin-agent --scope user
```

The root `.claude-plugin/marketplace.json` points at the two package roots.
Claude stores user enablement in its own settings and manages its cache. Local
marketplace source folders should remain available; they are not the user's
work project. Start a new session or run `/reload-plugins` to pick up changes.

For editing only, `claude --plugin-dir /absolute/path/to/agent/packages/developer`
loads a package for that session. It is not a persistent install.

## Collision and migration boundary

Plugin-qualified names differ from Claude's bare `/model`, `/doctor`, and bundled
`/verify`. Ordinary flat `skills add` does not create this namespace, and plugin
installation does not remove already installed flat Skills. Remove or disable
only entries you own after inspecting their source. Never blindly delete a
shared `~/.agents/skills/` tree that another client uses.

The package cannot reserve a name globally. Another publisher could deliberately
choose the same plugin ID; host precedence and trust policy remain relevant.

## Checks and limits

`pnpm check:standard` includes the pinned upstream Agent Plugins schema as well
as Agent Skills validation. `pnpm check:portable` additionally checks our identity
mapping, metadata/catalog consistency, source hashes, negative cases and actual
npm packs. It does not require Claude.

Optional native, model-free checks:

```sh
pnpm check:claude
pnpm check:install -- claude
```

The latter installs actual packed artifacts under a temporary HOME, verifies user
scope across work directories, inspects 17 + 5 Skills and a same-named peer Skill,
and checks installed resource bytes. It does not modify real user settings or
run a model. Icons/public directory submission, publisher verification and live
model behavior are separate concerns. See the
[evidence boundaries](installation.md#evidence-recorded-on-2026-10-27).

Version 0.2.1 introduced the Claude compatibility files. Version 0.2.2 adds the
portable manifests to npm artifacts and native catalogs to the Git repository.
Git source publication and npm releases remain separate operations. See
[release notes](releases/0.2.2.md) for registry publication status.
