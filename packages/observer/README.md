# @hobin/observer

Observer is a local-first inquiry sidecar for [Pi](https://pi.dev). It follows standing questions across source material, keeps working observations and memos in the current Pi session, and saves approved, source-linked Markdown to a notebook you choose.

Observer supports three entry paths:

- **Sidecar:** keep observation on while doing other work.
- **Track a hypothesis:** preserve a user idea, then review the current Pi context through it as a lens.
- **Observe material:** inspect supplied or retrieved material while Observer Mode stays off.

All three paths use the same Episode, Memo, approval, and Review & Save flow.

## Install

Requires Node.js 22.19 or newer. The 0.1.0 compatibility window is Pi 0.80.10 through 0.82.x; release checks exercise Pi 0.80.10, 0.81.1, and 0.82.1.

```sh
pi install npm:@hobin/observer
```

Try it for one run without installing:

```sh
pi -e npm:@hobin/observer
```

Run `pi list` to confirm that the package is available.

## Start in the control center

In Pi's TUI, run `/observe` with no arguments. The keyboard-first control center shows only actions that are legal for the current Episode:

```text
/observe
→ connect a Notebook
→ turn Observer On, track a hypothesis, or observe material
→ work normally
→ run Memo when you want a reconciliation
→ run Review & Save when you are ready to review and save
```

Use ↑/↓ and Enter to navigate; Esc always returns to Pi. The same surface exposes **Track a hypothesis**, **Observe material**, **Default output language**, and a detailed health view without requiring users to remember subcommands. Observer On/Off is a toggle; language is not. Enter on the language row opens an explicit `English (en)` / `Korean (ko)` chooser with the current choice preselected. On/Off and language changes update in place without closing and reopening the control center. The footer shows compact state, while a small widget appears only when an Episode needs attention or observation is active.

Observer never chooses a Notebook path for you. Setup accepts either an absolute path or a path relative to Pi's current working directory, then initializes a new folder or adopts an existing one without rewriting unrelated files. Direct commands remain available:

```text
/observe setup ko /Users/me/notes/observer
/observe setup en ./notes/observer
/observe status
```

`ko` and `en` select the language used when Observer writes Memo and Zettel Markdown; they do not change the control-center UI language. `/observe settings` opens the same control center. Changing the default output language during an open Episode affects the next Episode only. Do not move or replace the selected Notebook while an Episode is open.

## Sidecar workflow

Turn observation on, then work with Pi normally:

```text
/observe on
```

Read documents, inspect code, retrieve webpages, or discuss a question. Observer stages source candidates, SourceReads, optional Standing Inquiry hydration, semantic observations, and user hypotheses on the current Pi branch.

Reconcile the current working material without writing notebook Markdown:

```text
/observe memo
```

When the current inquiry is ready for durable review:

```text
/observe save
```

Observer prepares a proposal. Notebook Markdown changes only after you explicitly approve the proposal and Observer saves, reads back, and validates the records. A successful Review & Save settles the Episode and leaves Mode off.

Turn observation off without discarding an open Episode:

```text
/observe off
```

## Track a hypothesis workflow

Track a hypothesis immediately preserves the user's wording and optional rationale, then triggers a model-owned first review of the visible Pi context and current Episode working state through that hypothesis as a lens:

```text
/observe hypothesis The order of capture changes interpretation bias.
Context: The last two examples diverged only after delayed note-taking.
```

The context line is optional. User context remains distinct from Observer interpretation. The first review records supporting clues, challenging clues, missing information, genuine Source references when available, and an explicit interpretation boundary. Insufficient context is valid: it never removes or rewrites the user's original hypothesis. Memo reconciliation waits until this initial context review completes.

## Observe material workflow

Observe material is natural-language and model-owned; it is not another slash command. While Observer Mode is off, ask Pi to review supplied or retrieved material:

```text
Observe this material with Observer and connect it to my current inquiry:
<material or question>
```

For a path or URL, Pi must retrieve the material first. The instruction itself is not treated as source evidence; retrieved tool results are linked to the Observe material request. Inline user material may be used as an exact user-message source candidate.

A completed Observe material pass:

- keeps Observer Mode off;
- opens or reuses the selected notebook's open Episode;
- requires every request-linked candidate to reach a SourceRead and semantic Observation;
- can continue through `/observe memo` and `/observe save` using the same approval and persistence rules as Sidecar.

Model/provider behavior is stochastic. Completion receipts prove one recorded request chain, not semantic truth or a provider reliability rate.

## Commands

| Command | Effect |
| --- | --- |
| `/observe` | Open the TUI control center; show status outside TUI mode |
| `/observe settings` | Open the TUI control center explicitly |
| `/observe setup` | Open interactive notebook setup |
| `/observe setup <ko\|en> <path>` | Initialize or select a Notebook; relative paths resolve from Pi's working directory |
| `/observe status` | Show notebook, Mode, Episode, and recovery status |
| `/observe on` | Enable Sidecar observation for the open Episode |
| `/observe off` | Disable Sidecar observation without settling the Episode |
| `/observe hypothesis <text>` | Preserve a user hypothesis and trigger its initial current-context review |
| `/observe memo` | Reconcile current working observations without Markdown writes |
| `/observe save` | Review proposed Notebook changes, save approved records, and settle the Episode |

## Durable data and boundaries

Observer Markdown Profile v1 is the durable source of truth. Pi events and
working session entries provide branch-local coordination and replay; they do
not replace the notebook.

Observer owns local Source, Inquiry, Memo, and Zettel persistence. It does not own:

- Git, GitHub, remote sync, or backup;
- graph or vector databases;
- subagents or background workers;
- crash/power-loss durability or concurrent multi-instance coordination;
- model semantic truth.

Every durable Zettel must have at least one direct Source reference. Invalid
Markdown is rejected before graph integrity checks, and Review & Save follows
approval → validation → save → readback validation → settlement ordering.

The code keeps the product operation and its persistence mechanism separate.
`SaveService` owns the Review & Save contract, lifecycle checks, target recovery,
and public receipt. Its injected `WrapService` implementation owns record
planning, atomic publication, readback, and rollback. Wrap is an internal save
process, not a command, model action, or persisted public protocol.

## Update and remove

```sh
pi update npm:@hobin/observer
pi remove npm:@hobin/observer
```

Use a project-local installation when a repository should declare Observer in its Pi settings:

```sh
pi install -l npm:@hobin/observer
```

Pi packages execute with the Pi process's system access. Review package source before installation and use an operating-system sandbox when you need a security boundary.

## Documentation

- [Observer v0.1 product specification (Korean)](docs/product-spec-v0.1.ko.md)
- [Observer v0.1 implementation plan and evidence (Korean)](docs/implementation-plan-v0.1.ko.md)

## Development

From the monorepo root:

```sh
pnpm --filter @hobin/observer check
pnpm --filter @hobin/observer eval
```

From `packages/observer`, run the clean-tree public package gate:

```sh
npm run release:check
```

The previous implementation remains on the `archive/observer-v0.1` branch as historical evidence, not as this package's runtime baseline.

## License

[MIT](./LICENSE)
