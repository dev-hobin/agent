# @hobin/observer

Observer is a local-first inquiry sidecar for [Pi](https://pi.dev). It follows standing questions across source material, keeps working observations and memos in the current Pi session, and saves approved, source-linked Markdown to a notebook you choose.

Observer supports three entry paths:

- **Sidecar:** keep observation on while doing other work.
- **Add a hypothesis:** preserve a user idea, then review the current Pi context through it as a lens.
- **Observe material:** inspect supplied or retrieved material without changing Observer Mode.

All three paths use the same Episode and Memo flow. Review prepares an inspectable proposal; Save is a separate explicit approval and persistence step.

## Install

Requires Node.js 22.19 or newer. The 0.1.x compatibility window is Pi 0.80.10 through 0.82.x; release checks exercise Pi 0.80.10, 0.81.1, and 0.82.1.

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
→ turn Observer On, add a hypothesis, or observe material
→ work normally
→ run Memo when you want an interim reconciliation
→ run Review to reconcile pending work and prepare a proposal
→ run Save only after inspecting the proposal
```

Use ↑/↓ and Enter to navigate; Esc always returns to Pi. The same surface
exposes **Add a hypothesis**, **Observe material**, **Default output language**,
and a detailed health view without requiring users to remember subcommands.
Observer On/Off is a toggle; language is not. Enter on the language row opens
an explicit `English (en)` / `Korean (ko)` chooser with the current choice
preselected. On/Off and language changes update in place without closing and
reopening the control center. The footer and small widget stay hidden while
Observer is idle, including before Notebook setup. They appear only while
observation is active, an Episode is preserved, or review or recovery needs
attention.

Observer never chooses a Notebook path for you. Setup accepts either an absolute path or a path relative to Pi's current working directory. The TUI shows the resolved path and default output language with a safe **Go back** default before it initializes a new folder or adopts an existing one without rewriting unrelated files. Direct commands remain available:

```text
/observe setup ko /Users/me/notes/observer
/observe setup en ./notes/observer
/observe status
```

`ko` and `en` select the language used when Observer writes new Memo and Zettel Markdown; they do not change the control-center UI language. `/observe settings` opens the same control center. Language changes apply immediately without replacing the open Episode. Work that was already prepared keeps the language locked in its review scope, and existing Markdown keeps its own language. Do not move or replace the selected Notebook while an Episode is open.

## Sidecar workflow

Turn observation on, then work with Pi normally:

```text
/observe on
```

Read documents, inspect code, retrieve webpages, or discuss a question. Observer stages selected source candidates, SourceReads, optional Standing Inquiry hydration, semantic observations, and user hypotheses on the current Pi branch. A normal tool execution is only eligible evidence: it is not copied into Observer state. During the same agent run, the model may nominate an exact tool-call ID with a specific evidence, counterexample, boundary, or Inquiry/Memo relevance reason. Only that explicit nomination promotes the original Pi tool result to an Observer candidate. Routine navigation, listings, write acknowledgements, repeated reads, and diagnostics remain unselected and create no Observer event. Unselected references disappear when the agent run ends or new user input arrives.

Oversized nominated results are split into ordered bounded segments, preserving all selected text instead of dropping the middle or producing a profile error. Repeated nomination of the same tool result and content resumes the existing candidates rather than duplicating them. Explicit retrieved `/observe material` is the exception: its bounded active retrieval run captures successful exact tool results automatically because the user requested that material directly.

Routine successful `observer_sidecar` protocol calls render no transcript row in the TUI. Failures, recovery state, explicit receipts, and Major notifications remain visible. Pi session history still retains ordinary tool messages for model continuity and audit, while Observer protocol entries exist only for nominated or explicitly requested material. Visual quietness is presentation, not deletion of the underlying Pi session log.

Reconcile the current working material without writing notebook Markdown:

```text
/observe memo
```

When the current inquiry is ready for durable review:

```text
/observe review
```

Review completes one final Memo pass when needed and prepares the exact Notebook proposal. It never writes Notebook files and stops after the proposal is ready. Inspect the working Memo and Inquiry state in **Status and health**, then run:

```text
/observe save
```

Save opens a bounded proposal viewer. Review each target path and exact final Markdown; updates open on a line diff and can switch to the existing or final document. **Back** keeps the validated proposal ready, **Return to Review** discards only the proposal while preserving working state, and **Save all N records** is the only action that writes. Save revalidates the whole batch, writes, reads back, and settles the Episode. There is no default `Yes` action and partial batch saves are not supported.

Turn observation off without discarding an open Episode:

```text
/observe off
```

## Add a hypothesis workflow

Add a hypothesis immediately preserves the user's wording and optional rationale, then triggers a model-owned first review of the visible Pi context and current Episode working state through that hypothesis as a lens:

```text
/observe add-hypothesis The order of capture changes interpretation bias.
Context: The last two examples diverged only after delayed note-taking.
```

The context line is optional. User context remains distinct from Observer interpretation. The first review records supporting clues, challenging clues, missing information, genuine Source references when available, and an explicit interpretation boundary. Insufficient context is valid: it never removes or rewrites the user's original hypothesis. Memo reconciliation waits until this initial context review completes.

## Observe material workflow

Observe material is independent of continuous Observer Mode. It works while Mode is On or Off and preserves that setting. Use the control center or the scriptable slash subcommand:

```text
/observe material <inline material, path, URL, or retrieval request>
```

For a path or URL, Pi must retrieve the material first. The instruction itself is not treated as source evidence. Retrieved tool results are linked only during the agent run that starts or explicitly retries that exact Observe material request. When that run settles—or unrelated user input arrives—the retrieval window closes while the request remains visibly suspended. Later technical-reading tools are therefore ignored when continuous Mode is Off, or become nomination-eligible references only for their own active agent run when Mode is On; they are never silently captured or attached to the stale material request.

If processing stops before completion, use:

```text
/observe material retry
/observe material cancel
```

`retry` resumes the exact pending request for one bounded agent run without creating another request. `cancel` records an explicit cancellation while preserving Observer Mode and the open Episode. Status and the control center show the request ID, coverage phase, capture-window state, and both recovery actions. Review is unavailable until the pending material review is completed or cancelled, preventing Episode settlement from stranding the request.

Inline user material may be used as an exact user-message source candidate.

A completed Observe material pass:

- leaves Observer Mode unchanged;
- opens or reuses the selected notebook's open Episode;
- requires every request-linked candidate to reach a SourceRead and semantic Observation;
- can continue through `/observe memo`, `/observe review`, and `/observe save` using the same separated review and persistence rules as Sidecar.

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
| `/observe add-hypothesis <text>` | Preserve a user hypothesis and trigger its initial current-context review |
| `/observe material <request>` | Observe inline or retrieved material without changing Observer Mode |
| `/observe material retry` | Resume the exact pending material review for one bounded agent run |
| `/observe material cancel` | Cancel the pending material review while preserving Mode and Episode |
| `/observe memo` | Reconcile current working observations without preparing or writing Markdown |
| `/observe review` | Reconcile pending work and prepare an inspectable proposal without file writes |
| `/observe save` | Inspect and approve an already prepared proposal, then persist and settle |

`add-hypothesis` and `material` are command-first flows, not TUI-only shortcuts.
Scripts may submit these exact `/observe` strings through Pi print or RPC input;
no control-center selection is required.

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
Markdown is rejected before graph integrity checks. Review validates the final
Notebook graph before a proposal becomes ready. Save revalidates the current
target, then follows explicit batch approval → write → readback validation →
settlement ordering.

The code keeps the product operation and its persistence mechanism separate.
`SaveService` owns Review-time and Save-time preflight, the approved Save
contract, lifecycle checks, target recovery, and public receipt. Its injected
`NotebookPublicationService` owns record
planning, atomic publication, readback, and rollback. Notebook publication is an
internal persistence process, not a command, model action, or public protocol.

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
