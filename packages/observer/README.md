# @hobin/observer

English | [한국어](./README.ko.md)

A Pi sidecar that keeps inquiry evidence in the current session and publishes
only a user-reviewed Markdown batch to a local notebook.

Observer does not save every tool result and does not write notes continuously.
Working evidence stays on the Pi branch until the user reviews an exact proposal
and approves the whole batch.

## Install

Requires Pi 0.80.10–0.83.x and Node.js 22.19 or newer.

```sh
pi install npm:@hobin/observer
```

Try it for one run:

```sh
pi -e npm:@hobin/observer
```

## Try this first

Open the Workbench:

```text
/observer
```

In **Settings**, choose a local Notebook folder and turn Observer on. Then work
with Pi normally.

When there is enough material to synthesize:

```text
/observer memo
/observer review
```

`review` prepares exact create/update operations, diffs, and final Markdown. It
does not write files. Open **Proposal**, inspect the batch, and choose **Save all**
to publish it.

## What happens while Observer is on

1. `/observer on` recovers the selected Notebook, opens an Episode if needed,
   and enables continuous observation mode.
2. Successful Pi tool results from the current agent run become candidates. They
   are not saved automatically.
3. The model may nominate an exact tool-call ID when its result materially
   supports, challenges, refines, or bounds the inquiry.
4. Observer records a `SourceRead` with provenance and a faithful summary, then a
   semantic observation tied to exact source and Inquiry IDs.
5. These records remain in the current Pi session branch.
6. `/observer memo` reconciles the current working evidence into Memos, still
   without writing Notebook files.
7. `/observer review` prepares a complete Notebook proposal.
8. Explicit approval stages, publishes, reads back, and settles the entire batch.

See [Observer operating principles](./docs/how-it-works.md) for branch replay,
typed relations, staged commit, and Notebook publication mechanics.

## Three ways to start inquiry work

| Entry | Use it when | Command |
| --- | --- | --- |
| Continuous Sidecar | Important evidence may appear while doing ordinary Pi work | `/observer on` |
| User hypothesis | Preserve the user's wording and inspect current evidence through that question | `/observer add-hypothesis <text>` |
| Bounded material review | Review supplied or retrieved material once without changing Sidecar mode | `/observer material <request>` |

All three use the same Episode, Memo, Review, and Save machinery.

## Session state versus Notebook files

| Location | Contents | When it changes |
| --- | --- | --- |
| Current Pi branch | Candidates, SourceReads, observations, hypotheses, working Memos, proposal state | During Observer work |
| Local Notebook | Source, Inquiry, Memo, and Zettel Markdown records | Only after explicit batch approval and successful readback |

Turning Observer off stops continuous model-backed observation but leaves an open
Episode and its working evidence intact.

## Processing modes

| Mode | Behavior |
| --- | --- |
| `piggyback` | Uses an existing foreground Pi turn; no separate inference request |
| `local` | Runs one queued job at a time on an explicitly selected loopback model |
| `off` | Keeps coordination state but performs no model-backed interpretation |

Piggyback may add context tokens to the existing turn. Local mode is an in-memory
queue, not a persistent daemon.

## Essential commands

| Command | Effect |
| --- | --- |
| `/observer` | Open the Workbench |
| `/observer setup <ko\|en> <path>` | Initialize or select a Notebook |
| `/observer on` / `/observer off` | Toggle continuous observation |
| `/observer add-hypothesis <text>` | Preserve and review a user hypothesis |
| `/observer material <request>` | Start a bounded material review |
| `/observer material retry` / `cancel` | Resume or cancel the exact pending request |
| `/observer memo` | Reconcile working evidence into Memos |
| `/observer review` | Prepare a publication proposal |
| `/observer save` | Inspect and explicitly approve a prepared proposal |
| `/observer status` | Show Notebook, Episode, processing, and recovery state |

`ko` and `en` choose the language of newly written records, not the Workbench UI.
Observer never chooses a Notebook path on the user's behalf.

## Safe publication boundary

Saving is an all-or-nothing transaction:

```text
prepare final Markdown and full graph
-> show exact batch to the user
-> receive approval for that proposal ID
-> verify current target bytes
-> stage all records
-> publish all records
-> read back and validate the final Notebook
-> append SaveCommitted
```

Target drift, invalid Markdown, graph errors, a stale proposal, or failed readback
prevents settlement. Observer rolls back known writes when safe and reports a
recovery state rather than overwriting unknown changes.

## Documentation

- [Observer operating principles](./docs/how-it-works.md) — branch replay,
  capture windows, typed relations, staged commit, and publication
- [User guide](./docs/user-guide.md) — setup, commands, and recovery
- [Notebook publication](./docs/notebook-publication.md) — record rules and the
  save transaction

## Boundaries

Observer does not provide Git sync, backup, remote sharing, a vector database,
model truth, a crash-proof daemon, or multi-process Notebook coordination.

## Development

```sh
pnpm --filter @hobin/observer check
pnpm --filter @hobin/observer eval
pi -e ./packages/observer
```

## License

[MIT](./LICENSE)
