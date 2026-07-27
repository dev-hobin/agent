# @hobin/observer

Observer is a local-first inquiry sidecar for [Pi](https://pi.dev). It follows standing questions across source material, keeps working observations and memos in the current Pi session, and saves approved, source-linked Markdown to a notebook you choose.

Observer supports two entry paths:

- **Sidecar:** keep observation on while doing other work.
- **One-shot:** ask for one observation while Observer Mode stays off.

Both paths use the same Episode, Memo, approval, and durable Wrap model.

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

## Set up a notebook

Observer never chooses a notebook path for you. Supply an absolute path and the notebook language:

```text
/observe setup ko /Users/me/notes/observer
```

Use `en` for English records:

```text
/observe setup en /Users/me/notes/observer
```

Running `/observe setup` without arguments opens the interactive setup prompt. Observer can initialize a new folder or adopt an existing one without rewriting unrelated files.

Check the selected notebook and current Mode/Episode state:

```text
/observe status
```

Do not move or replace the selected notebook while an Episode is open.

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
/observe wrap
```

Observer prepares a proposal. Notebook Markdown changes only after you explicitly approve the proposal and Observer saves, reads back, and validates the records. A successful Wrap settles the Episode and leaves Mode off.

Turn observation off without discarding an open Episode:

```text
/observe off
```

## One-shot workflow

One-shot is natural-language and model-owned; it is not another slash command. While Observer Mode is off, ask Pi to make one Observer pass:

```text
Observe this once with Observer and connect it to my current inquiry:
<material or question>
```

For a path or URL, Pi must retrieve the material first. The instruction itself is not treated as source evidence; retrieved tool results are linked to the One-shot request. Inline user material may be used as an exact user-message source candidate.

A completed One-shot:

- keeps Observer Mode off;
- opens or reuses the selected notebook's open Episode;
- requires every request-linked candidate to reach a SourceRead and semantic Observation;
- can continue through `/observe memo` and `/observe wrap` using the same approval and persistence rules as Sidecar.

Model/provider behavior is stochastic. Completion receipts prove one recorded request chain, not semantic truth or a provider reliability rate.

## Commands

| Command | Effect |
| --- | --- |
| `/observe setup` | Open interactive notebook setup |
| `/observe setup <ko\|en> <absolute path>` | Initialize or select an explicit notebook |
| `/observe status` | Show notebook, Mode, Episode, and recovery status |
| `/observe on` | Enable Sidecar observation for the open Episode |
| `/observe off` | Disable Sidecar observation without settling the Episode |
| `/observe memo` | Reconcile current working observations without Markdown writes |
| `/observe wrap` | Prepare the user-approved durable save path |

## Durable data and boundaries

Observer Markdown Profile v1 is the durable source of truth. Pi events and working session entries provide branch-local coordination and replay; they do not replace the notebook.

Observer owns local Source, Inquiry, Memo, and Zettel persistence. It does not own:

- Git, GitHub, remote sync, or backup;
- graph or vector databases;
- subagents or background workers;
- crash/power-loss durability or concurrent multi-instance coordination;
- model semantic truth.

Every durable Zettel must have at least one direct Source reference. Invalid Markdown is rejected before graph integrity checks, and Wrap follows approval → validation → save → readback validation → settlement ordering.

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
