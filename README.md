# agent

Composable packages for [Pi](https://pi.dev): contextual judgment, adaptive
development, source-grounded learning, and local-first observation without one
universal workflow.

This repository is a pnpm monorepo. The repository root is for development only;
each directory under `packages/` is an independently publishable package;
Developer, Learning, and Observer expose Pi resources while Judgment is their
side-effect-free engine dependency.

## Packages

| Package | What it adds | Start here |
| --- | --- | --- |
| [`@hobin/judgment@0.1.0`](./packages/judgment) | Optional policy authoring, dynamic context selection/sealing, contribution coverage, and adapter APIs without Pi side effects | npm API or `judgment check` |
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
pi install npm:@hobin/developer
pi install npm:@hobin/learning
pi install npm:@hobin/observer
```

Or try a package for one run without adding it to settings:

```sh
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

`@hobin/judgment` is the neutral, side-effect-free engine for contextual
selection and judgment. It separates Pi's available Skill/tool environment from
explicit current-branch nomination, selected and sealed material, contribution
coverage, and optional closure. Developer consumes it as an ordinary dependency
and admits nominated external Skill methods and optional `judgment.json`
references into one Developer lifecycle. Observer uses only its exact utility
surface; Learning compiles deterministic Context Directions at development time
and remains stateless.

See each package README for commands, examples, state semantics, and boundaries.

## Package safety

Pi packages can include TypeScript extensions that run with the same system
access as Pi. Review third-party package source before installation. In this
repository:

- Developer can change Pi's active built-in tool set while its protocol is on.
- Observer can publish only an explicitly reviewed, validated Notebook batch.
- Learning's chooser prepares prompts but owns no persistence protocol.
- Judgment itself registers no Pi resources; adapters load only nominated Skill
  policies and read prepared references after explicit selection.
- No package is a security sandbox.

See the [Pi package security and installation
model](https://pi.dev/docs/latest/packages) for host-level behavior.

## Manage installed packages

```sh
pi list
pi config
pi update npm:@hobin/developer
pi update npm:@hobin/learning
pi update npm:@hobin/observer
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
│   ├── judgment/    # side-effect-free engine, schema, CLI, docs, tests
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
pi -e ./packages/developer
pi -e ./packages/learning
pi -e ./packages/observer
```

The packages are versioned and published independently. Publish the
side-effect-free `@hobin/judgment@0.1.0` engine before dependent domain
packages. Domain source manifests use `workspace:^0.1.0`; the pinned pnpm
`pack` and `publish` commands rewrite it to the ordinary public `^0.1.0` range.
Judgment is an ordinary dependency rather than bundled Pi resources, so pnpm's
default isolated linker remains supported. Direct `npm pack` or `npm publish`
is not the maintainer release path. Source-level package isolation remains
enforced by `pnpm check:isolation`.

## License

[MIT](./LICENSE)
