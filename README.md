# Engineering judgment and learning packages for Pi

English | [한국어](./README.ko.md)

Two independently installable Pi packages for engineering judgment and source-grounded learning.

## Why these packages exist

People do not keep every detail in working memory. They retain a small method for deciding what kind of work is in front of them, then consult specific material when the situation requires it.

These packages shape agent context in the same way. A Skill carries the durable working method. Supporting References provide situational detail only when that detail can change the result. This keeps the active context focused without reducing every task to one preset or fixed pipeline.

## Packages

| Package | Purpose | Install |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer) | Turns experienced developer intuition into explicit engineering judgment Skills, with conditional References for the current problem | `pi install npm:@hobin/developer` |
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
