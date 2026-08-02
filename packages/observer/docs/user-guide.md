# Observer user guide

English | [한국어](./ko/user-guide.md)

## Create or select a Notebook

Open **Settings** in the Workbench or use a command:

```text
/observer setup ko ~/notes/observer
/observer setup en ./notes/observer
```

Path resolution is explicit:

| Input | Resolved location |
| --- | --- |
| `/absolute/path` | Used as written |
| `./notes` or `notes` | Relative to Pi's current working directory |
| `~` or `~/notes` | Relative to the current user's home directory |
| `~other-user/notes` | Rejected instead of guessed |

Observer shows the absolute path before creating or adopting a folder. Adopting
an existing folder does not rewrite unrelated files.

`ko` and `en` choose the language of newly saved Memo and Zettel records. They do
not change the Workbench UI or existing records.

## Workbench

```text
/observer
```

| View | Contents |
| --- | --- |
| Overview | Notebook health, mode, Episode, and next action |
| Activity | SourceReads, observations, material reviews, hypothesis reviews |
| Inquiries | Original wording, current hypothesis, and evidence |
| Memos | Complete working Memo content and relations |
| Proposal | Preparation state and existing/diff/final Markdown |
| Notebook | Saved records and exact Markdown |
| Settings | Notebook, language, and processing mode |

Main keys:

| Key | Action |
| --- | --- |
| `↑` / `↓`, `j` / `k` | Move |
| Enter | Inspect or run the current contextual action |
| Escape | Go back |
| Tab | Move between regions |
| Page Up / Page Down | Scroll |
| Home / End | Jump to beginning or end |
| `y` | Copy the complete selected record |
| `?` | Show help |

Opening, scrolling, and copying records is read-only.

## Collect evidence during ordinary work

```text
/observer on
```

Then use Pi normally. Observer holds current-run tool results as candidates. Only
results that the model nominates as materially relevant become SourceReads and
observations.

```text
/observer off
```

`off` stops new continuous observation. It does not delete the open Episode,
SourceReads, or Memos.

## Start from a user hypothesis

```text
/observer add-hypothesis Capture timing changes interpretation bias.
Context: The previous two cases diverged only after delayed note-taking.
```

The first line is preserved as the user's original wording. `Context:` remains
separate supporting context. Observer records supporting clues, challenging
clues, missing information, and an interpretation boundary. Insufficient
evidence never rewrites the original text.

## Review one bounded item

```text
/observer material <inline text, file path, URL, or retrieval request>
```

This works while continuous Sidecar mode is either on or off. For a file or URL,
only results from the exact agent run handling that request are eligible. The
command text is not treated as source content.

If processing stops before completion:

```text
/observer material retry
/observer material cancel
```

`retry` opens one more window for the same request. `cancel` ends the request but
keeps the Episode and Sidecar mode unchanged.

## Reconcile Memos

```text
/observer memo
```

Observer compares current SourceReads, observations, hypotheses, working Memos,
and explicitly related saved records. It may create, revise, merge, or keep
Memos.

This changes only Pi session working state. It does not write Notebook files.

## Review and Save

```text
/observer review
```

Observer first completes any required Memo work, then prepares a proposal showing
for every record:

- create or update operation;
- target path;
- existing Markdown;
- line diff;
- final Markdown; and
- current validation errors.

Preparation still writes nothing.

Press `s` from Proposal or run `/observer save` to open the approval view. The
choices are:

- **Back**: keep the proposal and leave;
- **Return to Review**: discard only the proposal;
- **Save all N records**: approve the exact complete batch.

There is no default approval and no partial-record save.

## Processing mode

```text
/observer processing piggyback
/observer processing local
/observer processing off
```

- `piggyback`: use the current foreground Pi model turn;
- `local`: use an in-memory queue on an explicitly selected loopback model;
- `off`: keep requests and candidate state but stop model interpretation.

Local mode verifies that the endpoint is actually `localhost`, `127.0.0.0/8`, or
`::1`. It does not trust model pricing metadata as evidence of locality.

## Status and recovery

```text
/observer status
```

| Status | Action |
| --- | --- |
| Material request suspended | `material retry` or `material cancel` |
| Proposal ready | Inspect Proposal, then Save |
| Proposal invalid after target drift | Return to Review and prepare from current files |
| Notebook moved or replaced during an Episode | Restore it or settle current work before selecting another |
| Local processing paused | Finish foreground work or change processing mode |
| Malformed branch history | Preserve diagnostics; do not force state mutation |

## Update and remove

```sh
pi update npm:@hobin/observer
pi remove npm:@hobin/observer
```

Use `pi install -l npm:@hobin/observer` for a project-local installation.
