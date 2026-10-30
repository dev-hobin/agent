# Claude compatibility and namespaces

For normal persistent installation, follow the
[native installation guide](installation.md). Claude supports user-wide plugins;
its default `user` scope is not tied to a chosen work repository.

## Common identity, host compatibility

Each package's root `plugin.json` declares its Agent Plugins identity.
`.claude-plugin/plugin.json` retains the matching name, version, description and
author for Claude Code's host manifest location. The same `skills/` directories
supply every host; there are no per-host Skill copies or reference loaders.

| npm package | Portable / Claude name | Claude invocation |
| --- | --- | --- |
| `@hobin/review` | `hobin-review` | `/hobin-review:reviewing-code` |
| `@hobin/feature` | `hobin-feature` | `/hobin-feature:developing-features` |
| `@hobin/stances` | `hobin-stances` | `/hobin-stances:applying-stances`, `/hobin-stances:enforcing-conventions` |
| `@hobin/skill-eval` | `hobin-skill-eval` | `/hobin-skill-eval:evaluating-skills` |
| `@hobin/learning` | `hobin-learning` | `/hobin-learning:technical-reading` |

The `@hobin/<package>` to `hobin-<package>` mapping is our convention, not a
portable name registry. The standard defines package structure, not a universal
command syntax. Native Codex also qualifies plugin Skills; see the separate
Codex commands and observed names in the installation guide.

## Persistent user installation

From any directory, register a checkout containing the current catalogs:

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-review@hobin --scope user
claude plugin install hobin-feature@hobin --scope user
```

The root `.claude-plugin/marketplace.json` points at the five package roots.
Claude stores user enablement in its own settings and manages its cache. Local
marketplace source folders should remain available; they are not the user's
work project. Start a new session or run `/reload-plugins` to pick up changes.

For editing only, `claude --plugin-dir /absolute/path/to/agent/packages/review`
loads a package for that session. It is not a persistent install.

## Collision and migration boundary

Plugin-qualified names cannot collide with Claude's built-in commands or with
another publisher's Skill of the same name. Entry-point descriptions say "Use only
when explicitly asked", so Claude does not select them on its own; Claude has no
portable field for this, and the repository does not use host-only frontmatter. Ordinary flat `skills add` does not create this namespace, and plugin
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
scope across work directories, inspects all ten Skills and a same-named peer Skill,
and checks installed resource bytes. It does not modify real user settings or
run a model. Icons/public directory submission, publisher verification and live
model behavior are separate concerns. See the
[evidence boundaries](installation.md#evidence-recorded-on-2026-10-27).

Version 0.3.0 replaces `hobin-developer` with four focused plugins and renames the
marketplace to `hobin`. Git source publication and npm releases remain separate
operations. See the [0.3.0 release notes](releases/0.3.0.md).
