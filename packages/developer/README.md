# @hobin/developer

English | [한국어](./README.ko.md)

A Pi extension that keeps semantic judgment, file-change permission, and
claim-relative verification separate.

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

Developer owns the runtime turn. It chooses one stable `RouteDefinition`, opens
an exact `RouteFrame`, and may invoke zero or one owning Skill while treating
other Skills as contextual material. A same-named Skill never gains authority
from its name alone.

## What happens during a change

1. Developer opens a frame for the current semantic obligation.
2. The frame may complete from current admitted support or invoke one owning
   Skill selected from a finite routing snapshot.
3. Skill output remains a candidate until the frame explicitly admits it.
4. Every obligation needs an explicit discharge and current stop evidence before
   the frame can conclude.
5. A concluded frame may authorize one bounded implementation movement.
6. The model records the exact changed paths as one landing.
7. Landing consumes mutation authority and creates separate reroute and
   verification debt.
8. Later frames clear those debts independently.

A landing means “these paths changed under this authorization,” not “the task is
complete.” A resolved judgment may also be negative; resolution is not approval.

See [Developer operating principles](./docs/how-it-works.md) for routing,
replay, admission, authorization, and receipt projection.

## Tool access

| Current runtime state | `bash` | Built-in `edit` / `write` |
| --- | --- | --- |
| Enabled with no open frame | Withheld | Withheld |
| Semantic frame open | Available for evidence gathering | Withheld |
| Replay-current change authorization | Available | Available for the bounded movement |
| Landing debt | Withheld until the next frame opens | Withheld |

This is workflow gating, not an operating-system sandbox. Shell commands and
third-party extensions retain Pi process permissions.

## Skills

Developer includes ten independent Skills. Pi chooses one only when that
capability owns the current question; you can also invoke one with
`/skill:<name>`.

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

These are alternative collaborators, not mandatory phases.

## Commands

| Command | Effect |
| --- | --- |
| `/developer` | Open the exact-current read-only receipt overlay in TUI mode |
| `/developer on` | Open a Developer v8 work scope |
| `/developer off` | Close the scope when no change authorization is active |
| `/developer status` | Show the current receipt projection summary |
| `/developer questions` | Compatibility alias for the same receipt summary |
| `/developer settings` | Compatibility alias for the same receipt summary |

Start Pi with Developer enabled:

```sh
pi --developer
```

## Receipt observer

The overlay reads one verified page from the exact current projection. It can
move through opaque page cursors, return to the first page, refresh, copy, or
close. It cannot route, settle, admit, discharge, conclude, authorize, persist,
or publish. If the projection changes while the overlay is open, reopen it.

## Documentation

- [Developer operating principles](./docs/how-it-works.md) — runtime ownership,
  routing, contribution admission, authorization, and replay
- [User guide](./docs/user-guide.md) — commands, receipt navigation, and recovery
- [Runtime protocol](./docs/runtime-protocol.md) — v8 envelopes, events, replay,
  result summaries, and receipt projection

## Development

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pi -e ./packages/developer
```

## License

[MIT](./LICENSE)
