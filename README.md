# agent

Composable packages for [Pi](https://pi.dev): adaptive development judgment and
source-grounded learning, without imposing one fixed workflow.

This repository is a pnpm monorepo. The repository root is for development only;
each directory under `packages/` is an independently installable and publishable
Pi package.

## Packages

| Package | What it adds | Start here |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer) | A branch-aware development protocol, ten independently routed judgment skills, strict mutation gating, and Pi-native TUI controls | `/develop on` |
| [`@hobin/learning`](./packages/learning) | Five source-grounded learning skills, an optional TUI chooser, and a read-only learning-artifact validator | `/learning` or a normal learning request |

Install only the package you need. Do not run `pi install` against the monorepo
root: it intentionally has no `pi` manifest and is not a combined distribution.

## Quick start

Requirements:

- [Pi](https://pi.dev) installed and configured
- Node.js 22.19 or newer

Install packages globally for your Pi user profile:

```sh
pi install npm:@hobin/developer
pi install npm:@hobin/learning
```

Or try either package for one run without adding it to settings:

```sh
pi -e npm:@hobin/developer
pi -e npm:@hobin/learning
```

For project-local installation, add `-l`; Pi writes the package entry to the
project's `.pi/settings.json` instead of the user profile:

```sh
pi install -l npm:@hobin/developer
```

The packages have been exercised against Pi 0.80.3 and 0.80.10. Their Pi core
imports are peer dependencies supplied by the host and are not bundled into the
npm artifacts.

## What to expect

Both packages keep their focused skills independent. Pi may load a skill from the
current request, or the user may invoke it explicitly with `/skill:<name>`.
Neither package requires a universal phase order.

`@hobin/developer` additionally provides a small stateful protocol. It can route one
development question at a time, preserve unresolved questions by stable ID, and
record evidence-backed judgments. Product files are still changed by Pi's normal
implementation tools.

`@hobin/learning` provides optional discovery UI but does not claim a persistent
learning phase or completion percentage. Its validator checks the structure of
saved graph-shaped Markdown artifacts, not their truth or educational quality.

See each package README for commands, examples, state semantics, and boundaries.

## Package safety

Pi packages can include TypeScript extensions that run with the same system
access as Pi. Review third-party package source before installation. In this
repository:

- Developer can change Pi's active built-in tool set while strict mode is on.
- Learning's extension reads only the Markdown path explicitly passed to its
  validator; its skills may still guide Pi to use the tools enabled by the user.
- Neither package is a security sandbox.

See the [Pi package security and installation
model](https://pi.dev/docs/latest/packages) for host-level behavior.

## Manage installed packages

```sh
pi list
pi config
pi update npm:@hobin/developer
pi update npm:@hobin/learning
pi remove npm:@hobin/developer
pi remove npm:@hobin/learning
```

An unversioned npm install follows future package updates. Install a specific
version, such as `npm:@hobin/developer@0.1.0`, when you want it pinned.

## Repository layout

```text
agent/
├── packages/
│   ├── developer/   # extension, protocol state, TUI, skills, tests, evals
│   └── learning/    # extension, TUI, validator, skills, tests
├── package.json     # private workspace scripts
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Develop locally

The root `packageManager` field pins pnpm. From a fresh checkout:

```sh
corepack enable pnpm
pnpm install
pnpm check
pnpm eval
```

Run or package one workspace independently:

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pnpm --filter @hobin/developer pack

pnpm --filter @hobin/learning check
pnpm --filter @hobin/learning eval
pnpm --filter @hobin/learning pack
```

After installing workspace dependencies, load a package directly into Pi during
development:

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

The packages are versioned and published independently. If one workspace later
depends on another, use pnpm's `workspace:*` protocol so local resolution and
published version rewriting stay explicit.

## License

[MIT](./LICENSE)
