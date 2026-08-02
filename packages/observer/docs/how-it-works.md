# How Observer works

English | [한국어](./ko/how-it-works.md)

Observer keeps two different kinds of state in different places:

- **current Pi branch:** working SourceReads, observations, hypotheses, and Memos;
- **user-selected Notebook:** reviewed Markdown records that completed Save.

Working interpretation is never written directly to the Notebook.

## 1. What `/observer on` does

Observer first recovers the selected Notebook and checks its path and manifest
against current session state.

If no Episode is open, it creates one and locks the Notebook's default language
for that Episode. It then changes continuous observation mode to `on`.

Episode and mode are separate. `/observer off` stops new continuous observation
but keeps the open Episode and its working evidence.

## 2. A tool result first becomes a candidate

While mode is on and an Episode is open, the extension stages tool results from
the current agent run. Candidate metadata includes call ID, tool name, arguments,
content, error status, and capture time.

A candidate is not yet an observation. Routine listings, repeated reads, write
acknowledgments, diagnostic boilerplate, and Observer's own tool results are
normally not nominated. Error results may explain missing evidence but cannot
become positive source material.

Unselected candidates expire when the agent run ends.

## 3. Piggyback uses the existing model turn

The default `piggyback` mode creates no separate model request. It adds a bounded
hidden context to a foreground Pi turn containing:

- tool results that may be nominated in this run;
- unfinished Observer requests for the current Episode;
- a small index of standing Inquiries and Memos; and
- the `observer_sidecar` tool.

The model nominates only exact tool-call IDs whose results materially support,
challenge, refine, or bound the inquiry. It submits at most one final
`observer-commit` for the run, and that tool call terminates without another
model turn.

## 4. Turn a candidate into a SourceRead and observation

Inside `observer-commit`, one proposed source follows this order:

1. confirm that each nominated call ID belongs to the current candidate window;
2. preserve candidate content and order in a `SourceRead`;
3. record whether the source is external material or direct observation;
4. attach provenance, a faithful summary, and exact claim locators;
5. optionally hydrate exact Inquiry IDs selected from the bounded standing index;
6. run a typed context check for the claimed Source/Inquiry relation; and
7. record a `supports`, `challenges`, `refines`, `boundary`, or `uncertain`
   observation.

A named evaluator can verify exact identity relations. Summary, stance, and
interpretation remain model assertions. A successful receipt does not prove the
interpretation true.

## 5. Commit the whole proposal or none of it

One `observer-commit` may include several SourceReads and observations,
hypothesis reviews, and either Memo preparation or Save preparation.

Observer applies the proposal to a staging port first. Every ID, context basis,
request, and branch must still match before all staged entries are appended.
Any stale or invalid part rejects the whole proposal.

Memo and Save preparation cannot share one commit because Save scope depends on
the completed Memo result.

## 6. Material review opens a separate capture window

```text
/observer material <request>
```

This command does not change Sidecar mode. It opens one exact request-bound
capture window. Inline text uses that user message as source material; a URL or
file uses only successful retrieval results from the run that starts or retries
the request.

If the run ends before all linked candidates become SourceReads and
observations, the request becomes suspended:

```text
/observer material retry
/observer material cancel
```

`retry` opens one more window for the same request. `cancel` ends that request
without closing the Episode.

## 7. Preserve a user hypothesis separately

```text
/observer add-hypothesis <text>
```

The original wording is stored with `origin: user`. Observer records supporting
clues, challenging clues, missing information, and an interpretation boundary
separately. Insufficient context is valid and never rewrites the original text.

## 8. Memo reconciliation stays in the session

`/observer memo` creates a request over current SourceReads, observations,
hypotheses, working Memos, and explicitly related standing records.

The model proposes create, revise, merge, or keep outcomes and must cover the
whole requested scope. If the proposal still matches the current basis, Observer
applies one prepared pass and records its lifecycle acknowledgment.

No Notebook file is written at this stage.

## 9. Review prepares exact Markdown

`/observer review` first completes any required Memo work, then prepares exact
create/update Markdown from current working state.

Preparation binds target paths and existing bytes, validates every document,
validates the complete final record graph, and binds Notebook, Episode, language,
record set, and final Markdown into one proposal ID.

The Workbench shows existing content, diff, and final Markdown. Files are still
unchanged. See [Notebook publication](./notebook-publication.md) for the Save
transaction.

## Processing modes

| Mode | Actual behavior |
| --- | --- |
| `piggyback` | Inject bounded hidden Observer context into a foreground turn |
| `local` | Use an in-memory queue with one explicitly selected loopback model |
| `off` | Keep candidate/request coordination without model interpretation |

The local queue runs one job at a time and yields to foreground input. It is lost
when the process exits. Loopback status is established from the endpoint, not
model price metadata.
