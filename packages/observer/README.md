# @hobin/observer

> **Development status:** `0.1.6` is a private patch candidate. Context-basis
> replay, sidecar workflows, and the Pi 0.80.10–0.83.0 source/packed matrix are
> green. Publication still requires explicit approval.

Observer is a local-first inquiry sidecar for [Pi](https://pi.dev). It follows standing questions across source material, keeps working observations and memos in the current Pi session, and saves approved, source-linked Markdown to a notebook you choose.

Observer supports three entry paths:

- **Sidecar:** keep observation on while doing other work.
- **Add a hypothesis:** preserve a user idea, then review the current Pi context through it as a lens.
- **Observe material:** inspect supplied or retrieved material without changing Observer Mode.

All three paths use the same Episode and Memo flow. Review prepares an inspectable proposal; Save is a separate explicit approval and persistence step.

## Install

Requires Node.js 22.19 or newer. Observer `0.1.6` targets Pi 0.80.10 through
0.83.x; the release check reruns package and clean-tree gates.

```sh
pi install npm:@hobin/observer
```

Try it for one run without installing:

```sh
pi -e npm:@hobin/observer
```

Run `pi list` to confirm that the package is available.

## Start in the inquiry workbench

In Pi's TUI, run `/observer` with no arguments. It opens a keyboard-first, read-only workbench over the current Observer branch:

```text
/observer
├─ Overview        Mode, Episode, processing, health, next publication state
├─ Activity        SourceReads, semantic Observations, and hypothesis reviews
├─ Inquiries       Original and current hypotheses with evidence
├─ Memos           Complete working Memo content and relations
├─ Proposal        Preparing scope or validated Diff/final/existing Markdown
├─ Notebook        Existing saved records and exact Markdown
└─ Settings        Notebook, On/Off, language, and processing policy
```

The Workbench is a screen-relative viewport; it does not rely on terminal
scrollback. Use ↑/↓ or `j/k` to move, Enter to inspect, Tab to move between
sections and content, PageUp/PageDown or Home/End to scroll, `y` to copy the
focused semantic selection, `?` for contextual help, and Esc to return one
level. Copying a section yields its identity; copying an item or detail yields
the complete unwrapped record without borders, neighboring panes, terminal
styling, or viewport truncation. Pi does not yet expose extension-scoped wheel
capture, so Observer does not take over the mouse globally; native terminal drag
selection therefore remains screen-wide rather than pane-bounded. Wide terminals
show stable section and content panes together; narrow terminals use list/detail
navigation. Opening and copying a record is always read-only. Contextual keys
expose only legal actions—for example `r` in Proposal to prepare Review and `s`
only for a ready Save batch.

Settings is secondary to inquiry state. `/observer settings` opens it directly;
Esc returns to the workbench. Observer On/Off is a toggle; language is not.
Enter on the language row opens an explicit `English (en)` / `Korean (ko)`
chooser with the current choice preselected. On/Off and language changes update
in place. The footer and small widget stay hidden while Observer is idle,
including before Notebook setup and when only a remembered Notebook selection
needs recovery. Notebook health remains inspectable in the workbench. Ambient
status appears only while observation is active, an Episode or explicit request
is preserved, or active work needs recovery.

Observer never chooses a Notebook path for you. Setup distinguishes absolute paths, paths relative to Pi's current working directory, and `~` / `~/…` paths relative to your home directory. For example, `~/coding/archive` resolves to `$HOME/coding/archive`; it is never treated as a literal `~` folder under the current project. `~user/…` syntax is rejected rather than guessed. The TUI shows both the input kind and resolved absolute path, with a safe **Go back** default, before it initializes a new folder or adopts an existing one without rewriting unrelated files. The selected Notebook is then stored and locked as its canonical absolute path for Review and Save. Direct commands remain available:

```text
/observer setup ko /Users/me/notes/observer
/observer setup en ./notes/observer
/observer status
```

`ko` and `en` select the language used when Observer writes new Memo and Zettel Markdown; they do not change the workbench UI language. `/observer settings` opens the Settings surface directly and returns to the workbench on Esc. Language changes apply immediately without replacing the open Episode. Work that was already prepared keeps the language locked in its review scope, and existing Markdown keeps its own language. Do not move or replace the selected Notebook while an Episode is open.

## Sidecar workflow

For normal interactive use, the only command you need to remember is `/observer`. It opens one workbench for current inquiry state, saved Notebook records, setup, Memo, Review, proposal inspection, and recovery. Scriptable subcommands remain available for RPC and advanced use.

Open the workbench, enter Settings to turn Observer on, then work with Pi normally:

```text
/observer
```

Read documents, inspect code, retrieve webpages, or discuss a question. Observer stages selected source candidates, SourceReads, optional Standing Inquiry hydration, semantic observations, and user hypotheses on the current Pi branch. A normal tool execution is only eligible evidence: it is not copied into Observer state. During the same agent run, the model may nominate an exact tool-call ID with a specific evidence, counterexample, boundary, or Inquiry/Memo relevance reason. Only that explicit nomination promotes the original Pi tool result to an Observer candidate. Routine navigation, listings, write acknowledgements, repeated reads, and diagnostics remain unselected and create no Observer event. Unselected references disappear when the agent run ends or new user input arrives.

Oversized nominated results are split into ordered bounded segments, preserving all selected text instead of dropping the middle or producing a profile error. Repeated nomination of the same tool result and content resumes the existing candidates rather than duplicating them. Explicit retrieved `/observer material` is the exception: its bounded active retrieval run captures successful exact tool results automatically because the user requested that material directly.

Observation interpretation and Memo reconciliation use adapter-owned typed
domain contracts rather than authored `judgment.json`. Observer has no
conditional packaged references and therefore owns no authoring policy. Refined
`SourceReading`, `InquiryContext`, Memo scope, and parser-refined pass values
become exact domain material. Observer's named evaluators establish only declared
source/inquiry identity and memo relations with `domain-verified` assurance;
semantic stance and movement remain `agent-asserted`, and user-owned policy
requires an explicit user event. Coverage is assessed before
`appendObservation` or Memo preparation. Missing or conflicting context blocks
semantic mutation. Compact `ContextBasisData` travels in `observer_sidecar`
details without copying source content or generic Judgment event lists.

The public sidecar sequence is `record-source-reading`, optional
`load-inquiry-context`, then `record-observation` (or the distinct independent
hypothesis action). Persisted Observer v1 source-read and hydration event IDs stay
readable; the vocabulary change does not rewrite user-owned Notebook data.

The default **Piggyback** policy never creates a separate model session or provider request. Observer stages candidates locally, injects bounded pending work into an existing foreground model turn, and permits at most one final `observer-commit`. One commit can combine meaning-bearing tool-result nominations, SourceRead, optional Inquiry hydration, semantic records, hypothesis context reviews, and one currently scoped Memo or proposal preparation. All resulting session entries are staged and validated together, then the current Observer branch is revalidated immediately before serialized append. A proposal rejected before that boundary appends none of its staged entries and is not retried in the same run. The tool terminates without a follow-up model request; a Save stage that depends on a newly completed Memo waits for a later ordinary turn. The tool schema and bounded context add some tokens to that existing request, so Piggyback means “no additional inference request,” not literally zero token overhead.

**Off** keeps local candidate staging but performs no model-backed interpretation. **Local background** is opt-in and can select only a Pi model whose endpoint is loopback (`localhost`, `127.0.0.0/8`, or `::1`). Cost metadata alone is never trusted as evidence that a model is local. The local worker remains concurrency one, yields to foreground input, validates actions, and does not retry a rejected action in the same run.

Open the Memos section and press `m` to reconcile current working material without writing Notebook Markdown. Open Proposal and press `r` when the inquiry is ready for durable review. Under Piggyback, an explicit Memo or Review starts one user-requested foreground turn; if Review still needs a later proposal-preparation stage, that stage waits for the next ordinary model turn rather than silently starting another request. Local background can continue it on the selected loopback model.

No files are written during preparation. The Proposal section shows the locked request scope and processing wait reason without presenting partial model output as valid Markdown. When the proposal is ready, Observer's status and widget say **proposal ready for your review**. Open `/observer`, inspect each Proposal record's Diff, exact proposed Markdown, and existing Markdown, then press `s` to enter the separate bounded approval viewer. The scriptable `/observer save` command remains available for automation.

The proposal viewer lets you inspect every target path and exact final Markdown. Review each target path and exact final Markdown; updates open on a line diff and can switch to the existing or final document. **Back** keeps the validated proposal ready, **Return to Review** discards only the proposal while preserving working state, and **Save all N records** is the only action that writes. Save revalidates the whole batch, writes, reads back, and settles the Episode. There is no default `Yes` action and partial batch saves are not supported.

Turn observation off without discarding an open Episode:

```text
/observer off
```

## Add a hypothesis workflow

Add a hypothesis immediately preserves the user's wording and optional rationale, then triggers a model-owned first review of the visible Pi context and current Episode working state through that hypothesis as a lens:

```text
/observer add-hypothesis The order of capture changes interpretation bias.
Context: The last two examples diverged only after delayed note-taking.
```

The context line is optional. User context remains distinct from Observer interpretation. The first review records supporting clues, challenging clues, missing information, genuine Source references when available, and an explicit interpretation boundary. Insufficient context is valid: it never removes or rewrites the user's original hypothesis. Memo reconciliation waits until this initial context review completes.

## Observe material workflow

Observe material is independent of continuous Observer Mode. It works while Mode is On or Off and preserves that setting. Use `o` in the Activity section or the scriptable slash subcommand:

```text
/observer material <inline material, path, URL, or retrieval request>
```

For a path or URL, Pi must retrieve the material first. The instruction itself is not treated as source evidence. Retrieved tool results are linked only during the agent run that starts or explicitly retries that exact Observe material request. When that run settles—or unrelated user input arrives—the retrieval window closes while the request remains visibly suspended. Later unrelated tool results are therefore ignored when continuous Mode is Off, or become nomination-eligible references only for their own active agent run when Mode is On; they are never silently captured or attached to the stale material request.

If processing stops before completion, use:

```text
/observer material retry
/observer material cancel
```

`retry` resumes the exact pending request for one bounded agent run without creating another request. `cancel` records an explicit cancellation while preserving Observer Mode and the open Episode. Status and the workbench show the request ID, coverage phase, capture-window state, and both recovery actions. Review is unavailable until the pending material review is completed or cancelled, preventing Episode settlement from stranding the request.

Inline user material may be used as an exact user-message source candidate.

A completed Observe material pass:

- leaves Observer Mode unchanged;
- opens or reuses the selected notebook's open Episode;
- requires every request-linked candidate to reach a SourceRead and semantic Observation;
- continues through the same Memo, Review, and proposal-approval controls as Sidecar.

Model/provider behavior is stochastic. Completion receipts prove one recorded request chain, not semantic truth or a provider reliability rate.

## Commands

| Command | Effect |
| --- | --- |
| `/observer` | Open the TUI inquiry workbench; show status outside TUI mode |
| `/observer settings` | Open Settings directly, then return to the workbench on Esc |
| `/observer setup` | Open interactive notebook setup |
| `/observer setup <ko\|en> <path>` | Initialize or select a Notebook; relative paths resolve from Pi's working directory |
| `/observer status` | Show notebook, Mode, Episode, and recovery status |
| `/observer on` | Enable Sidecar observation for the open Episode |
| `/observer off` | Disable Sidecar observation without settling the Episode |
| `/observer add-hypothesis <text>` | Preserve a user hypothesis and trigger its initial current-context review |
| `/observer material <request>` | Observe inline or retrieved material without changing Observer Mode |
| `/observer material retry` | Resume the exact pending material review for one bounded agent run |
| `/observer material cancel` | Cancel the pending material review while preserving Mode and Episode |
| `/observer processing off` | Keep local staging but disable model-backed interpretation |
| `/observer processing piggyback` | Default; use existing foreground turns without a separate model request |
| `/observer processing local` | Select an available loopback Pi model for concurrency-one background work |
| `/observer memo` | Reconcile current working observations without preparing or writing Markdown |
| `/observer review` | Reconcile pending work and prepare an inspectable proposal without file writes |
| `/observer save` | Inspect an already prepared proposal before explicit persistence approval |

`add-hypothesis` and `material` are command-first flows, not TUI-only shortcuts.
Scripts may submit these exact `/observer` strings through Pi print or RPC input;
no workbench selection is required.

## Durable data and boundaries

Observer Markdown Profile v1 is the durable source of truth. Pi events and
working session entries provide branch-local coordination and replay; they do
not replace the notebook.

Observer owns local Source, Inquiry, Memo, and Zettel persistence. Compact
context bases are branch coordination and provenance, not durable Notebook
records. Observer does not own:

- Git, GitHub, remote sync, or backup;
- graph or vector databases;
- subagents, long-lived daemons, or externally managed background jobs;
- crash/power-loss durability or concurrent multi-instance coordination;
- model semantic truth.

Piggyback uses no separate AgentSession. When explicitly enabled, the bounded in-memory AgentSession is restricted to the selected loopback model and is an internal scheduling lane, not an independently durable worker or source of truth.

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

- [Observer Runtime Flow](docs/runtime-flow.md)
- [Observer v0.1 product specification (Korean)](docs/product-spec-v0.1.ko.md)

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
