# Observer operating principles

English | [한국어](./ko/how-it-works.md)

Observer is not a recorder that copies tool output directly into notes. Working
evidence and interpretation remain branch-local Pi events; only reviewed exact
Markdown crosses a separate publication transaction into the Notebook.

Each representation has a different meaning:

```text
Tool result
→ Candidate
→ SourceRead
→ Observation or hypothesis review
→ working Memo
→ PreparedSave
→ user approval
→ Notebook record + SaveCommitted
```

A previous stage never implies the next one. A Candidate is not a source, a
SourceRead is not an interpretation, and a Memo is not yet a Notebook record.

## 1. The session branch and Notebook have different state ownership

| Location | Values owned | Lifetime |
| --- | --- | --- |
| Current Pi branch | Episode, mode, Candidate, SourceRead, Observation, hypothesis, working Memo, prepared proposal | While branch entries can be replayed |
| User-selected Notebook | Source, Inquiry, Memo, and Zettel Markdown | After publication and exact readback |

Extension commands and sidecar actions first append typed custom entries to the
current branch. The runtime reparses branch ancestry and applies entries through
pure transitions or reconstruction functions to obtain current snapshots.

Notebook files are not continuously edited as working session state. Session
Memos are not treated as durable records. That boundary prevents in-progress or
failed model interpretation from leaking automatically into the Notebook.

## 2. Mode and Episode are orthogonal

`mode` controls continuous observation. An `Episode` identifies the current
inquiry unit.

- `/observer on` validates Notebook identity, opens an Episode when needed, and
  changes mode to `on`.
- `/observer off` stops new continuous capture and interpretation.
- The open Episode and existing SourceReads, Observations, and Memos remain.
- Material review and explicit user hypotheses can operate in an open Episode
  while continuous mode is off.

An Episode can be empty, open, reviewing a save, or settled. Preparing a save
does not settle it. The exact proposal must be published and read back before a
`SaveCommitted` event can move it to settled state.

## 3. Branch entries decode as typed streams, not permissive JSON

Observer decodes lifecycle, observation, Memo, Save, and processing-policy values
through separate protocols. Each event kind has exact required and allowed keys.

Observation replay independently checks that:

- a Candidate came from a live Episode and authorized capture window;
- a SourceRead consumes exact unused Candidates;
- hydration names an existing SourceRead and standing-index digest;
- a semantic observation names valid SourceRead and optional hydration values;
- a Memo request covers the current unconsumed observation set.

Malformed or misordered entries become replay issues instead of being merged
into guessed state. Entries from a sibling branch cannot support the current
snapshot.

## 4. Candidate capture is a bounded nomination window

During a continuous agent run, Observer may stage tool results with exact call
ID, tool name, arguments, content, status, and capture time.

A Candidate exists so that the model can nominate stable content briefly. It is
not immediately an observation because:

- routine listings and acknowledgments rarely change an inquiry;
- retaining every repeated read would count the same evidence repeatedly;
- an error may explain missing evidence but cannot create positive source
  assurance; and
- observing Observer's own tool results would create self-amplifying loops.

Unselected ordinary Candidates expire as nomination options when the agent run
ends. Material-review Candidates are instead bound to a request and attempt and
follow retry or cancellation rules.

## 5. Processing mode changes scheduling, not domain meaning

| Mode | Scheduling mechanism | Persistence |
| --- | --- | --- |
| `piggyback` | Add bounded hidden context and `observer_sidecar` to the current foreground model turn | Current turn |
| `local` | Run jobs one at a time through an explicitly selected loopback model | Current process |
| `off` | Keep Candidate and request coordination without model interpretation | Session entries only |

Piggyback creates no separate inference request. The model nominates exact
tool-call IDs and submits at most one final `observer-commit`. That call
terminates without a follow-up model turn.

The local queue has bounded capacity, rejects duplicate job IDs, and runs one job
at a time. Foreground input aborts and requeues the active same-epoch job so that
interactive work wins. The queue disappears with the process; it is neither a
daemon nor a durable scheduler.

Local-model admission checks for a loopback endpoint rather than trusting price
metadata. A remote endpoint labelled free does not qualify as local.

## 6. SourceRead binds source identity and faithful capture

After the model nominates Candidates, the observation controller confirms exact
Candidate IDs and current capture ancestry. It then preserves content and order
in one reading and records:

- external-material or direct-observation source kind;
- provenance such as URI, revision, and content hash;
- a faithful summary;
- claims with exact locators; and
- a new `SourceReadId`.

This stage fixes what was read. It does not yet decide what the reading means for
an Inquiry. A successful SourceRead receipt also does not prove the summary true.

## 7. An Observation is a typed Source–Inquiry relation

To relate a reading to standing work, the model selects exact Inquiry IDs from a
bounded index and hydrates only those records. Hydration is bound to both the
index digest and SourceRead.

Context assessment then checks that:

- SourceRead and optional Inquiry context belong to the same current basis;
- related Inquiry IDs agree with hydration;
- required source/inquiry identity relations hold; and
- conflicts or missing context remain explicit.

Only then can the model record `supports`, `challenges`, `refines`, `boundary`, or
`uncertain`.

Observer uses Judgment primitives inside these typed assessments but exposes no
generic Judgment session. Named evaluators establish domain identity relations
such as source ID, Inquiry ID, and content identity. Stance, movement, and
rationale remain `agent-asserted` interpretation.

## 8. User hypotheses separate original wording from review

`/observer add-hypothesis` stores exact user wording with `origin: user`.
Observer may add a separate context review containing supporting clues,
challenging clues, missing information, an interpretation boundary, and related
Source IDs.

Weak evidence never authorizes rewriting the original into a more convenient
claim. `insufficient-context` is a valid review result.

## 9. `observer-commit` applies atomically over a branch fingerprint

A Piggyback proposal can include observations, hypothesis reviews, and either
Memo preparation or Save preparation. Observer does not append these directly
to the live session while validating them.

It copies current branch entries, computes a fingerprint, and creates a staging
port. Every controller action runs against the staged virtual branch. After all
Episode, Candidate, hydration, context-basis, request, and identity checks pass,
Observer:

1. compares the live branch fingerprint with the starting fingerprint;
2. appends staged custom entries in order; and
3. applies staged notifications and status updates.

Any failed member or branch drift leaves the live session unchanged. Memo and
Save cannot share one commit because Save scope depends on the completed Memo
result.

## 10. Memo reconciliation rewrites working synthesis

`/observer memo` takes exact scope over current SourceReads, Observations,
user/observer hypotheses, working Memos, and explicitly related standing records.

The model must account for every scoped item through create, revise, merge, or
keep outcomes and name the evidence IDs behind each result. Preparation derives
an instruction from the current basis; apply executes the whole instruction as
one domain transition.

The resulting Memo remains branch-local working synthesis. It does not overwrite
a standing Notebook Memo automatically.

## 11. Review creates an exact publication proposal, not files

`/observer review` first completes required Memo reconciliation, then renders
final Markdown for each create or update from current working state.

Preparation binds all of the following into proposal identity:

- Notebook and Episode identities;
- target paths and current byte hashes;
- operation and record IDs;
- parsed document schemas;
- the complete record graph after applying the batch; and
- final Markdown bytes.

Workbench existing, diff, and final views come from that exact proposal. Opening
or inspecting them performs no write. Publication can start only after the user
approves the whole batch under the same proposal ID.

## 12. Notebook publication ends with stage, publish, and readback

Records are not individually reported as complete:

```text
verify preflight snapshot
→ acquire Notebook transaction directory
→ stage every next content and before image
→ recheck target inventory drift
→ atomic create/replace each record
→ verify final inventory and byte readback
→ remove transaction directory
→ append SaveCommitted
```

An existing active transaction directory means another or interrupted save may
exist and requires recovery. If publication fails, Observer rolls back known
published entries from their before images.

A rollback or cleanup failure is surfaced as `recoveryRequired`. Observer also
avoids overwriting bytes changed by another process when restoring a before
image would be unsafe.

`SaveCommitted` is appended only after readback exactly matches the proposal. A
prepared proposal, user approval, or partial file publication is never durable
completion.

## 13. Three atomic boundaries protect different owners

| Boundary | State protected | Partial result not exposed |
| --- | --- | --- |
| `observer-commit` | Current Pi branch proposal | A subset of SourceReads or Observations |
| Memo apply | Working inquiry synthesis | A partially reconciled Memo scope |
| Notebook publication | Local Markdown record set | A partially completed Save batch |

They are separate because ownership and recovery differ. Branch-fingerprint
staleness and filesystem rollback are not the same failure problem.

Observer guarantees these boundaries and provenance. It does not guarantee
source truth, model correctness, or safe concurrent Notebook mutation by
multiple processes.
