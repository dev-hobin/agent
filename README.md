# Hobin packages for Pi

Four focused packages for making Pi's work easier to inspect: contextual judgment,
safer development decisions, source-grounded learning, and local-first inquiry
notes.

Each package stands on its own. Install only the capability you want.

## Packages

| Package | Use it for | Start with |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer) | Clarifying consequential coding decisions, gating mutation, and verifying what a change proves | `/developer on` |
| [`@hobin/learning`](./packages/learning) | Reading technical sources and repositories, forming concepts and patterns, and designing practice | `/learning` or `/skill:<name>` |
| [`@hobin/observer`](./packages/observer) | Following an inquiry across a Pi session and publishing reviewed Markdown to a local notebook | `/observer` |
| [`@hobin/judgment`](./packages/judgment) | Building context-sensitive judgment into another adapter or tool | npm API or `judgment check` |

```mermaid
flowchart LR
  U[Pi user] --> D[Developer]
  U --> L[Learning]
  U --> O[Observer]
  D --> J[Judgment engine]
  O --> J
  L -. policy compiler at development time .-> J

  classDef engine fill:#f4f4f4,stroke:#666,color:#111;
  class J engine;
```

The arrows show dependencies, not a required workflow. Developer, Learning, and
Observer do not become phases of one larger product.

## Install

Requires [Pi](https://pi.dev) and Node.js 22.19 or newer.

```sh
pi install npm:@hobin/developer
pi install npm:@hobin/learning
pi install npm:@hobin/observer
```

Try a package for one run:

```sh
pi -e npm:@hobin/developer
```

Use `-l` for a project-local install recorded in `.pi/settings.json`:

```sh
pi install -l npm:@hobin/learning
```

`@hobin/judgment` is a library and CLI, not a Pi user interface:

```sh
npm install @hobin/judgment
```

## Which package should I choose?

| If you want Pi to… | Choose |
| --- | --- |
| Decide what must be true before editing code | Developer |
| Compare implementation evidence with a completion claim | Developer |
| Explain a specification without flattening its boundaries | Learning |
| Trace one public API through an open-source repository | Learning |
| Turn several insights into a reusable concept or practice set | Learning |
| Accumulate source-linked inquiry notes while doing other work | Observer |
| Review an exact Markdown batch before saving it locally | Observer |
| Add policy, provenance, selection, sealing, and coverage to another adapter | Judgment |

## Design boundaries

```mermaid
flowchart TB
  subgraph Pi-facing packages
    D[Developer\njudgment + mutation authority]
    L[Learning\nfive independent skills]
    O[Observer\ninquiry + notebook publication]
  end

  subgraph Reusable library
    J[Judgment\npolicy → context → outcome]
  end

  subgraph Host
    P[Pi\ntools, sessions, skills, UI]
  end

  P --> D
  P --> L
  P --> O
  D --> J
  O --> J
```

- **Judgment** has no Pi Skill, command, tool, prompt, or UI.
- **Developer** owns its questions, workbench, tool gating, authorization, and
  landing protocol.
- **Learning** owns no persistent learning session or notebook.
- **Observer** owns its local notebook format and explicit publication flow, not
  Git, remote sync, or model truth.
- No package is an operating-system sandbox. Pi packages execute with Pi's
  process permissions; review source before installation.

## Repository layout

```text
packages/
├── judgment/   reusable engine, schema, API, and CLI
├── developer/  Pi extension, workbench, protocol, and eleven skills
├── learning/   Pi chooser and five independent learning skills
└── observer/   Pi sidecar, inquiry workbench, and notebook publisher
```

Every package README is the consumer landing page. Its `docs/` directory contains
mechanism and maintainer detail.

## Develop

This is a private pnpm workspace. Package versions and publication are managed
independently.

```sh
corepack enable pnpm
pnpm install
pnpm check
pnpm eval
```

Run one package:

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pi -e ./packages/developer
```

The workspace uses pnpm's default isolated linker. `pnpm pack` rewrites
`workspace:` ranges to public semver ranges; sibling Pi resources are never
silently bundled. Source-level package isolation is checked by
`pnpm check:isolation`.

## License

[MIT](./LICENSE)
