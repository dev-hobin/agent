# Package-owned Claude namespaces

Claude plugin identity is optional host metadata, not part of Agent Skills.
Canonical `skills/<name>/SKILL.md` names and reference paths stay unchanged.

## Stable identities

| npm package | Claude plugin name | Example invocation in plugin mode |
| --- | --- | --- |
| `@hobin/developer` | `hobin-developer` | `/hobin-developer:model` |
| `@hobin/learning` | `hobin-learning` | `/hobin-learning:technical-reading` |

Each package owns `.claude-plugin/plugin.json` at its root. Our convention maps
`@hobin/<package>` to `hobin-<package>`; the manifest's version, description, and
author match `package.json`. The default `skills/` layout is used directly, with
no Skill copies, renamed frontmatter, hooks, MCP server, or custom loader.

Claude permits a plugin without a manifest, but then its identity can depend on
the directory or marketplace entry. Shipping an explicit name keeps our identity
stable when an npm archive is extracted to a directory such as `package/`.

These metadata files are included in npm packages starting with the prepared
`0.2.1` release. Published `0.2.0` packages do not contain them.

## Load the package as a Claude plugin

From the project where you want to work, point Claude at the **package roots**:

```sh
claude --plugin-dir /path/to/agent/packages/developer \
       --plugin-dir /path/to/agent/packages/learning
```

For npm-installed packages, use the corresponding
`node_modules/@hobin/developer` and `node_modules/@hobin/learning` roots instead.
The same layout also works with Claude's supported whole-plugin installation
mechanisms; this repository does not install a marketplace or change user settings.

Use qualified commands such as:

```text
/hobin-developer:model Model the unresolved cases behind this bug.
/hobin-developer:doctor Diagnose this module.
/hobin-developer:verify Check what this evidence supports.
/hobin-learning:technical-reading Read this specification faithfully.
```

Plugin mode gives these commands different names from Claude's `/model`,
`/doctor`, and bundled `/verify`. It does not remove already installed flat
Skills that may still shadow those commands. If migrating a flat installation,
inspect the Claude entries and remove or disable only the copies you own. Do not
blindly delete shared `~/.agents/skills/` resources that Codex may still use.

## Ordinary Skill installation is a different route

A common installer such as Vercel Labs' `skills` CLI manages discovery, copying,
links, and updates. It does not turn ordinary Skill installations into native
Claude plugins or promise to apply this namespace.

For example, install the standard bundles for Codex with:

```sh
npx skills@1.7.4 add dev-hobin/agent/packages/developer -g -a codex
npx skills@1.7.4 add dev-hobin/agent/packages/learning -g -a codex
```

This optional installer needs Node.js 22.20+. That is a tool requirement, not a
runtime requirement of the Skills. Review same-named existing Skills before
installing. Codex's `$model` remains an ordinary Skill mention; this manifest
does not introduce a cross-host namespace syntax.

Do not install these packages as flat Claude Skills and assume that adding the
plugin metadata elsewhere has qualified their names. Choose native Claude
plugin loading when avoiding bare-command collisions is required.

## Guarantee and checks

`pnpm check:portable` checks the package-to-plugin identity mapping, disjoint
names across our packages, matching metadata, and inclusion in actual npm packs.
Negative cases cover unscoped or duplicate IDs, stale versions, missing npm
exports, and accidental executable manifest fields. Packed Skills still work
without host metadata when copied on their own.

With Claude Code installed, run the optional, model-free authoritative check:

```sh
pnpm check:claude
```

This check is not required by portable CI. Marketplace listing, icons, global
installation, and live-model evaluations are separate operations.

The guarantee covers identities we own and Claude's plugin-loading route. It is
not a global reservation system: another plugin can deliberately choose the same
manifest name, and Claude's load precedence then applies. Plain Skill installs
and other hosts are not silently renamed or made collision-free by this file.

References: [manifest format](https://code.claude.com/docs/en/plugins-reference),
[plugin loading and name conflicts](https://code.claude.com/docs/en/plugins/loading),
[skills CLI](https://github.com/vercel-labs/skills).
