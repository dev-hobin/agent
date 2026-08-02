# Hobin packages for Pi

English | [한국어](./README.ko.md)

This repository contains three Pi packages that users install independently and
one library used to build evidence-aware workflows.

## Packages

| Package | What it is for | Install |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer) | Decide what must be known before a code change, allow only a bounded edit, and verify the result afterward | `pi install npm:@hobin/developer` |
| [`@hobin/learning`](./packages/learning) | Read technical sources and repositories, form concepts and patterns, and design practice | `pi install npm:@hobin/learning` |
| [`@hobin/observer`](./packages/observer) | Keep inquiry evidence in a Pi session and publish a reviewed Markdown batch to a local notebook | `pi install npm:@hobin/observer` |
| [`@hobin/judgment`](./packages/judgment) | Add policy-aware context selection, content sealing, evidence accounting, and outcomes to another adapter | `npm install @hobin/judgment` |

Requires Node.js 22.19 or newer. The three Pi-facing packages also require
[Pi](https://pi.dev).

Try a Pi package without keeping it installed:

```sh
pi -e npm:@hobin/developer
```

Use `-l` to record it in the current project's `.pi/settings.json`:

```sh
pi install -l npm:@hobin/learning
```

## Which package should I start with?

- Use **Developer** when Pi may need to change code and the decision or completion
  claim deserves an explicit check.
- Use **Learning** when the result should be understanding, a reusable idea, or
  practice rather than a repository change.
- Use **Observer** when evidence should accumulate across otherwise ordinary Pi
  work and become reviewed local notes later.
- Use **Judgment** only when you are writing an adapter or tool. It has no Pi
  command, Skill, prompt, or UI of its own.

## How the packages relate

The packages are not stages of one product.

- Developer uses Judgment to bind a question to exact evidence before producing
  a conclusion.
- Observer uses Judgment primitives inside its own typed observation and Memo
  checks.
- Learning uses the Judgment policy compiler during development to keep optional
  reference instructions deterministic. Its installed runtime remains a normal
  set of Pi Skills.
- Each Pi-facing package owns its own commands, state, UI, and persistence rules.

## Monorepo installation boundary

Do not install the repository root expecting all packages to load. The root is a
private pnpm workspace and has no combined Pi manifest.

Install published packages one at a time. From a source checkout, run the exact
package directory you want:

```sh
pi -e ./packages/developer
```

This keeps each package independently installable and prevents a checkout from
silently enabling unrelated extensions or Skills.

## Documentation

Every package README is a standalone landing page suitable for GitHub and npm.
Detailed documents live under that package's `docs/` directory.

- English: `README.md` and `docs/*.md`
- Korean: `README.ko.md` and `docs/ko/*.md`

The repository check requires the English and Korean document sets and their
local links to stay aligned.

## Repository layout

```text
packages/
├── judgment/   reusable engine, schema, API, and CLI
├── developer/  Pi extension, workbench, protocol, and ten Skills
├── learning/   Pi chooser and five independent learning Skills
└── observer/   Pi sidecar, inquiry workbench, and notebook publisher
```

## Development

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

The workspace uses pnpm's isolated linker. Package versions and publication are
managed independently, and all manifests remain private until an explicit
release decision.

Pi packages execute with Pi's process permissions. Review third-party package
source and use operating-system isolation when stronger boundaries are needed.

## License

[MIT](./LICENSE)
