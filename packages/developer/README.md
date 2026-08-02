# @hobin/developer

English | [한국어](./README.ko.md)

A Pi extension that separates three things agents often blur together: deciding
what is true, receiving permission to change files, and verifying the result.

## Install

Requires [Pi](https://pi.dev) and Node.js 22.19 or newer.

```sh
pi install npm:@hobin/developer
```

Try it for one run:

```sh
pi -e npm:@hobin/developer
```

Enable it inside Pi:

```text
/developer on
```

## Try this first

Ask for the change normally:

```text
/developer on
The selected payment method disappears after navigating back to checkout.
Find the cause and fix it, but do not guess at missing product behavior.
```

You do not choose protocol tools. Developer tells the model which operations are
currently legal.

## What happens during a change

Suppose the request leaves one product rule unclear.

1. Developer opens a focused judgment owned by one Skill, such as `specify`.
2. While that judgment is open, Pi may read files and run checks, but Developer
   withholds built-in `edit` and `write`.
3. The judgment either resolves the question or records exactly what evidence or
   user answer is missing.
4. After all before-implementation questions are closed, Developer creates an
   `AuthorizedChange` describing the allowed movement and what a stable landing
   should look like.
5. Built-in mutation tools become available for that bounded change.
6. The model records the actual changed paths as an `ImplementationLanding`.
7. Recording a landing removes mutation authority and creates verification debt.
8. A separate `verify` judgment decides what the tests and observed result prove.

A landing is therefore “these files changed under this authorization,” not “the
task is complete.”

See [Developer operating principles](./docs/how-it-works.md) for the branch
replay, state transitions, and tool projection that enforce this separation.

## Tool access

| Current state | `bash` | Built-in `edit` / `write` |
| --- | --- | --- |
| Developer enabled but idle | Withheld | Withheld |
| Active judgment | Available for evidence gathering | Withheld |
| Authorized change | Available | Available for the bounded movement |
| Landing recorded | Withheld until the next judgment opens | Withheld again |

This is workflow gating, not an operating-system sandbox. Shell commands and
third-party extensions still run with Pi's process permissions.

## Skills

Developer includes ten Skills. Pi chooses one that owns the current question, or
you can invoke one with `/skill:<name>`.

| Skill | Question it owns |
| --- | --- |
| `doctor` | What should a bounded existing-code scope address now, later, observe, or leave alone? |
| `specify` | What does the product requirement actually mean? |
| `model` | Which cases, rules, states, contracts, and forbidden conditions exist? |
| `sketch` | What data, interfaces, ownership, and collaboration should exist? |
| `signal` | Is there observable structural pressure rather than mere similarity? |
| `naming-judgment` | Which name preserves domain meaning and exposes effects? |
| `abstraction-review` | Is a concrete abstraction stable enough to keep? |
| `schedule` | Should a concrete structural change happen now, later, or never? |
| `verify` | Which claims does current evidence support? |
| `adversarial-eval` | Which finite counterexamples could falsify a consequential claim? |

These are alternative question owners, not mandatory phases.

## External Skill context

An active Developer judgment may use a Skill from another installed Pi package
as context. Developer first exposes lightweight descriptors. The model nominates
exact Skill IDs, and only those `SKILL.md` files and optional policies are opened.

An external Skill contributes method or guidance to the current judgment. It
does not become the owner, open another judgment, or grant mutation permission.

## Commands

| Command | Effect |
| --- | --- |
| `/developer` | Open the read-only workbench |
| `/developer on` | Enable judgment and mutation gating |
| `/developer off` | Disable Developer after confirming unresolved work when needed |
| `/developer status` | Inspect current state |
| `/developer questions` | Inspect or answer unresolved questions |
| `/developer settings` | Open activation settings |

Start Pi with Developer enabled:

```sh
pi --developer
```

## Workbench

`/developer` shows the active judgment, pending questions, completed judgments,
landings, and verification obligations. It is read-only: opening, scrolling, or
copying a record does not append events or write files.

## Documentation

- [Developer operating principles](./docs/how-it-works.md) — branch replay,
  authority transitions, tool projection, context basis, and verification debt
- [User guide](./docs/user-guide.md) — commands, questions, and recovery
- [Runtime protocol](./docs/runtime-protocol.md) — exact operations and replay
  rules for maintainers

## Development

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pi -e ./packages/developer
```

## License

[MIT](./LICENSE)
