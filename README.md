# Hobin packages for Pi

This repository contains two independently installable Pi packages.

| Package | Purpose | Install |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer) | Composable engineering method Skills, conditional References, and source-agnostic Reference disclosure for selected Skills | `pi install npm:@hobin/developer` |
| [`@hobin/learning`](./packages/learning) | Technical reading, open-source study, concept formation, pattern discovery, and deliberate practice Skills | `pi install npm:@hobin/learning` |

Both packages require Node.js 22.19 or newer and use Pi's native model, Tool, session, compaction, and response loop. They do not form one staged workflow and should be installed independently.

Try a package without keeping it installed:

```sh
pi -e npm:@hobin/developer
```

From a source checkout, load the exact package directory rather than the private workspace root:

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

## Standalone resources

[`agents/`](./agents) contains reviewable context fragments, and [`skills/`](./skills) contains independent Skills. They are not declared by either package and are not loaded automatically. Merge a selected context fragment into an `AGENTS.md`, or load a Skill explicitly with `pi --skill ./skills/<name>`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
```

Package checks are provider-free. Live-model qualification is bounded separately and is not part of the default test command.

## License

[MIT](./LICENSE)
