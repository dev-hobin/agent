# @hobin/learning

English | [한국어](./README.ko.md)

Five independent Pi Skills for understanding technical sources, studying public
repositories, forming reusable ideas, and practicing them.

Learning is not a course runner or a fixed pipeline. Each Skill can be used by
itself and ends with its own complete result.

## Install

Requires [Pi](https://pi.dev) and Node.js 22.19 or newer.

```sh
pi install npm:@hobin/learning
```

Try it for one run:

```sh
pi -e npm:@hobin/learning
```

## Try this first

Ask Pi normally:

```text
Read this RFC section with me. Preserve the example and the exception, then
explain the state model it expects me to use.
```

Or invoke a Skill directly:

```text
/skill:technical-reading Explain this article without flattening its boundaries.
/skill:opensource-reading Trace this API through docs, tests, and implementation.
/skill:conceptualize Turn these findings into one source-independent concept.
/skill:patternize Decide whether these repeated cases form one reusable routine.
/skill:exercise Build prediction, diagnosis, repair, and transfer practice.
```

`/learning` opens a small chooser. It places the selected `/skill:...` command in
the editor and preserves the current draft. It does not send the command or
start a separate Learning session.

## Choose a Skill

| Needed result | Skill |
| --- | --- |
| Understand a book, article, specification, tutorial, PDF, or webpage faithfully | `technical-reading` |
| Learn how one public API, flow, invariant, or tradeoff works in an open-source repository | `opensource-reading` |
| Name and test a durable idea that survives beyond its sources | `conceptualize` |
| Turn recurrence across cases into an operational routine | `patternize` |
| Produce observable evidence that a learner can use the idea | `exercise` |

These are different questions, not five phases. Technical reading does not have
to become a concept; a concept does not have to become a pattern; any completed
result can stop where it is.

## What happens after selecting a Skill

1. Pi loads the selected `SKILL.md` as the complete method.
2. The Skill reads only the source or repository slice needed for its question.
3. A packaged reference is opened only when its stated distinction can change
   the result.
4. The Skill returns a complete conversational result or copyable Markdown.
5. It writes a file only after the user names or approves a target.

Learning does not create a notebook, graph database, progress record, or hidden
cross-Skill state.

## Optional reference directions

Each Skill has a small `judgment.json` used during package development. It is
rendered into a deterministic `Context Directions` section inside `SKILL.md`.
The installed package does not start a Judgment runtime. Pi simply shows the
method and directions to the model as normal Skill content.

## Documentation

- [Choosing a Skill](./docs/choosing-a-skill.md) — the distinction between the
  five results
- [How Learning works](./docs/how-it-works.md) — chooser, Skill loading, optional
  references, and saving

## Development

```sh
pnpm --filter @hobin/learning check
pnpm --filter @hobin/learning eval
pi -e ./packages/learning
```

After changing a policy, regenerate the embedded directions:

```sh
node packages/learning/scripts/write-context-directions.mjs
```

## License

[MIT](./LICENSE)
