# @hobin/learning

English | [한국어](./README.ko.md)

Five independent [Agent Skills](https://agentskills.io/specification) for
understanding technical sources, studying public repositories, forming reusable
ideas, and practicing them. Learning is not a course runner or fixed pipeline:
each Skill completes its own result and can be used by itself.

## Portable installation

The root `plugin.json` follows Agent Plugins 1.0.0 and declares `hobin-learning`.
Prefer native plugin installation below for persistent, package-qualified Skills
in Claude and Codex. Alternatively expose a whole `skills/<name>/` directory,
including supporting files, through a compatible host. Instruction-only bundles
need neither Pi nor Node.js, and reference selection needs no host extension.

Host-specific loading and explicit invocation examples:

| Host | Location | Example |
| --- | --- | --- |
| Claude Code plugin | Native user plugin installation | `/hobin-learning:technical-reading` |
| Codex plugin | Native user plugin installation | `$hobin-learning:technical-reading` |
| Pi | Native Skill paths or package installation below | `/skill:technical-reading` |

These are compatibility examples, not universal Agent Skills discovery rules.
The repository's [standards register](https://github.com/dev-hobin/agent/blob/main/docs/standards.md)
separates the upstream format from our own reference convention and host APIs.

## Try this first

Ask your agent normally, or explicitly select `technical-reading`:

```text
Read this RFC section with me. Preserve the example and the exception, then
explain the state model it expects me to use.
```

## Choose a Skill

| Needed result | Skill |
| --- | --- |
| Understand a book, article, specification, tutorial, PDF, or webpage faithfully | `technical-reading` |
| Learn one public API, flow, invariant, or tradeoff in an open-source repository | `opensource-reading` |
| Name and test a durable idea that survives beyond its sources | `conceptualize` |
| Turn recurrence across cases into an operational routine | `patternize` |
| Produce observable evidence that a learner can use the idea | `exercise` |

These are different questions, not five phases. Reading does not have to become
a concept, and a concept does not have to become a pattern.

## Execution and supporting material

The host loads the selected `SKILL.md`; the agent follows its method using
ordinary source, repository, and file tools. It reads only supporting references
that can materially change the result. The method directs it to complete a
conversational result or copyable Markdown, and to write files only after a user
requests persistence and names or approves the target.

Each Skill's `judgment.json` is an authoring source, rendered into deterministic
`Context Directions` inside `SKILL.md`. This JSON is our own convention, not a
standard host policy API. There is no Judgment runtime or reference-selection
service. Learning stores no notebook, progress record, or hidden cross-Skill state.

## Native plugin installation

Use a checkout containing the prepared 0.2.2 manifests/catalogs; it is not yet an
npm release. Register the **resource checkout**, not a selected work project.

Claude Code, once for your user across projects:

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-learning@hobin-agent --scope user
```

Codex, using its native user installation:

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-learning@hobin-agent
```

Start a new session. Claude uses `/hobin-learning:technical-reading`; Codex uses
`$hobin-learning:technical-reading`. Both consume the same canonical `skills/`.
The synchronized `.claude-plugin/plugin.json` is legacy compatibility, not an
alternative portable manifest. No `.codex-plugin` descriptor is needed here.

`claude --plugin-dir /absolute/path/to/agent/packages/learning` is for one-session
development only. Flat `skills add` does not apply plugin namespaces or remove
existing copies. See [installation and exercised evidence](https://github.com/dev-hobin/agent/blob/main/docs/installation.md)
and [Claude collision boundaries](https://github.com/dev-hobin/agent/blob/main/docs/claude-plugins.md).

## Optional Pi chooser

```sh
pi install npm:@hobin/learning
# Or try for one run:
pi -e npm:@hobin/learning
```

`adapters/pi/learning.ts` registers `/learning`. The chooser places a selected
`/skill:...` command in the editor and preserves the draft; it does not send it,
load references, or start a Learning session. Native explicit Skill commands
work without opening the chooser.

Package installation remains supported. Manually configured source paths change
from `extensions/learning.ts` to `adapters/pi/learning.ts`. The Pi peers are
optional; consuming a Skill directory does not require installing a Pi runtime.

## Documentation

- [Choosing a Skill](./docs/choosing-a-skill.md)
- [Learning operating principles](./docs/how-it-works.md) — portable methods,
  authoring/runtime boundaries, and optional Pi integration

## Development

After the repository root's authoring setup:

```sh
pnpm check:portable
pnpm --filter @hobin/learning check:pi
# Optional, with Claude Code installed:
pnpm check:claude
```

After changing a policy:

```sh
node packages/learning/scripts/write-context-directions.mjs
```

`pnpm check:standard` covers Agent Skills and Agent Plugins. The optional
`pnpm check:install -- claude` or `pnpm check:install -- codex` probes actual
native installation in temporary HOME/config without a model call. These are
authoring checks, not consumer installers.

`eval` and `eval:contrast` remain optional Pi live-model evaluation commands;
they are not part of portable checks and may make provider requests.

## License

[MIT](./LICENSE)
