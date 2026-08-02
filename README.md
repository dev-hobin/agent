# agent

Composable packages for [Pi](https://pi.dev): contextual judgment, adaptive
development, source-grounded learning, and local-first observation without one
universal workflow.

This repository is a pnpm monorepo. The repository root is for development only;
each directory under `packages/` is an independently installable and publishable
Pi package.

## Packages

| Package | What it adds | Start here |
| --- | --- | --- |
| [`@hobin/judgment@0.1.0`](./packages/judgment) | Minimal optional authoring policy, dynamic context selection/sealing/contribution core, and generic Pi runtime | `/skill:judgment` or its tools |
| [`@hobin/developer@0.1.17`](./packages/developer) | A branch-aware judgment workbench, eleven independently routed skills, strict mutation gating, and inspectable Pi-native state | `/developer on` |
| [`@hobin/learning@0.1.1`](./packages/learning) | Five independently complete source-grounded learning skills and an optional TUI chooser | `/learning` or a normal learning request |
| [`@hobin/observer@0.1.6`](./packages/observer) | Local-first inquiry observation, Memo reconciliation, proposal review, and explicit Notebook publication | `/observer` |

Install only the package you need. Do not run `pi install` against the monorepo
root: it intentionally has no `pi` manifest and is not a combined distribution.

The patch candidates remain private until publication is explicitly approved
from a committed clean worktree. Judgment's current authoring
format is `specVersion: "0.1"`; see its
[authoring guide](./packages/judgment/docs/authoring-schema-v0.1.md) and
[runtime guide](./packages/judgment/docs/runtime-integration.md).

## Quick start

Requirements:

- [Pi](https://pi.dev) installed and configured
- Node.js 22.19 or newer

Install packages globally for your Pi user profile:

```sh
pi install npm:@hobin/judgment
pi install npm:@hobin/developer
pi install npm:@hobin/learning
pi install npm:@hobin/observer
```

Or try a package for one run without adding it to settings:

```sh
pi -e npm:@hobin/judgment
pi -e npm:@hobin/developer
pi -e npm:@hobin/learning
pi -e npm:@hobin/observer
```

For project-local installation, add `-l`; Pi writes the package entry to the
project's `.pi/settings.json` instead of the user profile:

```sh
pi install -l npm:@hobin/developer
```

The private candidates have been exercised against Pi 0.80.10, 0.82.1, and
0.83.0; the currently published package versions may cover a
narrower matrix. Consult each package README for its exact verification scope.
Pi core imports are peer dependencies supplied by the host and are not bundled
into npm artifacts.

## What to expect

All packages keep focused capabilities independent. Pi may load a skill from the
current request, or the user may invoke it explicitly with `/skill:<name>`.
No package requires a universal phase order.

`@hobin/developer` additionally provides a small stateful protocol. It can route one
development question at a time, preserve unresolved questions by stable ID, and
record evidence-backed judgments. Product files are still changed by Pi's normal
implementation tools.

`@hobin/learning` provides optional discovery UI but does not claim a persistent
learning phase, completion percentage, notebook, graph, or persistence owner.

`@hobin/judgment` is the neutral foundation for contextual selection and
judgment. It separates Pi's available skill/tool environment from explicit
current-branch nomination, selected and sealed material, contribution coverage,
and optional closure. Developer and Observer bundle only the core they own without
exposing nested generic Pi resources; Learning compiles deterministic Context
Directions at development time and remains stateless.

See each package README for commands, examples, state semantics, and boundaries.

## Package safety

Pi packages can include TypeScript extensions that run with the same system
access as Pi. Review third-party package source before installation. In this
repository:

- Developer can change Pi's active built-in tool set while its protocol is on.
- Observer can publish only an explicitly reviewed, validated Notebook batch.
- Learning's chooser prepares prompts but owns no persistence protocol.
- Judgment loads only a selected skill's optional policy and reads prepared
  references only after explicit nomination through its bounded adapter.
- No package is a security sandbox.

See the [Pi package security and installation
model](https://pi.dev/docs/latest/packages) for host-level behavior.

## Manage installed packages

```sh
pi list
pi config
pi update npm:@hobin/judgment
pi update npm:@hobin/developer
pi update npm:@hobin/learning
pi update npm:@hobin/observer
pi remove npm:@hobin/judgment
pi remove npm:@hobin/developer
pi remove npm:@hobin/learning
pi remove npm:@hobin/observer
```

An unversioned npm install follows future package updates. Install a specific
version, such as `npm:@hobin/developer@0.1.17`, when you want it pinned.

## Repository layout

```text
agent/
├── packages/
│   ├── judgment/    # neutral core, generic extension, schema/docs, tests
│   ├── developer/   # extension, v7 protocol, migration docs, TUI, skills, evals
│   ├── learning/    # chooser, independent skills, guidance specs, tests
│   └── observer/    # observation, inquiry, Memo, save, TUI, tests, evals
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
pnpm --filter @hobin/judgment check
pnpm --filter @hobin/judgment pack

pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pnpm --filter @hobin/developer pack

pnpm --filter @hobin/learning check
pnpm --filter @hobin/learning eval
pnpm --filter @hobin/learning pack

pnpm --filter @hobin/observer check
pnpm --filter @hobin/observer eval
pnpm --filter @hobin/observer pack
```

After installing workspace dependencies, load a package directly into Pi during
development:

```sh
pi -e ./packages/judgment
pi -e ./packages/developer
pi -e ./packages/learning
pi -e ./packages/observer
```

The packages are versioned and published independently. Publish
`@hobin/judgment@0.1.0` before dependent domain packages. Domain source
manifests use the exact `workspace:0.1.0` protocol so local development cannot
silently resolve a registry copy. The pinned pnpm `pack` and `publish` commands
rewrite that protocol to `0.1.0` and bundle Judgment for Pi installation. Direct
`npm pack` or `npm publish` is therefore not a supported maintainer path. pnpm
requires the workspace's hoisted linker when packing `bundledDependencies`;
source-level package isolation remains enforced by `pnpm check:isolation`.

## License

[MIT](./LICENSE)
